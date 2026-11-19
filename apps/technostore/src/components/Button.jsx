/**
 * Botón profesional (TechnoStore). Variants: primary | secondary | ghost | danger.
 * Sizes: xs | sm | md | lg. Cursor pointer, estados focus/hover/disabled definidos en ui.css.
 */
import { forwardRef } from 'react'

export const Button = forwardRef(function Button({ variant = 'primary', size = 'md', className, disabled, loading, children, ...rest }, ref) {
  const cls = ['ts-btn', `ts-btn--${variant}`, `ts-btn--${size}`, className].filter(Boolean).join(' ')
  return (
    <button ref={ref} className={cls} disabled={disabled} {...rest}>
      {loading ? <span className="ts-spinner" aria-hidden /> : children}
    </button>
  )
})

export default Button
