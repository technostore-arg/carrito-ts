export default function Button({ variant = "primary", children, ...props }) {
  const cls = variant === "ghost" ? "btn-ghost" : "btn-primary"
  return (
    <button className={cls} {...props}>
      {children}
    </button>
  )
}
