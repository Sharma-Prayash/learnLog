import { ExternalLink } from 'lucide-react'
import { getYouTubeEmbedUrl, getVimeoEmbedUrl } from '../utils/contentTypes'
import './ExternalEmbed.css'

export default function ExternalEmbed({ src, type, nodeName }) {
  // YouTube or Vimeo — render responsive iframe
  if (type === 'youtube' || type === 'vimeo') {
    const embedUrl = type === 'youtube' ? getYouTubeEmbedUrl(src) : getVimeoEmbedUrl(src)

    return (
      <div className="external-embed" id="external-embed">
        <div className="embed-responsive">
          <iframe
            src={embedUrl}
            title={nodeName || 'Video'}
            className="embed-iframe"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    )
  }

  // External link card (Google Docs, websites, etc.)
  return (
    <div className="external-embed" id="external-embed">
      <div className="external-link-card">
        <div className="external-link-icon">
          <ExternalLink size={28} />
        </div>
        <div className="external-link-info">
          <h3 className="external-link-name">{nodeName || 'External Resource'}</h3>
          <p className="external-link-url">{src}</p>
        </div>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary btn-sm"
        >
          <ExternalLink size={14} /> Open Link
        </a>
      </div>
    </div>
  )
}
