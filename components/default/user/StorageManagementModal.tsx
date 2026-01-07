"use client";

import { Trash2, File, HardDrive, Database, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/tailwind/ui/dialog";
import { Button } from "@/components/tailwind/ui/button";
import { Input } from "@/components/tailwind/ui/input";
import type { UserFile } from "@/app/api/_lib/services/fileService/read";
import { useStorageStatisticsStore } from "./stores/storageStatisticsStore";
import { useSession } from "next-auth/react";

interface StorageManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalStorageBytes: number;
  storageLimitBytes: number;
}

export function StorageManagementModal({
  open,
  onOpenChange,
  totalStorageBytes,
  storageLimitBytes,
}: StorageManagementModalProps) {
  const { data: session } = useSession();
  const updateStorageAfterDeletion = useStorageStatisticsStore((state) => state.updateStorageAfterDeletion);
  const [files, setFiles] = useState<UserFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (open) {
      fetchFiles();
    }
  }, [open]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/storage/files/read");
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
      } else {
        toast.error("Failed to load files");
      }
    } catch (error) {
      console.error("Error fetching files:", error);
      toast.error("Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingFileId(fileId);
      const response = await fetch(`/api/storage/files/${encodeURIComponent(fileId)}/delete`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success(`"${fileName}" deleted successfully`);
        
        // Find the deleted file to get its size
        const deletedFile = files.find((f) => f.id === fileId);
        if (deletedFile) {
          // Update storage statistics store immediately
          updateStorageAfterDeletion(deletedFile.fileSize);
        }
        
        // Remove file from list - modal manages its own state
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to delete file");
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Failed to delete file");
    } finally {
      setDeletingFileId(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / k ** i).toFixed(1)) + " " + sizes[i];
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredFiles = files.filter((file) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      file.fileName.toLowerCase().includes(query) ||
      file.documentTitle?.toLowerCase().includes(query) ||
      file.storageLocation.toLowerCase().includes(query)
    );
  });

  const totalFilesSize = files.reduce((sum, file) => sum + file.fileSize, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Storage Management
          </DialogTitle>
          <DialogDescription>
            View and manage your files. Total storage: {formatBytes(totalStorageBytes)} / {formatBytes(storageLimitBytes)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search files by name, document, or storage location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Files list */}
          <div className="flex-1 overflow-y-auto border rounded-lg">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600" />
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {searchQuery ? "No files match your search" : "No files found"}
              </div>
            ) : (
              <div className="divide-y">
                {filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        {file.storageLocation === "database" ? (
                          <Database className="h-5 w-5 text-blue-500" />
                        ) : (
                          <File className="h-5 w-5 text-green-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">{file.fileName}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 space-x-2">
                          <span>{formatBytes(file.fileSize)}</span>
                          <span>•</span>
                          <span>{formatDate(file.uploadDate)}</span>
                          {file.documentTitle && (
                            <>
                              <span>•</span>
                              <span className="truncate">Doc: {file.documentTitle}</span>
                            </>
                          )}
                          <span>•</span>
                          <span className="capitalize">{file.storageLocation}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(file.id, file.fileName)}
                      disabled={deletingFileId === file.id}
                      className="flex-shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      {deletingFileId === file.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 pt-2 border-t">
            <span>
              {filteredFiles.length} {filteredFiles.length === 1 ? "file" : "files"}
              {searchQuery && ` (${files.length} total)`}
            </span>
            <span>Total size: {formatBytes(totalFilesSize)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

