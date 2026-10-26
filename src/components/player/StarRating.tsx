/**
 * Interactive Star Rating component (0 to 5 stars)
 * 
 * Supports hover preview, clear-on-active-click, and persistent rating dispatch.
 */

import React from "react";
import "./StarRating.css";

export interface StarRatingProps {
	/** Current saved rating (0 - 5) */
	rating?: number;
	/** Callback when a rating is chosen */
	onRate?: (rating: number) => void;
	/** Optional class name */
	className?: string;
	/** Read-only mode */
	readOnly?: boolean;
}

export function StarRating({
	rating = 0,
	onRate,
	className = "",
	readOnly = false,
}: StarRatingProps) {
	const [hoverRating, setHoverRating] = React.useState<number | null>(null);

	const activeStars = hoverRating !== null ? hoverRating : rating;

	const handleClick = (starValue: number) => {
		if (readOnly || !onRate) return;
		// Clicking current rating clears it back to 0
		if (rating === starValue) {
			onRate(0);
		} else {
			onRate(starValue);
		}
	};

	return (
		<div
			className={`star-rating-container ${className} ${readOnly ? "is-readonly" : ""}`}
			onMouseLeave={() => setHoverRating(null)}
			role="group"
			aria-label="Track rating"
		>
			{[1, 2, 3, 4, 5].map((starValue) => {
				const isFilled = starValue <= activeStars;
				return (
					<button
						key={starValue}
						type="button"
						className={`star-button ${isFilled ? "is-filled" : "is-empty"}`}
						onClick={() => handleClick(starValue)}
						onMouseEnter={() => !readOnly && setHoverRating(starValue)}
						aria-label={
							rating === starValue
								? `Clear rating (${starValue} stars)`
								: `Rate ${starValue} star${starValue > 1 ? "s" : ""}`
						}
						title={
							readOnly
								? `${rating} / 5`
								: rating === starValue
								? `Click to clear rating`
								: `${starValue} star${starValue > 1 ? "s" : ""}`
						}
						disabled={readOnly}
					>
						★
					</button>
				);
			})}
		</div>
	);
}
