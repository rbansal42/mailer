// server/src/services/backup.test.ts
import { describe, test, expect, mock, beforeEach } from 'bun:test'

// Mock fs module
const mockReaddirSync = mock((_path: string) => [] as string[])
const mockUnlinkSync = mock((_path: string) => {})
const mockStatSync = mock((_path: string) => ({ size: 1024, mtime: new Date() }))
const mockExistsSync = mock((_path: string) => true)
const mockMkdirSync = mock((_path: string, _options?: object) => {})

mock.module('fs', () => ({
  readdirSync: mockReaddirSync,
  unlinkSync: mockUnlinkSync,
  statSync: mockStatSync,
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync
}))

// Mock db module (queryOne, execute for settings)
const mockQueryOne = mock(async (_sql: string, _params?: unknown[]) => null as { value: string } | null)
const mockExecute = mock(async (_sql: string, _params?: unknown[]) => ({ rowsAffected: 1, lastInsertRowid: undefined }))

mock.module('../db', () => ({
  queryOne: mockQueryOne,
  execute: mockExecute,
  safeJsonParse: (value: unknown, fallback: unknown) => {
    if (value == null) return fallback
    if (typeof value === 'object') return value
    if (typeof value === 'string') {
      if (value === '') return fallback
      try { return JSON.parse(value) } catch { return fallback }
    }
    return fallback
  }
}))

// Mock logger to suppress output during tests
mock.module('../lib/logger', () => ({
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {}
  }
}))

// Import after mocking
import {
  listBackups,
  pruneBackups,
  getBackupSettings,
  saveBackupSettings
} from './backup'

