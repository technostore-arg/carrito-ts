export default function RatingStars({ rating, reviews }) {
  return (
    <div className="rating">
      <span className="stars">
        {"★".repeat(Math.round(rating))}
        {"☆".repeat(5 - Math.round(rating))}
      </span>
      <small>
        {rating.toFixed(1)} ({reviews})
      </small>
    </div>
  )
}
