const ALLOWED_UPLOAD_TYPES = {
  '.pdf': ['application/pdf'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.bmp': ['image/bmp'],
  '.mp4': ['video/mp4'],
  '.webm': ['video/webm'],
  '.ogg': ['video/ogg', 'application/ogg'],
  '.mov': ['video/quicktime'],
  '.txt': ['text/plain'],
  '.md': ['text/markdown', 'text/plain'],
  '.csv': ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.ppt': ['application/vnd.ms-powerpoint'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
};

export const ALLOWED_UPLOAD_EXTENSIONS = Object.keys(ALLOWED_UPLOAD_TYPES);

export function getUploadPolicySummary() {
  return ALLOWED_UPLOAD_EXTENSIONS.join(', ');
}

export function validateRelativePath(relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.trim()) {
    return { valid: false, error: 'Each uploaded file requires a relative path' };
  }

  const normalizedPath = relativePath.replace(/\\/g, '/').trim();
  if (
    normalizedPath.startsWith('/') ||
    normalizedPath.includes('\0') ||
    normalizedPath.includes('//')
  ) {
    return { valid: false, error: 'Upload paths must stay within the selected folder' };
  }

  const segments = normalizedPath.split('/').filter(Boolean);
  if (segments.length === 0) {
    return { valid: false, error: 'Each uploaded file requires a filename' };
  }

  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return { valid: false, error: 'Upload paths cannot contain "." or ".." segments' };
  }

  return { valid: true, normalizedPath, segments };
}

export function validateUploadedFile(file) {
  if (!file || typeof file.originalname !== 'string') {
    return { valid: false, error: 'Invalid upload payload' };
  }

  const extension = getExtension(file.originalname);
  if (!extension || !ALLOWED_UPLOAD_TYPES[extension]) {
    return {
      valid: false,
      error: `File type not allowed. Allowed extensions: ${getUploadPolicySummary()}`,
    };
  }

  const allowedMimeTypes = ALLOWED_UPLOAD_TYPES[extension];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return {
      valid: false,
      error: `File MIME type "${file.mimetype}" is not allowed for ${extension} files`,
    };
  }

  return { valid: true, extension, mimetype: file.mimetype };
}

function getExtension(fileName) {
  const normalized = fileName.trim().toLowerCase();
  const index = normalized.lastIndexOf('.');
  return index === -1 ? '' : normalized.slice(index);
}
