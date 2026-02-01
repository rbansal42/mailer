import { createRouteHandler } from "uploadthing/express";
import { Router } from "express";
import { uploadRouter } from "../lib/uploadthing";

// Create router lazily to ensure env vars are loaded
export function createUploadthingRouter() {
  const token = process.env.UPLOADTHING_TOKEN;
  console.log('[UT DEBUG] Creating uploadthing router');
  console.log('[UT DEBUG] Token available:', !!token);
  console.log('[UT DEBUG] Token preview:', token?.slice(0, 20));
  
  const router = Router();
  
  // Debug middleware - log all requests
  router.use((req, res, next) => {
    console.log('[UT DEBUG] Request:', req.method, req.path);
    console.log('[UT DEBUG] Token at request time:', !!process.env.UPLOADTHING_TOKEN);
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
