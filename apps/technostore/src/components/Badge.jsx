/** Badge de estado profesional. Variants: new | used | low | high | encargo | discount | neutral. */
export function Badge({ variant = 'neutral', children, className }) {
  return <span className={['ts-badge', `ts-badge--${variant}`, className].filter(Boolean).join(' ')}>{children}</span>
}

export default Badge
