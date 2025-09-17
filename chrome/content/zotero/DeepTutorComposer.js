import React, { useEffect, useMemo, useRef, useState } from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';
import { useDeepTutorTheme } from './theme/useDeepTutorTheme.js';
import { getPreSignedUrl } from './api/libs/api';

const BasicPath = 'chrome://zotero/content/DeepTutorMaterials/Registration/RES_STANDARD.svg';
const BasicDarkPath = 'chrome://zotero/content/DeepTutorMaterials/Registration/RES_STANDARD_DARK.svg';
const AdvancedPath = 'chrome://zotero/content/DeepTutorMaterials/Registration/RES_ADVANCED.svg';
const AdvancedDarkPath = 'chrome://zotero/content/DeepTutorMaterials/Registration/RES_ADVANCED_DARK.svg';
const SendIconPath = 'chrome://zotero/content/DeepTutorMaterials/Chat/SEND.svg';
const GraySendIconPath = 'chrome://zotero/content/DeepTutorMaterials/Chat/GRAY_SEND.svg';
const StopIconPath = 'chrome://zotero/content/DeepTutorMaterials/Chat/RES_STOP.svg';

const DeepTutorComposer = ({
	sessionId,
	userId,
	selectedDocumentIds,
	onDocumentsChange,
	onSend,
	onStop,
	isBusy,
	subscriptionType = 'BASIC',
	usageSummary: _usageSummary = null,
	hasActiveSubscription: _hasActiveSubscription = false,
	onShowFileSizeWarning,
	onShowPageLimitWarning,
	onShowSubscriptionPopup
}) => {
	const { colors, theme, isDark } = useDeepTutorTheme();

	// UI state
	const [inputValue, setInputValue] = useState('');
	const [showContextSearch, setShowContextSearch] = useState(false);
	const [searchValue, setSearchValue] = useState('');
	const [containers, setContainers] = useState([]);
	const [filteredContainers, setFilteredContainers] = useState([]);
	const [hoveredContainerId, setHoveredContainerId] = useState(null);
	const [showOverflow, setShowOverflow] = useState(false);
	const [hoveredChipIndex, setHoveredChipIndex] = useState(null);
	const [askType, setAskType] = useState('ASK'); // ASK | AGENT (future)
	const [askMode, setAskMode] = useState('standard'); // standard | advanced
	const searchPopupRef = useRef(null);
	const textareaRef = useRef(null);
	const isSessionActive = Boolean(sessionId);
	const contextDisabled = isSessionActive; // disable add/remove after session created
	
	// Check if user has free subscription (BASIC) - only allow standard mode
	const isFreeSubscription = (subscriptionType || '').toUpperCase() === 'BASIC';
	const modeToggleDisabled = isSessionActive || isFreeSubscription;

	// Limits helpers (mirror ModelSelection)
	const getFileCountLimit = () => {
		switch ((subscriptionType || '').toUpperCase()) {
			case 'BASIC':
				return 1;
			case 'PLUS':
				return 10;
			case 'PREMIUM':
				return 20;
			default:
				return 1;
		}
	};
	const getFileSizeLimitMB = () => {
		switch ((subscriptionType || '').toUpperCase()) {
			case 'BASIC':
				return 10;
			case 'PLUS':
				return 50;
			case 'PREMIUM':
				return 100;
			default:
				return 10;
		}
	};
	const getPageLimit = () => 500;
	const canAddMoreFiles = () => selectedDocumentIds.length < getFileCountLimit();

	// Auto-resize textarea function
	const autoResizeTextarea = () => {
		const textarea = textareaRef.current;
		if (!textarea) return;
		
		// Reset height to auto to get the correct scrollHeight
		textarea.style.height = 'auto';
		
		// Calculate the new height based on content
		const scrollHeight = textarea.scrollHeight;
		const minHeight = 6.5 * 16; // 6.5rem in pixels (assuming 16px base font size)
		const maxHeight = 14 * 16; // 14rem in pixels
		
		// Set height within min/max bounds
		const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
		textarea.style.height = `${newHeight}px`;
	};

	const validateFileSize = async (pdf, fileName = null) => {
		try {
			const filePath = await pdf.getFilePathAsync();
			if (filePath) {
				const fileStats = await IOUtils.stat(filePath);
				const fileSizeMB = fileStats.size / (1024 * 1024);
				const sizeLimitMB = getFileSizeLimitMB();
				if (fileSizeMB > sizeLimitMB) {
					const displayName = fileName || pdf.name || 'PDF';
					if (typeof onShowFileSizeWarning === 'function') {
						onShowFileSizeWarning({ fileName: displayName, fileSizeMB, sizeLimitMB });
					}
					return false;
				}
			}
			return true;
		}
		catch {
			return true;
		}
	};
	const validatePageCount = async (pdf, fileName = null) => {
		try {
			const { totalPages } = await Zotero.PDFWorker.getFullText(pdf.id, 1);
			if (typeof totalPages === 'number') {
				const limit = getPageLimit();
				if (totalPages > limit) {
					const displayName = fileName || pdf.name || 'PDF';
					if (typeof onShowPageLimitWarning === 'function') {
						onShowPageLimitWarning({ fileName: displayName, pageCount: totalPages, pageLimit: limit });
					}
					return false;
				}
			}
			return true;
		}
		catch {
			return true;
		}
	};

	// Load persisted selections per session
	useEffect(() => {
		try {
			if (sessionId) {
				const savedAskType = Zotero.Prefs.get(`deeptutor_ask_type_${sessionId}`);
				const savedAskMode = Zotero.Prefs.get(`deeptutor_ask_mode_${sessionId}`);
				if (savedAskType && (savedAskType === 'ASK' || savedAskType === 'AGENT')) setAskType(savedAskType);
				if (savedAskMode && (savedAskMode === 'standard' || savedAskMode === 'advanced')) setAskMode(savedAskMode);
			}
		}
		catch (e) {
			Zotero.debug(e);
		}
	}, [sessionId]);

	// Persist when changed
	useEffect(() => {
		try {
			if (sessionId) Zotero.Prefs.set(`deeptutor_ask_type_${sessionId}`, askType);
		}
		catch {}
	}, [askType, sessionId]);
	useEffect(() => {
		try {
			if (sessionId) Zotero.Prefs.set(`deeptutor_ask_mode_${sessionId}`, askMode);
		}
		catch {}
	}, [askMode, sessionId]);

	// Force free subscription users to use standard mode
	useEffect(() => {
		if (isFreeSubscription && askMode === 'advanced') {
			setAskMode('standard');
		}
	}, [isFreeSubscription, askMode]);

	// Auto-resize textarea when input value changes
	useEffect(() => {
		autoResizeTextarea();
	}, [inputValue]);

	// Auto-resize textarea on component mount
	useEffect(() => {
		autoResizeTextarea();
	}, []);

	// Styles
	const styles = {
		container: {
			width: '100%',
			background: colors.background.quaternary,
			border: `0.0625rem solid ${colors.border.quaternary}`,
			borderRadius: '0.75rem',
			padding: '0.75rem',
			boxSizing: 'border-box',
			boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.08)'
		},
		chipsRow: {
			display: 'flex',
			flexWrap: 'wrap',
			gap: '0.5rem',
			marginBottom: '0.75rem'
		},
		chip: {
			all: 'revert',
			display: 'flex',
			alignItems: 'center',
			gap: '0.375rem',
			height: '2rem',
			padding: '0 0.625rem',
			borderRadius: '999px',
			border: `0.0625rem solid ${colors.border.tertiary}`,
			background: theme === 'light' ? '#FFFFFF' : colors.background.tertiary,
			color: colors.text.primary,
			cursor: 'default',
			maxWidth: '12rem',
			overflow: 'hidden'
		},
		chipText: {
			whiteSpace: 'nowrap',
			textOverflow: 'ellipsis',
			overflow: 'hidden',
			maxWidth: '9rem'
		},
		chipClose: {
			all: 'revert',
			border: 'none',
			background: 'transparent',
			cursor: 'pointer',
			fontSize: '0.9rem',
			color: colors.text.tertiary,
			display: 'none'
		},
		chipHover: {
			background: colors.background.primary
		},
		chipCloseVisible: {
			display: 'block'
		},
		atButton: {
			all: 'revert',
			height: '2rem',
			padding: '0 0.75rem',
			borderRadius: '999px',
			border: `0.0625rem solid ${colors.border.tertiary}`,
			background: theme === 'light' ? '#FFFFFF' : colors.background.tertiary,
			color: colors.text.primary,
			cursor: 'pointer',
			fontWeight: 600
		},
		overflowChip: {
			all: 'revert',
			height: '2rem',
			padding: '0 0.75rem',
			borderRadius: '999px',
			border: `0.0625rem solid ${colors.border.tertiary}`,
			background: theme === 'light' ? '#FFFFFF' : colors.background.tertiary,
			color: colors.text.primary,
			cursor: 'pointer',
			fontWeight: 600
		},
		searchPopup: {
			position: 'absolute',
			top: '2.25rem',
			left: 0,
			zIndex: 1000,
			background: theme === 'light' ? '#FFFFFF' : colors.background.tertiary,
			border: `0.0625rem solid ${colors.border.primary}`,
			borderRadius: '0.5rem',
			boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.1)',
			padding: '0.5rem',
			width: '18rem',
			maxHeight: '15rem',
			overflowY: 'auto'
		},
		searchHeader: {
			display: 'flex',
			alignItems: 'center',
			gap: '0.5rem',
			marginBottom: '0.5rem'
		},
		searchInput: {
			all: 'revert',
			flex: 1,
			height: '2rem',
			borderRadius: '0.375rem',
			border: `0.0625rem solid ${colors.border.primary}`,
			padding: '0 0.5rem',
			background: colors.background.quaternary,
			color: colors.text.allText
		},
		searchItem: {
			padding: '0.375rem 0.5rem',
			borderRadius: '0.375rem',
			cursor: 'pointer',
			color: colors.text.allText
		},
		searchItemHover: {
			background: colors.background.quaternary
		},
		textarea: {
			width: '100%',
			minHeight: '6.5rem',
			maxHeight: '14rem',
			borderRadius: '0.625rem',
			border: 'none',
			outline: 'none',
			resize: 'none',
			padding: '0.75rem 0.875rem',
			boxSizing: 'border-box',
			background: colors.background.primary,
			color: colors.text.primary,
			fontFamily: 'Roboto, sans-serif',
			fontSize: '1rem',
			overflow: 'auto'
		},
		bottomRow: {
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'space-between',
			marginTop: '0.75rem'
		},
		dropdownButton: {
			all: 'revert',
			display: 'flex',
			alignItems: 'center',
			gap: '0.5rem',
			height: '2.25rem',
			padding: '0 0.75rem',
			borderRadius: '0.5rem',
			border: `0.0625rem solid ${colors.border.tertiary}`,
			background: colors.background.primary,
			color: colors.text.primary,
			cursor: 'pointer',
			fontWeight: 500
		},
		dropdownMenu: {
			position: 'absolute',
			background: theme === 'light' ? '#FFFFFF' : colors.background.tertiary,
			border: `0.0625rem solid ${colors.border.primary}`,
			borderRadius: '0.5rem',
			boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.1)',
			padding: '0.25rem',
			zIndex: 1000
		},
		menuItem: {
			all: 'revert',
			padding: '0.5rem 0.75rem',
			borderRadius: '0.375rem',
			cursor: 'pointer',
			color: colors.text.allText
		},
		sendButton: {
			all: 'revert',
			height: '2.25rem',
			width: '2.25rem',
			borderRadius: '50%',
			border: 'none',
			background: colors.background.primary,
			cursor: 'pointer',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			borderColor: colors.border.tertiary,
			padding: 0,
			margin: 0
		}
	};

	// Compute display chips (up to 4 visible, then +N overflow)
	const visibleChipIds = useMemo(() => {
		const count = selectedDocumentIds.length;
		if (count <= 4) return selectedDocumentIds;
		return selectedDocumentIds.slice(0, 4);
	}, [selectedDocumentIds]);
	const overflowCount = Math.max(0, selectedDocumentIds.length - 4);

	// Get display names for selectedDocumentIds using mapping prefs
	const [docNames, setDocNames] = useState({});
	useEffect(() => {
		const loadNames = () => {
			try {
				const mappingStr = Zotero.Prefs.get(sessionId ? `deeptutor_mapping_${sessionId}` : 'deeptutor_mapping_draft') || '{}';
				const mapping = JSON.parse(mappingStr);
				const updated = {};
				selectedDocumentIds.forEach((azureId) => {
					const zoteroId = mapping[azureId];
					if (zoteroId) {
						const item = Zotero.Items.get(zoteroId);
						if (item) {
							let name = '';
							try {
								name = item.attachmentFilename || item.getField('title') || '';
							}
							catch {
								name = '';
							}
							updated[azureId] = name && name.trim() !== '' ? name : 'Untitled';
						}
					}
				});
				setDocNames(updated);
			}
			catch {}
		};
		loadNames();
	}, [selectedDocumentIds, sessionId]);

	// Load container candidates once
	useEffect(() => {
		const loadContainers = async () => {
			try {
				const libraryID = Zotero.Libraries.userLibraryID;
				const items = await Zotero.Items.getAll(libraryID);
				const seen = new Set();
				const list = items.reduce((arr, item) => {
					if (item.isRegularItem() && !seen.has(item.id)) {
						const pdfs = item.getAttachments().map(x => Zotero.Items.get(x)).filter(x => x && x.isPDFAttachment && x.isPDFAttachment());
						if (pdfs.length) {
							seen.add(item.id);
							let name = '';
							try {
								name = item.getField('title') || '';
							}
							catch {
								name = '';
							}
							arr.push({ id: item.id, name: name && name.trim() !== '' ? name : 'Untitled' });
						}
					}
					return arr;
				}, []);
				setContainers(list);
			}
			catch (e) {
				Zotero.debug(e);
			}
		};
		loadContainers();
	}, []);

	// Filter containers on searchValue
	useEffect(() => {
		const term = (searchValue || '').toLowerCase().trim();
		if (!term) {
			setFilteredContainers([]);
			return;
		}
		setFilteredContainers(containers.filter((c) => {
			try {
				return String(c.name).toLowerCase().includes(term);
			}
			catch {
				return false;
			}
		}));
	}, [searchValue, containers]);

	// Close popups on outside click
	useEffect(() => {
		const handleClick = (e) => {
			if (searchPopupRef.current && !searchPopupRef.current.contains(e.target)) {
				setShowContextSearch(false);
			}
		};
		document.addEventListener('mousedown', handleClick);
		return () => document.removeEventListener('mousedown', handleClick);
	}, []);

	const handleRemoveDoc = (azureId) => {
		const next = selectedDocumentIds.filter(id => id !== azureId);
		onDocumentsChange(next);
	};

	const handleSelectContainer = async (container) => {
		try {
			if (!canAddMoreFiles()) {
				if (typeof onShowSubscriptionPopup === 'function') {
					onShowSubscriptionPopup();
				}
				setShowContextSearch(false);
				setSearchValue('');
				return;
			}
			const item = Zotero.Items.get(container.id);
			if (!item || !item.isRegularItem()) return;
			const pdfAttachments = item.getAttachments().map(x => Zotero.Items.get(x)).filter(x => x && x.isPDFAttachment && x.isPDFAttachment());
			if (!pdfAttachments.length) return;

			const mappingKey = sessionId ? `deeptutor_mapping_${sessionId}` : 'deeptutor_mapping_draft';
			let mapping = {};
			try {
				mapping = JSON.parse(Zotero.Prefs.get(mappingKey) || '{}');
			}
			catch {
				mapping = {};
			}

			const addedAzureIds = [];
			const limit = getFileCountLimit();
			const availableSlots = Math.max(0, limit - selectedDocumentIds.length);
			const maxToAdd = Math.min(pdfAttachments.length, availableSlots);
			for (let i = 0; i < maxToAdd; i++) {
				const pdf = pdfAttachments[i];
				let fileName = '';
				try {
					fileName = pdf.attachmentFilename || pdf.getField('title') || '';
				}
				catch {
					fileName = '';
				}
				if (!fileName || typeof fileName !== 'string' || fileName.trim() === '') fileName = 'Untitled';

				const sizeOk = await validateFileSize(pdf, fileName);
				if (!sizeOk) {
					continue;
				}
				const pagesOk = await validatePageCount(pdf, fileName);
				if (!pagesOk) {
					continue;
				}

				let blob;
				try {
					const filePath = await pdf.getFilePathAsync();
					if (!filePath) continue;
					const exists = await IOUtils.exists(filePath);
					if (!exists) continue;
					const data = await IOUtils.read(filePath);
					const BlobConstructor = Zotero.getMainWindow().Blob;
					blob = new BlobConstructor([data], { type: 'application/pdf' });
				}
				catch {
					continue;
				}

				let pre;
				try {
					pre = await getPreSignedUrl(userId, encodeURIComponent(fileName));
				}
				catch {
					try {
						const sanitized = fileName.replace(/[;:&<>]/g, '_');
						pre = await getPreSignedUrl(userId, sanitized);
					}
					catch {
						continue;
					}
				}

				try {
					const resp = await window.fetch(pre.preSignedUrl, {
						method: 'PUT',
						headers: {
							'x-ms-blob-type': 'BlockBlob',
							'Content-Type': 'application/pdf'
						},
						body: blob
					});
					if (!resp.ok) continue;
					addedAzureIds.push(pre.documentId);
					mapping[pre.documentId] = pdf.id;
				}
				catch {
					continue;
				}
			}

			try {
				Zotero.Prefs.set(mappingKey, JSON.stringify(mapping));
			}
			catch {}
			if (addedAzureIds.length) {
				const next = [...selectedDocumentIds, ...addedAzureIds];
				onDocumentsChange(next);
			}
			setShowContextSearch(false);
			setSearchValue('');
		}
		catch (e) {
			Zotero.debug(e);
		}
	};

	const handleSendClick = async () => {
		const text = (inputValue || '').trim();
		if (!text) return;
		
		// Prevent sending if no files are selected
		if (!selectedDocumentIds || selectedDocumentIds.length === 0) {
			return;
		}
		
		setInputValue(''); // Clear input immediately
		await onSend(text);
	};

	return (
		<div style={styles.container}>
			<div style={styles.chipsRow}>
				<div style={{ position: 'relative' }} ref={searchPopupRef}>
					<button style={{ ...styles.atButton, opacity: contextDisabled ? 0.5 : 1, cursor: contextDisabled ? 'not-allowed' : 'pointer' }} onClick={() => {
						if (!contextDisabled) setShowContextSearch(v => !v);
					}} title="Add papers via search" disabled={contextDisabled}>@</button>
					{showContextSearch && (
						<div style={styles.searchPopup}>
							<div style={styles.searchHeader}>
								<input
									style={styles.searchInput}
									placeholder="Search containers with PDFs"
									value={searchValue}
									onChange={e => setSearchValue(e.target.value)}
								/>
							</div>
							{filteredContainers.length === 0 && searchValue.trim() !== '' && (
								<div style={{ padding: '0.25rem 0.5rem', color: colors.text.tertiary }}>No results</div>
							)}
							{filteredContainers.map(c => (
								<div
									key={c.id}
									style={{
										...styles.searchItem,
										...(hoveredContainerId === c.id ? styles.searchItemHover : {})
									}}
									onMouseEnter={() => setHoveredContainerId(c.id)}
									onMouseLeave={() => setHoveredContainerId(null)}
									onClick={() => handleSelectContainer(c)}
									title={c.name}
								>
									{c.name}
								</div>
							))}
						</div>
					)}
				</div>

				{visibleChipIds.map((azureId, idx) => {
					const isHovered = hoveredChipIndex === idx;
					return (
						<div
							key={azureId}
							style={{
								...styles.chip,
								...(isHovered ? styles.chipHover : {})
							}}
							onMouseEnter={() => setHoveredChipIndex(idx)}
							onMouseLeave={() => setHoveredChipIndex(null)}
							title={docNames[azureId] || azureId}
						>
							<span style={styles.chipText}>{docNames[azureId] || 'PDF'}</span>
							<button
								style={{
									...styles.chipClose,
									...(isHovered && !contextDisabled ? styles.chipCloseVisible : {})
								}}
								onClick={() => {
									if (!contextDisabled) handleRemoveDoc(azureId);
								}}
								title="Remove"
								disabled={contextDisabled}
							>
								×
							</button>
						</div>
					);
				})}

				{overflowCount > 0 && (
					<div style={{ position: 'relative' }}>
						<button style={{ ...styles.overflowChip, opacity: contextDisabled ? 0.5 : 1, cursor: contextDisabled ? 'not-allowed' : 'pointer' }} onClick={() => {
							if (!contextDisabled) setShowOverflow(v => !v);
						}} title="More context" disabled={contextDisabled}>+{overflowCount}</button>
						{showOverflow && (
							<div style={{ ...styles.searchPopup, left: 'auto', right: 0 }}>
								{selectedDocumentIds.slice(4).map(azureId => (
									<div key={azureId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.375rem 0.5rem' }}>
										<span style={{ ...styles.chipText, maxWidth: '12rem' }} title={docNames[azureId] || azureId}>{docNames[azureId] || 'PDF'}</span>
										<button style={{ ...styles.chipClose, display: contextDisabled ? 'none' : 'block', opacity: contextDisabled ? 0.5 : 1, cursor: contextDisabled ? 'not-allowed' : 'pointer' }} onClick={() => {
											if (!contextDisabled) handleRemoveDoc(azureId);
										}} title="Remove" disabled={contextDisabled}>×</button>
									</div>
								))}
							</div>
						)}
					</div>
				)}
			</div>

			<textarea
				ref={textareaRef}
				style={styles.textarea}
				placeholder={"Quick, academic-focused insights on one or a few documents, with rich support for tables, math, and source references."}
				value={inputValue}
				onChange={e => setInputValue(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
						if (!isBusy) handleSendClick();
					}
				}}
			/>

			<div style={styles.bottomRow}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
					{/* Ask/Agent dropdown */}
					<div style={{ position: 'relative' }}>
						<button style={{ ...styles.dropdownButton, opacity: isSessionActive ? 0.6 : 1, cursor: isSessionActive ? 'not-allowed' : 'pointer' }} onClick={(e) => {
							e.preventDefault();
							if (isSessionActive) return;
							const next = askType === 'ASK' ? 'AGENT' : 'ASK';
							setAskType(next);
						}} disabled={isSessionActive}>
							{askType === 'ASK' ? 'Ask' : 'Agent'}
						</button>
					</div>

					{/* Standard/Advanced when in Ask mode */}
					<div style={{ position: 'relative' }}>
						<button
							style={{
								...styles.dropdownButton,
								opacity: (askType === 'ASK' && !modeToggleDisabled) ? 1 : 0.6,
								cursor: (askType === 'ASK' && !modeToggleDisabled) ? 'pointer' : 'not-allowed'
							}}
							onClick={(e) => {
								e.preventDefault();
								if (askType !== 'ASK' || modeToggleDisabled) return;
								setAskMode(askMode === 'standard' ? 'advanced' : 'standard');
							}}
							disabled={askType !== 'ASK' || modeToggleDisabled}
							title={isFreeSubscription ? 'Advanced mode requires a paid subscription' : (askType !== 'ASK' ? 'Switch to Ask mode to change settings' : (isSessionActive ? 'Cannot change mode during active session' : 'Switch between Standard and Advanced mode'))}
						>
							<img src={isDark ? (askMode === 'standard' ? BasicDarkPath : AdvancedDarkPath) : (askMode === 'standard' ? BasicPath : AdvancedPath)} alt="Mode" style={{ width: '1rem', height: '1rem' }} />
							{askMode === 'standard' ? 'Standard' : 'Advanced'}
						</button>
					</div>
				</div>

				<button
					style={{
						...styles.sendButton,
						opacity: (!selectedDocumentIds || selectedDocumentIds.length === 0) ? 0.5 : 1,
						cursor: (!selectedDocumentIds || selectedDocumentIds.length === 0) ? 'not-allowed' : 'pointer'
					}}
					onClick={() => {
						if (isBusy) {
							onStop();
						}
						else {
							handleSendClick();
						}
					}}
					title={isBusy ? 'Stop' : ((!selectedDocumentIds || selectedDocumentIds.length === 0) ? 'Select files to send a message' : 'Send')}
					disabled={(!selectedDocumentIds || selectedDocumentIds.length === 0) && !isBusy}
				>
					<img
						src={isBusy ? StopIconPath : (inputValue.trim() ? SendIconPath : GraySendIconPath)}
						alt={isBusy ? 'Stop' : 'Send'}
						style={{ width: '2.1rem', height: '2.1rem' }}
					/>
				</button>
			</div>
		</div>
	);
};

DeepTutorComposer.propTypes = {
	sessionId: PropTypes.string,
	userId: PropTypes.string,
	selectedDocumentIds: PropTypes.array.isRequired,
	onDocumentsChange: PropTypes.func.isRequired,
	onSend: PropTypes.func.isRequired,
	onStop: PropTypes.func.isRequired,
	isBusy: PropTypes.bool.isRequired,
	subscriptionType: PropTypes.string,
	usageSummary: PropTypes.object,
	hasActiveSubscription: PropTypes.bool,
	onShowFileSizeWarning: PropTypes.func,
	onShowPageLimitWarning: PropTypes.func,
	onShowSubscriptionPopup: PropTypes.func
};

export default DeepTutorComposer;


