function normalizeMimeType(value: string) {
  return value.trim().toLowerCase().split(";")[0];
}

function inferLabelFromFileName(fileName?: string) {
  if (!fileName) {
    return null;
  }

  const extension = fileName.split(".").pop()?.trim().toLowerCase();
  if (!extension) {
    return null;
  }

  return extension.toUpperCase();
}

const DOCUMENT_MIME_LABEL_MAP: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/vnd.ms-powerpoint": "PPT",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "PPTX",
  "application/rtf": "RTF",
  "application/zip": "ZIP",
  "application/x-zip-compressed": "ZIP",
  "text/plain": "TXT",
  "text/csv": "CSV",
  "application/csv": "CSV",
};

export function getDocumentTypeLabel(mimeType: string, fileName?: string) {
  const normalizedMimeType = normalizeMimeType(mimeType);
  if (normalizedMimeType in DOCUMENT_MIME_LABEL_MAP) {
    return DOCUMENT_MIME_LABEL_MAP[normalizedMimeType];
  }

  return inferLabelFromFileName(fileName) ?? "DOCUMENT";
}
