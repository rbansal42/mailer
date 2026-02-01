import { generateReactHelpers } from "@uploadthing/react";

// Note: We use a simple type here since importing from server causes build issues
// The actual type safety comes from the server-side validation
type OurFileRouter = {
  mediaUploader: any;
};

export const { useUploadThing, uploadFiles } = generateReactHelpers<OurFileRouter>({
  url: "/api/uploadthing",
});
