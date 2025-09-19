/* eslint-disable no-loop-func */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
	createMessage,
	getMessagesBySessionId,
	getDocumentById,
	subscribeToChat,
	createSession,
	updateSessionName
} from './api/libs/api';
import DeepTutorChatMessage from './DeepTutorChatMessage';
import DeepTutorComposer from './DeepTutorChatComposer.js';
import DeepTutorChatTop from './DeepTutorChatTop.js';
import { useDeepTutorTheme } from './theme/useDeepTutorTheme.js';
import {
	RecentFilesManager,
	getDocumentMapping,
	processDocument,
	getCurrentlyOpenedPDF,
	setNoteContainerFromDocuments,
	cleanupSourceData
} from './DeepTutorHelperFunctions.js';

import ClaudeAutoInstall from './ClaudeAutoInstall';

// Import DeepTutor Claude Management class
const DeepTutorClaudeManagement = require('./DeepTutorClaudeManagement.js');

const ClaudeCliWrapper = require('./ClaudeCliWrapper.js');

// Chrome Components for file system operations
const { Cc, Ci } = require('chrome');

const markdownit = require('markdown-it');
// Try to require markdown-it-container, fallback to a simpler implementation if not available
try {
	require('markdown-it-container');
}
catch {
	// Fallback implementation for markdown-it-container
}
const md = markdownit({
	html: true,
	linkify: true,
	typographer: true,
	tables: true, // Enable built-in table support
	breaks: false, // GFM line breaks (optional)
	strikethrough: true, // Enable strikethrough support
});

// Re-enable markdown-it-katex plugin now that XML parsing is fixed
const mk = require('resource://zotero/markdown-it-katex.js');
md.use(mk, {
	throwOnError: false,
	errorColor: "#cc0000"
});

// Try to add enhanced table support with plugins
try {
	// Try to load markdown-it-table plugin for enhanced table features
	const markdownItTable = require('markdown-it-table');
	md.use(markdownItTable);
}
catch {
	// Try alternative GFM plugin that includes tables
	try {
		const markdownItGfm = require('markdown-it-gfm');
		md.use(markdownItGfm);
	}
	catch {
		// Using basic table support only
	}
}

// Configure markdown-it-container for source buttons
// DISABLED - Using direct HTML replacement approach instead to avoid table conflicts
// The container plugin interferes with table parsing, so we'll use post-processing instead

// Test removed - no longer using container plugin


class Conversation {
	constructor({
		userId = null,
		sessionId = null,
		ragSessionId = null,
		storagePaths = [],
		history = [],
		message = null,
		streaming = false,
		type = SessionType.BASIC
	} = {}) {
		this.userId = userId;
		this.sessionId = sessionId;
		this.ragSessionId = ragSessionId;
		this.storagePaths = storagePaths;
		this.history = history;
		this.message = message;
		this.streaming = streaming;
		this.type = type;
	}
}

const SessionType = {
	LITE: 'LITE',
	BASIC: 'BASIC',
	ADVANCED: 'ADVANCED',
	AGENTIC: 'AGENTIC'
};

const ContentType = {
	THINK: 'THINK',
	TEXT: 'TEXT',
	IMAGE: 'IMAGE',
	AUDIO: 'AUDIO'
};

const MessageStatus = {
	UNVIEW: 'UNVIEW',
	DELETED: 'DELETED',
	VIEWED: 'VIEWED',
	PROCESSING_ERROR: 'PROCESSING_ERROR'
};

const MessageRole = {
	TUTOR: 'TUTOR',
	USER: 'USER'
};


// Default system prompts for agentic mode
const _DEFAULT_SYS_PROMPT = 'Note: In the current data directory, please only view the /DeepTutorDataBase folder and the pdf files inside of it. In particular, please view the pdf file or files associated with the current session, which are named: {DOCUMENT_NAMES}. You are a helpful AI assistant. Please provide clear, accurate, and helpful responses to user questions.';

const DEFAULT_SYS_SUM_PROMPT = `Note: In the current data directory, please only view the /DeepTutorDataBase folder and the pdf files inside of it. In particular, please view the pdf file or files associated with the current session, which are named: {DOCUMENT_NAMES}. You are an expert academic tutor helping a student understand multiple documents. The student has loaded multiple PDF files and needs a comprehensive summary that explains what each document is about. Here are the files with previews of their content:

{formatted_previews}

Please provide a comprehensive summary that:
1. Introduces each document with its title (derived from content if possible) and main topic
2. Summarizes the key content and main findings of each document
3. Identifies relationships or connections between the documents (they appear to be related scientific papers)
4. Highlights the most important concepts across all documents
5. Uses markdown formatting for clear organization with sections and subsections
6. Makes appropriate use of bold, bullet points, and other formatting to improve readability
7. Highest title level is 3, and the title should be concise and informative.

Format your summary with a friendly welcome message at the beginning and a closing "Ask me anything" message at the end.`;

const DEFAULT_SYS_QA_PROMPT = `Note: In the current data directory, please only view the /DeepTutorDataBase folder and the pdf files inside of it. In particular, please view the pdf file or files associated with the current session, which are named: {DOCUMENT_NAMES}. You are a deep thinking tutor helping a student reading a paper.
Reference context from the paper: {formatted_context_string}
This is a detailed plan for constructing the answer: {str(question.answer_planning)}
The student's query is: {user_input_string}

For formulas, use LaTeX format with $...$ or
$$
...
$$
and make sure latex syntax can be properly rendered in the response.

Requirement:
Only use the information from the context chunks to answer the question. Give the response in a scientific and academic tone. Do not make up or assume anything or guess without any evidence. If you answer some questions based on your own knowledge, clearly state that you are using your own knowledge.

Format requirement:
1. Make sure each sentence in the response there is a corresponding context chunk to support the sentence, and cite the most relevant context chunk keys in the format "[<chunk_key, like {example_keys}, etc>]" at the end of the sentence after the period mark. If there are more than one context chunk keys, use the format "[<chunk_key_1>][<chunk_key_2>] ..." to cite all the context chunk keys.
2. Use markdown syntax for formatting the response to make it more clear and readable.`;

const SendIconPath = 'chrome://zotero/content/DeepTutorMaterials/Chat/RES_SEND.svg';
const StopIconPath = 'chrome://zotero/content/DeepTutorMaterials/Chat/RES_STOP.svg';
const _ArrowDownPath = 'chrome://zotero/content/DeepTutorMaterials/Chat/CHAT_ARROWDOWN.svg';
const SettingsIconPath = 'chrome://zotero/content/DeepTutorMaterials/History/SESHIS_SEARCH.svg';
const _RenameIconPath = 'chrome://zotero/content/DeepTutorMaterials/History/RENAME_SESSION.svg';
const _RenameIconDarkPath = 'chrome://zotero/content/DeepTutorMaterials/History/RENAME_SESSION_DARK.svg';