describe('backup service', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    mockReaddirSync.mockClear()
    mockUnlinkSync.mockClear()
    mockStatSync.mockClear()
    mockExistsSync.mockClear()
    mockMkdirSync.mockClear()
    mockQueryOne.mockClear()
    mockExecute.mockClear()

    // Default: files exist
    mockExistsSync.mockImplementation(() => true)
  })

  // Note: createBackup and restoreBackup are async and use Bun.spawn with pg_dump/pg_restore.
  // They require a real PostgreSQL connection and pg_dump/pg_restore binaries, so they
  // are not unit-testable with mocks alone — they should be covered by integration tests.

  describe('listBackups', () => {
    test('returns empty array when backup directory does not exist', () => {
      mockExistsSync.mockImplementation(() => false)

      const backups = listBackups()

      expect(backups).toEqual([])
    })

    test('filters for mailer_*.dump files only', () => {
      const now = new Date()
      mockReaddirSync.mockImplementation(() => [
        'mailer_2024-01-15_10-30.dump',
        'other_file.dump',
        'mailer_2024-01-14_08-00.dump',
        'readme.txt',
        'mailer_2024-01-13.db' // old .db format should be excluded
      ])
      mockStatSync.mockImplementation(() => ({ size: 1024, mtime: now }))

      const backups = listBackups()

      expect(backups).toHaveLength(2)
      expect(backups.map(b => b.filename)).toEqual([
        'mailer_2024-01-15_10-30.dump',
        'mailer_2024-01-14_08-00.dump'
      ])
    })

    test('sorts backups by date newest first', () => {
      const oldDate = new Date('2024-01-01')
      const newDate = new Date('2024-01-15')

      mockReaddirSync.mockImplementation(() => [
        'mailer_2024-01-01_10-00.dump',
        'mailer_2024-01-15_10-00.dump'
      ])
      mockStatSync.mockImplementation((path: string) => {
        if (path.includes('2024-01-01')) {
          return { size: 1024, mtime: oldDate }
        }
        return { size: 2048, mtime: newDate }
      })

      const backups = listBackups()

      expect(backups[0].filename).toBe('mailer_2024-01-15_10-00.dump')
      expect(backups[1].filename).toBe('mailer_2024-01-01_10-00.dump')
    })

    test('includes file size and date in backup info', () => {
      const testDate = new Date('2024-06-15T12:00:00Z')
      mockReaddirSync.mockImplementation(() => ['mailer_2024-06-15_12-00.dump'])
      mockStatSync.mockImplementation(() => ({ size: 5120, mtime: testDate }))

      const backups = listBackups()

      expect(backups[0]).toEqual({
        filename: 'mailer_2024-06-15_12-00.dump',
        size: 5120,
        date: testDate
      })
    })
  })

  describe('pruneBackups', () => {
    test('throws error on negative keepCount', () => {
      expect(() => pruneBackups(-1)).toThrow('keepCount must be non-negative')
    })

    test('keeps correct number of backups', () => {
      const dates = [
        new Date('2024-01-15'),
        new Date('2024-01-14'),
        new Date('2024-01-13'),
        new Date('2024-01-12'),
        new Date('2024-01-11')
      ]

      mockReaddirSync.mockImplementation(() => [
        'mailer_2024-01-15_10-00.dump',
        'mailer_2024-01-14_10-00.dump',
        'mailer_2024-01-13_10-00.dump',
        'mailer_2024-01-12_10-00.dump',
        'mailer_2024-01-11_10-00.dump'
      ])
      mockStatSync.mockImplementation((path: string) => {
        const idx = dates.findIndex((_, i) => path.includes(`2024-01-${15 - i}`))
        return { size: 1024, mtime: dates[idx >= 0 ? idx : 0] }
      })

      const deleted = pruneBackups(2)

      // Should delete 3 oldest backups
      expect(deleted).toBe(3)
      expect(mockUnlinkSync).toHaveBeenCalledTimes(3)
    })

    test('deletes nothing when keepCount >= backup count', () => {
      mockReaddirSync.mockImplementation(() => [
        'mailer_2024-01-15_10-00.dump',
        'mailer_2024-01-14_10-00.dump'
      ])
      mockStatSync.mockImplementation(() => ({ size: 1024, mtime: new Date() }))

      const deleted = pruneBackups(5)

      expect(deleted).toBe(0)
      expect(mockUnlinkSync).not.toHaveBeenCalled()
    })

    test('handles keepCount of 0', () => {
      mockReaddirSync.mockImplementation(() => [
        'mailer_2024-01-15_10-00.dump',
        'mailer_2024-01-14_10-00.dump'
      ])
      mockStatSync.mockImplementation(() => ({ size: 1024, mtime: new Date() }))

      const deleted = pruneBackups(0)

      expect(deleted).toBe(2)
      expect(mockUnlinkSync).toHaveBeenCalledTimes(2)
    })
  })

  describe('getBackupSettings', () => {
    test('returns defaults when no settings exist', async () => {
      mockQueryOne.mockImplementation(async () => null)

      const settings = await getBackupSettings()

      expect(settings).toEqual({
        schedule: 'manual',
        retention: 7
      })
    })

    test('returns stored values', async () => {
      mockQueryOne.mockImplementation(async (_sql: string, params?: unknown[]) => {
        const key = params?.[0]
        if (key === 'backup_schedule') return { value: '0 0 * * *' }
        if (key === 'backup_retention') return { value: '14' }
        return null
      })

      const settings = await getBackupSettings()

      expect(settings.schedule).toBe('0 0 * * *')
      expect(settings.retention).toBe(14)
    })

    test('parses retention as integer', async () => {
      mockQueryOne.mockImplementation(async () => null)

      const settings = await getBackupSettings()

      expect(typeof settings.retention).toBe('number')
      expect(Number.isInteger(settings.retention)).toBe(true)
    })
  })

  describe('saveBackupSettings', () => {
    test('throws error when retention is less than 1', async () => {
      expect(saveBackupSettings('manual', 0)).rejects.toThrow('Retention must be at least 1')
    })

    test('throws error when retention is negative', async () => {
      expect(saveBackupSettings('daily', -5)).rejects.toThrow('Retention must be at least 1')
    })

    test('calls execute to save schedule and retention', async () => {
      await saveBackupSettings('0 0 * * *', 7)

      // Should be called twice - once for schedule, once for retention
      expect(mockExecute).toHaveBeenCalledTimes(2)
    })

    test('accepts manual as schedule value', async () => {
      await expect(saveBackupSettings('manual', 7)).resolves.toBeUndefined()
    })

    test('accepts retention of 1 (minimum valid value)', async () => {
      await expect(saveBackupSettings('manual', 1)).resolves.toBeUndefined()
    })
  })
})
