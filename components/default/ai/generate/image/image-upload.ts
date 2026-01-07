import { createImageUpload } from "novel";
import { toast } from "sonner";
import type { LocalSourceFile } from "../../../../scriba/document";

// Generic file upload function that works for any file type
export const uploadFile = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);

  const promise = fetch("/api/files/upload", {
    method: "POST",
    body: formData,
  });

  return new Promise((resolve, reject) => {
    promise
      .then(async (res) => {
        // Successfully uploaded file
        if (res.status === 200) {
          const { url } = (await res.json()) as { url: string };
          resolve(url);
        } else if (res.status === 401) {
          // No blob store configured, create blob URL as fallback
          const blobUrl = URL.createObjectURL(file);
          resolve(blobUrl);
        } else {
          throw new Error("Error uploading file. Please try again.");
        }
      })
      .catch(reject);
  });
};

// We'll need to access the document context, so we'll create a function that can be called with context
export const createDocumentImageUpload = (
  documentId: string | null,
  addLocalSourceFile: (sourceFile: LocalSourceFile) => void,
) => {
  const onUpload = (file: File) => {
    const promise = fetch("/api/files/upload", {
      method: "POST",
      headers: {
        "content-type": file?.type || "application/octet-stream",
        "x-vercel-filename": file?.name || "image.png",
      },
      body: file,
    });

    return new Promise((resolve, reject) => {
      toast.promise(
        promise.then(async (res) => {
          // Successfully uploaded image
          if (res.status === 200) {
            const { url } = (await res.json()) as { url: string };

            // If we have a document context, save this as a source file
            if (documentId && addLocalSourceFile) {
              try {
                const sourceFile = addLocalSourceFile({
                  id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  documentId: documentId,
                  type: "local",
                  fileType: "image",
                  fileName: file.name,
                  fileSize: file.size,
                  mimeType: file.type,
                  filePath: url, // This will be blob URL
                  createdAt: new Date(),
                });

                console.log("Image saved as source file:", sourceFile);
              } catch (error) {
                console.warn("Failed to save image as source file:", error);
                // Don't fail the upload if source file saving fails
              }
            }

            // preload the image and resolve after both source file saving and image loading
            const image = new Image();
            image.src = url;
            image.onload = () => {
              resolve(url);
            };
            image.onerror = () => {
              console.warn("Image failed to preload, but upload was successful");
              resolve(url);
            };
            // No blob store configured
          } else if (res.status === 401) {
            resolve(file);
            throw new Error("`BLOB_READ_WRITE_TOKEN` environment variable not found, reading image locally instead.");
            // Unknown error
          } else {
            throw new Error("Error uploading image. Please try again.");
          }
        }),
        {
          loading: "Uploading image...",
          success: "Image uploaded successfully.",
          error: (e) => {
            reject(e);
            return e.message;
          },
        },
      );
    });
  };

  return createImageUpload({
    onUpload,
    validateFn: (file) => {
      if (!file.type.includes("image/")) {
        toast.error("File type not supported.");
        return false;
      }
      if (file.size / 1024 / 1024 > 20) {
        toast.error("File size too big (max 20MB).");
        return false;
      }
      return true;
    },
  });
};

// Fallback for when document context is not available
const onUpload = (file: File) => {
  const promise = fetch("/api/files/upload", {
    method: "POST",
    headers: {
      "content-type": file?.type || "application/octet-stream",
      "x-vercel-filename": file?.name || "image.png",
    },
    body: file,
  });

  return new Promise((resolve, reject) => {
    toast.promise(
      promise.then(async (res) => {
        // Successfully uploaded image
        if (res.status === 200) {
          const { url } = (await res.json()) as { url: string };
          // preload the image
          const image = new Image();
          image.src = url;
          image.onload = () => {
            resolve(url);
          };
          // No blob store configured
        } else if (res.status === 401) {
          resolve(file);
          throw new Error("`BLOB_READ_WRITE_TOKEN` environment variable not found, reading image locally instead.");
          // Unknown error
        } else {
          throw new Error("Error uploading image. Please try again.");
        }
      }),
      {
        loading: "Uploading image...",
        success: "Image uploaded successfully.",
        error: (e) => {
          reject(e);
          return e.message;
        },
      },
    );
  });
};

export const uploadFn = createImageUpload({
  onUpload,
  validateFn: (file) => {
    if (!file.type.includes("image/")) {
      toast.error("File type not supported.");
      return false;
    }
    if (file.size / 1024 / 1024 > 20) {
      toast.error("File size too big (max 20MB).");
      return false;
    }
    return true;
  },
});
