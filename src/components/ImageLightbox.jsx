import { useEffect, useCallback } from 'react'
import { X, Download } from 'lucide-react'
import './ImageLightbox.css'

export default function ImageLightbox({ src, alt, isOpen, onClose }) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div className="lightbox-overlay animate-fade-in" onClick={onClose} id="image-lightbox">
      <div className="lightbox-content animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-toolbar">
          <span className="lightbox-title">{alt || 'Image Preview'}</span>
          <div className="lightbox-actions">
            <a href={src} target="_blank" rel="noopener noreferrer" className="lightbox-btn" title="Open in new tab">
              <Download size={16} />
            </a>
            <button className="lightbox-btn" onClick={onClose} title="Close">
              <X size={18} />
            </button>
          </div>
        </div>
        <img src={src} alt={alt || 'Preview'} className="lightbox-image" />
      </div>
    </div>
  )
}
