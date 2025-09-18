import React, { useEffect, useMemo, useRef, useState } from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';
import { useDeepTutorTheme } from './theme/useDeepTutorTheme.js';
import { getPreSignedUrl } from './api/libs/api.js';
import {
	RecentFilesManager,
	getFileCountLimit,
	validateFileSize,
	validatePageCount,
	getDocumentMapping,
	loadContainersWithPDFs,
	useAutoResizeTextarea,
	processDocument,
	getCurrentlyOpenedPDF,
	setNoteContainerFromDocuments
} from './DeepTutorHelperFunctions.js';


const BasicPath = 'chrome://zotero/content/DeepTutorMaterials/Registration/RES_STANDARD.svg';
const BasicDarkPath = 'chrome://zotero/content/DeepTutorMaterials/Registration/RES_STANDARD_DARK.svg';
const AdvancedPath = 'chrome://zotero/content/DeepTutorMaterials/Registration/RES_ADVANCED.svg';
const AdvancedDarkPath = 'chrome://zotero/content/DeepTutorMaterials/Registration/RES_ADVANCED_DARK.svg';
const SendIconPath = 'chrome://zotero/content/DeepTutorMaterials/Chat/SEND.svg';
const GraySendIconPath = 'chrome://zotero/content/DeepTutorMaterials/Chat/GRAY_SEND.svg';
const StopIconPath = 'chrome://zotero/content/DeepTutorMaterials/Chat/RES_STOP.svg';

// Document handling functions moved from DeepTutorChat.js
const getCurrentlyOpenedPaperId = () => {
	const pdfData = getCurrentlyOpenedPDF();
	return pdfData ? pdfData.itemId : null;
};

const updatePaperContext = async (newPaperId, userId, sessionId, selectedDocumentIds) => {
	try {
		if (!newPaperId || !userId) return;

		// Only update paper context for placeholder sessions
		const isPlaceholderSession = sessionId && typeof sessionId === 'string' && sessionId.startsWith('__DRAFT__');
		if (!isPlaceholderSession) {
			Zotero.debug(`DeepTutorComposer: Not a placeholder session, skipping paper context update`);
			return;
		}

		// Get the new paper item
		const newItem = Zotero.Items.get(newPaperId);
		if (!newItem || !newItem.isPDFAttachment()) return;

		// Get filename for the new paper
		let fileName = '';
		try {
			fileName = newItem.attachmentFilename || newItem.getField('title') || '';
		}
		catch (error) {
			Zotero.debug(`DeepTutorComposer: Error getting filename for new paper: ${error.message}`);
			fileName = '';
		}

		if (!fileName || typeof fileName !== 'string' || fileName.trim() === '') {
			fileName = 'Untitled';
		}

		// For placeholder sessions, we don't upload yet - just update the display
		// We use a temporary ID based on the Zotero item ID for the current-opened slot
		const tempDocumentId = `temp_${newPaperId}`;

		// Determine if this Zotero item is already represented in the user-added list via mapping
		// If so, do not add a separate current-opened slot to avoid duplicates
		let willDuplicateExisting = false;
		try {
			const candidateIds = Array.isArray(selectedDocumentIds) ? selectedDocumentIds : [];
			for (const id of candidateIds) {
				const mapping = getDocumentMapping(sessionId);
				if (mapping[id] && mapping[id] === newPaperId) {
					willDuplicateExisting = true;
					break;
				}
			}
		}
		catch {}

		if (willDuplicateExisting) {
			// The file is already in the added list; keep current slot empty to avoid duplicates
			Zotero.debug(`DeepTutorComposer: Current-opened paper already in user-added context; skipping current slot`);
		}
		else {
			// Save current-opened document in its own slot and ensure it is included
			// This would need to be handled by the parent component
			Zotero.debug(`DeepTutorComposer: Current-opened paper context updated: ${fileName} (temp ID: ${tempDocumentId})`);
		}

		// Update the mapping for display purposes
		const mappingKey = 'deeptutor_mapping_draft';
		let existingMapping = {};
		try {
			const mappingStr = Zotero.Prefs.get(mappingKey) || '{}';
			existingMapping = JSON.parse(mappingStr);
		}
		catch {
			existingMapping = {};
		}

		// Add the new mapping while preserving existing ones
		const updatedMapping = { ...existingMapping, [tempDocumentId]: newPaperId };
		try {
			Zotero.Prefs.set(mappingKey, JSON.stringify(updatedMapping));
		}
		catch (error) {
			Zotero.debug(`DeepTutorComposer: Error updating temp mapping: ${error.message}`);
		}

		Zotero.debug(`DeepTutorComposer: Set current-opened paper in context: ${fileName} (temp ID: ${tempDocumentId})`);
	}
	catch (error) {
		Zotero.debug(`DeepTutorComposer: Error updating paper context: ${error.message}`);
	}
};

