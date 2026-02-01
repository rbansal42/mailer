import { createRouteHandler } from "uploadthing/express";
import { uploadRouter } from "../lib/uploadthing";

// TEMPORARY: Hardcoded token for debugging
const HARDCODED_TOKEN = "eyJhcGlLZXkiOiJza19saXZlXzNiNzYzYzgyNmMxZjQ1N2RhNDlkZTIxZGVmOWE1Y2M0YmE0YjNkYTI0MDZhMDA3NTIwMTFiYTJmMGU5MjU0NzEiLCJhcHBJZCI6ImZyOTBibXJteWMiLCJyZWdpb25zIjpbInNlYTEiXX0=";

// Create router lazily to ensure env vars are loaded
export function createUploadthingRouter() {
  // Force set the env var at runtime - bypasses any bundler issues
  process.env.UPLOADTHING_TOKEN = HARDCODED_TOKEN;
  
  console.log('[UT DEBUG] Set UPLOADTHING_TOKEN in process.env');
  console.log('[UT DEBUG] Verify:', process.env.UPLOADTHING_TOKEN?.slice(0, 30));
  
  // Create handler WITHOUT passing token in config - let it read from env
  return createRouteHandler({
    router: uploadRouter,
  });
}
