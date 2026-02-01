import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/hooks/useAuthStore";

// Get token with fallback to localStorage (handles Zustand hydration race)
function getToken(): string | null {
  const storeToken = useAuthStore.getState().token;
  if (storeToken) return storeToken;
  
  try {
    const stored = localStorage.getItem('mailer-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.state?.token || null;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

interface MediaUploaderProps {
  onUploadComplete: (data: { url: string; name: string; size: number }) => void;
  onUploadError?: (error: Error) => void;
}

export function MediaUploader({ onUploadComplete, onUploadError }: MediaUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    const token = getToken();
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/media/upload", {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(error.error || "Upload failed");
      }

      const media = await response.json();
      onUploadComplete({
        url: media.url,
        name: media.original_filename,
        size: media.size_bytes,
      });
    } catch (error) {
      console.error("Upload error:", error);
      onUploadError?.(error instanceof Error ? error : new Error("Upload failed"));
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        uploadFile(acceptedFiles[0]);
      }
    },
    []
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
