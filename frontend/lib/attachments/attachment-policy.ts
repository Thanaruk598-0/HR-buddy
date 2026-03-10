export type AttachmentFileKind = "IMAGE" | "VIDEO" | "DOCUMENT";

type AttachmentPolicy = {
  maxSizeBytes: number;
  allowedMimeTypes: readonly string[];
};

const MB = 1024 * 1024;

export const ATTACHMENT_POLICY: Record<AttachmentFileKind, AttachmentPolicy> = {
  IMAGE: {
    maxSizeBytes: 10 * MB,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
  VIDEO: {
    maxSizeBytes: 100 * MB,
    allowedMimeTypes: ["video/mp4", "video/quicktime"],
  },
  DOCUMENT: {
    maxSizeBytes: 20 * MB,
    allowedMimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
    ],
  },
};

const EXTENSION_MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function normalizeMimeType(value: string) {
  return value.trim().toLowerCase();
}

function formatSizeLimit(bytes: number) {
  return `${(bytes / MB).toFixed(0)} MB`;
}

function inferMimeTypeFromFileName(fileName: string) {
  const lower = fileName.toLowerCase();

  for (const [extension, mimeType] of Object.entries(EXTENSION_MIME_MAP)) {
    if (lower.endsWith(extension)) {
      return mimeType;
    }
  }

  return null;
}

export function inferFileKindFromMimeType(mimeType: string): AttachmentFileKind | null {
  const normalized = normalizeMimeType(mimeType);

  if (normalized.startsWith("image/")) {
    return "IMAGE";
  }

  if (normalized.startsWith("video/")) {
    return "VIDEO";
  }

  if (ATTACHMENT_POLICY.DOCUMENT.allowedMimeTypes.includes(normalized)) {
    return "DOCUMENT";
  }

  return null;
}

export function resolveUploadMimeType(file: File) {
  const fromFileType = normalizeMimeType(file.type ?? "");
  if (fromFileType) {
    return fromFileType;
  }

  return inferMimeTypeFromFileName(file.name);
}

export function validateAttachmentCandidate(file: File, requestedKind: AttachmentFileKind) {
  const mimeType = resolveUploadMimeType(file);

  if (!mimeType) {
    return {
      ok: false as const,
      message: "Unsupported file type. Please choose a supported format.",
    };
  }

  const policy = ATTACHMENT_POLICY[requestedKind];
  if (!policy.allowedMimeTypes.includes(mimeType)) {
    return {
      ok: false as const,
      message: `Selected file kind does not match file type (${mimeType}).`,
    };
  }

  if (file.size > policy.maxSizeBytes) {
    return {
      ok: false as const,
      message: `File is too large for ${requestedKind}. Max ${formatSizeLimit(policy.maxSizeBytes)}.`,
    };
  }

  return {
    ok: true as const,
    mimeType,
  };
}
export function getAcceptMimeTypes(kind: AttachmentFileKind) {
  return ATTACHMENT_POLICY[kind].allowedMimeTypes.join(",");
}

export function getAttachmentPolicySummary(kind: AttachmentFileKind) {
  const policy = ATTACHMENT_POLICY[kind];
  const maxSize = formatSizeLimit(policy.maxSizeBytes);
  return `Allowed: ${policy.allowedMimeTypes.join(", ")} | Max: ${maxSize}`;
}

