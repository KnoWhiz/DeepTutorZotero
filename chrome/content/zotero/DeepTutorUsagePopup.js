import React from "react";
import PropTypes from "prop-types";
import { useDeepTutorTheme } from "./theme/useDeepTutorTheme.js";

// Close icon paths (match other popups)
const PopupClosePath = "chrome://zotero/content/DeepTutorMaterials/Main/MAIN_CLOSE.svg";
const PopupCloseDarkPath = "chrome://zotero/content/DeepTutorMaterials/Main/CLOSE_DARK.svg";

/**
 * DeepTutorUsagePopup Component
 * Placeholder usage popup that will be implemented later
 * Shows basic usage information and close button
 */
export default function DeepTutorUsagePopup({ onClose }) {
	const { colors, isDark } = useDeepTutorTheme();
	const closePath = isDark ? PopupCloseDarkPath : PopupClosePath;

	const styles = {
		overlay: {
			position: "fixed",
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			background: "rgba(0, 0, 0, 0.5)",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			zIndex: 1000
		},
		container: {
			background: colors.background.primary,
			borderRadius: "0.5rem",
			padding: "2rem",
			maxWidth: "24rem",
			width: "100%",
			position: "relative",
			border: isDark ? `1px solid ${colors.popup.border}` : "none",
			fontFamily: "Roboto, sans-serif"
		},
		title: {
			width: "100%",
			textAlign: "center",
			background: "linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)",
			WebkitBackgroundClip: "text",
			WebkitTextFillColor: "transparent",
			backgroundClip: "text",
			color: "#0687E5",
			fontWeight: 700,
			fontSize: "1.5rem",
			lineHeight: "1.2",
			letterSpacing: "0%",
			marginBottom: "1.5rem"
		},
		closeButton: {
			all: "revert",
			background: "none",
			border: "none",
			cursor: "pointer",
			position: "absolute",
			right: "1rem",
			top: "1rem",
			width: "1rem",
			height: "1rem",
			display: "flex",
			alignItems: "center",
			justifyContent: "center"
		},
		content: {
			textAlign: "center",
			color: colors.text.primary,
			fontSize: "1rem",
			lineHeight: "1.5"
		},
		placeholderText: {
			color: colors.text.tertiary,
			fontStyle: "italic",
			marginTop: "1rem"
		}
	};

	return (
		<div style={styles.overlay} onClick={onClose}>
			<div style={styles.container} onClick={(e) => e.stopPropagation()}>
				{/* Close button positioned at top right */}
				<button
					onClick={onClose}
					style={styles.closeButton}
				>
					<img src={closePath} alt="Close" style={{ width: "1rem", height: "1rem" }} />
				</button>

				{/* Title */}
				<div style={styles.title}>
					Usage
				</div>

				{/* Content */}
				<div style={styles.content}>
					<div>Usage statistics and information will be displayed here.</div>
					<div style={styles.placeholderText}>
						This feature is coming soon!
					</div>
				</div>
			</div>
		</div>
	);
}

// PropTypes for component validation
DeepTutorUsagePopup.propTypes = {
	/** Callback to close the popup */
	onClose: PropTypes.func.isRequired
};

