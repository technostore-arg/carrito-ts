export default function Badge({ children, deal }) {
  return <span className={`badge ${deal ? "deal" : ""}`}>{children}</span>
}
