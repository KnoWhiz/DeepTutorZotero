import React from 'react';
import PropTypes from 'prop-types';
import { useDeepTutorTheme } from './theme/useDeepTutorTheme.js';

export default function DeepTutorFileSizeWarning({ onClose, fileName, fileSizeMB, sizeLimitMB, subscriptionType }) {
	const { colors } = useDeepTutorTheme();
	const [isButtonHovered, setIsButtonHovered] = React.useState(false);

	// Get file size limit message based on subscription type
	const getFileSizeLimitMessage = () => {
		switch (subscriptionType) {
			case "BASIC":
				return `Basic subscription allows files up to ${sizeLimitMB}MB`;
			case "PLUS":
				return `Pro subscription allows files up to ${sizeLimitMB}MB`;
			case "PREMIUM":
				return `Premium subscription allows files up to ${sizeLimitMB}MB`;
			default:
				return `File size limit: ${sizeLimitMB}MB`;
		}
	};

	const styles = {
		container: {
			width: '100%',
			minHeight: '80%',
			background: colors.background.primary,
			fontFamily: 'Roboto, sans-serif',
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			position: 'relative',
		},
		content: {
			width: '100%',
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
		},
		title: {
			width: '100%',
			textAlign: 'center',
			background: 'linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)',
			WebkitBackgroundClip: 'text',
			WebkitTextFillColor: 'transparent',
			backgroundClip: 'text',
			color: '#0687E5',
			fontWeight: 700,
			fontSize: '1.5rem',
			lineHeight: '1.2',
			letterSpacing: '0%',
			marginBottom: '1.5rem'
		},
		message: {
			fontSize: '1rem',
			color: colors.text.allText,
			textAlign: 'left',
			marginBottom: '1.875rem',
			fontWeight: 400,
			lineHeight: '135%',
		},
		fileName: {
			fontSize: '1rem',
			color: colors.text.allText,
			textAlign: 'left',
			marginBottom: '0.5rem',
			fontWeight: 600,
			lineHeight: '135%',
		},
		fileSizeInfo: {
			fontSize: '0.9rem',
			color: colors.text.tertiary,
			textAlign: 'left',
			marginBottom: '1rem',
			fontWeight: 400,
			lineHeight: '135%',
		},
		subscriptionInfo: {
			fontSize: '0.9rem',
			color: colors.text.tertiary,
			textAlign: 'left',
			marginBottom: '1.875rem',
			fontWeight: 400,
			lineHeight: '135%',
			fontStyle: 'italic',
		},
		button: {
			all: 'revert',
			background: colors.button.primary,
			color: colors.button.primaryText,
			border: 'none',
			borderRadius: '0.625rem',
			padding: '0.75rem 1.5rem',
			minHeight: '3rem',
			fontWeight: 600,
			fontSize: '1rem',
			cursor: 'pointer',
			boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.08)',
			fontFamily: 'Roboto, sans-serif',
			letterSpacing: 0.2,
			transition: 'background 0.2s',
			display: 'block',
			width: '100%',
		},
		buttonHover: {
			background: colors.button.primaryHover,
		}
	};

	const handleClose = () => {
		if (onClose) {
			onClose();
		}
	};

	const buttonDynamicStyle = {
		...styles.button,
		...(isButtonHovered ? styles.buttonHover : {})
	};

	return (
		<div style={styles.container}>
			<div style={styles.content}>
				<div style={styles.title}>
					File Too Large
				</div>
				<div style={styles.message}>
					The selected file exceeds the size limit for your current subscription.
				</div>
				{fileName && (
					<div style={styles.fileName}>
						File: {fileName}
					</div>
				)}
				{fileSizeMB && sizeLimitMB && (
					<div style={styles.fileSizeInfo}>
						File size: {fileSizeMB.toFixed(2)}MB (Limit: {sizeLimitMB}MB)
					</div>
				)}
				<div style={styles.subscriptionInfo}>
					{getFileSizeLimitMessage()}. Please upgrade your subscription to process larger files.
				</div>
				<button
					style={buttonDynamicStyle}
					onClick={handleClose}
					onMouseEnter={() => setIsButtonHovered(true)}
					onMouseLeave={() => setIsButtonHovered(false)}
				>
					Got It
				</button>
			</div>
		</div>
	);
}

DeepTutorFileSizeWarning.propTypes = {
	onClose: PropTypes.func.isRequired,
	fileName: PropTypes.string,
	fileSizeMB: PropTypes.number,
	sizeLimitMB: PropTypes.number,
	subscriptionType: PropTypes.string
};

DeepTutorFileSizeWarning.defaultProps = {
	fileName: '',
	fileSizeMB: null,
	sizeLimitMB: null,
	subscriptionType: 'BASIC'
};
