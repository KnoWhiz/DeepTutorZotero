import React, { useState } from "react";
import { useDeepTutorTheme } from './theme/useDeepTutorTheme.js';

const SKY = "#0687E5";
const styles = {
	container: {
		width: "100%",
		minHeight: "80%",
		background: "#FFFFFF",
		fontFamily: "Roboto, sans-serif",
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "flex-start",
		position: "relative",
	},
	contentFrame: {
		width: "100%",
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		padding: "0 1.25rem",
		marginBottom: "1.875rem",
	},
	text: {
		fontSize: "1.25rem",
		color: "#222",
		textAlign: "left",
		margin: "0 0 30px 0",
		fontFamily: "Roboto, sans-serif",
		fontWeight: 500,
		lineHeight: "1.35",
	},
	button: {
		all: "revert",
		background: SKY,
		color: "#fff",
		width: "100%",
		minHeight: "2.4375rem",
		fontWeight: 700,
		fontSize: '1rem',
		border: "none",
		borderRadius: "0.625rem",
		padding: "0.875rem 0",
		margin: "0 0 0.75rem 0",
		cursor: "pointer",
		boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
		fontFamily: "Roboto, sans-serif",
		letterSpacing: 0.2,
		display: "block",
	},
	cancelButton: {
		all: "revert",
		background: "#fff",
		color: SKY,
		width: "100%",
		minHeight: "2.4375rem",
		fontWeight: 700,
		fontSize: '1rem',
		border: `0.125rem solid ${SKY}`,
		borderRadius: "0.625rem",
		padding: "0.875rem 0",
		margin: 0,
		cursor: "pointer",
		boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
		fontFamily: "Roboto, sans-serif",
		letterSpacing: 0.2,
		display: "block",
	},
	buttonCol: {
		width: "100%",
		display: "flex",
		flexDirection: "column",
		gap: "0.75rem",
		alignItems: "center"
	}
};

/**
 * Processing Subscription Popup
 * @param {Object} props
 * @param {() => void} props.onContinue - Called when user clicks Continue
 * @param {() => void} props.onCancel - Called when user clicks Cancel
 */
export default function DeepTutorProcessingSubscription({ onContinue, onCancel }) {
	const { colors } = useDeepTutorTheme();
	const [isContinueHovered, setIsContinueHovered] = useState(false);
	const [isCancelHovered, setIsCancelHovered] = useState(false);

	const continueButtonDynamicStyle = {
		...styles.button,
		background: isContinueHovered ? colors.button.primaryHover : colors.button.primary,
	};

	const cancelButtonDynamicStyle = {
		...styles.cancelButton,
		background: isCancelHovered ? colors.background.quaternary : colors.button.secondary,
	};

	return (
		<div style={styles.container}>
			<div style={styles.contentFrame}>
				<div style={styles.text}>
					You&apos;ll now be redirected to a secure page to set up your subscription.<br />
					You may need to sign in again.<br />
					Once done, come back here and click &apos;Continue&apos;.
				</div>
				<div style={styles.buttonCol}>
					<button 
						style={continueButtonDynamicStyle} 
						onClick={onContinue}
						onMouseEnter={() => setIsContinueHovered(true)}
						onMouseLeave={() => setIsContinueHovered(false)}
					>
						Continue
					</button>
					<button 
						style={cancelButtonDynamicStyle} 
						onClick={onCancel}
						onMouseEnter={() => setIsCancelHovered(true)}
						onMouseLeave={() => setIsCancelHovered(false)}
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	);
}
