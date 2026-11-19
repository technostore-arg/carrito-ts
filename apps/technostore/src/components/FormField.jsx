/** Campo de formulario reutilizable: etiqueta + control + hint/error visibles. */
export function FormField({ label, error, hint, required, id, children }) {
  return (
    <div className="ts-field">
      {label && (
        <label htmlFor={id} className="ts-field-label">
          {label}{required && <span className="ts-field-label-req" aria-hidden> *</span>}
        </label>
      )}
      {children}
      {hint && !error && <span className="ts-field-hint">{hint}</span>}
      {error && <span className="ts-field-error" role="alert">{error}</span>}
    </div>
  )
}

export default FormField
