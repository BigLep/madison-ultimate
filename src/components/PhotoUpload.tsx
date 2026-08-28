"use client"

import { useRef, useState } from 'react'

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
