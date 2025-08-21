import React, { useState, useEffect, useRef } from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';
import { useDeepTutorTheme } from './theme/useDeepTutorTheme.js';

const ClaudeCliWrapper = require('./ClaudeCliWrapper.js');

export default function ClaudeAutoInstall({
	onInstallComplete,
	onCancel
}) {
	const { colors } = useDeepTutorTheme();
	const [apiKey, setApiKey] = useState('');
	const [isInstalling, setIsInstalling] = useState(false);
	const [installationResult, setInstallationResult] = useState(null);
	const textareaRef = useRef(null);

	// Select all text when component mounts
	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.focus();
		}
	}, []);

	// Auto-close after 1.5 minutes if installation is complete
	useEffect(() => {
		if (isInstalling) {
			const timer = setTimeout(() => {
				if (onInstallComplete) {
					onInstallComplete(installationResult);
				}
			}, 90000); // 1.5 minutes

			return () => clearTimeout(timer);
		}
	}, [isInstalling, installationResult, onInstallComplete]);

	// Inject CSS to ensure 13px base for rem calculations
	useEffect(() => {
		const cssText = `
			.claude-auto-install-popup {
				font-size: 13px !important;
			}
			.claude-auto-install-popup * {
				font-size: inherit;
			}
		`;
		
		try {
			if (window.document) {
				let existingStyle = window.document.getElementById('claude-auto-install-styles');
				if (existingStyle) {
					existingStyle.textContent = cssText;
				} else {
					const style = window.document.createElement('style');
					style.id = 'claude-auto-install-styles';
					style.textContent = cssText;
					if (window.document.head) {
						window.document.head.appendChild(style);
					}
				}
			}
		} catch (e) {
			console.error('Failed to inject CSS:', e.message);
		}
	}, []);

	const styles = {
		container: {
			width: '28rem',
			maxWidth: '90vw',
			background: colors.background.primary,
			fontFamily: 'Roboto, sans-serif',
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			position: 'relative',
			borderRadius: '0.625rem',
			boxShadow: '0 0.25rem 0.5rem rgba(0,0,0,0.15)',
			padding: '0.25rem 1.25rem',
		},
		header: {
			width: '100%',
			display: 'flex',
			justifyContent: 'center',
			alignItems: 'center',
			padding: '1.25rem 0 0 0',
			marginBottom: '1.5rem',
			position: 'relative',
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
		},
		closeButton: {
			all: 'revert',
			background: 'transparent',
			border: 'none',
			cursor: 'pointer',
			padding: '0.75rem',
			borderRadius: '0.25rem',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			color: colors.text.tertiary,
			fontSize: '2rem',
			lineHeight: 1,
			position: 'absolute',
			right: '0rem',
			top: '50%',
			transform: 'translateY(-50%)',
		},
		content: {
			width: '100%',
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'flex-start',
			padding: '0 0 1.25rem 0',
		},
		description: {
			width: '100%',
			color: colors.text.allText,
			fontSize: '1rem',
			fontWeight: 400,
			lineHeight: '150%',
			marginBottom: '1.5rem',
			textAlign: 'center',
		},
		label: {
			width: '100%',
			color: colors.text.allText,
			fontSize: '1rem',
			fontWeight: 500,
			marginBottom: '0.5rem',
			textAlign: 'left',
		},
		textArea: {
			width: '100%',
			minHeight: '3rem',
			height: '3rem',
			borderRadius: '0.625rem',
			border: `0.0625rem solid ${colors.border.primary}`,
			background: colors.background.secondary,
			padding: '0.75rem 0.9375rem',
			fontSize: '1rem',
			fontWeight: 400,
			lineHeight: '133%',
			letterSpacing: '0%',
			fontFamily: 'Roboto, sans-serif',
			color: colors.text.allText,
			outline: 'none',
			resize: 'vertical',
			marginBottom: '1.875rem',
			boxSizing: 'border-box',
		},
		buttonContainer: {
			width: '100%',
			display: 'flex',
			flexDirection: 'column',
			gap: '0.625rem',
		},
		installButton: {
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
			marginBottom: '0.5rem',
		},
		installButtonDisabled: {
			background: colors.background.tertiary,
			color: colors.text.tertiary,
			cursor: 'not-allowed',
			opacity: 0.7,
		},
		cancelButton: {
			background: colors.button.secondary,
			color: colors.button.primary,
			border: `1px solid ${colors.button.primary}`,
			borderRadius: '0.625rem',
			padding: '0.75rem 1.5rem',
			minHeight: '3rem',
			fontWeight: 600,
			fontSize: '1rem',
			cursor: 'pointer',
			boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.04)',
			fontFamily: 'Roboto, sans-serif',
			letterSpacing: 0.2,
			transition: 'background 0.2s',
			display: 'block',
			width: '100%',
		},
		cancelButtonDisabled: {
			opacity: 0.5,
			cursor: 'not-allowed',
		}
	};

	const handleCancel = () => {
		if (!isInstalling && onCancel) {
			onCancel();
		}
	};

	const handleInstall = async () => {
		const apiKeyString = String(apiKey || '').trim();
		
		if (!apiKeyString) {
			return;
		}

		setIsInstalling(true);
		try {
			Zotero.debug(`ClaudeAutoInstall: Starting installation with API key length: ${apiKeyString.length}`);
			
			// Resolve working directory: prefer user-configured dataDir, else default
			let workingDir = null;
			try {
				const prefDir = Zotero.Prefs.get('dataDir') || Zotero.Prefs.get('lastDataDir');
				if (prefDir && typeof prefDir === 'string') {
					workingDir = prefDir;
				}
				else if (Zotero.DataDirectory && typeof Zotero.DataDirectory.dir === 'string') {
					workingDir = Zotero.DataDirectory.dir;
				}
			} catch (e) { 
				Zotero.debug(e); 
			}
			
			if (!workingDir) {
				Zotero.debug(`ClaudeAutoInstall: No working directory found, using default`);
				workingDir = '/home/sherman01/Zotero';
			}

			const result = await ClaudeCliWrapper.installClaude(apiKeyString, workingDir);
			Zotero.debug(`ClaudeAutoInstall: Installation result: ${JSON.stringify(result)}`);
			
			setInstallationResult(result);
			
			// Don't auto-close immediately, wait for the timer
		}
		catch (error) {
			Zotero.debug(`ClaudeAutoInstall: Error during installation: ${error.message}`);
			setInstallationResult({ ok: false, error: error });
		}
	};

	const getInstallButtonText = () => {
		if (isInstalling) {
			return 'Please wait for 1.5 minutes...';
		}
		return 'Install Claude';
	};

	const installButtonDynamicStyle = {
		...styles.installButton,
		...(isInstalling || !apiKey.trim() ? styles.installButtonDisabled : {}),
	};

	const cancelButtonDynamicStyle = {
		...styles.cancelButton,
		...(isInstalling ? styles.cancelButtonDisabled : {}),
	};

	return (
		<div style={styles.container} className="claude-auto-install-popup">
			<div style={styles.header}>
				<div style={styles.title}>Install Claude</div>
				<button
					style={styles.closeButton}
					onClick={handleCancel}
					disabled={isInstalling}
				>
					×
				</button>
			</div>
			<div style={styles.content}>
				<div style={styles.description}>
					Claude not installed, please get an API key and install claude.
				</div>
				<div style={styles.label}>API Key</div>
				<textarea
					ref={textareaRef}
					style={styles.textArea}
					value={apiKey}
					onChange={e => setApiKey(e.target.value)}
					disabled={isInstalling}
					placeholder="Enter your Claude API key..."
				/>
				<div style={styles.buttonContainer}>
					<button
						style={installButtonDynamicStyle}
						onClick={handleInstall}
						disabled={isInstalling || !apiKey.trim()}
					>
						{getInstallButtonText()}
					</button>
					<button
						style={cancelButtonDynamicStyle}
						onClick={handleCancel}
						disabled={isInstalling}
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	);
}

ClaudeAutoInstall.propTypes = {
	onInstallComplete: PropTypes.func.isRequired,
	onCancel: PropTypes.func.isRequired
};
