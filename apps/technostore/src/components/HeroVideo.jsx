import { useEffect, useRef, useState } from 'react'

export default function HeroVideo({ src, poster, children }) {
  const ref = useRef(null)
  const [failed, setFailed] = useState(false)
  const base = import.meta.env.BASE_URL || '/'
  const videoSrc = src.startsWith('/') || src.startsWith('http') ? src : base + src
  const posterSrc = poster?.startsWith('/') || poster?.startsWith('http') ? poster : base + poster

  useEffect(() => {
    const v = ref.current
    if (!v || failed) return
    v.muted = true
    v.playsInline = true
    const p = v.play()
    if (p?.catch) p.catch(() => setFailed(true))
  }, [failed, videoSrc])

  const showVideo = !failed && !!videoSrc

  return (
    <div className="hero">
      {showVideo ? (
        <video
          ref={ref}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={posterSrc}
          onError={() => setFailed(true)}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      ) : (
        <div className="hero-fallback" style={{ backgroundImage: `url(${posterSrc})` }} />
      )}
      <div className="hero-content">
        <div className="container">{children}</div>
      </div>
    </div>
  )
}
