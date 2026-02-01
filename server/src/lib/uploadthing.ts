import { createUploadthing, type FileRouter } from "uploadthing/express";

const f = createUploadthing();

export const uploadRouter = {
  mediaUploader: f({
    image: { maxFileSize: "4MB", maxFileCount: 1 },
  }).onUploadComplete(({ file }) => {
    console.log("Upload complete:", file.name);
    return {
      url: file.ufsUrl,
      key: file.key,
      name: file.name,
      size: file.size,
    };
  }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
