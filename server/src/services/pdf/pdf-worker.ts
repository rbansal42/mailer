/**
 * PDF Worker - runs in a separate thread to generate PDFs
 *
 * This worker receives PDF generation tasks from the main thread,
 * generates the PDF using generateReactPdf, and sends the result back.
 *
 * Note: This runs in a Worker thread, so console logging is used
 * instead of the main logger (which may not be available in worker context).
 */
import { generateReactPdf } from './generator'
import type { TemplateId } from './templates'
import type { CertificateProps } from './generator'

interface WorkerTask {
  taskId: string
  templateId: TemplateId
  props: CertificateProps
}

interface WorkerResult {
  taskId: string
  success: boolean
  buffer?: Uint8Array
  error?: string
}

declare const self: Worker

// Simple worker logging helper
function workerLog(level: 'info' | 'error' | 'debug', message: string, context?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context: { service: 'pdf-worker', ...context }
  }
  if (level === 'error') {
    console.error(JSON.stringify(entry))
  } else {
    console.log(JSON.stringify(entry))
  }
}

self.onmessage = async (event: MessageEvent<WorkerTask>) => {
  const { taskId, templateId, props } = event.data
  const startTime = Date.now()

  workerLog('info', 'Received PDF generation task', {
    taskId,
    templateId,
    recipientName: props.recipientName
  })

  try {
    const buffer = await generateReactPdf(templateId, props)
    const durationMs = Date.now() - startTime

    workerLog('info', 'PDF generation task completed', {
      taskId,
      templateId,
      bufferSize: buffer.length,
      durationMs
    })

    const result: WorkerResult = {
      taskId,
      success: true,
      buffer: new Uint8Array(buffer),
    }
    self.postMessage(result)
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    workerLog('error', 'PDF generation task failed', {
      taskId,
      templateId,
      error: errorMessage,
      durationMs
    })

    const result: WorkerResult = {
      taskId,
      success: false,
      error: errorMessage,
    }
    self.postMessage(result)
  }
}

// Signal ready to main thread
workerLog('info', 'PDF worker initialized and ready')
self.postMessage({ ready: true })
