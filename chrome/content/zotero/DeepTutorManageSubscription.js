import React, { useState } from 'react';
import { useDeepTutorTheme } from './theme/useDeepTutorTheme.js';

const SKY = '#0687E5';
const styles = {
	container: {
		width: '100%',
		minHeight: '80%',
		background: '#FFFFFF',
		fontFamily: 'Roboto, sans-serif',
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
		position: 'relative',
	},
	title: {
		background: 'linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)',
		WebkitBackgroundClip: 'text',
		WebkitTextFillColor: 'transparent',
		backgroundClip: 'text',
		color: SKY,
		fontWeight: 700,
		fontSize: '1.5rem',
		lineHeight: '100%',
		letterSpacing: '0%',
		textAlign: 'center',
		marginBottom: '1.125rem',
		marginTop: '0.5rem',
	},
	image: {
		width: '9rem',
		height: '9rem',
		objectFit: 'contain',
		margin: '0 auto 1.25rem auto',
		display: 'block',
	},
	text: {
		fontSize: '1rem',
		color: '#222',
		textAlign: 'left',
		margin: '0 0 1.125rem 0',
		fontFamily: 'Roboto, sans-serif',
		fontWeight: 400,
		lineHeight: '1.35',
		marginBottom: '1.875rem',
	},
	button: {
		all: 'revert',
		background: SKY,
		color: '#fff',
		fontWeight: 600,
		fontSize: '1rem',
		border: 'none',
		borderRadius: '0.625rem',
		padding: '0.875rem 0',
		width: '100%',
		margin: '0 auto 0.625rem auto',
		cursor: 'pointer',
		boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.08)',
		fontFamily: 'Roboto, sans-serif',
		letterSpacing: 0.2,
		display: 'block',
	},
	cancelButton: {
		all: 'revert',
		background: '#fff',
		color: SKY,
		fontWeight: 600,
		fontSize: '1rem',
		border: `0.125rem solid ${SKY}`,
		boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.08)',
		borderRadius: '0.625rem',
		width: '100%',
		padding: '0.875rem 0',
		margin: '0.75rem auto 0 auto',
		cursor: 'pointer',
		fontFamily: 'Roboto, sans-serif',
		letterSpacing: 0.2,
		display: 'block',
	},
};

export default function DeepTutorManageSubscription({ imagePath, onManage, onCancel }) {
	const { colors } = useDeepTutorTheme();
	const [isManageHovered, setIsManageHovered] = useState(false);
	const [isCancelHovered, setIsCancelHovered] = useState(false);

	const manageButtonDynamicStyle = {
		...styles.button,
		background: isManageHovered ? colors.button.primaryHover : colors.button.primary,
	};

	const cancelButtonDynamicStyle = {
		...styles.cancelButton,
		background: isCancelHovered ? colors.background.quaternary : colors.button.secondary,
	};

	return (
		<div style={styles.container}>
			<img src={imagePath} alt="Manage Subscription" style={styles.image} />
			<div style={styles.text}>
        You can add or modify your payment method,
        changing your billing information, view your payment history,
        or cancel your subscription here.
			</div>
			<button 
				style={manageButtonDynamicStyle} 
				onClick={onManage}
				onMouseEnter={() => setIsManageHovered(true)}
				onMouseLeave={() => setIsManageHovered(false)}
			>
				Manage
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
	);
}
