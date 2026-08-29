/** Required-field marker, colored to stand out from the label text instead of blending in. */
export function Req() {
  return <span style={{ color: '#f87171' }}> *</span>
}

/** Sits between a label and its input. */
export function HelperText({ children }: { children: React.ReactNode }) {
  return <p className="text-xs" style={{ color: 'var(--secondary-text)' }}>{children}</p>
}
