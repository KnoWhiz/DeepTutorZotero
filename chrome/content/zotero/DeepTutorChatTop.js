import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useDeepTutorTheme } from './theme/useDeepTutorTheme.js';

// Icon paths
const HistoryIconPath = 'chrome://zotero/content/DeepTutorMaterials/Top/TOP_HISTORY_NEW.svg';
const HistoryIconDarkPath = 'chrome://zotero/content/DeepTutorMaterials/Top/TOP_HISTORY_DARK.svg';
const SettingsIconPath = 'chrome://zotero/content/DeepTutorMaterials/Settings/SETTINGS_BUTTON.svg';
const SettingsIconDarkPath = 'chrome://zotero/content/DeepTutorMaterials/Settings/SETTINGS_BUTTON_DARK.svg';
const PlusIconPath = 'chrome://zotero/content/DeepTutorMaterials/Top/TOP_NEW.svg';
const PlusIconDarkPath = 'chrome://zotero/content/DeepTutorMaterials/Top/TOP_NEW_DARK.svg';
const CloseIconPath = 'chrome://zotero/content/DeepTutorMaterials/Main/MAIN_CLOSE.svg';
const CloseIconDarkPath = 'chrome://zotero/content/DeepTutorMaterials/Main/CLOSE_DARK.svg';

/**
 * DeepTutorChatTop component handles the session tabs and top-right functional buttons
 * @param {Object} props - Component props
 * @param {Object} props.currentSession - Currently active session
 * @param {Array} props.sessions - Array of all sessions
 * @param {Function} props.onSessionSelect - Callback when a session is selected
 * @param {Function} props.onDeleteSession - Callback when a session is deleted
 * @param {Function} props.onOpenSessionHistory - Callback to open session history
 * @param {Function} props.onToggleSettingsPopup - Callback to toggle settings popup
 * @param {Function} props.onToggleModelSelectionPopup - Callback to toggle model selection popup
 */
