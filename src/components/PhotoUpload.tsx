"use client"

import { useRef, useState } from 'react'

/**
 * No HEIC-to-JPEG conversion anywhere (ADR 0003): the browser decides whether it can render the
 * bytes inline. When it can't (most non-Safari browsers for HEIC), the <img> fails to load and
 * this falls back to a plain "View / download photo" link instead.
 */
function PhotoPreview({ playerId, cacheBust }: { playerId: string; cacheBust: number }) {
  const [imageFailed, setImageFailed] = useState(false)
  const photoUrl = `/api/signup/player/${playerId}/photo?v=${cacheBust}`

  return (
    <div className="space-y-1">
      {!imageFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt="Current player photo"
          className="rounded-md max-h-40 w-auto"
          onError={() => setImageFailed(true)}
        />
      )}
      {imageFailed && (
        <a href={photoUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline" style={{ color: 'var(--accent)' }}>
          Your browser can&apos;t preview this photo here &mdash; view / download it
        </a>
      )}
    </div>
  )
}

export function PhotoUpload({
  playerId,
  hasPhoto,
  onUploaded,
}: {
  playerId: string
  hasPhoto: boolean
  onUploaded: () => void
}) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [cacheBust, setCacheBust] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = async (file: File) => {
    setError('')
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('photo', file)
      const res = await fetch(`/api/signup/player/${playerId}/photo`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || 'Upload failed. Please try again.')
        return
      }
      setCacheBust(n => n + 1)
      onUploaded()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs" style={{ color: 'var(--secondary-text)' }}>
        This helps coaches learn names. It&apos;s used in the portal and by coaches only.
      </p>
      {hasPhoto && <PhotoPreview playerId={playerId} cacheBust={cacheBust} />}
      <div
        className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer"
        style={{ borderColor: 'var(--border)' }}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => {
          e.preventDefault()
          setIsDragging(false)
          const file = e.dataTransfer.files?.[0]
          if (file) upload(file)
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) upload(file)
          }}
        />
        <p style={{ color: isDragging ? 'var(--accent)' : 'var(--secondary-text)' }}>
          {isUploading ? 'Uploading...' : hasPhoto ? 'Drag a new photo here or click to replace' : 'Drag a photo here or click to upload'}
        </p>
      </div>
      {error && (
        <div className="border px-4 py-3 rounded font-medium" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#dc2626' }}>
          {error}
        </div>
      )}
    </div>
  )
}
