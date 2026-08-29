"use client"

import { useEffect, useRef, useState } from 'react'
import { PHOTO_MAX_BYTES, PHOTO_MAX_MB, photoTooLargeMessage } from '@/lib/photo-limits'

function canPreviewLocally(file: File): boolean {
  const type = file.type.toLowerCase()
  const name = file.name.toLowerCase()
  if (type === 'image/heic' || type === 'image/heif') return false
  if (name.endsWith('.heic') || name.endsWith('.heif')) return false
  return true
}

/**
 * No HEIC-to-JPEG conversion anywhere (ADR 0003): the browser decides whether it can render the
 * bytes inline. When it can't (most non-Safari browsers for HEIC/HEIF), the <img> is hidden and
 * this falls back to a plain "View / download photo" link instead of a broken-image icon.
 */
function PhotoPreview({ src, downloadUrl }: { src: string; downloadUrl: string }) {
  const [status, setStatus] = useState<'pending' | 'ok' | 'failed'>('pending')

  useEffect(() => {
    setStatus('pending')
  }, [src])

  return (
    <div className="space-y-1">
      {/* Keep the img in the DOM to load it, but hide it until onLoad so a failed HEIF
          doesn't flash the browser's broken-image icon and alt text. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={src}
        src={src}
        alt=""
        className={status === 'ok' ? 'rounded-md max-h-40 w-auto' : 'hidden'}
        onLoad={() => setStatus('ok')}
        onError={() => setStatus('failed')}
      />
      {status === 'failed' && (
        <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline" style={{ color: 'var(--accent)' }}>
          Your browser can&apos;t preview this photo here &mdash; view / download it
        </a>
      )}
    </div>
  )
}

function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ ok: boolean; status: number; body: { success?: boolean; error?: string } }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }
    xhr.onload = () => {
      let body: { success?: boolean; error?: string } = {}
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        body = { error: 'Upload failed. Please try again.' }
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body })
    }
    xhr.onerror = () => reject(new Error('Network error'))
    const formData = new FormData()
    formData.append('photo', file)
    xhr.send(formData)
  })
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
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [cacheBust, setCacheBust] = useState(0)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const localPreviewRef = useRef<string | null>(null)

  const replaceLocalPreview = (url: string | null) => {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current)
    localPreviewRef.current = url
    setLocalPreview(url)
  }

  useEffect(() => {
    return () => {
      if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current)
    }
  }, [])

  const clearInput = () => {
    if (inputRef.current) inputRef.current.value = ''
  }

  const upload = async (file: File) => {
    setError('')
    if (file.size > PHOTO_MAX_BYTES) {
      setError(photoTooLargeMessage(file.size))
      clearInput()
      return
    }

    setIsUploading(true)
    setProgress(0)
    replaceLocalPreview(canPreviewLocally(file) ? URL.createObjectURL(file) : null)
    try {
      const { ok, body } = await uploadWithProgress(
        `/api/signup/player/${playerId}/photo`,
        file,
        setProgress,
      )
      if (!ok || !body.success) {
        replaceLocalPreview(null)
        setError(body.error || 'Upload failed. Please try again.')
        return
      }
      setCacheBust(Date.now())
      onUploaded()
    } catch {
      replaceLocalPreview(null)
      setError('Network error. Please try again.')
    } finally {
      setIsUploading(false)
      setProgress(0)
      clearInput()
    }
  }

  const statusText = isUploading
    ? progress >= 100
      ? 'Saving photo...'
      : `Uploading... ${progress}%`
    : hasPhoto
      ? 'Drag a new photo here or click to replace'
      : 'Drag a photo here or click to upload'

  return (
    <div className="space-y-2">
      <p className="text-xs" style={{ color: 'var(--secondary-text)' }}>
        This helps coaches learn names. It&apos;s used in the portal and by coaches only. JPEG, PNG,
        WebP, or HEIC, {PHOTO_MAX_MB} MB or smaller.
      </p>
      {(hasPhoto || localPreview) && (
        <PhotoPreview
          src={localPreview || `/api/signup/player/${playerId}/photo?v=${cacheBust}`}
          downloadUrl={`/api/signup/player/${playerId}/photo?v=${cacheBust}`}
        />
      )}
      <div
        className="border-2 border-dashed rounded-md p-6 text-center"
        style={{
          borderColor: isDragging ? 'var(--accent)' : 'var(--border)',
          cursor: isUploading ? 'default' : 'pointer',
        }}
        aria-busy={isUploading || undefined}
        onClick={() => {
          if (!isUploading) inputRef.current?.click()
        }}
        onDragOver={e => {
          e.preventDefault()
          if (!isUploading) setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => {
          e.preventDefault()
          setIsDragging(false)
          if (isUploading) return
          const file = e.dataTransfer.files?.[0]
          if (file) upload(file)
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={isUploading}
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) upload(file)
          }}
        />
        <p style={{ color: isDragging ? 'var(--accent)' : 'var(--secondary-text)' }}>{statusText}</p>
        {isUploading && (
          <div
            className="mt-3 mx-auto max-w-xs h-1.5 rounded-full overflow-hidden"
            style={{ background: 'var(--border)' }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Photo upload"
          >
            <div
              className="h-full"
              style={{
                width: `${progress}%`,
                background: 'var(--accent)',
                transition: 'width 150ms linear',
              }}
            />
          </div>
        )}
      </div>
      {error && (
        <div className="border px-4 py-3 rounded font-medium" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#dc2626' }}>
          {error}
        </div>
      )}
    </div>
  )
}
