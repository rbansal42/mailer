/**
 * PDF Worker Pool - manages a pool of worker threads for parallel PDF generation
 * 
 * Features:
 * - Configurable pool size via PDF_WORKER_COUNT env var (default: 5)
 * - Configurable timeout via PDF_TIMEOUT_MS env var (default: 30000)
 * - Automatic queue management when all workers are busy
 * - Graceful error handling and worker recovery
 * - Statistics for monitoring via getStats()
 */
import { randomUUID } from 'crypto'
import { join } from 'path'
import { logger } from '../../lib/logger'
import type { TemplateId } from './templates'
import type { CertificateProps } from './generator'

interface QueuedTask {
  taskId: string
  templateId: TemplateId
  props: CertificateProps
  resolve: (buffer: Buffer) => void
  reject: (error: Error) => void
  timeoutId: ReturnType<typeof setTimeout>
  queuedAt: number
}

interface WorkerWrapper {
  worker: Worker
  busy: boolean
  currentTaskId: string | null
  index: number
}

export interface PoolStats {
  workerCount: number
  activeWorkers: number
  queueLength: number
  totalProcessed: number
  totalFailed: number
}

export class PdfWorkerPool {
  private workers: WorkerWrapper[] = []
  private taskQueue: QueuedTask[] = []
  private pendingTasks: Map<string, QueuedTask> = new Map()
  private totalProcessed = 0
  private totalFailed = 0
  private readonly size: number
  private readonly timeoutMs: number
  private initialized = false
  private initPromise: Promise<void> | null = null

  constructor(size?: number, timeoutMs?: number) {
    this.size = size ?? parseInt(process.env.PDF_WORKER_COUNT || '5', 10)
    this.timeoutMs = timeoutMs ?? parseInt(process.env.PDF_TIMEOUT_MS || '30000', 10)
  }

