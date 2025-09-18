/**
 * DeepTutorHelperFunctions.js
 * Consolidated helper functions to reduce code duplication across DeepTutor components
 */

import { useEffect } from 'react';

/**
 * Utility functions for managing recently opened files
 */
export const RecentFilesManager = {

	/**
	 * Get the preference key for storing recent files
	 * @returns {string} The preference key
	 */
	getPreferenceKey() {
		return "deeptutor_recent_files";
	},

	/**
	 * Get the maximum number of recent files to store
	 * @returns {number} Maximum number of recent files
	 */
	getMaxRecentFiles() {
		return 10; // Store more than we display to have a buffer
	},

	/**
	 * Get recently opened files from preferences
	 * @returns {Array} Array of recent file objects with {id, name, lastAccessed}
	 */
	getRecentFiles() {
		try {
			const recentFilesStr = Zotero.Prefs.get(this.getPreferenceKey());
			if (!recentFilesStr) return [];
			
			const recentFiles = JSON.parse(recentFilesStr);
			return Array.isArray(recentFiles) ? recentFiles : [];
		}
		catch (error) {
			Zotero.debug(`Error getting recent files: ${error.message}`);
			return [];
		}
	},

	/**
	 * Add or update a file in the recent files list
	 * @param {number} itemId - The Zotero item ID
	 * @param {string} fileName - The display name of the file
	 */
	addRecentFile(itemId, fileName) {
		try {
			const recentFiles = this.getRecentFiles();
			const now = Date.now();
			
			// Remove existing entry if it exists
			const filteredFiles = recentFiles.filter(file => file.id !== itemId);
			
			// Add new entry at the beginning
			const newFile = {
				id: itemId,
				name: fileName || "Untitled",
				lastAccessed: now
			};
			
			filteredFiles.unshift(newFile);
			
			// Keep only the most recent files
			const maxFiles = this.getMaxRecentFiles();
			const trimmedFiles = filteredFiles.slice(0, maxFiles);
			
			// Save back to preferences
			Zotero.Prefs.set(this.getPreferenceKey(), JSON.stringify(trimmedFiles));
		}
		catch (error) {
			Zotero.debug(`Error adding recent file: ${error.message}`);
		}
	},

	/**
	 * Get the most recent files (up to a specified limit)
	 * @param {number} limit - Maximum number of files to return
	 * @returns {Array} Array of recent file objects
	 */
	getMostRecentFiles(limit = 5) {
		const recentFiles = this.getRecentFiles();
		return recentFiles.slice(0, limit);
	}
};

/**
 * Get file size limit in MB based on subscription type
 * @param {string} subscriptionType - The subscription type
 * @returns {number} File size limit in MB
 */
export const getFileSizeLimitMB = (subscriptionType) => {
	switch ((subscriptionType || '').toUpperCase()) {
		case "BASIC":
			return 10;
		case "PLUS":
			return 50;
		case "PREMIUM":
			return 100;
		default:
			return 10; // Default to BASIC limit
	}
};

/**
 * Get file count limit based on subscription type
 * @param {string} subscriptionType - The subscription type
 * @returns {number} File count limit
 */
export const getFileCountLimit = (subscriptionType) => {
	switch ((subscriptionType || '').toUpperCase()) {
		case "BASIC":
			return 1;
		case "PLUS":
			return 10;
		case "PREMIUM":
			return 20;
		default:
			return 1;
	}
};

/**
 * Get page limit for PDF files
 * @returns {number} Page limit
 */
export const getPageLimit = () => {
	return 500;
};

/**
 * Validate file size for a PDF attachment
 * @param {Object} pdf - The PDF item
 * @param {string} fileName - The filename for display purposes
 * @param {string} subscriptionType - The subscription type
 * @param {Function} onShowFileSizeWarning - Optional callback for file size warnings
 * @returns {Promise<boolean>} True if file size is valid, false otherwise
 */
