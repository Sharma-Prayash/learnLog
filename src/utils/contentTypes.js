/**
 * Content type detection utility for LearnLog
 * Classifies a resource URL into: video, pdf, image, youtube, vimeo, external, or unknown
 */

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv']
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp']
const PDF_EXTENSION = '.pdf'

/**
 * Determine the content type of a resource URL.
 * @param {string} url
 * @returns {'video'|'pdf'|'image'|'youtube'|'vimeo'|'external'|'unknown'}
 */
export function getContentType(url) {
  if (!url) return 'unknown'

  const lower = url.toLowerCase()

  // YouTube detection
  if (isYouTubeUrl(lower)) return 'youtube'

  // Vimeo detection
  if (isVimeoUrl(lower)) return 'vimeo'

  // Extract extension from URL (strip query params)
  const ext = getExtension(lower)

  if (ext === PDF_EXTENSION) return 'pdf'
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video'
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image'

  // If it looks like a URL but isn't a known file type, treat as external link
  if (lower.startsWith('http://') || lower.startsWith('https://')) return 'external'

  return 'unknown'
}

/**
 * Check if a URL is previewable in-app (not just a download link).
 */
export function isPreviewable(url) {
  const type = getContentType(url)
  return ['video', 'pdf', 'image', 'youtube', 'vimeo'].includes(type)
}

/**
 * Get the file type icon label for UI display.
 */
export function getFileTypeIcon(url) {
  const type = getContentType(url)
  const map = {
    video: '🎬',
    pdf: '📄',
    image: '🖼️',
    youtube: '▶️',
    vimeo: '▶️',
    external: '🔗',
    unknown: '📎',
  }
  return map[type] || '📎'
}

// ── YouTube helpers ──

function isYouTubeUrl(url) {
  return (
    url.includes('youtube.com/watch') ||
    url.includes('youtu.be/') ||
    url.includes('youtube.com/embed/')
  )
}

export function getYouTubeEmbedUrl(url) {
  let videoId = null

  // youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
  if (watchMatch) videoId = watchMatch[1]

  // youtu.be/VIDEO_ID
  if (!videoId) {
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
    if (shortMatch) videoId = shortMatch[1]
  }

  // youtube.com/embed/VIDEO_ID
  if (!videoId) {
    const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/)
    if (embedMatch) videoId = embedMatch[1]
  }

  return videoId ? `https://www.youtube.com/embed/${videoId}` : url
}

// ── Vimeo helpers ──

function isVimeoUrl(url) {
  return url.includes('vimeo.com/')
}

export function getVimeoEmbedUrl(url) {
  const match = url.match(/vimeo\.com\/(\d+)/)
  return match ? `https://player.vimeo.com/video/${match[1]}` : url
}

// ── General helpers ──

function getExtension(url) {
  try {
    const pathname = new URL(url).pathname
    const dotIndex = pathname.lastIndexOf('.')
    return dotIndex !== -1 ? pathname.slice(dotIndex).toLowerCase() : ''
  } catch {
    // If URL parsing fails, try a simple approach
    const clean = url.split('?')[0].split('#')[0]
    const dotIndex = clean.lastIndexOf('.')
    return dotIndex !== -1 ? clean.slice(dotIndex).toLowerCase() : ''
  }
}
