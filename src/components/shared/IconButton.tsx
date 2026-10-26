import React from "react";
import { type IconName, setIcon } from "obsidian";

/**
 * Props interface for IconButton component
 */
export interface IconButtonProps {
	/** Obsidian icon name */
	icon: IconName;
	/** Button label text (for accessibility) */
	label: string;
	/** Custom CSS class name (optional) */
	className?: string;
	/** Click event callback (optional) */
	onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
	/** Double click event callback (optional) */
	onDoubleClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Generic icon button component
 * 
 * A reusable icon button component using Obsidian's built-in icon system.
 * Automatically sets the icon via ref and useEffect, supporting custom styles and click events.
 * 
 * @param props Button properties
 * @returns Button element rendered with Obsidian icon
 * 
 * @example
 * ```tsx
 * <IconButton 
 *   icon="play" 
 *   label="Play" 
 *   onClick={() => handlePlay()} 
 * />
 * ```
 */
export function IconButton({ icon, label, className, onClick, onDoubleClick }: IconButtonProps) {
	const btnRef = React.useRef<HTMLButtonElement>(null);

	React.useEffect(() => {
		if (btnRef.current) {
			setIcon(btnRef.current, icon);
		}
	}, [icon]);

	return (
		<button
			ref={btnRef}
			type="button"
			className={className}
			aria-label={label}
			onClick={onClick}
			onDoubleClick={onDoubleClick}
		/>
	);
}

