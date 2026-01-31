// server/src/lib/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  requestId?: string
  service?: string
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  error?: { code?: string; message: string; stack?: string }
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

const currentLevel = (process.env.LOG_LEVEL || 'info') as LogLevel

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]
}

function formatEntry(entry: LogEntry): string {
  return JSON.stringify(entry)
}

function log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
  if (!shouldLog(level)) return

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context
  }

  if (error) {
    entry.error = {
      code: (error as any).code,
      message: error.message,
      stack: level === 'error' ? error.stack : undefined
    }
  }

  const output = formatEntry(entry)
  
  if (level === 'error') {
    console.error(output)
  } else if (level === 'warn') {
    console.warn(output)
  } else {
    console.log(output)
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => log('debug', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext, error?: Error) => log('warn', message, context, error),
  error: (message: string, context?: LogContext, error?: Error) => log('error', message, context, error)
}

// Request ID middleware
let requestCounter = 0

export function requestIdMiddleware(req: any, res: any, next: any): void {
  requestCounter++
  req.requestId = `req_${Date.now()}_${requestCounter}`
  res.setHeader('X-Request-ID', req.requestId)
  next()
}

// Request logging middleware
export function requestLogMiddleware(req: any, res: any, next: any): void {
  const start = Date.now()
  
  res.on('finish', () => {
    const duration = Date.now() - start
    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration
    })
  })
  
  next()
}
