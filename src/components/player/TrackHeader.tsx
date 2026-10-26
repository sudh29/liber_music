/**
 * Props interface for TrackHeader component
 */
export interface TrackHeaderProps {
	/** Track title */
	title: string;
	/** Artist name */
	artist: string;
}

/**
 * Track header component
 * 
 * Displays song title and artist information, always centered.
 * 
 * @param props Component properties
 */
export function TrackHeader({ title, artist }: TrackHeaderProps) {
	return (
		<div className="track-header">
			<h2 className="track-title">{title}</h2>
			<div className="artist-name">{artist}</div>
		</div>
	);
}

