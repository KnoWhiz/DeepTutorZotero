import React, { useState, useRef, useEffect } from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';
import { useDeepTutorTheme } from './theme/useDeepTutorTheme.js';

/**
 * DeepTutorBrowser component for embedding web content within the DeepTutor app
 * Uses XUL browser element for secure web content display with navigation controls
 */
const DeepTutorBrowser = (props) => {
	const { colors, isDark } = useDeepTutorTheme();
	const [currentUrl, setCurrentUrl] = useState(props.initialUrl || 'https://www.google.com');
	const [isLoading, setIsLoading] = useState(false);
	const [canGoBack, setCanGoBack] = useState(false);
	const [canGoForward, setCanGoForward] = useState(false);
	const [hasError, setHasError] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const browserRef = useRef(null);
	const urlInputRef = useRef(null);

	// Theme-aware styles
	const styles = {
		container: {
			display: 'flex',
			flexDirection: 'column',
			height: '100%',
			width: '100%',
			background: colors.background.primary,
			fontFamily: 'Roboto, Inter, Arial, sans-serif',
		},
		controls: {
			display: 'flex',
			flexDirection: 'row',
			alignItems: 'center',
			padding: '0.75rem',
			background: colors.background.secondary,
			borderBottom: `0.0625rem solid ${colors.border.primary}`,
			gap: '0.5rem',
		},
		navButton: {
			width: '2rem',
			height: '2rem',
			background: colors.background.tertiary,
			border: `0.0625rem solid ${colors.border.primary}`,
			borderRadius: '0.25rem',
			cursor: 'pointer',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			transition: 'background-color 0.2s ease',
			color: colors.text.allText,
		},
		navButtonDisabled: {
			opacity: 0.5,
			cursor: 'not-allowed',
		},
		navButtonHover: {
			background: colors.background.quaternary,
		},
		refreshButton: {
			width: '2rem',
			height: '2rem',
			background: colors.background.tertiary,
			border: `0.0625rem solid ${colors.border.primary}`,
			borderRadius: '0.25rem',
			cursor: 'pointer',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			transition: 'background-color 0.2s ease',
			color: colors.text.allText,
		},
		urlInput: {
			flex: 1,
			height: '2rem',
			padding: '0.5rem',
			background: colors.background.primary,
			border: `0.0625rem solid ${colors.border.primary}`,
			borderRadius: '0.25rem',
			color: colors.text.allText,
			fontSize: '0.875rem',
			outline: 'none',
		},
		urlInputFocus: {
			borderColor: colors.button.primary,
		},
		browserContainer: {
			flex: 1,
			position: 'relative',
			background: colors.background.primary,
			width: '100%',
			height: '100%',
		},
		loadingOverlay: {
			position: 'absolute',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			background: colors.background.primary,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			color: colors.text.secondary,
			fontSize: '0.875rem',
		},
		errorMessage: {
			position: 'absolute',
			top: '50%',
			left: '50%',
			transform: 'translate(-50%, -50%)',
			background: colors.background.secondary,
			border: `0.0625rem solid ${colors.error}`,
			borderRadius: '0.375rem',
			padding: '1rem',
			color: colors.error,
			textAlign: 'center',
			maxWidth: '20rem',
		},
	};

	// Handle URL input changes
	const handleUrlChange = (event) => {
		setCurrentUrl(event.target.value);
	};

	// Handle URL input submission
	const handleUrlSubmit = (event) => {
		event.preventDefault();
		navigateToUrl(currentUrl);
	};

	// Navigate to a specific URL
	const navigateToUrl = (url) => {
		if (!url) return;
		
		// Clear previous errors
		setHasError(false);
		setErrorMessage('');
		
		// Add protocol if missing
		if (!url.startsWith('http://') && !url.startsWith('https://')) {
			url = 'https://' + url;
		}
		
		// Security: Basic URL validation using regex instead of URL constructor
		const urlPattern = /^https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(\/.*)?$/;
		if (!urlPattern.test(url)) {
			console.warn('DeepTutorBrowser: Invalid URL format:', url);
			setHasError(true);
			setErrorMessage('Invalid URL format');
			return;
		}
		
		// Block potentially dangerous domains (basic protection)
		const hostnameMatch = url.match(/^https?:\/\/([^\/]+)/);
		if (hostnameMatch) {
			const hostname = hostnameMatch[1].toLowerCase();
			if (hostname.includes('localhost') || hostname.includes('127.0.0.1') || hostname.includes('file://')) {
				console.warn('DeepTutorBrowser: Blocked local/private URL:', url);
				setHasError(true);
				setErrorMessage('Local and private URLs are not allowed for security reasons');
				return;
			}
		}
		
		setCurrentUrl(url);
		setIsLoading(true);
		
		// Load in XUL browser element
		const browser = browserRef.current?.querySelector("browser");
		if (browser) {
			try {
				// Try setting src attribute instead of loadURI
				browser.setAttribute("src", url);
			} catch (error) {
				console.error('DeepTutorBrowser: Failed to load URL in browser:', error);
				setIsLoading(false);
				setHasError(true);
				setErrorMessage('Failed to load the webpage. Please check the URL and try again.');
			}
		}
	};

	// Navigation functions
	const goBack = () => {
		const browser = browserRef.current?.querySelector("browser");
		if (browser && canGoBack) {
			browser.goBack();
		}
	};

	const goForward = () => {
		const browser = browserRef.current?.querySelector("browser");
		if (browser && canGoForward) {
			browser.goForward();
		}
	};

	const refresh = () => {
		const browser = browserRef.current?.querySelector("browser");
		if (browser) {
			browser.reload();
		}
	};

	// Handle browser load events
	const handleBrowserLoad = () => {
		setIsLoading(false);
		setHasError(false);
		setErrorMessage('');
		// Update navigation state
		const browser = browserRef.current?.querySelector("browser");
		if (browser) {
			setCanGoBack(browser.canGoBack);
			setCanGoForward(browser.canGoForward);
		}
	};

	const handleBrowserError = (event) => {
		setIsLoading(false);
		setHasError(true);
		console.warn('DeepTutorBrowser: Browser load error:', event);
		setErrorMessage('Failed to load the webpage. Please check the URL and try again.');
	};

	// Handle keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (event) => {
			// Ctrl/Cmd + L to focus URL bar
			if ((event.ctrlKey || event.metaKey) && event.key === 'l') {
				event.preventDefault();
				if (urlInputRef.current) {
					urlInputRef.current.focus();
					urlInputRef.current.select();
				}
			}
			// F5 or Ctrl/Cmd + R to refresh
			if (event.key === 'F5' || ((event.ctrlKey || event.metaKey) && event.key === 'r')) {
				event.preventDefault();
				refresh();
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, []);

	// Initialize browser element and load initial URL
	useEffect(() => {
		if (browserRef.current) {
			// Create XUL browser element
			const browser = document.createXULElement("browser");
			browser.setAttribute("type", "content");
			browser.setAttribute("remote", "true");
			browser.setAttribute("maychangeremoteness", "true");
			browser.setAttribute("disableglobalhistory", "true");
			browser.style.width = "100%";
			browser.style.height = "100%";
			browser.style.border = "none";
			
			// Add event listeners
			browser.addEventListener("load", handleBrowserLoad);
			browser.addEventListener("error", handleBrowserError);
			
			// Append to container
			browserRef.current.appendChild(browser);
			
			// Load initial URL
			if (props.initialUrl) {
				navigateToUrl(props.initialUrl);
			}
		}
		
		return () => {
			// Cleanup when component unmounts
			if (browserRef.current) {
				const browser = browserRef.current.querySelector("browser");
				if (browser) {
					browser.removeEventListener("load", handleBrowserLoad);
					browser.removeEventListener("error", handleBrowserError);
					browser.remove();
				}
			}
		};
	}, []);

	return (
		<div style={styles.container}>
			{/* Navigation Controls */}
			<div style={styles.controls}>
				<button
					style={{
						...styles.navButton,
						...(canGoBack ? {} : styles.navButtonDisabled)
					}}
					onClick={goBack}
					disabled={!canGoBack}
					title="Go Back"
				>
					←
				</button>
				<button
					style={{
						...styles.navButton,
						...(canGoForward ? {} : styles.navButtonDisabled)
					}}
					onClick={goForward}
					disabled={!canGoForward}
					title="Go Forward"
				>
					→
				</button>
				<button
					style={styles.refreshButton}
					onClick={refresh}
					title="Refresh"
				>
					↻
				</button>
				<form onSubmit={handleUrlSubmit} style={{ flex: 1, display: 'flex' }}>
					<input
						ref={urlInputRef}
						type="text"
						value={currentUrl}
						onChange={handleUrlChange}
						style={styles.urlInput}
						placeholder="Enter URL or search term..."
						title="Address bar - Press Enter to navigate"
					/>
				</form>
			</div>

			{/* Browser Content */}
			<div style={styles.browserContainer}>
				{isLoading && (
					<div style={styles.loadingOverlay}>
						Loading...
					</div>
				)}
				{hasError && (
					<div style={styles.errorMessage}>
						{errorMessage}
					</div>
				)}
				<div
					ref={browserRef}
					style={styles.browserContainer}
				/>
			</div>
		</div>
	);
};

DeepTutorBrowser.propTypes = {
	initialUrl: PropTypes.string,
	onUrlChange: PropTypes.func,
	onNavigationChange: PropTypes.func,
};

export default DeepTutorBrowser;