const DeepTutorChat = ({ currentSession, sessions = [], onSessionSelect, onInitWaitChange, handleShowNoteSavePopup, _onShowRenamePopup, onOpenSessionHistory, onToggleSettingsPopup, onToggleModelSelectionPopup, onDeleteSession, userIdFromParent, onCreateSessionFromId, subscriptionType = 'BASIC', usageSummary = null, hasActiveSubscription = false, onShowFileSizeWarning, onShowPageLimitWarning, onShowSubscriptionPopup, refreshUsageSummary }) => {
	const { colors, theme } = useDeepTutorTheme();
	
	// Theme-aware styles
	const styles = {
		container: {
			width: '100%',
			minHeight: '80%',
			background: colors.background.tertiary,
			boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.1)',
			height: '100%',
			display: 'flex',
			flexDirection: 'column',
			fontFamily: 'Roboto, sans-serif',
			position: 'relative',
			overflow: 'hidden',
			padding: '1.875rem 1.25rem 0 1.25rem',
			boxSizing: 'border-box',
			userSelect: 'text', // Ensure text is selectable
			WebkitUserSelect: 'text',
			MozUserSelect: 'text',
			msUserSelect: 'text',
		},
		sessionInfo: {
			width: '90%',
			fontSize: '1em',
			color: colors.text.tertiary,
			marginBottom: '0.25rem',
			paddingLeft: '0.25rem',
			fontFamily: 'Roboto, sans-serif',
			alignSelf: 'flex-start',
			marginLeft: '5%',
		},
		chatLog: {
			width: '100%',
			overflowY: 'auto',
			overflowX: 'hidden',
			background: colors.background.tertiary,
			height: '100%',
			boxShadow: 'none',
			fontFamily: 'Roboto, sans-serif',
			flex: 1,
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'stretch',
			boxSizing: 'border-box',
			marginBottom: '1.25rem',
			userSelect: 'text',
			WebkitUserSelect: 'text',
			MozUserSelect: 'text',
			msUserSelect: 'text',
		},
		bottomBar: {
			width: '100%',
			background: colors.background.quaternary,
			display: 'flex',
			alignItems: 'flex-end', // Changed from 'center' to 'flex-end' to align with textarea
			justifyContent: 'space-between',
			fontFamily: 'Roboto, sans-serif',
			position: 'relative',
			zIndex: 1,
			border: `0.0625rem solid ${colors.border.quaternary}`,
			borderRadius: '0.5rem',
			boxSizing: 'border-box',
			minHeight: '2.5rem',
			maxHeight: '10rem', // Increased to accommodate larger textarea (7rem + padding)
			padding: '0.5rem',
		},
		textInput: {
			flex: 1,
			padding: '0.5rem 0.75rem',
			border: 'none',
			outline: 'none',
			borderRadius: '0.625rem',
			background: colors.background.quaternary,
			color: colors.text.tertiary,
			minHeight: '1.5rem',
			maxHeight: '7rem', // Approximately 5 lines of text at 0.95rem font size
			fontSize: '1rem',
			overflowY: 'auto',
			fontFamily: 'Roboto, sans-serif',
			resize: 'none',
			height: '24px', // Start with minHeight (1.5rem)
			marginRight: '0.625rem',
			alignSelf: 'center',
			lineHeight: '24px',
			wordWrap: 'break-word',
			whiteSpace: 'pre-wrap'
		},
		sendButton: {
			all: 'revert',
			background: colors.background.quaternary,
			border: 'none',
			borderRadius: '50%',
			aspectRatio: '1',
			height: '1.8rem',
			width: '1.8rem',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			cursor: 'pointer',
			padding: '0.125rem',
			transition: 'background-color 0.2s ease',
			flexShrink: 0,
			alignSelf: 'center',
			':hover': {
				background: colors.border.quaternary
			}
		},
		sendIcon: {
			width: '1.5rem',
			height: '1.5rem',
			objectFit: 'contain',
		},
		messageContainer: {
			width: '100%',
			margin: '0.5rem 0',
			boxSizing: 'border-box',
			display: 'flex',
			flexDirection: 'column',
		},
		messageBubble: {
			padding: '0.5rem 0.75rem',
			borderRadius: '0.625rem',
			maxWidth: '100%',
			boxShadow: 'none',
			animation: 'slideIn 0.3s ease-out forwards',
			height: 'auto',
			whiteSpace: 'pre-wrap',
			wordBreak: 'break-word',
			boxSizing: 'border-box',
			overflowWrap: 'break-word',
			userSelect: 'text',
			WebkitUserSelect: 'text',
			MozUserSelect: 'text',
			msUserSelect: 'text',
		},
		userMessage: {
			backgroundColor: colors.message.user,
			color: colors.message.userText,
			marginLeft: 'auto',
			marginRight: '1rem',
			borderRadius: '0.625rem',
			fontWeight: 400,
			textAlign: 'left',
			alignSelf: 'flex-end',
			maxWidth: '85%',
			width: 'fit-content',
			fontSize: '0.875rem',
			lineHeight: '1.35',
			padding: '0.25rem 1.25rem',
			letterSpacing: '0.02em',
		},
		botMessage: {
			backgroundColor: colors.message.bot,
			color: colors.message.botText,
			marginRight: 'auto',
			marginLeft: 0,
			borderBottomLeftRadius: '0.25rem',
			borderRadius: '1rem',
			fontWeight: 400,
			alignSelf: 'flex-start',
			letterSpacing: '0.02em',
		},

		messageText: {
			display: 'block',
			maxWidth: '100%',
			overflowWrap: 'break-word',
			wordBreak: 'break-word',
			userSelect: 'text',
			WebkitUserSelect: 'text',
			MozUserSelect: 'text',
			msUserSelect: 'text',
			cursor: 'text',
		},

		questionContainer: {
			all: 'revert',
			width: '100%',
			margin: '0.5rem 0',
			display: 'flex',
			flexDirection: 'column',
			justifyContent: 'flex-start',
			gap: '0.75rem',
			flexWrap: 'wrap',
			boxSizing: 'border-box',
		},
		questionButton: {
			all: 'revert',
			background: colors.button.secondary,
			color: colors.button.secondaryText,
			border: `0.0625rem solid ${colors.button.secondaryBorder}`,
			borderRadius: '0.625rem',
			padding: '0.625rem 1.25rem',
			minWidth: '8rem',
			maxWidth: '83%',
			fontWeight: 500,
			fontSize: '1rem',
			lineHeight: '1.5',
			letterSpacing: '0.02em',
			cursor: 'pointer',
			boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.04)',
			textAlign: 'left',
			fontFamily: 'Roboto, sans-serif',
			height: 'auto',
			whiteSpace: 'pre-wrap',
			wordBreak: 'break-word',
			transition: 'background 0.2s',
			boxSizing: 'border-box',
			overflowWrap: 'break-word',
			alignSelf: 'flex-end',
			marginLeft: 'auto',
			marginRight: '1rem',
		},

		viewContextContainer: {
			position: 'relative',
			width: '100%',
			marginBottom: '1.25rem',
		},
		viewContextButton: {
			all: 'revert',
			width: '100%',
			gap: '0.625rem',
			padding: '0.625rem 1.25rem',
			border: `0.0625rem solid ${colors.border.tertiary}`,
			borderRadius: '0.625rem',
			height: '3rem',
			background: colors.background.quaternary,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'space-between',
			boxSizing: 'border-box',
			cursor: 'pointer',
			transition: 'background-color 0.2s',
		},
		viewContextButtonHover: {
			background: colors.background.primary,
		},
		viewContextText: {
			fontSize: '1rem',
			fontWeight: 400,
			color: colors.text.tertiary,
			lineHeight: '100%',
		},
		contextPopup: {
			position: 'absolute',
			top: '100%',
			left: 0,
			right: 0,
			background: theme === 'light' ? '#FFFFFF' : colors.background.tertiary,
			border: `0.0625rem solid ${colors.border.primary}`,
			borderRadius: '0.5rem',
			boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.1)',
			zIndex: 1000,
			maxHeight: '24rem', // 360px = 5 items * (3rem height + 1.5rem padding)
			overflowY: 'auto',
			marginTop: '0.25rem',
			boxSizing: 'border-box',
		},
		contextDocumentButton: {
			all: 'revert',
			width: '100%',
			padding: '0.75rem',
			background: theme === 'light' ? '#FFFFFF' : colors.background.quaternary,
			border: 'none',
			borderBottom: `0.0625rem solid ${colors.border.primary}`,
			color: colors.text.quaternary,
			fontSize: '0.875rem',
			fontWeight: 600,
			cursor: 'pointer',
			fontFamily: 'Roboto, sans-serif',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'flex-start',
			transition: 'background-color 0.2s',
			boxSizing: 'border-box',
			whiteSpace: 'nowrap',
			overflow: 'hidden',
			textOverflow: 'ellipsis',
		},
		contextDocumentButtonHover: {
			background: theme === 'light' ? '#F8F6F7' : colors.background.primary,
		},
		followUpQuestionText: {
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'flex-end',
			fontSize: '0.875rem',
			fontWeight: 400,
			color: '#757575',
			lineHeight: '1.35',
			cursor: 'pointer',
			marginRight: '1rem',
		},
		settingsPopup: {
			position: 'absolute',
			bottom: '100%',
			right: 0,
			background: theme === 'light' ? '#FFFFFF' : colors.background.tertiary,
			border: `0.0625rem solid ${colors.border.primary}`,
			borderRadius: '0.5rem',
			boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.1)',
			zIndex: 1000,
			width: '20rem',
			padding: '1rem',
			marginBottom: '0.5rem',
			boxSizing: 'border-box',
		},
		settingsLabel: {
			fontSize: '0.875rem',
			fontWeight: 500,
			color: colors.text.allText,
			marginBottom: '0.5rem',
			display: 'block',
		},
		settingsInput: {
			width: '100%',
			padding: '0.5rem',
			border: `0.0625rem solid ${colors.border.primary}`,
			borderRadius: '0.25rem',
			background: colors.background.secondary,
			color: colors.text.allText,
			fontSize: '0.875rem',
			marginBottom: '1rem',
			boxSizing: 'border-box',
			outline: 'none',
		},
		settingsButton: {
			background: colors.button.primary,
			color: colors.button.primaryText,
			border: 'none',
			borderRadius: '0.25rem',
			padding: '0.5rem 1rem',
			fontSize: '0.875rem',
			fontWeight: 500,
			cursor: 'pointer',
			width: '100%',
			boxSizing: 'border-box',
		}
		// renamePopupOverlay is managed by parent in DeepTutorMain
	};
	const [messages, setMessages] = useState([]);
	const [sessionId, setSessionId] = useState(null);
	const [userId, setUserId] = useState(userIdFromParent || null);
	const [inputValue, setInputValue] = useState('');
	const [documentIds, setDocumentIds] = useState([]);
	const [latestMessageId, setLatestMessageId] = useState(null);
	const [curSessionType, setcurSessionType] = useState(SessionType.BASIC);
	const chatLogRef = useRef(null);
	const contextPopupRef = useRef(null);
	const [_hoveredContextDoc, _setHoveredContextDoc] = useState(null);
	const [hoveredQuestion, setHoveredQuestion] = useState(null);
	const [iniWait, setInitWait] = useState(false);
	const [isStreaming, setIsStreaming] = useState(false);
	const streamReaderRef = useRef(null);
	const isAutoScrollingRef = useRef(true);
	const [showContextPopup, setShowContextPopup] = useState(false);
	const [_contextDocuments, _setContextDocuments] = useState([]);
	const [currentSourceIndices, setCurrentSourceIndices] = useState([]);
	const sessionIdRef = useRef(null);
	const [isManuallyStopped, setIsManuallyStopped] = useState(false);
	const isManuallyStoppedRef = useRef(isManuallyStopped);
	// Ref to prevent race conditions on the very first send in a new session
	const isFirstSendInitializingRef = useRef(false);
	const [_time, setTime] = useState(new Date());

	// Separate state for the currently-opened file context slot
	// This is kept distinct from user-added context in documentIds
	const [currentContextDocumentId, setCurrentContextDocumentId] = useState(null);
	const [includeCurrentContext, setIncludeCurrentContext] = useState(true);

	/**
	 * Build a combined, de-duplicated list of context document IDs with the
	 * current-opened file (if included) appearing first, followed by user-added files.
	 */
	const combinedDocumentIds = useMemo(() => {
		const base = Array.isArray(documentIds) ? documentIds : [];
		const currentArray = (includeCurrentContext && typeof currentContextDocumentId === 'string' && currentContextDocumentId.length > 0)
			? [currentContextDocumentId]
			: [];

		// Load mappings for dedupe across temp/azure IDs using underlying Zotero attachment
		let draftMapping = {};
		let sessionMapping = {};
		try {
			draftMapping = JSON.parse(Zotero.Prefs.get('deeptutor_mapping_draft') || '{}');
		}
		catch {}
		try {
			if (sessionId) {
				sessionMapping = JSON.parse(Zotero.Prefs.get(`deeptutor_mapping_${sessionId}`) || '{}');
			}
		}
		catch {}

		const resolveZoteroAttachmentId = (id) => {
			if (!id) return null;
			if (draftMapping[id]) return draftMapping[id];
			if (sessionMapping[id]) return sessionMapping[id];
			return null;
		};

		const seenIds = new Set();
		const seenZotero = new Set();
		const result = [];
		const pushIfUnique = (id) => {
			if (!id) return;
			const zotId = resolveZoteroAttachmentId(id);
			const zotKey = typeof zotId === 'number' || typeof zotId === 'string' ? String(zotId) : null;
			if (seenIds.has(id)) return;
			if (zotKey && seenZotero.has(zotKey)) return;
			seenIds.add(id);
			if (zotKey) seenZotero.add(zotKey);
			result.push(id);
		};

		currentArray.forEach(pushIfUnique);
		base.forEach(pushIfUnique);
		return result;
	}, [documentIds, currentContextDocumentId, includeCurrentContext, sessionId]);

	// Add state for note container (parent item ID for creating notes)
	const [noteContainer, setNoteContainer] = useState(null);

	// Add state to track if a note is currently being saved
	const [isSavingNote, _setIsSavingNote] = useState(false);

	// Add state to track streaming component visibility for each message
	const [streamingComponentVisibility, setStreamingComponentVisibility] = useState({});
	// const [showRenamePopup, setShowRenamePopup] = useState(false); // deprecated - managed by parent

	// Add state to track waiting for AI response (backend processing)
	const [waitingStreaming, setWaitingStreaming] = useState(false);

	// Add state to track if we have an active stream connection (vs just backend processing)
	const [hasActiveStream, setHasActiveStream] = useState(false);

	// Add state to track the currently opened paper for change detection
	const [currentOpenedPaperId, setCurrentOpenedPaperId] = useState(null);

	// Toggle streaming component visibility for a specific message
	const toggleStreamingComponent = (messageId) => {
		setStreamingComponentVisibility(prev => ({
			...prev,
			[messageId]: !prev[messageId]
		}));
	};

	// Function to get currently opened paper ID
	const getCurrentlyOpenedPaperId = () => {
		const pdfData = getCurrentlyOpenedPDF();
		return pdfData ? pdfData.itemId : null;
	};

	// Function to update paper context when paper changes
	const updatePaperContext = async (newPaperId) => {
		try {
			if (!newPaperId || !userId) return;

			// Only update paper context for placeholder sessions
			const isPlaceholderSession = sessionId && typeof sessionId === 'string' && sessionId.startsWith('__DRAFT__');
			if (!isPlaceholderSession) {
				Zotero.debug(`DeepTutorChat: Not a placeholder session, skipping paper context update`);
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
				Zotero.debug(`DeepTutorChat: Error getting filename for new paper: ${error.message}`);
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
				const candidateIds = Array.isArray(documentIds) ? documentIds : [];
				for (const id of candidateIds) {
					if (updatedMapping[id] && updatedMapping[id] === newPaperId) {
						willDuplicateExisting = true;
						break;
					}
				}
			}
			catch {}

			if (willDuplicateExisting) {
				// The file is already in the added list; keep current slot empty to avoid duplicates
				setCurrentContextDocumentId(null);
				setIncludeCurrentContext(false);
				Zotero.debug(`DeepTutorChat: Current-opened paper already in user-added context; skipping current slot`);
			}
			else {
				// Save current-opened document in its own slot and ensure it is included
				setCurrentContextDocumentId(tempDocumentId);
				setIncludeCurrentContext(true);
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

			// If we are replacing a previously-set current temp document, remove its mapping
			try {
				if (typeof currentContextDocumentId === 'string' && currentContextDocumentId.startsWith('temp_') && currentContextDocumentId !== tempDocumentId) {
					delete existingMapping[currentContextDocumentId];
				}
			}
			catch {}

			// Add the new mapping while preserving existing ones
			const updatedMapping = { ...existingMapping, [tempDocumentId]: newPaperId };
			try {
				Zotero.Prefs.set(mappingKey, JSON.stringify(updatedMapping));
			}
			catch (error) {
				Zotero.debug(`DeepTutorChat: Error updating temp mapping: ${error.message}`);
			}

			Zotero.debug(`DeepTutorChat: Set current-opened paper in context: ${fileName} (temp ID: ${tempDocumentId})`);
		}
		catch (error) {
			Zotero.debug(`DeepTutorChat: Error updating paper context: ${error.message}`);
		}
	};

	// Agentic mode state variables
	const [isAgenticMode, setIsAgenticMode] = useState(false);
	const [showClaudeInstallPopup, setShowClaudeInstallPopup] = useState(false);
	const [showSettingsPopup, setShowSettingsPopup] = useState(false);
	const [agenticApiKey, setAgenticApiKey] = useState(() => {
		try {
			return Zotero.Prefs.get('deeptutor.claude.apiKey') || '';
		} catch (e) {
			Zotero.debug(e);
			return '';
		}
	});
	const [openaiApiKey, setOpenaiApiKey] = useState(() => {
		try {
			return Zotero.Prefs.get('deeptutor.openai.apiKey') || '';
		} catch (e) {
			Zotero.debug(e);
			return '';
		}
	});
	const [cliChoice, setCliChoice] = useState(() => {
		try {
			return Zotero.Prefs.get('deeptutor.cli.choice') || 'claude';
		} catch (e) {
			Zotero.debug(e);
			return 'claude';
		}
	});
	const [agenticSystemPrompt, setAgenticSystemPrompt] = useState(DEFAULT_SYS_QA_PROMPT);
	// Comment out Zotero.Prefs fetching - prioritize default prompt and rely on component state
	// const [agenticSystemPrompt, setAgenticSystemPrompt] = useState(() => {
	// 	try {
	// 		return Zotero.Prefs.get('deeptutor.claude.systemPrompt') || DEFAULT_SYS_QA_PROMPT;
	// 	} catch (e) {
	// 		Zotero.debug(e);
	// 		return DEFAULT_SYS_QA_PROMPT;
	// 	}
	// });
	const [_agenticHistory, setAgenticHistory] = useState([]);
	const [isFirstSummary, setIsFirstSummary] = useState(true);

	// Agentic history management functions
	const saveAgenticHistory = (sessionId, history) => {
		try {
			const historyKey = `SessionHis_${sessionId}`;
			Zotero.Prefs.set(historyKey, JSON.stringify(history));
			Zotero.debug(`DeepTutorChatBox: Saved agentic history for session ${sessionId}`);
		} catch (error) {
			Zotero.debug(`DeepTutorChatBox: Error saving agentic history: ${error.message}`);
		}
	};

	const loadAgenticHistory = (sessionId) => {
		try {
			const historyKey = `SessionHis_${sessionId}`;
			const historyStr = Zotero.Prefs.get(historyKey);
			if (historyStr) {
				return JSON.parse(historyStr);
			}
			return [];
		} catch (error) {
			Zotero.debug(`DeepTutorChatBox: Error loading agentic history: ${error.message}`);
			return [];
		}
	};

	const addToAgenticHistory = (sessionId, role, message) => {
		const historyEntry = `${role}: ${message}`;
		setAgenticHistory(prev => {
			const newHistory = [...prev, historyEntry];
			saveAgenticHistory(sessionId, newHistory);
			return newHistory;
		});
	};

	const convertAgenticHistoryToMessages = (history) => {
		const messages = [];
		history.forEach((entry, index) => {
			if (entry.startsWith('USER: ')) {
				const text = entry.substring(6); // Remove "USER: " prefix
				messages.push({
					id: `agentic_user_${index}`,
					subMessages: [{
						text: text,
						contentType: ContentType.TEXT,
						creationTime: new Date().toISOString(),
						sources: []
					}],
					role: MessageRole.USER,
					creationTime: new Date().toISOString(),
					lastUpdatedTime: new Date().toISOString(),
					status: MessageStatus.VIEWED
				});
			} else if (entry.startsWith('TUTOR: ')) {
				const text = entry.substring(7); // Remove "TUTOR: " prefix
				messages.push({
					id: `agentic_tutor_${index}`,
					subMessages: [{
						text: text,
						contentType: ContentType.TEXT,
						creationTime: new Date().toISOString(),
						sources: []
					}],
					role: MessageRole.TUTOR,
					creationTime: new Date().toISOString(),
					lastUpdatedTime: new Date().toISOString(),
					status: MessageStatus.VIEWED,
					followUpQuestions: []
				});
			}
		});
		return messages;
	};

	// Helper function to check if we should continue checking for responses (within 10 minutes)
	const checkTime = React.useCallback((lastMessage) => {
		if (!lastMessage || !lastMessage.creationTime) return true;
		
		const messageTime = new Date(lastMessage.creationTime);
		const currentTime = new Date();
		const timeDiff = currentTime - messageTime;
		
		// Continue checking if less than 10 minutes have passed since the last message
		return timeDiff < 600000; // 10 minutes in milliseconds
	}, []);

	useEffect(() => {
		isManuallyStoppedRef.current = isManuallyStopped;
	}, [isManuallyStopped]);

	// Clear waiting state when active streaming starts
	useEffect(() => {
		if (hasActiveStream && waitingStreaming) {
			Zotero.debug(`DeepTutorChat: Active streaming started, clearing waiting state`);
			setWaitingStreaming(false);
		}
	}, [hasActiveStream, waitingStreaming]);

	// Periodic message fetching useEffect
	useEffect(() => {
		let isActive = true;
		let timeoutId = null;
		
		const periodicCheck = () => {
			if (!isActive) return;
			
			setTime(new Date()); // Update time every 30 seconds
			
			if (
				sessionId
				&& messages.length > 0
				&& messages[messages.length - 1].role === MessageRole.USER
				&& checkTime(messages[messages.length - 1])
			) {
				// Set waiting state to show thinking animation (AI is processing but not yet in history)
				Zotero.debug(`DeepTutorChat: Setting waitingStreaming to true - last message is USER and within time limit`);
				setWaitingStreaming(true);
				
				getMessagesBySessionId(sessionId).then((response) => {
					if (response && response.length > messages.length) {
						Zotero.debug(`DeepTutorChat: New messages found, stopping waitingStreaming`);
						setMessages(response);
						setLatestMessageId(response[response.length - 1].id);
						// Stop streaming if it was active (AI response received)
						setIsStreaming(false);
						setHasActiveStream(false);
						// Stop waiting since we got a response
						setWaitingStreaming(false);
					}
					else {
						Zotero.debug(`DeepTutorChat: No new messages, keeping waitingStreaming true`);
					}
					// If no new messages but we're still checking, keep waiting state true
				}).catch((error) => {
					Zotero.debug(`DeepTutorChat: Error checking messages: ${error}`);
					// Stop waiting state on error
					setWaitingStreaming(false);
				});
			}
			else {
				// Not waiting for response
				Zotero.debug(`DeepTutorChat: Not in waiting condition, setting waitingStreaming to false`);
				setWaitingStreaming(false);
			}
			
			// Schedule next check
			if (isActive) {
				timeoutId = setTimeout(periodicCheck, 60000);
			}
		};
		
		// Start the periodic check if checkTime is available
		if (checkTime) {
			timeoutId = setTimeout(periodicCheck, 60000);
		}
		
		// If checkTime is not available, don't start the periodic check
		if (!checkTime) {
			isActive = false;
		}
		
		return () => {
			isActive = false;
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};
	}, [messages, checkTime]); // Dependencies: sessionId, messages, and checkTime function


	// Handle source button clicks
	const handleSourceClick = async (source) => {
		if (!source) {
			return;
		}

		// Determine which attachment the source refers to
		const docIdx
            = (source.refinedIndex !== undefined && source.refinedIndex !== null)
            	? source.refinedIndex
            	: source.index;

		if (docIdx === undefined || docIdx === null || docIdx < 0 || docIdx >= combinedDocumentIds.length) {
			return;
		}

		const attachmentId = combinedDocumentIds[docIdx];
		if (!attachmentId) {
			return;
		}

		try {
			const storageKey = `deeptutor_mapping_${sessionId}`;
			let zoteroAttachmentId = attachmentId;

			const mappingStr = Zotero.Prefs.get(storageKey);
			if (mappingStr) {
				const mapping = JSON.parse(mappingStr);
				if (mapping[attachmentId]) {
					zoteroAttachmentId = mapping[attachmentId];
				}
			}

			const item = Zotero.Items.get(zoteroAttachmentId);
			if (!item) {
				return;
			}

			// Track this file as recently accessed
			let fileName = '';
			try {
				fileName = item.getField('title') || item.attachmentFilename || '';
			}
			catch {
				fileName = '';
			}
			RecentFilesManager.addRecentFile(item.id, fileName);

			// Open the PDF on the correct page
			await Zotero.FileHandlers.open(item, {
				location: { pageIndex: source.page - 1 }
			});

			// Get the reader instance for the current tab
			const reader = Zotero.Reader.getByTabID(Zotero.getMainWindow().Zotero_Tabs.selectedID);
			if (!reader) {
				return; // Early exit if reader is not available
			}

			/*
			Search functionality commented out - preserve file opening and page switching only
			const searchQuery = source.referenceString || "test";
			
			reader._internalReader.setFindQuery(searchQuery, {
			primary: true,
			openPopup: false,
			activateSearch: true
			});
			*/
			
			// Future: Add search functionality here when needed
			Zotero.debug('DeepTutorChat: PDF opened, search functionality available if needed');
		}
		catch (error) {
			Zotero.debug(error);
		}
	};

	// Set up global handler for source button clicks
	useEffect(() => {
		window.handleDeepTutorSourceClick = (encodedSourceData) => {
			try {
				const sourceData = JSON.parse(decodeURIComponent(encodedSourceData));
				handleSourceClick(sourceData);
			}
			catch (error) {
				Zotero.debug(error);
			}
		};
		
		// Set up event delegation for source button clicks
		const handleDocumentClick = (event) => {
			if (event.target && event.target.classList.contains('deeptutor-source-button')) {
				const sourceData = event.target.getAttribute('data-source-data');
				if (sourceData) {
					try {
						const decodedData = JSON.parse(decodeURIComponent(sourceData));
						handleSourceClick(decodedData);
					}
					catch (error) {
						Zotero.debug(error);
					}
				}
			}
		};
		
		// Add event listener to document
		document.addEventListener('click', handleDocumentClick);
		
		// Cleanup function
		return () => {
			document.removeEventListener('click', handleDocumentClick);
			if (window.handleDeepTutorSourceClick) {
				delete window.handleDeepTutorSourceClick;
			}
		};
	}, [sessionId, combinedDocumentIds]); // Re-setup when session or documents change

	// Re-enable placeholder to button conversion now that XML parsing is fixed
	// Convert placeholder spans to actual buttons after React renders
	useEffect(() => {
		const convertPlaceholdersToButtons = () => {
			if (!chatLogRef.current) return;
			
			const placeholders = chatLogRef.current.querySelectorAll('.deeptutor-source-placeholder');
			
			placeholders.forEach((placeholder) => {
				const sourceId = placeholder.getAttribute('data-source-id');
				const sourceIndex = parseInt(sourceId) - 1;
				const page = placeholder.getAttribute('data-page');
				
				// Get source data from Zotero.Prefs
				const storageKey = `deeptutor_source_${sessionId}_${sourceIndex}`;
				let sourceData;
				try {
					const sourceDataStr = Zotero.Prefs.get(storageKey);
					if (sourceDataStr) {
						sourceData = JSON.stringify(JSON.parse(sourceDataStr));
					}
				}
				catch (error) {
					Zotero.debug(error);
				}
				
				// Fallback: Try to get source data from current messages if not in prefs
				if (!sourceData) {
					for (const message of messages) {
						if (message.subMessages) {
							for (const subMessage of message.subMessages) {
								if (subMessage.sources && subMessage.sources[sourceIndex]) {
									const source = subMessage.sources[sourceIndex];
									sourceData = JSON.stringify({
										// remap index to combinedDocumentIds order when available
										index: source.index || sourceIndex,
										refinedIndex: source.refinedIndex !== undefined ? source.refinedIndex : source.index || sourceIndex,
										page: source.page || 1,
										referenceString: source.referenceString || '',
										sourceAnnotation: source.sourceAnnotation || {}
									});
									
									// Store it in prefs for future use
									Zotero.Prefs.set(storageKey, sourceData);
									break;
								}
							}
						}
						if (sourceData) break;
					}
				}
				
				// Create the button element
				const button = document.createElement('button');
				button.className = 'deeptutor-source-button';
				button.setAttribute('data-source-id', sourceId);
				if (sourceData) {
					button.setAttribute('data-source-data', encodeURIComponent(sourceData));
				}
				button.title = `Jump to source: Page ${page}`;
				button.textContent = sourceId;
				
				// Replace the placeholder with the button
				placeholder.parentNode.replaceChild(button, placeholder);
			});
		};
		
		// Convert placeholders after messages change
		const timeoutId = setTimeout(convertPlaceholdersToButtons, 100);
		
		return () => {
			clearTimeout(timeoutId);
		};
	}, [messages, sessionId]); // Added sessionId dependency

	// Handle session changes
	useEffect(() => {
		const loadSessionData = async () => {
			if (!currentSession?.id) return;

			Zotero.debug('DeepTutorChatBox: Session change detected, starting session data loading...');

			// Check if this is an agentic mode session
			const isAgentic = currentSession.sessionName && currentSession.sessionName.startsWith('_AGENTIC_');
			setIsAgenticMode(isAgentic);

			// Update session and user IDs
			setSessionId(currentSession.id);
			setUserId(currentSession.userId);
			setDocumentIds(currentSession.documentIds || []);
			setcurSessionType(isAgentic ? SessionType.AGENTIC : (currentSession.type || SessionType.BASIC));

			// Note: PDF processing is now available through the settings popup
			// Users can manually trigger PDF processing when needed
			Zotero.debug('DeepTutorChatBox: Session loaded - PDF processing available in settings');

			// For agentic mode, check Claude CLI availability
			if (isAgentic) {
				try {
					Zotero.debug('DeepTutorChatBox: Agentic mode detected, checking Claude CLI...');
					const claudeCheck = await ClaudeCliWrapper.checkClaude();
					Zotero.debug(`DeepTutorChatBox: Claude CLI check result: ${JSON.stringify(claudeCheck)}`);
					
					if (!claudeCheck.exists) {
						Zotero.debug('DeepTutorChatBox: Claude CLI not found, showing install popup');
						setShowClaudeInstallPopup(true);
					}
				} catch (error) {
					Zotero.debug(`DeepTutorChatBox: Error checking Claude CLI: ${error.message}`);
					setShowClaudeInstallPopup(true);
				}
			}

			// For non-agentic mode, fetch document information (errors are handled gracefully)
			if (!isAgentic) {
				const documentIds = currentSession.documentIds || [];
				const newDocumentFiles = await Promise.allSettled(
					documentIds.map(id => getDocumentById(id))
				);
				
				// Log any failures
				newDocumentFiles
					.filter(result => result.status === "rejected")
					.forEach(result => Zotero.debug(result.reason));
			}
		};

		loadSessionData();
		
		// Immediately check for waiting state when session changes
		// This handles the case where user switches back to a session that's waiting for AI response
		setTimeout(() => {
			if (
				currentSession?.id
				&& messages.length > 0
				&& messages[messages.length - 1].role === MessageRole.USER
				&& checkTime(messages[messages.length - 1])
			) {
				Zotero.debug(`DeepTutorChat: Session changed, immediately checking for waiting state`);
				setWaitingStreaming(true);
			}
		}, 100); // Small delay to ensure state updates are processed
	}, [currentSession, checkTime]);

	// Monitor for paper changes during placeholder stage
	useEffect(() => {
		// Only monitor for paper changes if we're in a placeholder session (draft session)
		const isPlaceholderSession = currentSession?.id && typeof currentSession.id === 'string' && currentSession.id.startsWith('__DRAFT__');
		
		if (!isPlaceholderSession) {
			return;
		}

		let timeoutId;
		
		const checkForPaperChange = () => {
			const currentPaperId = getCurrentlyOpenedPaperId();
			
			// If we have a current paper ID and it's different from what we're tracking
			if (currentPaperId && currentPaperId !== currentOpenedPaperId) {
				Zotero.debug(`DeepTutorChat: Paper change detected from ${currentOpenedPaperId} to ${currentPaperId}`);
				
				// Update the tracked paper ID
				setCurrentOpenedPaperId(currentPaperId);
				
				// Update the paper context
				updatePaperContext(currentPaperId);
			}
			// If we don't have a current paper ID but we were tracking one, clear it
			else if (!currentPaperId && currentOpenedPaperId) {
				Zotero.debug(`DeepTutorChat: No paper currently opened, clearing tracked paper ID`);
				setCurrentOpenedPaperId(null);
			}

			// Schedule next check
			timeoutId = setTimeout(checkForPaperChange, 2000);
		};

		// Set initial paper ID
		const initialPaperId = getCurrentlyOpenedPaperId();
		setCurrentOpenedPaperId(initialPaperId);

		// Start checking for paper changes
		timeoutId = setTimeout(checkForPaperChange, 2000);

		// eslint-disable-next-line consistent-return
		return () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};
	}, [currentSession, currentOpenedPaperId, userId, subscriptionType]);


	// Handle message updates
	useEffect(() => {
		const loadMessages = async () => {
			if (!sessionId) return;
			// Skip fetching for placeholder draft sessions
			if (typeof sessionId === 'string' && sessionId.startsWith('__DRAFT__')) return;

			// If we're kicking off the very first message streaming, skip empty loader to prevent clearing
			if (isFirstSendInitializingRef.current) {
				Zotero.debug('DeepTutorChat: Skipping loadMessages — first-send initialization in progress');
				return;
			}

			try {
				if (isAgenticMode) {
					// Load messages from local storage for agentic mode
					const history = loadAgenticHistory(sessionId);
					setAgenticHistory(history);
					const agenticMessages = convertAgenticHistoryToMessages(history);
					setMessages(agenticMessages);
					
					if (agenticMessages.length === 0) {
						// This is a new session, keep isFirstSummary as true
						await handleEmptyAgenticSession();
					} else {
						// This session has existing history, so first summary was already done
						setIsFirstSummary(false);
					}
				} else {
					// Regular API-based message loading
					const sessionMessages = await getMessagesBySessionId(sessionId);
					setMessages([]);
	                
					if (sessionMessages.length === 0) {
						await handleEmptySession();
						return;
					}

					// Process existing messages
					setLatestMessageId(sessionMessages[sessionMessages.length - 1].id);
					
					for (const [, message] of sessionMessages.entries()) {
						const sender = message.role === MessageRole.USER ? "You" : "DeepTutor";
						await _appendMessage(sender, message);
					}

					// Update streaming state based on last message
					const lastMessage = sessionMessages[sessionMessages.length - 1];
					const shouldStream = lastMessage?.role === MessageRole.USER && checkTime(lastMessage);
					setIsStreaming(shouldStream);
				}
			}
			catch (error) {
				Zotero.debug(error);
			}
		};

		const handleEmptySession = async () => {
			setInitWait(true);
			// If we already have an active stream or streaming state, do not overlay the loader
			if (hasActiveStream || isStreaming) {
				Zotero.debug('DeepTutorChat: Skipping handleEmptySession — stream already active');
				setInitWait(false);
				return;
			}
			
			const loadingMessage = {
				id: null,
				parentMessageId: latestMessageId,
				userId: userId,
				sessionId: sessionId,
				subMessages: [{
					text: "Loading...Please wait for a few seconds",
					image: null,
					audio: null,
					contentType: ContentType.TEXT,
					creationTime: new Date().toISOString(),
					sources: []
				}],
				followUpQuestions: [],
				creationTime: new Date().toISOString(),
				lastUpdatedTime: new Date().toISOString(),
				status: MessageStatus.UNVIEW,
				role: MessageRole.TUTOR
			};
			
			await _appendMessage("DeepTutor", loadingMessage);
			await new Promise(resolve => setTimeout(resolve, 8000));
			// Do not clear messages if streaming has begun in the meantime
			if (hasActiveStream || isStreaming) {
				Zotero.debug('DeepTutorChat: Aborting loader clear — streaming began during wait');
				setInitWait(false);
				return;
			}
			setMessages([]);
			
			// Do not auto-send summary; wait for user's first question
			setInitWait(false);
		};

		const handleEmptyAgenticSession = async () => {
			// For agentic mode, generate initial summary using summary prompt
			setInitWait(true);
			
			const loadingMessage = {
				id: 'agentic_loading',
				subMessages: [{
					text: "Loading...Please wait while I generate a summary of your documents.",
					contentType: ContentType.TEXT,
					creationTime: new Date().toISOString(),
					sources: []
				}],
				role: MessageRole.TUTOR,
				creationTime: new Date().toISOString(),
				lastUpdatedTime: new Date().toISOString(),
				status: MessageStatus.VIEWED,
				followUpQuestions: []
			};
			
			setMessages([loadingMessage]);
			await new Promise(resolve => setTimeout(resolve, 2000));
			setMessages([]);
			
			// Generate initial summary using summary prompt
			await handleAgenticMessage('Based on the context provided, make a comprehensive summary for the documents. Begin with "Summary"', true);
			setInitWait(false);
		};

		loadMessages();
	}, [sessionId, isAgenticMode]);


	// Auto-scroll when messages change
	useEffect(() => {
		if (chatLogRef.current && isAutoScrollingRef.current) {
			chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
		}
	}, [messages]);

	// Auto-scroll during streaming
	useEffect(() => {
		if (chatLogRef.current && isAutoScrollingRef.current) {
			chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
		}
	}, [messages, isStreaming]);

	// Handle manual scrolling - disable auto-scroll when user scrolls up
	const handleWheel = () => {
		if (chatLogRef.current) {
			const { scrollTop, scrollHeight, clientHeight } = chatLogRef.current;
			const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 100; // 100px tolerance
            
			// Only disable auto-scrolling if user is NOT at bottom
			if (!isAtBottom && isAutoScrollingRef.current) {
				isAutoScrollingRef.current = false;
			}
		}
	};


	// Handle scroll to detect if user scrolled back to bottom
	const handleScroll = () => {
		if (chatLogRef.current) {
			const { scrollTop, scrollHeight, clientHeight } = chatLogRef.current;
			const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 100; // 100px tolerance
            
			if (isAtBottom && !isAutoScrollingRef.current) {
				isAutoScrollingRef.current = true;
			}
		}
	};

	const userSendMessage = async (messageString) => {
		if (!messageString.trim()) {
			return;
		}
		// Capture whether this is the very first message in the session BEFORE we mutate state
		const hadNoMessagesBeforeSend = messages.length === 0;
		// Mark that we are initializing the first-send flow to avoid loader race conditions
		if (hadNoMessagesBeforeSend) {
			isFirstSendInitializingRef.current = true;
		}
		// Always enable auto-scrolling when user sends a message (which will trigger streaming)
		isAutoScrollingRef.current = true;

		try {
			if (!userId) throw new Error("No active user ID");
			let effectiveSessionId = sessionId;
			// If no session exists yet, create one now using any selected context
			const shouldCreateSession = !effectiveSessionId || (typeof effectiveSessionId === 'string' && effectiveSessionId.startsWith('__DRAFT__'));
			
			if (shouldCreateSession) {
				// Usage pre-check similar to model selection
				try {
					const latest = typeof refreshUsageSummary === 'function' ? await refreshUsageSummary() : usageSummary;
					const summary = latest || usageSummary || null;
					const subType = (subscriptionType || '').toUpperCase();
					const isPro = Boolean(hasActiveSubscription) && ["BASIC", "PLUS"].includes(subType);
					const isPremium = Boolean(hasActiveSubscription) && subType === "PREMIUM";
					if (!isPremium && summary) {
						const weeklyTotalUsed = Number(summary.weeklyLiteCount || 0) + Number(summary.weeklyBasicCount || 0);
						const cycleTotalUsed = Number(summary.liteCount || 0) + Number(summary.basicCount || 0);
						const wouldHitWeeklyLimit = !hasActiveSubscription && weeklyTotalUsed >= 5; // Free: 5/week
						const wouldHitCycleLimit = isPro && cycleTotalUsed >= 200; // Pro: 200/cycle
						if (wouldHitWeeklyLimit || wouldHitCycleLimit) {
							if (typeof onShowSubscriptionPopup === 'function') {
								onShowSubscriptionPopup();
							}
							return; // Do not create a new session
						}
					}
				}
				catch {}
				
				// Filter out temporary context IDs (e.g., temp_*) to avoid backend 400s
				const filteredDocumentIds = (combinedDocumentIds || []).filter((id) => !(typeof id === 'string' && id.startsWith('temp_')));
				try {
					const removedCount = (combinedDocumentIds || []).length - filteredDocumentIds.length;
					if (removedCount > 0) {
						Zotero.debug(`DeepTutorChat: Filtering out ${removedCount} temporary context IDs before session creation`);
					}
				}
				catch {}
				const sessionData = {
					userId: userId,
					sessionName: 'New Session',
					type: curSessionType || SessionType.BASIC,
					documentIds: filteredDocumentIds
				};
				const created = await createSession(sessionData).catch((err) => {
					throw err;
				});
				if (!created || !created.id) throw new Error('Failed to create session');
				setSessionId(created.id);
				effectiveSessionId = created.id;
				// Migrate draft mapping to this session's mapping key
				try {
					let draftMapping = {};
					try {
						draftMapping = JSON.parse(Zotero.Prefs.get('deeptutor_mapping_draft') || '{}');
					}
					catch {
						draftMapping = {};
					}
					
					if (draftMapping && typeof draftMapping === 'object') {
						const filtered = {};
						(combinedDocumentIds || documentIds || []).forEach((azureId) => {
							if (draftMapping[azureId]) {
								filtered[azureId] = draftMapping[azureId];
							}
						});
						try {
							Zotero.Prefs.set(`deeptutor_mapping_${created.id}`, JSON.stringify(filtered));
						}
						catch {}
					}
				}
				catch {}
				// Try to rename session based on first file name (best effort)
				if (combinedDocumentIds && combinedDocumentIds.length > 0) {
					try {
						let fileTitle = '';
						const firstAzureId = (combinedDocumentIds && combinedDocumentIds.length > 0) ? combinedDocumentIds[0] : (documentIds && documentIds[0]);
						// Try Zotero mapping first
						let mapping = {};
						try {
							mapping = JSON.parse(Zotero.Prefs.get(`deeptutor_mapping_${created.id}`) || '{}');
						}
						catch {
							mapping = {};
						}
						if (!mapping[firstAzureId]) {
							try {
								mapping = JSON.parse(Zotero.Prefs.get('deeptutor_mapping_draft') || '{}');
							}
							catch {
								mapping = {};
							}
						}
						const zoteroPdfId = mapping[firstAzureId];
						if (zoteroPdfId) {
							const item = Zotero.Items.get(zoteroPdfId);
							if (item) {
								try {
									fileTitle = item.attachmentFilename || item.getField('title') || '';
								}
								catch {
									fileTitle = '';
								}
							}
						}
						if (!fileTitle) {
							try {
								const docData = await getDocumentById(firstAzureId);
								fileTitle = (docData && (docData.name || docData.fileName || docData.title)) || '';
							}
							catch {}
						}
						
						const newTitle = (fileTitle || '').trim();
						if (newTitle) {
							try {
								await updateSessionName(created.id, newTitle);
							}
							catch {
								// Silent fail for session rename
							}
						}
					}
					catch {
						// Silent fail for session rename
					}
				}

				// Inform parent so it registers the new session and loads messages thereafter
				if (onCreateSessionFromId) {
					try {
						await onCreateSessionFromId(created.id);
					}
					catch {
						// ignore
					}
				}
			}

			// Create user message with proper structure
			const userMessage = {
				id: null,
				parentMessageId: latestMessageId,
				userId: userId,
				sessionId: effectiveSessionId,
				subMessages: [{
					text: messageString,
					image: null,
					audio: null,
					contentType: ContentType.TEXT,
					creationTime: new Date().toISOString(),
					sources: []
				}],
				followUpQuestions: [],
				creationTime: new Date().toISOString(),
				lastUpdatedTime: new Date().toISOString(),
				status: MessageStatus.UNVIEW,
				role: MessageRole.USER
			};

			await _appendMessage("You", userMessage);
			setLatestMessageId(userMessage.id);

			// Send to API and handle response
			const _response = await sendToAPI(userMessage, { isFirstSend: hadNoMessagesBeforeSend }).catch((err) => {
				Zotero.debug(`DeepTutorChat: createMessage/stream failed: ${err?.message}`);
				throw err;
			});
		}
		catch (error) {
			Zotero.debug(error);
			// Create error message
			const errorMessage = {
				subMessages: [{
					text: error.message || 'Error sending message',
					contentType: ContentType.TEXT
				}],
				role: MessageRole.TUTOR
			};
			setMessages(prev => [...prev, errorMessage]);
			await _appendMessage("DeepTutor", errorMessage);
		}
	};

	// Function to adjust textarea height based on content
	const adjustTextareaHeight = () => {
		// This function can be implemented if needed for auto-resize functionality
		// For now, it's a placeholder to prevent errors
	};

	const handleInputChange = (e) => {
		setInputValue(e.target.value);
		// Adjust height after the value is set
		setTimeout(adjustTextareaHeight, 0);
	};

	const handleAgenticMessage = async (messageText, isSummaryGeneration = false) => {
		if (!sessionId) return;

		try {
			// Add user message to history and display
			addToAgenticHistory(sessionId, 'USER', messageText);
			
			const userMessage = {
				id: `agentic_user_${Date.now()}`,
				subMessages: [{
					text: messageText,
					contentType: ContentType.TEXT,
					creationTime: new Date().toISOString(),
					sources: []
				}],
				role: MessageRole.USER,
				creationTime: new Date().toISOString(),
				lastUpdatedTime: new Date().toISOString(),
				status: MessageStatus.VIEWED
			};

			setMessages(prev => [...prev, userMessage]);

			// Disable input while processing
			setIsStreaming(true);

			// Call Claude CLI with streaming
			try {
				// Resolve working directory - now pointing to DeepTutorDataBase
				let workingDir = null;
				try {
					const prefDir = Zotero.Prefs.get('dataDir') || Zotero.Prefs.get('lastDataDir');
					if (prefDir && typeof prefDir === 'string') {
						// Point to DeepTutorDataBase subdirectory instead of main data directory
						const separator = Zotero.isWin ? '\\' : '/';
						workingDir = prefDir + separator + 'DeepTutorDataBase';
					}
					else if (Zotero.DataDirectory && typeof Zotero.DataDirectory.dir === 'string') {
						// Point to DeepTutorDataBase subdirectory instead of main data directory
						const separator = Zotero.isWin ? '\\' : '/';
						workingDir = Zotero.DataDirectory.dir + separator + 'DeepTutorDataBase';
					}
				}
				catch (e) {
					Zotero.debug(e);
				}
				
				if (!workingDir) {
					const separator = Zotero.isWin ? '\\' : '/';
					workingDir = `/home/sherman01/Zotero${separator}DeepTutorDataBase`;
				}

				// Ensure the DeepTutorDataBase directory exists
				try {
					const dirFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
					dirFile.initWithPath(workingDir);
					if (!dirFile.exists()) {
						Zotero.debug(`DeepTutorChatBox: DeepTutorDataBase directory does not exist, creating: ${workingDir}`);
						dirFile.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
					}
				}
				catch (dirError) {
					Zotero.debug(`DeepTutorChatBox: Error ensuring DeepTutorDataBase directory exists: ${dirError.message}`);
				}

				// Choose the appropriate system prompt
				let systemPrompt;
				if (isSummaryGeneration && isFirstSummary) {
					// Inject document names into the summary prompt
					const documentNames = _contextDocuments.map(doc => doc.name).join(', ');
					systemPrompt = DEFAULT_SYS_SUM_PROMPT.replace('{DOCUMENT_NAMES}', documentNames);
					setIsFirstSummary(false); // Mark that first summary is done
					Zotero.debug(`DeepTutorChatBox: Using summary prompt for first generation with documents: ${documentNames}`);
				}
				else {
					// Inject document names into QA prompt as well
					const documentNames = _contextDocuments.map(doc => doc.name).join(', ');
					const basePrompt = agenticSystemPrompt || DEFAULT_SYS_QA_PROMPT;
					systemPrompt = basePrompt.replace('{DOCUMENT_NAMES}', documentNames);
					Zotero.debug(`DeepTutorChatBox: Using QA prompt for regular conversation with documents: ${documentNames}`);
				}

				// Create initial streaming message for thinking display
				const initialStreamingMessage = {
					id: `agentic_streaming_${Date.now()}`,
					subMessages: [{
						text: '',
						contentType: ContentType.TEXT,
						creationTime: new Date().toISOString(),
						sources: []
					}],
					role: MessageRole.TUTOR,
					creationTime: new Date().toISOString(),
					lastUpdatedTime: new Date().toISOString(),
					status: MessageStatus.VIEWED,
					followUpQuestions: [],
					isStreaming: true,
					streamText: '',
					thinkingProcesses: [],
					hasThinkingProcess: false
				};

				// Add the streaming message immediately
				setMessages(prev => [...prev, initialStreamingMessage]);

				let accumulatedThinking = [];
				let finalResponseText = '';

				// Define streaming callbacks
				const onChunk = (chunk, isFinal, _accumulated) => {
					Zotero.debug(`DeepTutorChatBox: Received streaming chunk: "${chunk}"`);
					
					// Check for thinking content in the chunk
					if (chunk.includes('<thinking>')) {
						// Extract thinking content, even if the closing tag isn't in this chunk yet
						const thinkingStart = chunk.indexOf('<thinking>');
						if (thinkingStart !== -1) {
							let thinkingContent = chunk.substring(thinkingStart + '<thinking>'.length);
							
							// If we have a closing tag in this chunk, extract only the thinking part
							const thinkingEnd = thinkingContent.indexOf('</thinking>');
							if (thinkingEnd !== -1) {
								thinkingContent = thinkingContent.substring(0, thinkingEnd);
							}
							
							// Only add if we have actual content
							if (thinkingContent.trim()) {
								accumulatedThinking.push(thinkingContent);
								Zotero.debug(`DeepTutorChatBox: Captured thinking content: ${thinkingContent}`);
								
								// Update the streaming message with thinking content
								setMessages(prev => prev.map((msg, index) => {
									if (index === prev.length - 1 && msg.isStreaming) {
										return {
											...msg,
											streamText: `<thinking>${accumulatedThinking.join('')}</thinking>`,
											thinkingProcesses: [...accumulatedThinking],
											hasThinkingProcess: accumulatedThinking.length > 0
										};
									}
									return msg;
								}));
							}
							
							// If we found a closing tag, process any content after it as regular content
							if (thinkingEnd !== -1) {
								const afterThinking = chunk.substring(thinkingStart + '<thinking>'.length + thinkingContent.length + '</thinking>'.length);
								if (afterThinking.trim()) {
									finalResponseText += afterThinking;
								}
							}
							return;
						}
					}
					
					// Check if we're still in thinking mode (content between <thinking> tags)
					if (accumulatedThinking.length > 0 && !chunk.includes('</thinking>')) {
						// We're still accumulating thinking content
						accumulatedThinking[accumulatedThinking.length - 1] += chunk;
						
						// Update the streaming message with updated thinking content
						setMessages(prev => prev.map((msg, index) => {
							if (index === prev.length - 1 && msg.isStreaming) {
								return {
									...msg,
									streamText: `<thinking>${accumulatedThinking.join('')}</thinking>`,
									thinkingProcesses: [...accumulatedThinking],
									hasThinkingProcess: accumulatedThinking.length > 0
								};
							}
							return msg;
						}));
						return;
					}
					
					// Handle end of thinking
					if (chunk.includes('</thinking>')) {
						const thinkingEnd = chunk.indexOf('</thinking>');
						const thinkingPart = chunk.substring(0, thinkingEnd);
						
						// Add the final part of thinking content
						if (thinkingPart.trim() && accumulatedThinking.length > 0) {
							accumulatedThinking[accumulatedThinking.length - 1] += thinkingPart;
						}
						
						// Process any content after the thinking tags as regular content
						const afterThinking = chunk.substring(thinkingEnd + '</thinking>'.length);
						if (afterThinking.trim()) {
							finalResponseText += afterThinking;
							
							// Update the streaming message with response content
							setMessages(prev => prev.map((msg, index) => {
								if (index === prev.length - 1 && msg.isStreaming) {
									return {
										...msg,
										streamText: finalResponseText,
										subMessages: [{
											...msg.subMessages[0],
											text: finalResponseText
										}],
										thinkingProcesses: [...accumulatedThinking],
										hasThinkingProcess: accumulatedThinking.length > 0
									};
								}
								return msg;
							}));
						}
						return;
					}
					
					// Regular content chunk (not thinking)
					if (chunk && !chunk.includes('<thinking>') && !chunk.includes('</thinking>')) {
						finalResponseText += chunk;
						
						// Update the streaming message with response content
						setMessages(prev => prev.map((msg, index) => {
							if (index === prev.length - 1 && msg.isStreaming) {
								return {
									...msg,
									streamText: finalResponseText,
									subMessages: [{
										...msg.subMessages[0],
										text: finalResponseText
									}],
									thinkingProcesses: [...accumulatedThinking],
									hasThinkingProcess: accumulatedThinking.length > 0
								};
							}
							return msg;
						}));
					}
					
					if (isFinal) {
						Zotero.debug(`DeepTutorChatBox: Streaming completed with final content`);
					}
				};

				const onError = (error) => {
					Zotero.debug(`DeepTutorChatBox: Streaming error: ${error.message}`);
					setMessages(prev => prev.map((msg, index) => {
						if (index === prev.length - 1 && msg.isStreaming) {
							return {
								...msg,
								isStreaming: false,
								streamText: `Error: ${error.message}`,
								subMessages: [{
									...msg.subMessages[0],
									text: `Error: ${error.message}`
								}]
							};
						}
						return msg;
					}));
				};

				Zotero.debug(`DeepTutorChatBox: Calling Claude CLI streaming for agentic mode with working directory: ${workingDir}`);
				const claudeResult = await ClaudeCliWrapper.runClaudeStreaming([], workingDir, messageText, null, false, systemPrompt, false, cliChoice, onChunk, onError);
				
				let responseText = '';
				let thinkingProcesses = [];
				
				if (claudeResult && !claudeResult.error) {
					// Use accumulated content from streaming
					responseText = finalResponseText || claudeResult.content || String(claudeResult).trim();
					thinkingProcesses = accumulatedThinking;
					
					Zotero.debug(`DeepTutorChatBox: Streaming completed with ${thinkingProcesses.length} thinking processes`);
				}
				else if (claudeResult && claudeResult.error) {
					responseText = `Error: ${claudeResult.error}`;
				}
				else {
					responseText = 'No response from Claude CLI';
				}

				// Add tutor response to history and display
				addToAgenticHistory(sessionId, 'TUTOR', responseText);
				
				// Create final tutor message with thinking process support
				const tutorMessage = {
					id: `agentic_tutor_${Date.now()}`,
					subMessages: [{
						text: responseText,
						contentType: ContentType.TEXT,
						creationTime: new Date().toISOString(),
						sources: []
					}],
					role: MessageRole.TUTOR,
					creationTime: new Date().toISOString(),
					lastUpdatedTime: new Date().toISOString(),
					status: MessageStatus.VIEWED,
					followUpQuestions: [],
					// Add thinking process data
					thinkingProcesses: thinkingProcesses,
					hasThinkingProcess: thinkingProcesses.length > 0,
					isStreaming: false
				};

				// Replace the streaming message with final message
				setMessages(prev => {
					const newMessages = [...prev];
					newMessages[newMessages.length - 1] = tutorMessage;
					return newMessages;
				});
			}
			catch (claudeError) {
				Zotero.debug(`DeepTutorChatBox: Claude CLI error: ${claudeError.message}`);
				
				const errorText = `I encountered an error while processing your request: ${claudeError.message}`;
				addToAgenticHistory(sessionId, 'TUTOR', errorText);
				
				const errorMessage = {
					id: `agentic_error_${Date.now()}`,
					subMessages: [{
						text: errorText,
						contentType: ContentType.TEXT,
						creationTime: new Date().toISOString(),
						sources: []
					}],
					role: MessageRole.TUTOR,
					creationTime: new Date().toISOString(),
					lastUpdatedTime: new Date().toISOString(),
					status: MessageStatus.PROCESSING_ERROR,
					followUpQuestions: []
				};

				setMessages(prev => [...prev, errorMessage]);
			}

			// Re-enable input
			setIsStreaming(false);
		} catch (error) {
			Zotero.debug(`DeepTutorChatBox: Error in handleAgenticMessage: ${error.message}`);
			setIsStreaming(false);
		}
	};

	const handleSend = async () => {
		setIsManuallyStopped(false);
		const trimmedValue = inputValue.trim(); // Remove both leading and trailing spaces
		if (trimmedValue) { // Only send if there's actual content after trimming
			setInputValue('');
			// Reset textarea height after clearing
			setTimeout(adjustTextareaHeight, 0);
			
			if (isAgenticMode) {
				await handleAgenticMessage(trimmedValue);
			} else {
				await userSendMessage(trimmedValue);
			}
		}
		else {
			setInputValue(''); // Clear input even if empty
			// Reset textarea height after clearing
			setTimeout(adjustTextareaHeight, 0);
		}
	};

	const handleStopStreaming = async () => {
		if (streamReaderRef.current) {
			try {
				setIsManuallyStopped(true);
				await streamReaderRef.current.cancel();
				// Update the last message to show it was stopped
				setMessages((prev) => {
					const newMessages = [...prev];
					const lastMessage = newMessages[newMessages.length - 1];
					if (lastMessage && lastMessage.isStreaming) {
						lastMessage.isStreaming = false;
						
						// Clean the message text to remove any message ID that might have been added
						let cleanText = lastMessage.subMessages[0].text || '';
						
						// Remove any message ID patterns that might have been added (like long hex strings)
						cleanText = cleanText.replace(/[a-f0-9]{16,}/gi, ''); // Remove long hex strings
						cleanText = cleanText.replace(/^\d+/, ''); // Remove leading numbers (index fallbacks)
						
						// Add the stopped tag
						cleanText += '<stopped>';
						
						// Update the message text
						lastMessage.subMessages[0].text = cleanText;
						
						// Add flag to indicate this message was manually stopped
						lastMessage.manuallyStopped = true;
						
						// Hide streaming component by default when streaming is stopped
						setStreamingComponentVisibility(prevVisibility => ({
							...prevVisibility,
							[lastMessage.id || newMessages.length - 1]: false
						}));
					}
					return newMessages;
				});
			}
			catch (error) {
				Zotero.debug(`Error stopping stream: ${error.message}`);
				streamReaderRef.current = null; // Clear reader reference even on error
			}
		}
		
		// Handle waiting case - just stop the waiting animation
		if (waitingStreaming) {
			Zotero.debug(`DeepTutorChat: Stopping waiting animation`);
			setWaitingStreaming(false);
		}
		
		setIsStreaming(false);
		setHasActiveStream(false);
	};

	const sendToAPI = async (message, options = {}) => {
		const isFirstSend = Boolean(options.isFirstSend);
		const hasContextDocs = Array.isArray(combinedDocumentIds) && combinedDocumentIds.length > 0;
		// Determine target session for streaming early so it is available in error paths
		const sessionForStream = (message && message.sessionId) ? message.sessionId : sessionId;
		try {
			setIsStreaming(true); // Set streaming to true at start
			setHasActiveStream(true); // Set active stream flag
			setWaitingStreaming(false); // Clear waiting state when normal streaming starts
			isAutoScrollingRef.current = true; // Re-enable auto-scrolling for new stream
			Zotero.debug(`DeepTutorChat: sendToAPI start — isFirstSend=${isFirstSend}, hasContextDocs=${hasContextDocs}, sessionForStream=${sessionForStream}`);
			// Optional small pre-create delay on first send when context docs are present
			if (isFirstSend && hasContextDocs) {
				try {
					Zotero.debug('DeepTutorChat: delaying createMessage ~2000ms for context readiness');
					await new Promise((resolve) => setTimeout(resolve, 2000));
				}
				catch {}
			}
			// Send message to API (ensure de-duplicated context IDs are used)
			const responseData = await createMessage({ ...message, contextDocumentIds: combinedDocumentIds });
			try {
				Zotero.debug(`DeepTutorChat: createMessage OK — new message ID=${responseData?.id || 'n/a'}`);
			}
			catch {}
			const newDocumentFiles2 = [];
			for (const documentId of combinedDocumentIds || []) {
				try {
					const docData = await getDocumentById(documentId);
					newDocumentFiles2.push(docData);
				}
				catch (error) {
					Zotero.debug(error);
				}
			}
			
			// sessionForStream already computed above
			
			// Update conversation state
			const newState = new Conversation({
				userId: userId,
				sessionId: sessionForStream,
				ragSessionId: null,
				storagePaths: newDocumentFiles2.map(doc => doc.storagePath),
				history: messages,
				message: responseData,
				streaming: true,
				type: curSessionType || SessionType.BASIC
			});
			try {
				Zotero.debug(`DeepTutorChat: conversation ready — storagePaths=${newState.storagePaths?.length || 0}`);
			}
			catch {}

			// Optional pre-stream delay for the first response when context docs are present
			if (isFirstSend && hasContextDocs) {
				try {
					Zotero.debug('DeepTutorChat: first-send — show streaming placeholder immediately, but hold subscribe ~5000ms');
				}
				catch {}
			}
				
			// Subscribe to chat stream with timeout
			const streamResponse = await subscribeToChat(newState);
			try {
				Zotero.debug(`DeepTutorChat: subscribeToChat status=${streamResponse?.status}, hasBody=${Boolean(streamResponse?.body)}`);
			}
			catch {}

			if (!streamResponse.ok) {
				setIsStreaming(false); // Set streaming to false on error
				setHasActiveStream(false);
				throw new Error(`Stream request failed: ${streamResponse.status}`);
			}
            
			if (!streamResponse.body) {
				setIsStreaming(false); // Set streaming to false if no body
				setHasActiveStream(false);
				throw new Error('Stream response body is null');
			}

			const reader = streamResponse.body.getReader();
			streamReaderRef.current = reader; // Store reader reference for stopping
			const decoder = new TextDecoder();
			let streamText = "";
			let hasReceivedData = false;
			let lastDataTime = Date.now();
			try {
				Zotero.debug('DeepTutorChat: stream reader acquired; entering read loop');
			}
			catch {}

			// Create initial streaming message for TUTOR
			const initialStreamingMessage = {
				subMessages: [{
					text: "",
					contentType: ContentType.TEXT,
					creationTime: new Date().toISOString(),
					sources: []
				}],
				role: MessageRole.TUTOR,
				creationTime: new Date().toISOString(),
				lastUpdatedTime: new Date().toISOString(),
				status: MessageStatus.UNVIEW,
				isStreaming: true,
				streamText: ""
			};
            
			// Add the streaming message to messages
			await new Promise((resolve) => {
				setMessages((prev) => {
					const newMessages = [...prev, initialStreamingMessage];
					resolve();
					return newMessages;
				});
			});
			// First send initialization complete: we've placed the streaming placeholder
			isFirstSendInitializingRef.current = false;

			// Perform delayed subscribe after placeholder so UI shows instantly
			if (isFirstSend && hasContextDocs) {
				try {
					await new Promise((resolve) => setTimeout(resolve, 5000));
				}
				catch {}
			}

			while (true) {
				const { done, value } = await reader.read();
                
				// Check for timeout
				if (Date.now() - lastDataTime > 600000) {
					setIsStreaming(false); // Set streaming to false on timeout
					setHasActiveStream(false);
					throw new Error('Stream timeout - no data received for 300 seconds');
				}
                
				if (done) {
					if (!hasReceivedData) {
						setIsStreaming(false); // Set streaming to false if no data received
						setHasActiveStream(false);
						throw new Error('Stream closed without receiving any data');
					}
					break;
				}

				lastDataTime = Date.now();
				const data = decoder.decode(value);
				if (!hasReceivedData) {
					try {
						Zotero.debug(`DeepTutorChat: received first stream chunk — size=${data?.length || 0}`);
					}
					catch {}
				}
                
				data.split('\n\n').forEach((event) => {
					if (!event.startsWith('data:')) return;

					const jsonStr = event.slice(5);
					// Skip empty or whitespace-only strings
					if (!jsonStr || !jsonStr.trim()) return;

					try {
						const parsed = JSON.parse(jsonStr);
						const output = parsed.msg_content;
						if (output && output.length > 0) {
							hasReceivedData = true;
							streamText += output;
                            
							// Create a temporary streaming message to display the stream
							const streamMessage = {
								subMessages: [{
									text: streamText,
									contentType: ContentType.TEXT,
									creationTime: new Date().toISOString(),
									sources: []
								}],
								role: MessageRole.TUTOR,
								creationTime: new Date().toISOString(),
								lastUpdatedTime: new Date().toISOString(),
								status: MessageStatus.UNVIEW,
								isStreaming: true,
								streamText: streamText
							};

							// Update the last message in the chat, resilient to external clears
							setMessages((prev) => {
								if (!prev || prev.length === 0) {
									return [streamMessage];
								}
								const newMessages = [...prev];
								newMessages[newMessages.length - 1] = streamMessage;
								return newMessages;
							});
						}
					}
					catch (error) {
						Zotero.debug(error);
					}
				});
			}
			if (isManuallyStoppedRef.current) {
				setIsStreaming(false);
				setHasActiveStream(false);
				// For manual stop, we need to handle this differently since the message doesn't have an ID yet
				// We'll set the visibility when the message is processed later
				return;
			}
			// Fetch message history for the session
			await new Promise(resolve => setTimeout(resolve, 3000));
            
			const historyData = await getMessagesBySessionId(sessionForStream);
			
			// Preserve streaming message data when updating from server
			setMessages((prevMessages) => {
				// Find the streaming message (last message with isStreaming: true)
				const streamingMessageIndex = prevMessages.findIndex(msg => msg.isStreaming);
				
				if (streamingMessageIndex !== -1) {
					// Replace the streaming message with the final server message, but preserve streamText
					const streamingMessage = prevMessages[streamingMessageIndex];
					const finalMessage = historyData[historyData.length - 1];
					
					// Create updated message that preserves streamText but uses server data
					const updatedMessage = {
						...finalMessage,
						streamText: streamingMessage.streamText || finalMessage.subMessages?.[0]?.text || '',
						isStreaming: false
					};
					
					// Replace the streaming message with the updated one
					const updatedMessages = [...prevMessages];
					updatedMessages[streamingMessageIndex] = updatedMessage;
					
					// Hide streaming component by default when streaming finishes
					// Use the actual message ID from the server
					setStreamingComponentVisibility(prevVisibility => ({
						...prevVisibility,
						[updatedMessage.id]: false
					}));
					
					return updatedMessages;
				}
				
				// If no streaming message found, use server data as is
				// Hide streaming component for the last message
				if (historyData.length > 0) {
					const lastMessage = historyData[historyData.length - 1];
					setStreamingComponentVisibility(prevVisibility => ({
						...prevVisibility,
						[lastMessage.id]: false
					}));
				}
				
				return historyData;
			});
			
			setLatestMessageId(historyData[historyData.length - 1].id);

            
			setIsStreaming(false); // Set streaming to false when done
			setHasActiveStream(false);
			streamReaderRef.current = null; // Clear reader reference
			
			// Hide streaming component by default when streaming finishes
			// We need to wait for the messages to be updated with server data
			// The visibility will be set after the server message is processed
		}
		catch (error) {
			Zotero.debug(error);
			setIsStreaming(false); // Set streaming to false on any error
			setHasActiveStream(false);
			streamReaderRef.current = null; // Clear reader reference
			// Ensure flag resets even on failure
			isFirstSendInitializingRef.current = false;
			
			// Even on error, try to fetch message history to ensure UI consistency
			try {
				await new Promise(resolve => setTimeout(resolve, 1000)); // Shorter wait for error case
				
				const historyData = await getMessagesBySessionId(sessionForStream);
				if (historyData && historyData.length > 0) {
					setMessages(historyData);
					setLatestMessageId(historyData[historyData.length - 1].id);
					
					// Hide streaming component by default when streaming finishes (even on error)
					const lastMessage = historyData[historyData.length - 1];
					setStreamingComponentVisibility(prevVisibility => ({
						...prevVisibility,
						[lastMessage.id]: false
					}));
				}
			}
			catch (historyError) {
				Zotero.debug(historyError);
			}
			
			throw error;
		}
	};


	const _appendMessage = async (sender, message) => {
		// Process subMessages
		if (message.subMessages && message.subMessages.length > 0) {
			// Create a new message object with processed subMessages
			const processedMessage = {
				...message,
				subMessages: await Promise.all(message.subMessages.map(async (subMessage) => {
					// Process sources if they exist
					if (subMessage.sources && subMessage.sources.length > 0) {
						// Store source data in Zotero.Prefs for history sessions
						subMessage.sources.forEach((source, sourceIndex) => {
							const storageKey = `deeptutor_source_${sessionId}_${sourceIndex}`;
							const sourceData = {
								index: source.index || sourceIndex,
								refinedIndex: source.refinedIndex !== undefined ? source.refinedIndex : source.index || sourceIndex,
								page: source.page || 1,
								referenceString: source.referenceString || '',
								sourceAnnotation: source.sourceAnnotation || {}
							};
							Zotero.Prefs.set(storageKey, JSON.stringify(sourceData));
							
							// Add sourceIndex to tracking state
							if (!currentSourceIndices.includes(sourceIndex)) {
								setCurrentSourceIndices(prev => [...prev, sourceIndex]);
							}
						});
						
						// Annotation workflow removed — simply pass sources through unchanged
						return {
							...subMessage,
							sources: subMessage.sources
						};
					}
					return subMessage;
				}))
			};

			// Update messages state with only the new message
			setMessages(prev => [...prev, processedMessage]);


			// Auto-scrolling is handled by useEffect hooks
		}
	};

	const handleQuestionClick = async (question) => {
		// Set the input value to the question
		// Trigger send
		await userSendMessage(question);
	};

	// Handle add/remove changes initiated from Composer against the combined list
	const handleDocumentsChange = (nextCombinedIds) => {
		try {
			const prevCombined = combinedDocumentIds;
			const removed = prevCombined.filter(id => !nextCombinedIds.includes(id));
			const added = nextCombinedIds.filter(id => !prevCombined.includes(id));

			// Process removals first
			if (removed.length > 0) {
				removed.forEach((id) => {
					if (typeof id === 'string' && id === currentContextDocumentId) {
						// Removing the current-opened slot only affects the current slot
						setIncludeCurrentContext(false);
						setCurrentContextDocumentId(null);
						// Clean draft mapping for the temp id if present
						try {
							const mappingKey = 'deeptutor_mapping_draft';
							const mapping = JSON.parse(Zotero.Prefs.get(mappingKey) || '{}');
							if (mapping[id]) {
								delete mapping[id];
								Zotero.Prefs.set(mappingKey, JSON.stringify(mapping));
							}
						}
						catch {}
					}
					else {
						// Remove from user-added list
						setDocumentIds(prev => prev.filter(x => x !== id));
					}
				});
			}

			// Then process additions (ignore temp ids here)
			if (added.length > 0) {
				const toAdd = added.filter(id => !(typeof id === 'string' && id.startsWith('temp_')));
				if (toAdd.length > 0) {
					setDocumentIds((prev) => {
						const next = Array.isArray(prev) ? [...prev] : [];
						for (const id of toAdd) {
							if (!next.includes(id)) next.push(id);
						}
						return next;
					});
				}
			}
		}
		catch (e) {
			Zotero.debug(e);
		}
	};

	const _handleContextButtonClick = () => {};

	const _handleContextDocumentClick = async (_contextDoc) => {};

	// Settings popup handlers
	const handleSettingsClick = () => {
		// Settings popup is now available for all session types
		setShowSettingsPopup(!showSettingsPopup);
	};

	const handleClaudeInstallComplete = (result) => {
		Zotero.debug(`DeepTutorChatBox: Claude install completed: ${JSON.stringify(result)}`);
		setShowClaudeInstallPopup(false);
		
		if (result && result.ok) {
			// Show success message or handle success
			Zotero.debug('DeepTutorChatBox: Claude installation successful');
		}
	};

	const handleClaudeInstallCancel = () => {
		setShowClaudeInstallPopup(false);
	};

	const handleSettingsConfirm = (newApiKey, newPrompt, newCliChoice, newOpenaiApiKey) => {
		try {
			if (newApiKey && newApiKey.trim()) {
				setAgenticApiKey(newApiKey.trim());
				Zotero.Prefs.set('deeptutor.claude.apiKey', newApiKey.trim());
			}
			
			if (newOpenaiApiKey && newOpenaiApiKey.trim()) {
				setOpenaiApiKey(newOpenaiApiKey.trim());
				Zotero.Prefs.set('deeptutor.openai.apiKey', newOpenaiApiKey.trim());
			}
			
			if (newCliChoice) {
				setCliChoice(newCliChoice);
				Zotero.Prefs.set('deeptutor.cli.choice', newCliChoice);
			}
			
			if (newPrompt && newPrompt.trim()) {
				setAgenticSystemPrompt(newPrompt.trim());
				// Comment out Zotero.Prefs saving for system prompt - rely on component state only
				// Zotero.Prefs.set('deeptutor.claude.systemPrompt', newPrompt.trim());
			}
			
			setShowSettingsPopup(false);
			Zotero.debug('DeepTutorChatBox: Settings updated successfully');
		} catch (error) {
			Zotero.debug(`DeepTutorChatBox: Error updating settings: ${error.message}`);
		}
	};

	const renderMessage = (message, index) => {
		return (
			<DeepTutorChatMessage
				key={`message-${message.id || index}`}
				message={message}
				index={index}
				messages={messages}
				sessionId={sessionId}
				_documentIds={documentIds}
				currentSession={currentSession}
				noteContainer={noteContainer}
				isSavingNote={isSavingNote}
				iniWait={iniWait}
				streamingComponentVisibility={streamingComponentVisibility}
				toggleStreamingComponent={toggleStreamingComponent}
				handleQuestionClick={handleQuestionClick}
				setHoveredQuestion={setHoveredQuestion}
				hoveredQuestion={hoveredQuestion}
				colors={colors}
				theme={theme}
				handleShowNoteSavePopup={handleShowNoteSavePopup}
			/>
		);
	};

	// Add new useEffect after the existing one
	useEffect(() => {
		const openAllDocuments = async () => {
			if (combinedDocumentIds && combinedDocumentIds.length > 0 && sessionId) {
				// Try to get the mapping from local storage
				const storageKey = `deeptutor_mapping_${sessionId}`;
				const mappingStr = Zotero.Prefs.get(storageKey);
				let mapping = {};
				
				if (mappingStr) {
					mapping = JSON.parse(mappingStr);
				}

				// Open all documents in order
				for (let i = 0; i < combinedDocumentIds.length; i++) {
					const documentId = combinedDocumentIds[i];
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
						if (i < combinedDocumentIds.length - 1) {
							await new Promise(resolve => setTimeout(resolve, 500));
						}
					}
					catch (error) {
						Zotero.debug(error);
					}
				}
			}
		};
		openAllDocuments();
	}, [combinedDocumentIds, sessionId]); // Dependencies array

	// Load context documents when documentIds change
	useEffect(() => {
		const loadContextDocuments = async () => {
			if (!combinedDocumentIds?.length || !sessionId) {
				_setContextDocuments([]);
				return;
			}
			
			try {
				const mapping = getDocumentMapping();
				const contextDocs = await Promise.allSettled(
					combinedDocumentIds.map(id => processDocument(id, mapping))
				);
				
				const successfulDocs = contextDocs
					.filter(result => result.status === "fulfilled")
					.map(result => result.value);
				
				// Log any failures
				contextDocs
					.filter(result => result.status === "rejected")
					.forEach(result => Zotero.debug(result.reason));

				_setContextDocuments(successfulDocs);
				setNoteContainerFromDocuments(successfulDocs, setNoteContainer);
			}
			catch (error) {
				Zotero.debug(`DeepTutorChat: Error loading context documents: ${error.message}`);
				_setContextDocuments([]);
				setNoteContainer(null);
			}
		};

		loadContextDocuments();
	}, [combinedDocumentIds, sessionId]);

	// Handle click outside context popup
	useEffect(() => {
		const handleClickOutside = (event) => {
			if (contextPopupRef.current && !contextPopupRef.current.contains(event.target)) {
				setShowContextPopup(false);
			}
		};

		if (showContextPopup) {
			document.addEventListener("mousedown", handleClickOutside);
			return () => {
				document.removeEventListener("mousedown", handleClickOutside);
			};
		}
		return undefined; // Explicit return for linter
	}, [showContextPopup]);

	// Add new useEffect after the existing one
	useEffect(() => {
		const openAllDocuments = async () => {
			if (documentIds && documentIds.length > 0 && sessionId) {
				// Zotero.debug(`DeepTutorChat: Opening all documents - sessionId: ${sessionId}, ${documentIds.length} documents`);
                
				try {
					// Try to get the mapping from local storage
					const storageKey = `deeptutor_mapping_${sessionId}`;
					const mappingStr = Zotero.Prefs.get(storageKey);
					// Zotero.debug("DeepTutorChat: Get data mapping:", Zotero.Prefs.get(storageKey));
					
					let mapping = {};
					if (mappingStr) {
						mapping = JSON.parse(mappingStr);
						// Zotero.debug(`DeepTutorChat: Found mapping in storage: ${JSON.stringify(mapping)}`);
					}

					// Loop through all document IDs
					for (let i = 0; i < documentIds.length; i++) {
						const documentId = documentIds[i];
						try {
							let zoteroAttachmentId = documentId;

							// If we have a mapping for this document ID, use it
							if (mapping[documentId]) {
								zoteroAttachmentId = mapping[documentId];
								// Zotero.debug(`DeepTutorChat: Using mapped attachment ID: ${zoteroAttachmentId} for document ${documentId}`);
							}

							// Get the item and open it
							const item = Zotero.Items.get(zoteroAttachmentId);
							if (!item) {
								// Zotero.debug(`DeepTutorChat: No item found for ID ${zoteroAttachmentId}`);
								continue; // Skip this document and continue with the next one
							}

							// Open the document in the reader
							await Zotero.FileHandlers.open(item, {
								location: {
									pageIndex: 0 // Start at first page
								}
							});
							// Zotero.debug(`DeepTutorChat: Opened document ${i + 1}/${documentIds.length}: ${zoteroAttachmentId} in reader`);
							
							// Add a small delay between opening documents to avoid overwhelming the UI
							if (i < documentIds.length - 1) {
								await new Promise(resolve => setTimeout(resolve, 500));
							}
						}
						catch {
							// Zotero.debug(`DeepTutorChat: Error opening document ${documentId}: ${error.message}`);
							// Zotero.debug(`DeepTutorChat: Error stack: ${error.stack}`);
							// Continue with the next document even if this one fails
						}
					}
				}
				catch {
					// Zotero.debug(`DeepTutorChat: Error in openAllDocuments: ${error.message}`);
				}
				
				// Zotero.debug(`DeepTutorChat: Finished opening all ${documentIds.length} documents`);
			}
		};
		openAllDocuments();
	}, [documentIds, sessionId]); // Dependencies array

	// Load context documents when documentIds change
	useEffect(() => {
		const loadContextDocuments = async () => {
			if (!documentIds || documentIds.length === 0 || !sessionId) {
				_setContextDocuments([]);
				return;
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

				_setContextDocuments(successfulDocs);
				setNoteContainerFromDocuments(successfulDocs, setNoteContainer);
			}
			catch (error) {
				Zotero.debug(`DeepTutorChat: Error loading context documents: ${error.message}`);
				_setContextDocuments([]);
				setNoteContainer(null);
			}
		};

		loadContextDocuments();
	}, [documentIds, sessionId]);

	// Handle click outside context popup
	useEffect(() => {
		const handleClickOutside = (event) => {
			if (contextPopupRef.current && !contextPopupRef.current.contains(event.target)) {
				setShowContextPopup(false);
			}
		};

		if (showContextPopup) {
			document.addEventListener('mousedown', handleClickOutside);
			return () => {
				document.removeEventListener('mousedown', handleClickOutside);
			};
		}
		return undefined; // Explicit return for linter
	}, [showContextPopup]);


	// Communicate iniWait state changes to parent component
	useEffect(() => {
		if (onInitWaitChange) {
			onInitWaitChange(iniWait);
		}
	}, [iniWait, onInitWaitChange]);


	// Add effect to handle session changes
	useEffect(() => {
		if (sessionId) {
			// Store previous session ID for cleanup
			const prevSessionId = sessionIdRef.current;
			sessionIdRef.current = sessionId;
			
			// Clean up previous session's source data
			if (prevSessionId && prevSessionId !== sessionId) {
				cleanupSourceData(prevSessionId, currentSourceIndices);
				setCurrentSourceIndices([]);
			}
		}
	}, [sessionId]);

	// Add cleanup on unmount
	useEffect(() => {
		return () => {
			if (sessionIdRef.current) {
				// Only cleanup if we're actually unmounting, not just switching sessions
				// This prevents removing source data that might be needed
				cleanupSourceData(sessionIdRef.current, currentSourceIndices);
			}
		};
	}, []);

	// Add copy event handler for the chat box
	useEffect(() => {
		const handleCopy = (e) => {
			const selection = window.getSelection();
			const selectedText = selection.toString();
			
			// Check if selection is within our chat box
			let isWithinChatBox = false;
			let node = selection.anchorNode;
			while (node !== null) {
				if (node.classList && node.classList.contains('deeptutor-chat-box')) {
					isWithinChatBox = true;
					break;
				}
				node = node.parentNode;
			}

			if (isWithinChatBox && selectedText) {
				e.preventDefault(); // Prevent Zotero's global copy
				e.stopPropagation(); // Stop event bubbling
				
				// Copy the selected text
				navigator.clipboard.writeText(selectedText).then(() => {
					// Text copied successfully
				}).catch((err) => {
					Zotero.debug(err);
				});
			}
		};

		// Add event listener for copy events
		document.addEventListener('copy', handleCopy, true); // true for event capture phase

		return () => {
			// Cleanup listener on component unmount
			document.removeEventListener('copy', handleCopy, true);
		};
	}, []);

	// Settings popup component
	const SettingsPopup = ({ onConfirm, onCancel: _onCancel, initialApiKey, initialPrompt, initialCliChoice, initialOpenaiApiKey, styles, colors }) => {
		const [tempApiKey, setTempApiKey] = useState(initialApiKey || '');
		const [tempPrompt, setTempPrompt] = useState(initialPrompt || '');
		const [tempCliChoice, setTempCliChoice] = useState(initialCliChoice || 'claude');
		const [tempOpenaiApiKey, setTempOpenaiApiKey] = useState(initialOpenaiApiKey || '');
		const [isProcessingPDFs, setIsProcessingPDFs] = useState(false);
		const [pdfProcessingStatus, setPdfProcessingStatus] = useState('');
		const [isCheckingClaude, setIsCheckingClaude] = useState(false);
		const [claudeCheckResult, setClaudeCheckResult] = useState('');
		const [isInstallingClaude, setIsInstallingClaude] = useState(false);
		const [claudeInstallResult, setClaudeInstallResult] = useState('');

		const handleConfirm = () => {
			onConfirm(tempApiKey, tempPrompt, tempCliChoice, tempOpenaiApiKey);
		};

		const handleCheckClaude = async () => {
			setIsCheckingClaude(true);
			setClaudeCheckResult('Checking...');
			try {
				const result = await ClaudeCliWrapper.checkClaude();
				if (result.exists) {
					setClaudeCheckResult(`✅ Claude CLI found at: ${result.path}`);
				} else {
					setClaudeCheckResult(`❌ Claude CLI not found. ${result.error ? `Error: ${result.error.message}` : 'Please install it first.'}`);
				}
			} catch (error) {
				setClaudeCheckResult(`❌ Error checking Claude: ${error.message}`);
			} finally {
				setIsCheckingClaude(false);
			}
		};

		const handleInstallClaude = async () => {
			if (!tempApiKey.trim()) {
				setClaudeInstallResult('❌ Please enter an Anthropic API key first');
				return;
			}
			
			setIsInstallingClaude(true);
			setClaudeInstallResult('Installing Claude CLI and setting up API key...');
			try {
				const result = await ClaudeCliWrapper.installClaude(tempApiKey);
				if (result.ok) {
					setClaudeInstallResult(`✅ ${result.message}`);
				} else {
					setClaudeInstallResult(`❌ Installation failed: ${result.error.message}`);
				}
			} catch (error) {
				setClaudeInstallResult(`❌ Error installing Claude: ${error.message}`);
			} finally {
				setIsInstallingClaude(false);
			}
		};
		
		const handleCliChoiceChange = (choice) => {
			setTempCliChoice(choice);
			// Immediately save to preferences and update parent state
			onConfirm(tempApiKey, tempPrompt, choice, tempOpenaiApiKey);
		};

		const handleProcessPDFs = async () => {
			try {
				setIsProcessingPDFs(true);
				setPdfProcessingStatus('Initializing database...');
				
				Zotero.debug('DeepTutorChatBox: User initiated PDF processing from settings popup');
				const deepTutorManager = new DeepTutorClaudeManagement();
				
				// Initialize the database structure
				setPdfProcessingStatus('Creating database structure...');
				await deepTutorManager.initializeDataBase();
				setPdfProcessingStatus('Database structure created successfully');
				
				// Create CLAUDE.md instruction file
				setPdfProcessingStatus('Creating Claude instruction file...');
				await deepTutorManager.loadCLAUDEMD();
				setPdfProcessingStatus('Claude instruction file created successfully');
				
				// Load and process raw PDF documents
				setPdfProcessingStatus('Processing PDF documents...');
				await deepTutorManager.loadRawPDFDoc();
				setPdfProcessingStatus('PDF processing completed successfully!');
				
				// Show success status for a few seconds
				setTimeout(() => {
					setPdfProcessingStatus('');
				}, 3000);
			} catch (error) {
				Zotero.debug(`DeepTutorChatBox: Error in PDF processing from settings: ${error.message}`);
				setPdfProcessingStatus(`Error: ${error.message}`);
				
				// Show error status for a few seconds
				setTimeout(() => {
					setPdfProcessingStatus('');
				}, 5000);
			} finally {
				setIsProcessingPDFs(false);
			}
		};

		return (
			<div style={styles.settingsPopup}>
				{/* CLI Choice Section */}
				<label style={styles.settingsLabel}>CLI Choice</label>
				<div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
					<button
						onClick={() => handleCliChoiceChange('claude')}
						style={{
							...styles.settingsButton,
							backgroundColor: tempCliChoice === 'claude' ? colors.button.primary : colors.background.secondary,
							color: tempCliChoice === 'claude' ? colors.text.primary : colors.text.secondary,
							border: `1px solid ${tempCliChoice === 'claude' ? colors.button.primary : colors.border.primary}`,
							flex: 1
						}}
					>
						Claude
					</button>
					<button
						onClick={() => handleCliChoiceChange('codex')}
						style={{
							...styles.settingsButton,
							backgroundColor: tempCliChoice === 'codex' ? colors.button.primary : colors.background.secondary,
							color: tempCliChoice === 'codex' ? colors.text.primary : colors.text.secondary,
							border: `1px solid ${tempCliChoice === 'codex' ? colors.button.primary : colors.border.primary}`,
							flex: 1
						}}
					>
						Codex
					</button>
				</div>

				{/* Anthropic API Key */}
				<label style={styles.settingsLabel}>Anthropic API Key</label>
				<input
					type="text"
					value={tempApiKey}
					onChange={(e) => setTempApiKey(e.target.value)}
					style={styles.settingsInput}
					placeholder="Enter Anthropic API key..."
				/>
				
				{/* OpenAI API Key */}
				<label style={styles.settingsLabel}>OpenAI API Key</label>
				<input
					type="text"
					value={tempOpenaiApiKey}
					onChange={(e) => setTempOpenaiApiKey(e.target.value)}
					style={styles.settingsInput}
					placeholder="Enter OpenAI API key..."
				/>

				{/* Claude CLI Management Section */}
				<div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: `1px solid ${colors.border.primary}` }}>
					<label style={styles.settingsLabel}>Claude CLI Management</label>
					
					<div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
						<button
							onClick={handleCheckClaude}
							disabled={isCheckingClaude}
							style={{
								...styles.settingsButton,
								backgroundColor: isCheckingClaude ? '#9ca3af' : colors.button.primary,
								cursor: isCheckingClaude ? 'not-allowed' : 'pointer',
								opacity: isCheckingClaude ? 0.6 : 1,
								flex: 1
							}}
						>
							{isCheckingClaude ? 'Checking...' : 'Check Claude Installed'}
						</button>
						
						<button
							onClick={handleInstallClaude}
							disabled={isInstallingClaude || !tempApiKey.trim()}
							style={{
								...styles.settingsButton,
								backgroundColor: isInstallingClaude || !tempApiKey.trim() ? '#9ca3af' : colors.button.primary,
								cursor: isInstallingClaude || !tempApiKey.trim() ? 'not-allowed' : 'pointer',
								opacity: isInstallingClaude || !tempApiKey.trim() ? 0.6 : 1,
								flex: 1
							}}
						>
							{isInstallingClaude ? 'Installing...' : 'Install Claude'}
						</button>
					</div>

					{claudeCheckResult && (
						<div style={{
							marginBottom: '0.5rem',
							padding: '0.5rem',
							borderRadius: '0.25rem',
							backgroundColor: claudeCheckResult.includes('✅') ? '#dcfce7' : '#fee2e2',
							color: claudeCheckResult.includes('✅') ? '#166534' : '#991b1b',
							fontSize: '0.875rem',
							lineHeight: '1.2'
						}}>
							{claudeCheckResult}
						</div>
					)}

					{claudeInstallResult && (
						<div style={{
							marginBottom: '0.5rem',
							padding: '0.5rem',
							borderRadius: '0.25rem',
							backgroundColor: claudeInstallResult.includes('✅') ? '#dcfce7' : '#fee2e2',
							color: claudeInstallResult.includes('✅') ? '#166534' : '#991b1b',
							fontSize: '0.875rem',
							lineHeight: '1.2'
						}}>
							{claudeInstallResult}
						</div>
					)}
				</div>
				
				<label style={styles.settingsLabel}>Custom Prompt</label>
				<textarea
					value={tempPrompt}
					onChange={(e) => setTempPrompt(e.target.value)}
					style={{ ...styles.settingsInput, minHeight: '4rem', resize: 'vertical' }}
					placeholder="Enter custom system prompt..."
				/>
				
				<button
					onClick={handleConfirm}
					style={styles.settingsButton}
				>
					Confirm
				</button>

				{/* PDF Processing Section */}
				<div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: `1px solid ${colors.border.primary}` }}>
					<label style={styles.settingsLabel}>PDF Processing</label>
					<button
						onClick={handleProcessPDFs}
						disabled={isProcessingPDFs}
						style={{
							...styles.settingsButton,
							backgroundColor: isProcessingPDFs ? '#9ca3af' : colors.button.primary,
							cursor: isProcessingPDFs ? 'not-allowed' : 'pointer',
							opacity: isProcessingPDFs ? 0.6 : 1
						}}
						title="Process all PDF files in Zotero and convert them to markdown"
					>
						{isProcessingPDFs ? 'Processing...' : 'Process PDFs'}
					</button>
					
					{pdfProcessingStatus && (
						<div style={{
							marginTop: '0.5rem',
							padding: '0.5rem',
							borderRadius: '0.25rem',
							backgroundColor: pdfProcessingStatus.includes('Error') ? '#fee2e2' : '#dcfce7',
							color: pdfProcessingStatus.includes('Error') ? '#991b1b' : '#166534',
							fontSize: '0.875rem',
							textAlign: 'center'
						}}>
							{pdfProcessingStatus}
						</div>
					)}
				</div>
			</div>
		);
	};

	return (
		<div
			className="deeptutor-chat-box"
			style={styles.container}
		>
			{/* Add CSS styles for markdown tables and source buttons */}
			<style dangerouslySetInnerHTML={{
				__html: `
					.markdown table {
						border-collapse: collapse;
						width: 100%;
						margin: 1rem 0;
						font-size: 1rem;
						line-height: 1.4;
						border: 0.0625rem solid ${colors.border.primary};
						border-radius: 0.5rem;
						overflow: hidden;
						box-shadow: 0 0.0625rem 0.125rem rgba(0,0,0,0.1);
						background: ${colors.table.background};
						table-layout: auto;
					}
					.markdown thead {
						background: ${colors.table.header};
					}
					.markdown tbody {
						background: ${colors.table.background};
					}
					.markdown tr {
						border-bottom: 0.0625rem solid ${colors.table.border};
					}
					.markdown tr:last-child {
						border-bottom: none;
					}
					.markdown tr:hover {
						background: ${colors.table.hover};
					}
					.markdown th {
						padding: 0.75rem 0.5rem;
						text-align: left;
						font-weight: 600;
						color: ${colors.text.allText};
						border-bottom: 0.125rem solid ${colors.table.border};
						background: ${colors.table.header};
						font-size: 1.0rem;
						line-height: 1.6;
						white-space: normal;
						vertical-align: top;
					}
					.markdown td {
						padding: 0.75rem 0.5rem;
						text-align: left;
						color: ${colors.text.allText};
						border-bottom: 0.0625rem solid ${colors.table.border};
						border-right: 0.0625rem solid ${colors.table.border};
						border-left: 0.0625rem solid ${colors.table.border};
						font-size: 1.0rem;
						line-height: 1.6;
						white-space: normal;
						word-break: keep-all;
						overflow-wrap: break-word;
						vertical-align: top;
					}
					/* First column - prevent word breaking but allow line wrapping */
					.markdown td:first-child {
						word-break: keep-all;
						overflow-wrap: break-word;
						white-space: normal;
						width: fit-content;
						min-width: fit-content;
					}
					/* Other columns - allow normal word breaking */
					.markdown td:nth-child(n+2) {
						word-break: break-word;
						overflow-wrap: break-word;
						white-space: normal;
						width: auto;
					}
					
					/* Special styling for source buttons within tables */
					.markdown table .deeptutor-source-button {
						width: 2em !important;
						height: 2em !important;
						font-size: 1em !important;
						margin: 0 0.15em !important;
						vertical-align: middle !important;
					}
					
					/* Special styling for source placeholders within tables */
					.markdown table .deeptutor-source-placeholder {
						width: 1.5em !important;
						height: 1.5em !important;
						font-size: 0.75em !important;
						margin: 0 0.15em !important;
						vertical-align: middle !important;
					}
					/* Special styling for streaming source placeholders within tables */
					.markdown table .deeptutor-source-placeholder-streaming {
						width: 1.5em !important;
						height: 1.5em !important;
						font-size: 0.75em !important;
						margin: 0 0.15em !important;
						vertical-align: middle !important;
					}
					/* First column styling - prevent word breaking but allow line wrapping */
					.markdown table td:first-child,
					.markdown table th:first-child {
						width: fit-content;
						min-width: fit-content;
						white-space: normal;
						word-break: keep-all;
						overflow-wrap: break-word;
					}
					.deeptutor-source-button {
						background: ${colors.sourceButton.background} !important;
						opacity: 1 !important;
						color: ${colors.sourceButton.text} !important;
						border: none !important;
						border-radius: 50% !important;
						width: 2rem !important;
						height: 2rem !important;
						display: inline-flex !important;
						align-items: center !important;
						justify-content: center !important;
						font-weight: 600 !important;
						font-size: 0.875rem !important;
						cursor: pointer !important;
						box-shadow: 0 0.0625rem 0.125rem rgba(0,0,0,0.08) !important;
						padding: 0 !important;
						margin: 0 0.25rem !important;
						transition: all 0.2s ease !important;
						vertical-align: middle !important;
						line-height: 1 !important;
						text-decoration: none !important;
						user-select: none !important;
						font-family: 'Roboto', sans-serif !important;
						position: relative !important;
						overflow: hidden !important;
					}
					.deeptutor-source-button:hover {
						background: ${colors.button.primaryHover} !important;
						opacity: 0.8 !important;
						transform: scale(1.05) !important;
						box-shadow: 0 0.125rem 0.25rem rgba(0,0,0,0.15) !important;
					}
					.deeptutor-source-button:active {
						transform: scale(0.95) !important;
						box-shadow: 0 0.0625rem 0.125rem rgba(0,0,0,0.1) !important;
					}
					.deeptutor-source-button:focus {
						outline: 0.125rem solid ${colors.sourceButton.background} !important;
						outline-offset: 0.125rem !important;
					}
					.deeptutor-source-button:focus:not(:focus-visible) {
						outline: none !important;
					}
					.deeptutor-source-placeholder {
						background: ${colors.sourceButton.placeholder} !important;
						color: ${colors.sourceButton.text} !important;
						border: none !important;
						border-radius: 50% !important;
						width: 2rem !important;
						height: 2rem !important;
						display: inline-flex !important;
						align-items: center !important;
						justify-content: center !important;
						font-weight: 600 !important;
						font-size: 0.875rem !important;
						cursor: default !important;
						box-shadow: 0 0.0625rem 0.125rem rgba(0,0,0,0.08) !important;
						padding: 0 !important;
						margin: 0 0.25rem !important;
						vertical-align: middle !important;
						line-height: 1 !important;
						text-decoration: none !important;
						user-select: none !important;
						font-family: 'Roboto', sans-serif !important;
						position: relative !important;
						overflow: hidden !important;
					}
					/* Streaming-specific source placeholders - use theme colors */
					.deeptutor-source-placeholder-streaming {
						background: ${colors.sourceButton.streamingBackground} !important;
						color: ${colors.sourceButton.streamingText} !important;
						border: none !important;
						border-radius: 50% !important;
						width: 2rem !important;
						height: 2rem !important;
						display: inline-flex !important;
						align-items: center !important;
						justify-content: center !important;
						font-weight: 600 !important;
						font-size: 0.875rem !important;
						cursor: default !important;
						box-shadow: 0 0.0625rem 0.125rem rgba(0,0,0,0.08) !important;
						padding: 0 !important;
						margin: 0 0.25rem !important;
						vertical-align: middle !important;
						line-height: 1 !important;
						text-decoration: none !important;
						user-select: none !important;
						font-family: 'Roboto', sans-serif !important;
						position: relative !important;
						overflow: hidden !important;
						opacity: 0.7 !important;
					}
					@keyframes pulse {
						0% { opacity: 0.3; }
						100% { opacity: 0.6; }
					}
					/* KaTeX math expression styles */
					.katex {
						font-size: 1.1em !important;
						line-height: 1.2 !important;
						vertical-align: middle !important;
					}
					/* Inline math adjustments */
					.katex:not(.katex-display) {
						font-size: 1em !important;
						line-height: 1.1 !important;
						vertical-align: middle !important;
					}
					/* Display math adjustments */
					.katex-display {
						font-size: 1.2em !important;
						line-height: 1.4 !important;
						margin-bottom: 1em !important;
						margin-top: 0.5em !important;
						
					}
					/* General subscript/superscript positioning */
					.katex .msupsub {
						text-align: left !important;
					}
					.katex .msubsup {
						text-align: right !important;
					}
					/* Proper KaTeX subscript and superscript sizing */
					.katex .msupsub > .vlist-t {
						font-size: 0.7em !important;
					}
					.katex .msupsub .mord {
						font-size: 0.7em !important;
					}
					.katex .scriptstyle {
						font-size: 0.7em !important;
					}
					.katex .scriptscriptstyle {
						font-size: 0.5em !important;
					}
					/* Target actual superscript and subscript elements */
					.katex sup {
						font-size: 0.7em !important;
						vertical-align: super !important;
					}
					.katex sub {
						font-size: 0.7em !important;
						vertical-align: sub !important;
					}
					/* More specific KaTeX internal selectors */
					.katex .vlist .sizing.reset-size6.size3,
					.katex .vlist .fontsize-ensurer.reset-size6.size3 {
						font-size: 0.7em !important;
					}
					/* Radicals - fix square root positioning issues */
					.katex .sqrt {
						vertical-align: baseline !important;
						display: inline-block !important;
						position: relative !important;
					}
					.katex .sqrt > .vlist-t {
						display: inline-block !important;
						vertical-align: baseline !important;
					}
					.katex .sqrt-sign {
						position: relative !important;
						display: inline-block !important;
					}
					.katex .sqrt-line {
						border-top: 0.08em solid !important;
						position: relative !important;
						display: block !important;
						width: 100% !important;
						margin-top: -0.3em !important;
					}
					/* Fix radical symbol positioning */
					.katex .sqrt > .vlist-t > .vlist-r > .vlist {
						display: inline-block !important;
						vertical-align: baseline !important;
					}
					/* Prevent radical content from floating */
					.katex .sqrt .vlist {
						position: relative !important;
						display: inline-block !important;
					}
					/* Fractions - improve spacing and positioning */
					.katex .frac-line {
						border-bottom-width: 0.06em !important;
					}
					/* Fix outer containers that contain fractions */
					.katex-display:has(.frac),
					.katex-display:has(.mfrac) {
						margin-top: -1em !important;
						margin-bottom: 1.5em !important;
						vertical-align: middle !important;

					}
					/* General vertical alignment for all math elements */
					.katex * {
						vertical-align: baseline !important;
					}
					/* Improve spacing for operators */
					.katex .mop {
						vertical-align: baseline !important;
					}
					/* Ensure proper spacing around inline math */
					.katex:not(.katex-display)::after {
						content: " " !important;
						white-space: normal !important;
					}
					/* List styling - reduce horizontal spacing */
					.markdown ul,
					.markdown ol {
						margin: 0.5em 0 !important;
						padding-left: 1.5em !important;
					}
					.markdown li {
						margin: 0.25em 0 !important;
						padding-left: 0.5em !important;
					}
					/* Nested lists */
					.markdown ul ul,
					.markdown ol ol,
					.markdown ul ol,
					.markdown ol ul {
						margin: 0.25em 0 !important;
						padding-left: 1em !important;
					}
					/* Hide horizontal rules completely */
					.markdown hr,
					hr {
						display: none !important;
						border: none !important;
						margin: 0 !important;
						padding: 0 !important;
						height: 0 !important;
						width: 0 !important;
						visibility: hidden !important;
					}
					
					/* Image styling - make images fit their parent container */
					.markdown img {
						max-width: 100% !important;
						height: auto !important;
						display: block !important;
						margin: 0.5rem auto !important;
						border-radius: 0.375rem !important;
						box-shadow: 0 0.0625rem 0.125rem rgba(0,0,0,0.1) !important;
						object-fit: contain !important;
					}
					
					/* Ensure images don't overflow their containers */
					.markdown p img,
					.markdown div img {
						max-width: 100% !important;
						width: auto !important;
						height: auto !important;
					}
					
					/* Responsive image handling for different screen sizes */
					@media (max-width: 768px) {
						.markdown img {
							max-width: 95% !important;
							margin: 0.375rem auto !important;
						}
					}
				`
			}} />
            
			{/* Session Tabs and Functional Buttons Row */}
			<DeepTutorChatTop
				currentSession={currentSession}
				sessions={sessions}
				onSessionSelect={onSessionSelect}
				onDeleteSession={onDeleteSession}
				onOpenSessionHistory={onOpenSessionHistory}
				onToggleSettingsPopup={onToggleSettingsPopup}
				onToggleModelSelectionPopup={onToggleModelSelectionPopup}
			/>

			{/* Composer below session tabs when new session (no messages) */}
			{messages.length === 0 && (
				<DeepTutorComposer
					sessionId={(sessionId && !(String(sessionId).startsWith('__DRAFT__'))) ? sessionId : null}
					userId={userId}
					selectedDocumentIds={combinedDocumentIds}
					onDocumentsChange={handleDocumentsChange}
					subscriptionType={subscriptionType}
					usageSummary={usageSummary}
					hasActiveSubscription={hasActiveSubscription}
					onShowFileSizeWarning={onShowFileSizeWarning}
					onShowPageLimitWarning={onShowPageLimitWarning}
					onShowSubscriptionPopup={onShowSubscriptionPopup}
					onSend={async (text) => {
						setIsManuallyStopped(false);
						await userSendMessage(text);
					}}
					onStop={handleStopStreaming}
					isBusy={iniWait || hasActiveStream || waitingStreaming}
				/>
			)}

			<div
				ref={chatLogRef}
				style={styles.chatLog}
				onWheel={handleWheel}
				onScroll={handleScroll}
			>
				{messages.map((message, index) => renderMessage(message, index))}
				{waitingStreaming && !hasActiveStream && (() => {
					Zotero.debug(`DeepTutorChat: Rendering waiting message with thinking animation`);
					return renderMessage({
						id: 'waiting-message',
						role: MessageRole.TUTOR,
						subMessages: [{ text: '' }],
						isStreaming: true,
						streamText: '<thinking></thinking>',
						creationTime: new Date().toISOString()
					}, messages.length);
				})()}
			</div>

			{messages.length > 0 && (
				<DeepTutorComposer
					sessionId={(sessionId && !(String(sessionId).startsWith('__DRAFT__'))) ? sessionId : null}
					userId={userId}
					selectedDocumentIds={combinedDocumentIds}
					onDocumentsChange={handleDocumentsChange}
					subscriptionType={subscriptionType}
					usageSummary={usageSummary}
					hasActiveSubscription={hasActiveSubscription}
					onShowFileSizeWarning={onShowFileSizeWarning}
					onShowPageLimitWarning={onShowPageLimitWarning}
					onShowSubscriptionPopup={onShowSubscriptionPopup}
					onSend={async (text) => {
						setIsManuallyStopped(false);
						await userSendMessage(text);
					}}
					onStop={handleStopStreaming}
					isBusy={iniWait || hasActiveStream || waitingStreaming}
				/>
			)}

			{/* Style for placeholders */}
			<style>
				{`
				textarea::placeholder {
					color: ${colors.text.tertiary} !important;
					opacity: 1;
				}
				`}
			</style>

			{/* Bottom input area */}
			<div style={styles.bottomBar}>
				{/* Settings button - available for all session types */}
				<div style={{ position: 'relative' }}>
					<button
						style={{
							...styles.sendButton,
							marginRight: '0.5rem',
							opacity: iniWait ? 0.5 : 1,
							cursor: iniWait ? "not-allowed" : "pointer"
						}}
						onClick={handleSettingsClick}
						disabled={iniWait}
						title="Settings"
					>
						<img
							src={SettingsIconPath}
							alt="Settings"
							style={styles.sendIcon}
						/>
					</button>
					
					{showSettingsPopup && (
						<SettingsPopup
							onConfirm={handleSettingsConfirm}
							onCancel={() => setShowSettingsPopup(false)}
							initialApiKey={agenticApiKey}
							initialPrompt={agenticSystemPrompt}
							initialCliChoice={cliChoice}
							initialOpenaiApiKey={openaiApiKey}
							styles={styles}
							colors={colors}
						/>
					)}
				</div>

				{/* Text input */}
				<textarea
					style={styles.textInput}
					value={inputValue}
					onChange={handleInputChange}
					onKeyDown={(e) => {
						if (e.key === 'Enter' && !e.shiftKey) {
							e.preventDefault();
							handleSend();
						}
					}}
					placeholder="Type your message here..."
				/>

				{/* Send/Stop button */}
				<button
					style={{
						...styles.sendButton,
						opacity: iniWait ? 0.5 : 1,
						cursor: iniWait ? "not-allowed" : "pointer"
					}}
					onClick={(hasActiveStream || waitingStreaming) ? handleStopStreaming : handleSend}
					disabled={iniWait}
					title={(hasActiveStream || waitingStreaming) ? "Stop Thinking" : "Send"}
				>
					<img
						src={(hasActiveStream || waitingStreaming) ? StopIconPath : SendIconPath}
						alt={(hasActiveStream || waitingStreaming) ? "Stop" : "Send"}
						style={styles.sendIcon}
					/>
				</button>
			</div>

			{/* Claude Install Popup for agentic mode */}
			{showClaudeInstallPopup && (
				<div style={{
					position: 'fixed',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					background: 'rgba(0,0,0,0.5)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: 9999
				}}>
					<ClaudeAutoInstall
						onInstallComplete={handleClaudeInstallComplete}
						onCancel={handleClaudeInstallCancel}
					/>
				</div>
			)}
			{/* Rename popup managed by parent (DeepTutorMain) */}
		</div>
	);
};

DeepTutorChat.propTypes = {
	currentSession: PropTypes.object,
	sessions: PropTypes.array,
	onSessionSelect: PropTypes.func,
	onInitWaitChange: PropTypes.func,
	handleShowNoteSavePopup: PropTypes.func,
	_onShowRenamePopup: PropTypes.func,
	onOpenSessionHistory: PropTypes.func,
	onToggleSettingsPopup: PropTypes.func,
	onToggleModelSelectionPopup: PropTypes.func,
	onDeleteSession: PropTypes.func,
	userIdFromParent: PropTypes.string,
	onCreateSessionFromId: PropTypes.func,
	subscriptionType: PropTypes.string,
	usageSummary: PropTypes.object,
	hasActiveSubscription: PropTypes.bool,
	onShowFileSizeWarning: PropTypes.func,
	onShowPageLimitWarning: PropTypes.func,
	onShowSubscriptionPopup: PropTypes.func,
	refreshUsageSummary: PropTypes.func
};

export default DeepTutorChat;