const DeepTutorChatTop = ({
	currentSession,
	sessions = [],
	onSessionSelect,
	onDeleteSession,
	onOpenSessionHistory,
	onToggleSettingsPopup,
	onToggleModelSelectionPopup
}) => {
	const { colors, isDark } = useDeepTutorTheme();
	
	// State for managing hover states
	const [hoveredTabId, setHoveredTabId] = useState(null);
	
	// Get the most recent 3 sessions, sorted by lastUpdatedTime
	const recentSessions = useMemo(() => {
		return sessions
			.filter(session => session && session.id)
			.sort((a, b) => new Date(b.lastUpdatedTime || 0) - new Date(a.lastUpdatedTime || 0))
			.slice(0, 3);
	}, [sessions]);

	// Choose icons based on theme
	const historyIconPath = isDark ? HistoryIconDarkPath : HistoryIconPath;
	const settingsIconPath = isDark ? SettingsIconDarkPath : SettingsIconPath;
	const plusIconPath = isDark ? PlusIconDarkPath : PlusIconPath;
	const closeIconPath = isDark ? CloseIconDarkPath : CloseIconPath;

	// Theme-aware styles
	const styles = {
		sessionNameDiv: {
			width: '100%',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'space-between',
			gap: '0.75rem',
			minHeight: '1.5rem',
			marginBottom: '0.5rem',
			padding: '0rem 0.5rem 0rem 0rem',
		},
		sessionNameDivNoSessions: {
			width: '100%',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'flex-end',
			gap: '0.75rem',
			minHeight: '1.5rem',
			marginBottom: '0.5rem',
			padding: '0rem 0.5rem 0rem 0rem',
		},
		topRight: {
			display: 'flex',
			flexDirection: 'row',
			gap: '0.25rem',
			alignItems: 'center',
		},
		iconButton: {
			width: '24px',
			height: '24px',
			background: colors.background.tertiary,
			border: 'none',
			borderRadius: '0.375rem',
			cursor: 'pointer',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			transition: 'background-color 0.2s ease',
			padding: '1rem',
		},
		iconImage: {
			width: '1.4rem',
			height: '1.4rem',
			objectFit: 'contain',
		},
		settingsButton: {
			width: '2.5rem',
			height: '2.5rem',
			background: colors.background.tertiary,
			border: 'none',
			borderRadius: '0.375rem',
			cursor: 'pointer',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			transition: 'background-color 0.2s ease',
		},
		settingsIconImage: {
			width: '2rem',
			height: '2rem',
			objectFit: 'contain',
		},
		// Session tabs styles
		sessionTabsContainer: {
			display: 'flex',
			flexDirection: 'row',
			gap: '0.25rem',
			overflow: 'hidden',
			flex: 1,
			minWidth: 0,
			alignItems: 'center',
		},
		sessionTab: {
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'space-between',
			background: isDark ? '#2a2a2a' : colors.background.tertiary,
			border: `1px solid ${isDark ? '#404040' : '#d0d0d0'}`,
			borderRadius: '0.375rem',
			padding: '0.125rem 0.75rem',
			cursor: 'pointer',
			transition: 'all 0.2s ease',
			minWidth: '0',
			flex: '1',
			maxWidth: '150px',
			position: 'relative',
			height: '20px',
		},
		sessionTabActive: {
			background: isDark ? '#404040' : '#ffffff',
			borderColor: isDark ? '#606060' : '#e0e0e0',
		},
		sessionTabHovered: {
			background: colors.border.quaternary,
		},
		sessionTabTextHovered: {
			// Keep fade effect on hover
		},
		sessionTabText: {
			color: isDark ? '#808080' : '#6B7280',
			fontWeight: 500,
			fontSize: '12px',
			lineHeight: '1.2',
			overflow: 'hidden',
			whiteSpace: 'nowrap',
			flex: 1,
			position: 'relative',
			background: `linear-gradient(to right, currentColor 0%, currentColor 85%, transparent 100%)`,
			WebkitBackgroundClip: 'text',
			backgroundClip: 'text',
			WebkitTextFillColor: 'transparent',
		},
		sessionTabActiveText: {
			color: isDark ? '#d0d0d0' : colors.text.allText,
		},
		sessionTabCloseButton: {
			width: '1.25rem',
			height: '1.25rem',
			border: 'none',
			borderRadius: '0.25rem',
			cursor: 'pointer',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			padding: '0.125rem',
			flexShrink: 0,
			opacity: 0,
			transition: 'opacity 0.2s ease',
			position: 'absolute',
			right: '0.25rem',
			top: '50%',
			transform: 'translateY(-50%)',
		},
		sessionTabCloseButtonVisible: {
			opacity: 1,
		},
		sessionTabCloseIcon: {
			width: '0.625rem',
			height: '0.625rem',
			objectFit: 'contain',
		},
	};

	// Session tab handlers
	const handleTabClick = (sessionId) => {
		if (onSessionSelect && sessionId !== currentSession?.id) {
			onSessionSelect(sessionId);
		}
	};
	
	const handleTabClose = (e, sessionId) => {
		e.stopPropagation();
		if (onDeleteSession) {
			onDeleteSession(sessionId);
		}
	};
	
	const handleTabMouseEnter = (sessionId) => {
		setHoveredTabId(sessionId);
	};
	
	const handleTabMouseLeave = () => {
		setHoveredTabId(null);
	};

	return (
		<div style={recentSessions.length > 0 ? styles.sessionNameDiv : styles.sessionNameDivNoSessions}>
			{/* Session Tabs */}
			{recentSessions.length > 0 && (
				<div style={styles.sessionTabsContainer}>
					{recentSessions.map((session) => {
						const isActive = currentSession?.id === session.id;
						const isHovered = hoveredTabId === session.id;
						const displayName = session.sessionName || 'Unnamed Session';
						return (
							<div
								key={session.id}
								style={{
									...styles.sessionTab,
									...(isActive ? styles.sessionTabActive : {}),
									...(isHovered && !isActive ? styles.sessionTabHovered : {}),
								}}
								onClick={() => handleTabClick(session.id)}
								onMouseEnter={() => handleTabMouseEnter(session.id)}
								onMouseLeave={handleTabMouseLeave}
							>
								<div style={{
									...styles.sessionTabText,
									...(isActive ? styles.sessionTabActiveText : {}),
									...(isHovered ? styles.sessionTabTextHovered : {}),
								}}>
									{displayName}
								</div>
								<button
									style={{
										...styles.sessionTabCloseButton,
										...(isHovered ? styles.sessionTabCloseButtonVisible : {}),
										background: isActive
											? (isDark ? '#404040' : '#ffffff')
											: colors.border.quaternary,
									}}
									onClick={e => handleTabClose(e, session.id)}
									title="Delete Session"
								>
									<img
										src={closeIconPath}
										alt="Close"
										style={styles.sessionTabCloseIcon}
									/>
								</button>
							</div>
						);
					})}
				</div>
			)}
			
			{/* Top Right Buttons */}
			<div style={styles.topRight}>
				<button
					style={styles.iconButton}
					onClick={() => onOpenSessionHistory && onOpenSessionHistory()}
					title="Session History"
				>
					<img src={historyIconPath} alt="History" style={styles.iconImage} />
				</button>
				<button
					style={styles.settingsButton}
					onClick={() => onToggleSettingsPopup && onToggleSettingsPopup()}
					title="Settings"
				>
					<img src={settingsIconPath} alt="Settings" style={styles.settingsIconImage} />
				</button>
				<button
					style={styles.iconButton}
					onClick={() => onToggleModelSelectionPopup && onToggleModelSelectionPopup()}
					title="Create New Session"
				>
					<img src={plusIconPath} alt="New Session" style={styles.iconImage} />
				</button>
			</div>
		</div>
	);
};

DeepTutorChatTop.propTypes = {
	currentSession: PropTypes.object,
	sessions: PropTypes.array,
	onSessionSelect: PropTypes.func,
	onDeleteSession: PropTypes.func,
	onOpenSessionHistory: PropTypes.func,
	onToggleSettingsPopup: PropTypes.func,
	onToggleModelSelectionPopup: PropTypes.func
};

export default DeepTutorChatTop;
