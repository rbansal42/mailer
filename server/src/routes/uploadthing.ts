import { createRouteHandler } from "uploadthing/express";
import { uploadRouter } from "../lib/uploadthing";

// Create router lazily to ensure env vars are loaded
export function createUploadthingRouter() {
  return createRouteHandler({
    router: uploadRouter,
    config: {
      token: process.env.UPLOADTHING_TOKEN,
    },
  });
}
