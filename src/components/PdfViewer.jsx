import { useState } from 'react'
import { Download, AlertCircle } from 'lucide-react'
import './PdfViewer.css'

export default function PdfViewer({ src, nodeName }) {
  const [loadError, setLoadError] = useState(false)

  return (
    <div className="pdf-viewer" id="pdf-viewer">
      {loadError ? (
        <div className="pdf-fallback">
          <AlertCircle size={32} className="pdf-fallback-icon" />
          <p>Unable to preview this PDF in the browser.</p>
          <a href={src} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
            <Download size={14} /> Download PDF
          </a>
        </div>
      ) : (
        <iframe
          src={src}
          title={nodeName || 'PDF Viewer'}
          className="pdf-iframe"
          onError={() => setLoadError(true)}
        />
      )}
    </div>
  )
}
