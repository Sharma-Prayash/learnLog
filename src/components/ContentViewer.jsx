import { useState, useEffect, useCallback } from 'react'
import { X, Maximize2, Minimize2, MessageSquare, ChevronDown, ChevronUp, Video, FileText, Image as ImageIcon, Play, Link2, Paperclip } from 'lucide-react'
import { getContentType } from '../utils/contentTypes'
import VideoPlayer from './VideoPlayer'
import PdfViewer from './PdfViewer'
import ImageLightbox from './ImageLightbox'
import ExternalEmbed from './ExternalEmbed'
import CommentsSection from './CommentsSection'
import './ContentViewer.css'

export default function ContentViewer({ node, onClose, onAutoComplete, classroomId }) {
  const [isImmersive, setIsImmersive] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [showComments, setShowComments] = useState(false)

  const contentType = getContentType(node?.resource_url)
  
  const Icon = {
    video: Video,
    pdf: FileText,
    image: ImageIcon,
    youtube: Play,
    vimeo: Play,
    external: Link2,
    unknown: Paperclip,
  }[contentType] || Paperclip

  // Escape key exits immersive mode or closes viewer
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      if (isImmersive) {
        setIsImmersive(false)
      } else if (!lightboxOpen) {
        onClose()
      }
    }
  }, [isImmersive, lightboxOpen, onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Lock body scroll in immersive mode
  useEffect(() => {
    if (isImmersive) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isImmersive])

  if (!node) return null

  function renderContent() {
    switch (contentType) {
      case 'video':
        return (
          <VideoPlayer
            src={node.resource_url}
            nodeId={node.id}
            nodeName={node.name}
            onAutoComplete={onAutoComplete}
            alreadyCompleted={node.completed}
          />
        )
      case 'pdf':
        return <PdfViewer src={node.resource_url} nodeName={node.name} />
      case 'image':
        return (
          <>
            <div className="content-image-container" onClick={() => setLightboxOpen(true)}>
              <img src={node.resource_url} alt={node.name} className="content-image-preview" />
              <span className="content-image-hint">Click to expand</span>
            </div>
            <ImageLightbox
              src={node.resource_url}
              alt={node.name}
              isOpen={lightboxOpen}
              onClose={() => setLightboxOpen(false)}
            />
          </>
        )
      case 'youtube':
      case 'vimeo':
        return <ExternalEmbed src={node.resource_url} type={contentType} nodeName={node.name} />
      case 'external':
        return <ExternalEmbed src={node.resource_url} type="external" nodeName={node.name} />
      default:
        return (
          <div className="content-unknown">
            <p>This file type cannot be previewed.</p>
            <a href={node.resource_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
              Open in new tab
            </a>
          </div>
        )
    }
  }

  return (
    <div className={`content-viewer ${isImmersive ? 'content-viewer-immersive' : ''}`} id="content-viewer">
      {/* Header bar */}
      <div className="content-viewer-header">
        <div className="content-viewer-title">
          <span className="content-viewer-icon">
            <Icon size={16} />
          </span>
          <span className="content-viewer-name">{node.name}</span>
        </div>
        <div className="content-viewer-actions">
          <button
            className="content-viewer-btn"
            onClick={() => setShowComments(!showComments)}
            title={showComments ? 'Hide comments' : 'Show comments'}
          >
            <MessageSquare size={15} />
            {showComments ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button
            className="content-viewer-btn"
            onClick={() => setIsImmersive(!isImmersive)}
            title={isImmersive ? 'Exit immersive mode' : 'Immersive mode'}
          >
            {isImmersive ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button className="content-viewer-btn content-viewer-close" onClick={onClose} title="Close viewer">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content body */}
      <div className="content-viewer-body">
        {renderContent()}
      </div>

      {/* Comments section (togglable) */}
      {showComments && (
        <div className="content-viewer-comments animate-fade-in">
          <CommentsSection nodeId={node.id} classroomId={classroomId} />
        </div>
      )}

      {/* Immersive overlay background */}
      {isImmersive && <div className="immersive-backdrop" onClick={() => setIsImmersive(false)} />}
    </div>
  )
}
