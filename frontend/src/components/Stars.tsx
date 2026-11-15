export function Stars({ value, size = 'text-base' }: { value: number; size?: string }) {
  const rounded = Math.round(value)
  return (
    <span className={`${size} tracking-tight text-gold`} aria-label={`${value} out of 5`}>
      {'★★★★★'.slice(0, rounded)}
      <span className="text-ink/15">{'★★★★★'.slice(rounded)}</span>
    </span>
  )
}