  /**
   * Initialize the worker pool. Called automatically on first generate().
   */
  async initialize(): Promise<void> {
    if (this.initialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this.doInitialize()
    await this.initPromise
  }

  private async doInitialize(): Promise<void> {
    logger.info('Initializing PDF worker pool', { 
      service: 'pdf-pool',
      size: this.size, 
      timeoutMs: this.timeoutMs 
    })

    const workerPath = join(import.meta.dir, 'pdf-worker.ts')
    const readyPromises: Promise<void>[] = []

    for (let i = 0; i < this.size; i++) {
      const worker = new Worker(workerPath)
      const wrapper: WorkerWrapper = {
        worker,
        busy: false,
        currentTaskId: null,
        index: i,
      }

      // Wait for worker to signal ready
      const readyPromise = new Promise<void>((resolve) => {
        const handler = (event: MessageEvent) => {
          if (event.data?.ready) {
            worker.removeEventListener('message', handler)
            resolve()
          }
        }
        worker.addEventListener('message', handler)
      })
      readyPromises.push(readyPromise)

      // Handle worker messages
      worker.onmessage = (event: MessageEvent) => {
        this.handleWorkerMessage(wrapper, event.data)
      }

      worker.onerror = (error) => {
        logger.error('PDF worker error', { 
          service: 'pdf-pool',
          workerId: i, 
          error: error.message 
        })
        this.handleWorkerError(wrapper, new Error(error.message))
      }

      this.workers.push(wrapper)
    }

    // Wait for all workers to be ready (with timeout)
    const initTimeout = 10000 // 10s to initialize workers
    await Promise.race([
      Promise.all(readyPromises),
      new Promise<void>((_, reject) => 
        setTimeout(() => reject(new Error('Worker initialization timeout')), initTimeout)
      )
    ])

    this.initialized = true
    
    logger.info('PDF worker pool initialized', { 
      service: 'pdf-pool',
      workers: this.workers.length 
    })
  }

  /**
   * Generate a PDF using the worker pool.
   */
  async generate(templateId: TemplateId, props: CertificateProps): Promise<Buffer> {
    await this.initialize()

    return new Promise((resolve, reject) => {
      const taskId = randomUUID()
      
      // Set up timeout
      const timeoutId = setTimeout(() => {
        const task = this.pendingTasks.get(taskId)
        if (task) {
          this.pendingTasks.delete(taskId)
          // Remove from queue if still there
          const queueIndex = this.taskQueue.findIndex(t => t.taskId === taskId)
          if (queueIndex !== -1) {
            this.taskQueue.splice(queueIndex, 1)
          }
          this.totalFailed++
          logger.warn('PDF generation timed out', {
            service: 'pdf-pool',
            taskId,
            templateId,
            timeoutMs: this.timeoutMs,
          })
          reject(new Error(`PDF generation timed out after ${this.timeoutMs}ms`))
        }
      }, this.timeoutMs)

      const task: QueuedTask = {
        taskId,
        templateId,
        props,
        resolve,
        reject,
        timeoutId,
        queuedAt: Date.now(),
      }

      this.taskQueue.push(task)
      this.pendingTasks.set(taskId, task)
      this.processQueue()
    })
  }

  private processQueue(): void {
    if (this.taskQueue.length === 0) return

    // Find an idle worker
    const idleWorker = this.workers.find(w => !w.busy)
    if (!idleWorker) return

    // Get next task
    const task = this.taskQueue.shift()
    if (!task) return

    // Dispatch to worker
    idleWorker.busy = true
    idleWorker.currentTaskId = task.taskId

    logger.debug('Dispatching PDF task to worker', {
      service: 'pdf-pool',
      taskId: task.taskId,
      workerId: idleWorker.index,
      templateId: task.templateId,
      queueWaitMs: Date.now() - task.queuedAt,
    })

    idleWorker.worker.postMessage({
      taskId: task.taskId,
      templateId: task.templateId,
      props: task.props,
    })
  }

  private handleWorkerMessage(wrapper: WorkerWrapper, data: any): void {
    // Ignore ready messages after initialization
    if (data?.ready) return

    const { taskId, success, buffer, error } = data
    const task = this.pendingTasks.get(taskId)

    // Mark worker as idle
    wrapper.busy = false
    wrapper.currentTaskId = null

    if (task) {
      clearTimeout(task.timeoutId)
      this.pendingTasks.delete(taskId)

      if (success && buffer) {
        this.totalProcessed++
        logger.debug('PDF generation completed', {
          service: 'pdf-pool',
          taskId,
          workerId: wrapper.index,
          durationMs: Date.now() - task.queuedAt,
        })
        task.resolve(Buffer.from(buffer))
      } else {
        this.totalFailed++
        logger.warn('PDF generation failed', {
          service: 'pdf-pool',
          taskId,
          workerId: wrapper.index,
          error,
        })
        task.reject(new Error(error || 'PDF generation failed'))
      }
    }

    // Process next task in queue
    this.processQueue()
  }

  private handleWorkerError(wrapper: WorkerWrapper, error: Error): void {
    // If worker was processing a task, reject it
    if (wrapper.currentTaskId) {
      const task = this.pendingTasks.get(wrapper.currentTaskId)
      if (task) {
        clearTimeout(task.timeoutId)
        this.pendingTasks.delete(wrapper.currentTaskId)
        this.totalFailed++
        task.reject(new Error(`Worker error: ${error.message}`))
      }
    }

    wrapper.busy = false
    wrapper.currentTaskId = null

    // Process next task
    this.processQueue()
  }

  /**
   * Get pool statistics for monitoring.
   */
  getStats(): PoolStats {
    return {
      workerCount: this.workers.length,
      activeWorkers: this.workers.filter(w => w.busy).length,
      queueLength: this.taskQueue.length,
      totalProcessed: this.totalProcessed,
      totalFailed: this.totalFailed,
    }
  }

  /**
   * Check if the pool is initialized and ready.
   */
  isReady(): boolean {
    return this.initialized
  }

  /**
   * Gracefully shutdown the pool.
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down PDF worker pool', { service: 'pdf-pool' })

    // Reject all pending tasks
    for (const task of this.pendingTasks.values()) {
      clearTimeout(task.timeoutId)
      task.reject(new Error('Worker pool shutting down'))
    }
    this.pendingTasks.clear()
    this.taskQueue = []

    // Terminate all workers
    for (const wrapper of this.workers) {
      wrapper.worker.terminate()
    }
    this.workers = []
    this.initialized = false
    this.initPromise = null

    logger.info('PDF worker pool shut down', { service: 'pdf-pool' })
  }
}

// Singleton instance
let poolInstance: PdfWorkerPool | null = null

/**
 * Get the singleton PDF worker pool instance.
 * Creates it on first call.
 */
export function getPdfWorkerPool(): PdfWorkerPool {
  if (!poolInstance) {
    poolInstance = new PdfWorkerPool()
  }
  return poolInstance
}

/**
 * Shutdown the PDF worker pool.
 * Safe to call even if pool wasn't initialized.
 */
export function shutdownPdfWorkerPool(): Promise<void> {
  if (poolInstance) {
    const pool = poolInstance
    poolInstance = null
    return pool.shutdown()
  }
  return Promise.resolve()
}
