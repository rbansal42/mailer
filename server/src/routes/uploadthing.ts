import { createRouteHandler } from "uploadthing/express";
import { uploadRouter } from "../lib/uploadthing";

export const uploadthingRouter = createRouteHandler({
  router: uploadRouter,
});
