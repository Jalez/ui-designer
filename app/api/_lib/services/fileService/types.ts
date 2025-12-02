export type SourceFileType = "image" | "pdf" | "document";

export interface DatabaseSourceFile {
  id: string;
  document_id: string;
  file_type: SourceFileType;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  file_path: string | null;
  drive_file_id: string | null;
  sections: string[] | null;
  highlight_color: string | null;
  web_view_link: string | null;
  web_content_link: string | null;
  created_at: Date;
}

export interface CreateSourceFileOptions {
  documentId: string;
  fileType: SourceFileType;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  filePath?: string;
  driveFileId?: string;
  webViewLink?: string;
  webContentLink?: string;
  sections?: string[];
  highlightColor?: string;
}

export interface UpdateSourceFileOptions {
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  filePath?: string;
  sections?: string[];
  highlightColor?: string;
}
