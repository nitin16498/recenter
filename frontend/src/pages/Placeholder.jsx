// Generic placeholder page for tabs that have their own upcoming stories.
export default function Placeholder({ title, note }) {
  return (
    <div className="page placeholder-page">
      <h1>{title}</h1>
      <p className="placeholder-note">{note}</p>
    </div>
  )
}
