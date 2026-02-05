/**
 * PDF Worker - runs in a separate thread to generate PDFs
 * 
 * This worker receives PDF generation tasks from the main thread,
 * generates the PDF using generateReactPdf, and sends the result back.
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

self.onmessage = async (event: MessageEvent<WorkerTask>) => {
  const { taskId, templateId, props } = event.data
  
  try {
    const buffer = await generateReactPdf(templateId, props)
    const result: WorkerResult = {
      taskId,
      success: true,
      buffer: new Uint8Array(buffer),
    }
    self.postMessage(result)
  } catch (error) {
    const result: WorkerResult = {
      taskId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
    self.postMessage(result)
  }
}

// Signal ready to main thread
self.postMessage({ ready: true })