const openAllDocuments = async (documentIds, sessionId) => {
	if (documentIds && documentIds.length > 0 && sessionId) {
		try {
			// Try to get the mapping from local storage
			const storageKey = `deeptutor_mapping_${sessionId}`;
			const mappingStr = Zotero.Prefs.get(storageKey);
			
			let mapping = {};
			if (mappingStr) {
				mapping = JSON.parse(mappingStr);
			}

			// Loop through all document IDs
			for (let i = 0; i < documentIds.length; i++) {
				const documentId = documentIds[i];
				try {
					let zoteroAttachmentId = documentId;

					// If we have a mapping for this document ID, use it
					if (mapping[documentId]) {
						zoteroAttachmentId = mapping[documentId];
					}

					// Get the item and open it
					const item = Zotero.Items.get(zoteroAttachmentId);
					if (!item) {
						continue; // Skip this document and continue with the next one
					}

					// Open the document in the reader
					await Zotero.FileHandlers.open(item, {
						location: {
							pageIndex: 0 // Start at first page
						}
					});
					
					// Add a small delay between opening documents to avoid overwhelming the UI
					if (i < documentIds.length - 1) {
						await new Promise(resolve => setTimeout(resolve, 500));
					}
				}
				catch (error) {
					Zotero.debug(`DeepTutorComposer: Error opening document ${documentId}: ${error.message}`);
					// Continue with the next document even if this one fails
				}
			}
		}
		catch (error) {
			Zotero.debug(`DeepTutorComposer: Error in openAllDocuments: ${error.message}`);
		}
	}
};

const loadContextDocuments = async (documentIds, sessionId, setNoteContainer) => {
	if (!documentIds || documentIds.length === 0 || !sessionId) {
		return [];
	}
	
	try {
		const mapping = getDocumentMapping(sessionId);
		const contextDocs = await Promise.allSettled(
			documentIds.map(id => processDocument(id, mapping))
		);
		
		const successfulDocs = contextDocs
			.filter(result => result.status === "fulfilled")
			.map(result => result.value);
		
		// Log any failures
		contextDocs
			.filter(result => result.status === "rejected")
			.forEach(result => Zotero.debug(result.reason));

		setNoteContainerFromDocuments(successfulDocs, setNoteContainer);
		return successfulDocs;
	}
	catch (error) {
		Zotero.debug(`DeepTutorComposer: Error loading context documents: ${error.message}`);
		setNoteContainer(null);
		return [];
	}
};

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
	const [recentFiles, setRecentFiles] = useState([]);
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

	// Limits helpers
	const canAddMoreFiles = () => selectedDocumentIds.length < getFileCountLimit(subscriptionType);

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

	// Auto-resize textarea
	useAutoResizeTextarea(textareaRef, inputValue);

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
				const list = await loadContainersWithPDFs();
				setContainers(list);
			}
			catch (e) {
				Zotero.debug(e);
			}
		};
		loadContainers();
	}, []);

	// Load recent files on component mount
	useEffect(() => {
		const loadRecentFiles = () => {
			try {
				const recent = RecentFilesManager.getMostRecentFiles(5);
				setRecentFiles(recent);
			}
			catch (e) {
				Zotero.debug(`Error loading recent files: ${e.message}`);
			}
		};
		loadRecentFiles();
	}, []);

	// Filter containers on searchValue
	useEffect(() => {
		const term = (searchValue || '').toLowerCase().trim();
		if (!term) {
			// When search is empty, show recent files instead of empty results
			setFilteredContainers(recentFiles.map(recentFile => ({
				id: recentFile.id,
				name: recentFile.name,
				isRecent: true
			})));
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
	}, [searchValue, containers, recentFiles]);

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

			// Track this file as recently accessed
			RecentFilesManager.addRecentFile(container.id, container.name);
			
			// Update recent files state
			const updatedRecentFiles = RecentFilesManager.getMostRecentFiles(5);
			setRecentFiles(updatedRecentFiles);

			const mapping = getDocumentMapping(sessionId);

			const addedAzureIds = [];
			const limit = getFileCountLimit(subscriptionType);
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

				const sizeOk = await validateFileSize(pdf, fileName, subscriptionType, onShowFileSizeWarning);
				if (!sizeOk) {
					continue;
				}
				const pagesOk = await validatePageCount(pdf, fileName, onShowPageLimitWarning);
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
				const mappingKey = sessionId ? `deeptutor_mapping_${sessionId}` : 'deeptutor_mapping_draft';
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
							{searchValue.trim() === '' && recentFiles.length > 0 && (
								<div style={{ padding: '0.25rem 0.5rem', color: colors.text.secondary, fontSize: '0.875rem', fontWeight: 500, borderBottom: `1px solid ${colors.border.tertiary}`, marginBottom: '0.25rem' }}>
									Recently Opened
								</div>
							)}
							{filteredContainers.length === 0 && searchValue.trim() !== '' && (
								<div style={{ padding: '0.25rem 0.5rem', color: colors.text.tertiary }}>No results</div>
							)}
							{filteredContainers.map(c => (
								<div
									key={c.id}
									style={{
										...styles.searchItem,
										...(hoveredContainerId === c.id ? styles.searchItemHover : {}),
										...(c.isRecent ? { fontStyle: 'italic', color: colors.text.secondary } : {})
									}}
									onMouseEnter={() => setHoveredContainerId(c.id)}
									onMouseLeave={() => setHoveredContainerId(null)}
									onClick={() => handleSelectContainer(c)}
									title={c.name}
								>
									{c.name}
									{c.isRecent && (
										<span style={{ fontSize: '0.75rem', color: colors.text.tertiary, marginLeft: '0.5rem' }}>
											(Recent)
										</span>
									)}
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

// Export the utility functions for use by parent components
export {
	getCurrentlyOpenedPaperId,
	updatePaperContext,
	openAllDocuments,
	loadContextDocuments
};

export default DeepTutorComposer;


