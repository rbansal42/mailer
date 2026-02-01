import { createRouteHandler } from "uploadthing/express";
import { Router } from "express";
import { uploadRouter } from "../lib/uploadthing";

// TEMPORARY: Hardcoded token for debugging
const HARDCODED_TOKEN = "eyJhcGlLZXkiOiJza19saXZlXzNiNzYzYzgyNmMxZjQ1N2RhNDlkZTIxZGVmOWE1Y2M0YmE0YjNkYTI0MDZhMDA3NTIwMTFiYTJmMGU5MjU0NzEiLCJhcHBJZCI6ImZyOTBibXJteWMiLCJyZWdpb25zIjpbInNlYTEiXX0=";

// Create router lazily to ensure env vars are loaded
export function createUploadthingRouter() {
  const envToken = process.env.UPLOADTHING_TOKEN;
  const token = HARDCODED_TOKEN; // Use hardcoded for now
  
  console.log('[UT DEBUG] Creating uploadthing router');
  console.log('[UT DEBUG] Env token available:', !!envToken);
  console.log('[UT DEBUG] Using hardcoded token:', !!token);
  console.log('[UT DEBUG] Token preview:', token?.slice(0, 20));
  
  const router = Router();
  
  // Debug middleware - log all requests
  router.use((req, res, next) => {
    console.log('[UT DEBUG] Request:', req.method, req.path);
    next();
  });
  
  // Mount the actual uploadthing handler
  const utHandler = createRouteHandler({
    router: uploadRouter,
    config: {
      token: token,
      logLevel: "Debug",
    },
  });
  
  router.use(utHandler);
  
  return router;
}
