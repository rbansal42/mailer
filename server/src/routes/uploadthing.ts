import { createRouteHandler } from "uploadthing/express";
import { uploadRouter } from "../lib/uploadthing";

// TEMPORARY: Hardcoded token for debugging
const HARDCODED_TOKEN = "eyJhcGlLZXkiOiJza19saXZlXzNiNzYzYzgyNmMxZjQ1N2RhNDlkZTIxZGVmOWE1Y2M0YmE0YjNkYTI0MDZhMDA3NTIwMTFiYTJmMGU5MjU0NzEiLCJhcHBJZCI6ImZyOTBibXJteWMiLCJyZWdpb25zIjpbInNlYTEiXX0=";

// Create router lazily to ensure env vars are loaded
export function createUploadthingRouter() {
  const token = HARDCODED_TOKEN;
  
  console.log('[UT DEBUG] Creating uploadthing router');
  console.log('[UT DEBUG] Token:', token);
  
  const handlerOptions = {
    router: uploadRouter,
    config: {
      token: token,
      logLevel: "Debug" as const,
    },
  };
  
  console.log('[UT DEBUG] Handler options:', JSON.stringify({
    hasRouter: !!handlerOptions.router,
    config: handlerOptions.config,
  }, null, 2));
  
  return createRouteHandler(handlerOptions);
}
