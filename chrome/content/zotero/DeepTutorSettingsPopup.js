import React, { useMemo, useState } from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';
import { useDeepTutorTheme } from './theme/useDeepTutorTheme.js';
import DeepTutorUsageContent from './DeepTutorUsageContent.js';

// Icons
const PopupClosePath = 'chrome://zotero/content/DeepTutorMaterials/Main/MAIN_CLOSE.svg';
const PopupCloseDarkPath = 'chrome://zotero/content/DeepTutorMaterials/Main/CLOSE_DARK.svg';

/**
 * Settings popup with left sidebar and right content.
 * Sidebar shows user name/email, divider, and five tabs.
 */
export default function DeepTutorSettingsPopup({ onClose, currentUser, userData, activeSubscription, usageSummary, onShowUpgrade, onSignOut, refreshUsageSummary }) {
	const { colors, isDark } = useDeepTutorTheme();

	const [activeTab, setActiveTab] = useState('subscription');
	const [hoveredTab, setHoveredTab] = useState(null);

	// Derive name/email similar to account popup
	const userName = useMemo(() => {
		if (userData && (userData.name || userData.firstName || userData.lastName)) {
			const full = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
			return (userData.name && userData.name.trim()) || (full || 'User');
		}
		return 'User';
	}, [userData]);

	const userEmail = useMemo(() => {
		if (userData && userData.email) return userData.email;
		try {
			if (currentUser && typeof currentUser.getUsername === 'function') return currentUser.getUsername();
		}
		catch { }
		return '';
	}, [userData, currentUser]);

	const styles = {
		overlay: {
			position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
			background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000
		},
		container: {
			display: 'flex', flexDirection: 'row', width: '64rem', maxWidth: '90vw', height: '40rem', maxHeight: '90vh',
			background: colors.background.primary, borderRadius: '0.5rem', overflow: 'hidden', position: 'relative',
			border: isDark ? `1px solid ${colors.popup.border}` : 'none', boxShadow: '0 0.25rem 1rem rgba(0,0,0,0.15)'
		},
		sidebar: {
			width: '18rem', background: colors.background.tertiary, borderRight: `1px solid ${colors.border.primary}`,
			padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem'
		},
		main: { flex: 1, padding: '1.75rem', overflow: 'auto' },
		userBlock: { display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.75rem' },
		nameText: { color: colors.text.primary, fontWeight: 600 },
		emailText: { color: colors.text.tertiary, fontSize: '0.9rem' },
		divider: { height: '1px', background: isDark ? colors.border.primary : '#E5E7EB', width: '100%', margin: '0.75rem 0' },
		tabButton: {
			all: 'revert', padding: '0.75rem 1rem', borderRadius: '0.375rem', border: 'none', textAlign: 'left',
			background: 'transparent', color: colors.text.primary, cursor: 'pointer', fontFamily: 'Roboto, sans-serif',
			transition: 'background-color 0.2s ease', fontSize: '0.95rem'
		},
		tabButtonActive: {
			background: isDark ? colors.background.tertiary : '#F3F4F6'
		},
		tabButtonHover: {
			background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
		},
		actionTabButton: {
			all: 'revert', padding: '0.75rem 1rem', borderRadius: '0.375rem', border: 'none', textAlign: 'left',
			background: 'transparent', color: colors.text.primary, cursor: 'pointer', fontFamily: 'Roboto, sans-serif',
			transition: 'background-color 0.2s ease', fontSize: '0.95rem', width: '100%'
		},
		actionTabButtonHover: {
			background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
		},
		closeBtn: {
			all: 'revert', background: 'none', border: 'none', cursor: 'pointer', position: 'absolute', left: '1rem', top: '1rem', width: '1rem', height: '1rem'
		},
		grid3: {
			display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem'
		},
		toolCard: {
			background: colors.background.tertiary, borderRadius: '0.5rem', padding: '1rem', border: `1px solid ${colors.border.primary}`
		},
		toolIcon: { width: '3rem', height: '3rem', marginBottom: '0.5rem' },
		toolName: { fontWeight: 600, color: colors.text.primary, marginBottom: '0.25rem' },
		toolDesc: { color: colors.text.secondary, fontSize: '0.9rem', marginBottom: '0.75rem' },
		viewBtn: {
			all: 'revert', background: colors.button.primary, color: colors.button.primaryText, border: 'none', borderRadius: '0.375rem',
			padding: '0.375rem 0.75rem', cursor: 'pointer', fontFamily: 'Roboto, sans-serif'
		},
		actionBtn: {
			all: 'revert', background: 'transparent', border: 'none', color: '#0687E5', cursor: 'pointer', textDecoration: 'underline',
			fontFamily: 'Roboto, sans-serif'
		}
	};

	const Tab = ({ id, children }) => {
		if (activeTab !== id) return null;
		return children;
	};

	Tab.propTypes = {
		id: PropTypes.string.isRequired,
		children: PropTypes.node
	};

	const MoreToolsGrid = () => {
		const tools = [
			{ key: 'summarizer', name: 'Summarizer', desc: 'Summarize PDFs and web pages with one click.', url: 'https://deeptutor.ai/tools/summarizer', icon: '' },
			{ key: 'citation', name: 'Citation Helper', desc: 'Generate accurate citations instantly.', url: 'https://deeptutor.ai/tools/citation', icon: '' },
			{ key: 'notetaker', name: 'Smart Notes', desc: 'Turn readings into structured notes.', url: 'https://deeptutor.ai/tools/smart-notes', icon: '' },
			{ key: 'translator', name: 'Translator', desc: 'Translate and align terminology.', url: 'https://deeptutor.ai/tools/translator', icon: '' },
			{ key: 'outline', name: 'Outline Builder', desc: 'Create research outlines with AI.', url: 'https://deeptutor.ai/tools/outline', icon: '' },
			{ key: 'qa', name: 'Ask Anything', desc: 'Ask questions across your library.', url: 'https://deeptutor.ai/tools/qa', icon: '' },
		];
		return (
			<div style={styles.grid3}>
				{tools.map(t => (
					<div key={t.key} style={styles.toolCard}>
						<div style={styles.toolName}>{t.name}</div>
						<div style={styles.toolDesc}>{t.desc}</div>
						<button type="button" style={styles.viewBtn} onClick={() => {
							try {
								Zotero.launchURL(t.url);
							}
							catch {
								if (navigator.clipboard) navigator.clipboard.writeText(t.url);
							}
						}}>View details</button>
					</div>
				))}
			</div>
		);
	};

	return (
		<div style={styles.overlay} onClick={onClose}>
			<div style={styles.container} onClick={e => e.stopPropagation()}>
				<button onClick={onClose} style={styles.closeBtn}>
					<img src={isDark ? PopupCloseDarkPath : PopupClosePath} alt="Close" style={{ width: '1rem', height: '1rem' }} />
				</button>

				{/* Sidebar */}
				<aside style={styles.sidebar}>
					<div style={styles.userBlock}>
						<div style={styles.nameText}>{userName}</div>
						<div style={styles.emailText}>{userEmail}</div>
					</div>
					<div style={styles.divider} />

					<button
						type="button"
						style={{
							...styles.tabButton,
							...(activeTab === 'subscription' ? styles.tabButtonActive : {}),
							...(hoveredTab === 'subscription' ? styles.tabButtonHover : {})
						}}
						onClick={() => setActiveTab('subscription')}
						onMouseEnter={() => setHoveredTab('subscription')}
						onMouseLeave={() => setHoveredTab(null)}
					>
						Subscription and usage
					</button>
					<button
						type="button"
						style={{
							...styles.tabButton,
							...(activeTab === 'more' ? styles.tabButtonActive : {}),
							...(hoveredTab === 'more' ? styles.tabButtonHover : {})
						}}
						onClick={() => setActiveTab('more')}
						onMouseEnter={() => setHoveredTab('more')}
						onMouseLeave={() => setHoveredTab(null)}
					>
						More AI tools
					</button>
					<button
						type="button"
						style={{
							...styles.tabButton,
							...(activeTab === 'api' ? styles.tabButtonActive : {}),
							...(hoveredTab === 'api' ? styles.tabButtonHover : {})
						}}
						onClick={() => setActiveTab('api')}
						onMouseEnter={() => setHoveredTab('api')}
						onMouseLeave={() => setHoveredTab(null)}
					>
						API key settings
					</button>
					<button
						type="button"
						style={{
							...styles.actionTabButton,
							...(hoveredTab === 'feedback' ? styles.actionTabButtonHover : {})
						}}
						onClick={() => {
							const url = 'https://docs.google.com/forms/d/e/1FAIpQLSfgLdhUz79oBsNTIF_rD3hEw5pCTbXOOGfi1UBKViiVgFjI-A/viewform?usp=dialog';
							try {
								Zotero.launchURL(url);
							}
							catch {
								if (navigator.clipboard) navigator.clipboard.writeText(url);
							}
							onClose();
						}}
						onMouseEnter={() => setHoveredTab('feedback')}
						onMouseLeave={() => setHoveredTab(null)}
					>
						Give Us Feedbacks
					</button>
					<button
						type="button"
						style={{
							...styles.actionTabButton,
							...(hoveredTab === 'signout' ? styles.actionTabButtonHover : {})
						}}
						onClick={() => {
							if (onSignOut) onSignOut();
							onClose();
						}}
						onMouseEnter={() => setHoveredTab('signout')}
						onMouseLeave={() => setHoveredTab(null)}
					>
						Sign Out
					</button>
				</aside>

				{/* Main */}
				<main style={styles.main}>
					<Tab id="subscription">
						<DeepTutorUsageContent
							onUpgrade={onShowUpgrade}
							activeSubscription={activeSubscription}
							usageSummary={usageSummary}
							onRefreshUsageSummary={refreshUsageSummary}
						/>
					</Tab>

					<Tab id="more">
						<MoreToolsGrid />
					</Tab>

					<Tab id="api">
						<div style={{ color: colors.text.tertiary }}>API key settings — coming soon.</div>
					</Tab>
				</main>
			</div>
		</div>
	);
}

DeepTutorSettingsPopup.propTypes = {
	onClose: PropTypes.func.isRequired,
	currentUser: PropTypes.object,
	userData: PropTypes.object,
	activeSubscription: PropTypes.object,
	usageSummary: PropTypes.object,
	onShowUsage: PropTypes.func,
	onShowUpgrade: PropTypes.func,
	onSignOut: PropTypes.func,
	refreshUsageSummary: PropTypes.func,
};


