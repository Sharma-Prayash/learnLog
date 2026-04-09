import { useRef, useState, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react'
import './VideoPlayer.css'

export default function VideoPlayer({ src, nodeId, onAutoComplete, alreadyCompleted }) {
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const hasFiredRef = useRef(false)
  const toastTimeoutRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [toastNodeId, setToastNodeId] = useState(null)

  // Reset fired flag when nodeId changes
  useEffect(() => {
    hasFiredRef.current = false
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    }
  }, [nodeId])

  function handleTimeUpdate() {
    const video = videoRef.current
    if (!video || !video.duration) return

    const pct = (video.currentTime / video.duration) * 100
    setProgress(pct)
    setCurrentTime(video.currentTime)

    // Auto-complete at 70% threshold
    if (pct >= 70 && !hasFiredRef.current && !alreadyCompleted) {
      hasFiredRef.current = true
      setToastNodeId(nodeId)
      onAutoComplete?.(nodeId)
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
      toastTimeoutRef.current = setTimeout(() => setToastNodeId(null), 3000)
    }
  }

  function handleLoadedMetadata() {
    setDuration(videoRef.current?.duration || 0)
  }

  function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play()
      setIsPlaying(true)
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }

  function handleSeek(e) {
    const video = videoRef.current
    if (!video || !video.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    video.currentTime = pct * video.duration
  }

  function toggleMute() {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  function toggleFullscreen() {
    const container = containerRef.current
    if (!container) return

    if (!document.fullscreenElement) {
      container.requestFullscreen?.()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.()
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="video-player" ref={containerRef} id={`video-player-${nodeId}`}>
      {/* Auto-complete toast */}
      {toastNodeId === nodeId && (
        <div className="video-autocomplete-toast animate-scale-in">
          ✓ Auto-marked as complete (70% watched)
        </div>
      )}

      <video
        ref={videoRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onClick={togglePlay}
        className="video-element"
        preload="metadata"
      />

      {/* Custom controls */}
      <div className="video-controls">
        {/* Progress bar */}
        <div className="video-progress-container" onClick={handleSeek}>
          <div className="video-progress-track">
            <div className="video-progress-fill" style={{ width: `${progress}%` }} />
            <div className="video-progress-thumb" style={{ left: `${progress}%` }} />
            {/* 70% marker */}
            <div className="video-progress-marker" style={{ left: '70%' }} title="70% — Auto-complete threshold" />
          </div>
        </div>

        <div className="video-controls-row">
          <div className="video-controls-left">
            <button className="video-btn" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>

            <button className="video-btn" onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            <span className="video-time">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="video-controls-right">
            <button className="video-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