export const validateFileSize = async (pdf, fileName = null, subscriptionType = 'BASIC', onShowFileSizeWarning = null) => {
	try {
		const filePath = await pdf.getFilePathAsync();
		if (filePath) {
			const fileStats = await IOUtils.stat(filePath);
			const fileSizeMB = fileStats.size / (1024 * 1024);
			const sizeLimitMB = getFileSizeLimitMB(subscriptionType);
			
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
	catch (error) {
		Zotero.debug(`Error validating file size: ${error.message}`);
		return true; // Continue processing if we can't check size
	}
};

/**
 * Validate page count for a PDF attachment
 * @param {Object} pdf - The PDF item
 * @param {string} fileName - The filename for display purposes
 * @param {Function} onShowPageLimitWarning - Optional callback for page limit warnings
 * @returns {Promise<boolean>} True if page count is valid, false otherwise
 */
export const validatePageCount = async (pdf, fileName = null, onShowPageLimitWarning = null) => {
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
	catch (error) {
		Zotero.debug(`Error validating page count: ${error.message}`);
		return true; // Continue processing if we can't check pages
	}
};

/**
 * Get document mapping from Zotero preferences
 * @param {string} sessionId - The session ID
 * @returns {Object} The document mapping object
 */
export const getDocumentMapping = (sessionId) => {
	try {
		const storageKey = sessionId ? `deeptutor_mapping_${sessionId}` : 'deeptutor_mapping_draft';
		const mappingStr = Zotero.Prefs.get(storageKey);
		return mappingStr ? JSON.parse(mappingStr) : {};
	}
	catch (error) {
		Zotero.debug(`Error getting document mapping: ${error.message}`);
		return {};
	}
};

/**
 * Get document name from a Zotero item
 * @param {Object} item - The Zotero item
 * @returns {string} The document name
 */
export const getDocumentName = (item) => {
	if (!item) return "Document Not Found";
	
	try {
		// Prioritize attachment filename first
		if (item.attachmentFilename) {
			return item.attachmentFilename;
		}
		// Fall back to display title if no filename
		if (item.getDisplayTitle && typeof item.getDisplayTitle === 'function') {
			return item.getDisplayTitle();
		}
		// Finally try parent item title
		if (item.parentItem) {
			const parentItem = Zotero.Items.get(item.parentItem);
			if (parentItem && parentItem.getDisplayTitle && typeof parentItem.getDisplayTitle === 'function') {
				return parentItem.getDisplayTitle();
			}
		}
		return "Document Not Found";
	}
	catch (error) {
		Zotero.debug(`Error getting document name: ${error.message}`);
		return "Document Not Found";
	}
};

/**
 * Get document file path from a Zotero item
 * @param {Object} item - The Zotero item
 * @param {number} maxPathLength - Maximum path length before truncation
 * @returns {Promise<string|null>} The file path or null if not available
 */
export const getDocumentFilePath = async (item, maxPathLength = 60) => {
	if (!item || !item.isAttachment || !item.isAttachment()) return null;
	
	try {
		const filePath = await item.getFilePathAsync();
		if (!filePath) return null;
		
		// Optionally truncate long paths for display
		if (filePath.length <= maxPathLength) return filePath;
		
		const pathParts = filePath.split(/[/\\]/);
		const filename = pathParts[pathParts.length - 1];
		const pathPrefix = filePath.substring(0, maxPathLength - filename.length - 3);
		return `${pathPrefix}...${filename}`;
	}
	catch (error) {
		Zotero.debug(`Error getting document file path: ${error.message}`);
		return null;
	}
};

/**
 * Process a document ID to get document information
 * @param {string} documentId - The document ID
 * @param {Object} mapping - The document mapping
 * @returns {Promise<Object>} Document information object
 */
export const processDocument = async (documentId, mapping) => {
	try {
		const zoteroAttachmentId = mapping[documentId] || documentId;
		const item = Zotero.Items.get(zoteroAttachmentId);
		
		if (!item) {
			return createFallbackDocument(documentId);
		}

		const documentName = getDocumentName(item);
		const filePath = await getDocumentFilePath(item);

		return {
			documentId,
			zoteroAttachmentId,
			name: documentName,
			filePath
		};
	}
	catch (error) {
		Zotero.debug(`Error processing document: ${error.message}`);
		return createFallbackDocument(documentId);
	}
};

/**
 * Create a fallback document object when item is not found
 * @param {string} documentId - The document ID
 * @returns {Object} Fallback document object
 */
export const createFallbackDocument = documentId => ({
	documentId,
	zoteroAttachmentId: documentId,
	name: "Document Not Found",
	filePath: null
});

/**
 * Get currently opened PDF from Zotero
 * @returns {Object|null} Object containing item, fileName, and itemId, or null if not found
 */
export const getCurrentlyOpenedPDF = () => {
	try {
		// Get the main window and tabs
		const mainWindow = Zotero.getMainWindow();
		if (!mainWindow) return null;
		
		const selectedTabID = mainWindow.Zotero_Tabs.selectedID;
		if (!selectedTabID) return null;
		
		// Get the current reader instance
		const reader = Zotero.Reader.getByTabID(selectedTabID);
		if (!reader) return null;

		// Get the item from the reader
		const item = Zotero.Items.get(reader.itemID);
		if (!item || !item.isPDFAttachment()) return null;

		// Safe filename resolution with error handling
		let fileName = '';
		try {
			fileName = item.attachmentFilename || item.getField('title') || '';
		}
		catch (error) {
			Zotero.debug(`Error getting filename: ${error.message}`);
			fileName = '';
		}

		// Ensure we have a valid string and fallback to "Untitled"
		if (!fileName || typeof fileName !== 'string' || fileName.trim() === '') {
			fileName = 'Untitled';
		}

		return {
			item: item,
			fileName: fileName,
			itemId: item.id
		};
	}
	catch (error) {
		Zotero.debug(`Error getting currently opened PDF: ${error.message}`);
		return null;
	}
};

/**
 * Read file data and create a blob
 * @param {Object} item - The Zotero item
 * @param {string} fileName - The file name for error messages
 * @returns {Promise<Blob|null>} The blob or null if failed
 */
export const readFileAsBlob = async (item, fileName) => {
	try {
		const filePath = await item.getFilePathAsync();
		if (!filePath) {
			throw new Error(`No file path available for: ${fileName}`);
		}
		
		// Check file existence
		const fileExists = await IOUtils.exists(filePath);
		if (!fileExists) {
			throw new Error(`File not found on disk: ${filePath}`);
		}
		
		// Read file data directly
		const fileData = await IOUtils.read(filePath);
		
		// Create blob directly from file data
		const BlobConstructor = Zotero.getMainWindow().Blob;
		return new BlobConstructor([fileData], { type: 'application/pdf' });
	}
	catch (error) {
		Zotero.debug(`Error reading file as blob: ${error.message}`);
		return null;
	}
};

/**
 * Get pre-signed URL with fallback for filename sanitization
 * @param {string} userId - The user ID
 * @param {string} fileName - The file name
 * @param {Function} getPreSignedUrl - The API function to get pre-signed URL
 * @returns {Promise<Object|null>} Pre-signed URL data or null if failed
 */
export const getPreSignedUrlWithFallback = async (userId, fileName, getPreSignedUrl) => {
	try {
		const encodedFileName = encodeURIComponent(fileName);
		return await getPreSignedUrl(userId, encodedFileName);
	}
	catch (error) {
		Zotero.debug(`Error getting pre-signed URL, trying sanitized filename: ${error.message}`);
		// Try with a sanitized filename as fallback
		const sanitizedFileName = fileName.replace(/[;:&<>]/g, '_');
		try {
			const encodedSanitized = encodeURIComponent(sanitizedFileName);
			return await getPreSignedUrl(userId, encodedSanitized);
		}
		catch (fallbackError) {
			Zotero.debug(`Error getting pre-signed URL with sanitized filename: ${fallbackError.message}`);
			return null;
		}
	}
};

/**
 * Upload file to Azure Blob Storage
 * @param {string} preSignedUrl - The pre-signed URL
 * @param {Blob} blob - The file blob
 * @returns {Promise<boolean>} True if upload successful, false otherwise
 */
export const uploadFileToBlob = async (preSignedUrl, blob) => {
	try {
		const uploadResponse = await window.fetch(preSignedUrl, {
			method: 'PUT',
			headers: {
				'x-ms-blob-type': 'BlockBlob',
				'Content-Type': 'application/pdf'
			},
			body: blob
		});
		
		return uploadResponse.ok;
	}
	catch (error) {
		Zotero.debug(`Error uploading file to blob: ${error.message}`);
		return false;
	}
};

/**
 * Upload a currently opened PDF file and return its document ID
 * @param {Object} pdfData - Object containing item, fileName, and itemId
 * @param {string} userId - The user ID
 * @param {string} subscriptionType - The subscription type
 * @param {Function} getPreSignedUrl - The API function to get pre-signed URL
 * @param {Function} onShowFileSizeWarning - Optional callback for file size warnings
 * @param {Function} onShowPageLimitWarning - Optional callback for page limit warnings
 * @returns {Promise<Object|null>} Object containing documentId and mapping, or null if upload failed
 */
export const uploadCurrentlyOpenedFile = async (pdfData, userId, subscriptionType, getPreSignedUrl, onShowFileSizeWarning = null, onShowPageLimitWarning = null) => {
	try {
		const { item, fileName } = pdfData;
		
		// Validate file size
		const isFileSizeValid = await validateFileSize(item, fileName, subscriptionType, onShowFileSizeWarning);
		if (!isFileSizeValid) return null;
		
		// Validate page count
		const isPageCountValid = await validatePageCount(item, fileName, onShowPageLimitWarning);
		if (!isPageCountValid) return null;
		
		// Read file data
		const blob = await readFileAsBlob(item, fileName);
		if (!blob) return null;
		
		// Get pre-signed URL for the file
		const preSignedUrlData = await getPreSignedUrlWithFallback(userId, fileName, getPreSignedUrl);
		if (!preSignedUrlData) return null;
		
		// Upload file to Azure Blob Storage
		const uploadSuccess = await uploadFileToBlob(preSignedUrlData.preSignedUrl, blob);
		if (!uploadSuccess) return null;
		
		return {
			documentId: preSignedUrlData.documentId,
			mapping: { [preSignedUrlData.documentId]: item.id }
		};
	}
	catch (error) {
		Zotero.debug(`Error uploading currently opened file: ${error.message}`);
		return null;
	}
};

/**
 * Load containers with PDF attachments from Zotero library
 * @returns {Promise<Array>} Array of container objects with id and name
 */
export const loadContainersWithPDFs = async () => {
	try {
		const libraryID = Zotero.Libraries.userLibraryID;
		const items = await Zotero.Items.getAll(libraryID);
		const seen = new Set();
		
		return items.reduce((arr, item) => {
			if (item.isRegularItem() && !seen.has(item.id)) {
				const pdfs = item.getAttachments()
					.map(x => Zotero.Items.get(x))
					.filter(x => x && x.isPDFAttachment && x.isPDFAttachment());
				
				if (pdfs.length) {
					seen.add(item.id);
					let name = '';
					try {
						name = item.getField('title') || '';
					}
					catch (error) {
						Zotero.debug(`Error getting container name: ${error.message}`);
						name = '';
					}
					arr.push({
						id: item.id,
						name: name && name.trim() !== '' ? name : 'Untitled'
					});
				}
			}
			return arr;
		}, []);
	}
	catch (error) {
		Zotero.debug(`Error loading containers with PDFs: ${error.message}`);
		return [];
	}
};

/**
 * Get file count limit message based on subscription type
 * @param {string} subscriptionType - The subscription type
 * @returns {string} The limit message
 */
export const getFileCountLimitMessage = (subscriptionType) => {
	const limit = getFileCountLimit(subscriptionType);
	switch ((subscriptionType || '').toUpperCase()) {
		case "BASIC":
			return `Basic subscription allows only ${limit} file`;
		case "PLUS":
			return `Pro subscription allows up to ${limit} files`;
		case "PREMIUM":
			return `Premium subscription allows up to ${limit} files`;
		default:
			return `File limit: ${limit}`;
	}
};

/**
 * Check if adding more files would exceed the limit
 * @param {number} currentCount - Current number of files
 * @param {string} subscriptionType - The subscription type
 * @returns {boolean} True if can add more files
 */
export const canAddMoreFiles = (currentCount, subscriptionType) => {
	const limit = getFileCountLimit(subscriptionType);
	return currentCount < limit;
};

/**
 * Set note container from documents
 * @param {Array} docs - Array of document objects
 * @param {Function} setNoteContainer - State setter for note container
 */
export const setNoteContainerFromDocuments = (docs, setNoteContainer) => {
	if (!docs || !docs.length) {
		setNoteContainer(null);
		return;
	}

	try {
		const firstDoc = docs[0];
		const firstItem = Zotero.Items.get(firstDoc.zoteroAttachmentId);
		
		if (!firstItem) {
			setNoteContainer(null);
			return;
		}

		let parentItemId = null;
		
		if (firstItem.isAttachment() && firstItem.parentID) {
			const parentItem = Zotero.Items.get(firstItem.parentID);
			if (parentItem?.isRegularItem()) {
				parentItemId = firstItem.parentID;
			}
		}
		else if (firstItem.isRegularItem()) {
			parentItemId = firstItem.id;
		}

		setNoteContainer(parentItemId);
	}
	catch (error) {
		Zotero.debug(`Error setting note container from documents: ${error.message}`);
		setNoteContainer(null);
	}
};

/**
 * Clean up source data for a session
 * @param {string} sessionId - The session ID
 * @param {Array} sourceIndices - Array of source indices to clean up
 */
export const cleanupSourceData = (sessionId, sourceIndices) => {
	if (!sessionId || !sourceIndices) return;
	
	try {
		sourceIndices.forEach((sourceIndex) => {
			const storageKey = `deeptutor_source_${sessionId}_${sourceIndex}`;
			if (Zotero.Prefs.get(storageKey)) {
				Zotero.Prefs.clear(storageKey);
			}
		});
	}
	catch (error) {
		Zotero.debug(`Error cleaning up source data: ${error.message}`);
	}
};

/**
 * Handle click outside popup
 * @param {Object} popupRef - React ref to the popup element
 * @param {Function} setShowPopup - State setter for popup visibility
 * @param {boolean} showPopup - Current popup visibility state
 */
export const useClickOutsidePopup = (popupRef, setShowPopup, showPopup) => {
	useEffect(() => {
		const handleClick = (e) => {
			if (popupRef.current && !popupRef.current.contains(e.target)) {
				setShowPopup(false);
			}
		};

		if (showPopup) {
			document.addEventListener('mousedown', handleClick);
			return () => document.removeEventListener('mousedown', handleClick);
		}
		return undefined;
	}, [showPopup, popupRef, setShowPopup]);
};

/**
 * Auto-resize textarea based on content
 * @param {Object} textareaRef - React ref to the textarea element
 * @param {string} value - The textarea value
 * @param {number} minHeight - Minimum height in pixels
 * @param {number} maxHeight - Maximum height in pixels
 */
export const useAutoResizeTextarea = (textareaRef, value, minHeight = 104, maxHeight = 224) => {
	useEffect(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;
		
		// Reset height to auto to get the correct scrollHeight
		textarea.style.height = 'auto';
		
		// Calculate the new height based on content
		const scrollHeight = textarea.scrollHeight;
		const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));
		textarea.style.height = `${newHeight}px`;
	}, [value, textareaRef, minHeight, maxHeight]);
};
