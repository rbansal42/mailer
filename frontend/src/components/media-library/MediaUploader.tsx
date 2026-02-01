import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Loader2 } from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing";
import { cn } from "@/lib/utils";

interface MediaUploaderProps {
  onUploadComplete: (data: { key: string; url: string; name: string; size: number }) => void;
  onUploadError?: (error: Error) => void;
}

export function MediaUploader({ onUploadComplete, onUploadError }: MediaUploaderProps) {
  console.log('[UT CLIENT] MediaUploader mounted');
  
  const { startUpload, isUploading } = useUploadThing("mediaUploader", {
    onClientUploadComplete: (res) => {
      console.log('[UT CLIENT] Upload complete:', res);
      if (res?.[0]) {
        const file = res[0];
        onUploadComplete({
          key: file.key,
          url: file.ufsUrl,
          name: file.name,
          size: file.size,
        });
      }
    },
    onUploadError: (error) => {
      console.error("[UT CLIENT] Upload error:", error);
      console.error("[UT CLIENT] Error message:", error.message);
      console.error("[UT CLIENT] Error cause:", (error as any).cause);
      onUploadError?.(error);
    },
    onUploadBegin: (name) => {
      console.log('[UT CLIENT] Upload beginning:', name);
    },
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        startUpload(acceptedFiles);
      }
    },
    [startUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/gif": [".gif"],
      "image/webp": [".webp"],
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50",
        isUploading && "opacity-50 cursor-not-allowed"
      )}
    >
      <input {...getInputProps()} />
      {isUploading ? (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Uploading...</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Upload className="h-6 w-6" />
          <span className="text-sm">
            {isDragActive ? "Drop image here" : "Drop image or click to upload"}
          </span>
        </div>
      )}
    </div>
  );
}
