// Note: Use chrome module shortcuts (Cc, Ci) for XPCOM access in this context
let { Cc, Ci } = require('chrome');

// PDFLib removed - now using Zotero's PDFWorker instead

/**
 * DeepTutor Claude Management System
 * Handles database initialization and PDF document processing
 */

class DeepTutorClaudeManagement {
    constructor() {
        this.dataDirectory = null;
        this.deepTutorDBPath = null;
        this.rawDocDataPath = null;
        this.docTOCPath = null;
        this.userMetricPath = null;
        this.fileTreePath = null;
        this.generalPath = null;
        
        // Set up global error handling to prevent crashes
        this.setupErrorHandling();
    }
    
    /**
     * Set up global error handling to prevent crashes
     */
    setupErrorHandling() {
        try {
            // Handle unhandled promise rejections
            if (typeof window !== 'undefined' && window.addEventListener) {
                window.addEventListener('unhandledrejection', (event) => {
                    Zotero.debug(`DeepTutorClaudeManagement: Unhandled promise rejection: ${event.reason}`);
                    event.preventDefault();
                });
            }
            
            // Handle global errors
            if (typeof window !== 'undefined' && window.addEventListener) {
                window.addEventListener('error', (event) => {
                    Zotero.debug(`DeepTutorClaudeManagement: Global error: ${event.error}`);
                    event.preventDefault();
                });
            }
            
            Zotero.debug("DeepTutorClaudeManagement: Error handling setup completed");
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error setting up error handling: ${error.message}`);
        }
    }

    /**
     * Check if Zotero PDFWorker is available
     * @returns {boolean} True if PDFWorker is available
     */
    isPDFWorkerAvailable() {
        try {
            Zotero.debug("DeepTutorClaudeManagement: Checking Zotero PDFWorker availability...");
            if (!Zotero.PDFWorker) {
                Zotero.debug("DeepTutorClaudeManagement: Zotero PDFWorker not available");
                return false;
            }
            Zotero.debug("DeepTutorClaudeManagement: Zotero PDFWorker is available");
            return true;
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Zotero PDFWorker not available: ${error.message}`);
            return false;
        }
    }

    /**
     * Initialize the DeepTutor database structure
     * Creates necessary folders if they don't exist
     */
    async initializeDataBase() {
        try {
            Zotero.debug("DeepTutorClaudeManagement: Starting database initialization...");
            
            // Get Zotero's data directory
            this.dataDirectory = Zotero.DataDirectory.dir;
            Zotero.debug(`DeepTutorClaudeManagement: Data directory: ${this.dataDirectory}`);
            
            // Define the DeepTutorDataBase path
            this.deepTutorDBPath = this.pathJoin(this.dataDirectory, "DeepTutorDataBase");
            Zotero.debug(`DeepTutorClaudeManagement: DeepTutor database path: ${this.deepTutorDBPath}`);
            
            // Define subfolder paths
            this.rawDocDataPath = this.pathJoin(this.deepTutorDBPath, "RawDocData");
            this.docTOCPath = this.pathJoin(this.deepTutorDBPath, "DocTOC");
            this.userMetricPath = this.pathJoin(this.deepTutorDBPath, "UserMetric");
            this.fileTreePath = this.pathJoin(this.deepTutorDBPath, "FileTree");
            this.generalPath = this.pathJoin(this.deepTutorDBPath, "General");

            Zotero.debug("DeepTutorClaudeManagement: Checking main database folder...");
            // Check if DeepTutorDataBase folder exists, create if not
            try {
                const mainFolderExists = this.pathExists(this.deepTutorDBPath);
                if (!mainFolderExists) {
                    Zotero.debug(`DeepTutorClaudeManagement: Creating main database folder at: ${this.deepTutorDBPath}`);
                    this.createDirectory(this.deepTutorDBPath);
                    Zotero.debug("DeepTutorClaudeManagement: Successfully created DeepTutorDataBase folder");
                } else {
                    Zotero.debug("DeepTutorClaudeManagement: Main database folder already exists");
                }
            } catch (error) {
                Zotero.debug(`DeepTutorClaudeManagement: Error checking/creating main folder: ${error.message}`);
                throw error;
            }

            // Check and create subfolders if they don't exist
            const folders = [
                { path: this.rawDocDataPath, name: "RawDocData" },
                { path: this.docTOCPath, name: "DocTOC" },
                { path: this.userMetricPath, name: "UserMetric" },
                { path: this.fileTreePath, name: "FileTree" },
                { path: this.generalPath, name: "General" }
            ];

            Zotero.debug("DeepTutorClaudeManagement: Checking and creating subfolders...");
            for (const folder of folders) {
                Zotero.debug(`DeepTutorClaudeManagement: Checking folder: ${folder.name} at ${folder.path}`);
                try {
                    const folderExists = this.pathExists(folder.path);
                    if (!folderExists) {
                        Zotero.debug(`DeepTutorClaudeManagement: Creating ${folder.name} folder at: ${folder.path}`);
                        this.createDirectory(folder.path);
                        Zotero.debug(`DeepTutorClaudeManagement: Successfully created ${folder.name} folder`);
                    } else {
                        Zotero.debug(`DeepTutorClaudeManagement: ${folder.name} folder already exists`);
                    }
                } catch (error) {
                    Zotero.debug(`DeepTutorClaudeManagement: Error with folder ${folder.name}: ${error.message}`);
                    throw error;
                }
            }

            Zotero.debug("DeepTutorClaudeManagement: Database structure initialization completed successfully");
            Zotero.debug(`DeepTutorClaudeManagement: Final paths - RawDocData: ${this.rawDocDataPath}`);
            Zotero.debug(`DeepTutorClaudeManagement: Final paths - DocTOC: ${this.docTOCPath}`);
            Zotero.debug(`DeepTutorClaudeManagement: Final paths - UserMetric: ${this.userMetricPath}`);
            Zotero.debug(`DeepTutorClaudeManagement: Final paths - FileTree: ${this.fileTreePath}`);
            Zotero.debug(`DeepTutorClaudeManagement: Final paths - General: ${this.generalPath}`);
            
            return true;

        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error initializing DeepTutor database: ${error.message}`);
            Zotero.debug(`DeepTutorClaudeManagement: Error stack: ${error.stack}`);
            throw error;
        }
    }

    /**
     * Extract comprehensive metadata for a PDF item including collections and hierarchy
     * @param {Object} attachment - Zotero attachment item
     * @returns {Object} Comprehensive metadata object
     */
    async extractComprehensiveMetadata(attachment) {
        try {
            const metadata = {
                item: {},
                parent: {},
                collections: [],
                hierarchy: {},
                library: {}
            };

            // Get attachment metadata
            metadata.item.id = attachment.id;
            metadata.item.key = attachment.key;
            metadata.item.libraryID = attachment.libraryID;
            
            try {
                metadata.item.title = attachment.getField('title') || '';
                metadata.item.filename = attachment.attachmentFilename || '';
                metadata.item.contentType = attachment.attachmentContentType || '';
                metadata.item.dateAdded = attachment.dateAdded || '';
                metadata.item.dateModified = attachment.dateModified || '';
            } catch (e) { /* ignore field errors */ }

            // Get parent item metadata if available
            const parentItem = attachment.parentItem;
            if (parentItem) {
                metadata.parent.id = parentItem.id;
                metadata.parent.key = parentItem.key;
                metadata.parent.itemType = parentItem.itemType;
                
                try {
                    metadata.parent.title = parentItem.getField('title') || '';
                    metadata.parent.publicationTitle = parentItem.getField('publicationTitle') || '';
                    metadata.parent.date = parentItem.getField('date') || '';
                    metadata.parent.volume = parentItem.getField('volume') || '';
                    metadata.parent.issue = parentItem.getField('issue') || '';
                    metadata.parent.pages = parentItem.getField('pages') || '';
                    metadata.parent.DOI = parentItem.getField('DOI') || '';
                    metadata.parent.ISBN = parentItem.getField('ISBN') || '';
                    metadata.parent.ISSN = parentItem.getField('ISSN') || '';
                    metadata.parent.url = parentItem.getField('url') || '';
                    metadata.parent.abstractNote = parentItem.getField('abstractNote') || '';
                    metadata.parent.extra = parentItem.getField('extra') || '';
                } catch (e) { /* ignore field errors */ }

                // Get creators
                try {
                    const creators = parentItem.getCreators();
                    metadata.parent.creators = creators.map(creator => ({
                        firstName: creator.firstName || '',
                        lastName: creator.lastName || '',
                        name: creator.name || '',
                        creatorType: creator.creatorType || 'author'
                    }));
                    metadata.parent.authorsString = creators
                        .filter(c => c.creatorType === 'author')
                        .map(c => `${c.firstName} ${c.lastName}`.trim())
                        .join(', ');
                } catch (e) {
                    metadata.parent.creators = [];
                    metadata.parent.authorsString = '';
                }

                // Get tags
                try {
                    metadata.parent.tags = parentItem.getTags().map(tag => tag.tag);
                } catch (e) {
                    metadata.parent.tags = [];
                }
            }

            // Get library information
            try {
                const library = Zotero.Libraries.get(attachment.libraryID);
                metadata.library.id = library.id;
                metadata.library.name = library.name;
                metadata.library.libraryType = library.libraryType;
                metadata.library.editable = library.editable;
            } catch (e) {
                metadata.library.name = 'User Library';
            }

            // Get collections containing this item
            try {
                const itemToCheck = parentItem || attachment;
                const collectionIDs = itemToCheck.getCollections();
                
                for (const collectionID of collectionIDs) {
                    const collection = await Zotero.Collections.getAsync(collectionID);
                    if (collection) {
                        const collectionData = {
                            id: collection.id,
                            key: collection.key,
                            name: collection.name,
                            parentCollection: null,
                            level: 0,
                            path: []
                        };

                        // Build collection hierarchy path
                        let currentCollection = collection;
                        const pathComponents = [];
                        let level = 0;
                        
                        while (currentCollection) {
                            pathComponents.unshift(currentCollection.name);
                            
                            if (currentCollection.parentID) {
                                try {
                                    currentCollection = await Zotero.Collections.getAsync(currentCollection.parentID);
                                    level++;
                                } catch (e) {
                                    break;
                                }
                            } else {
                                break;
                            }
                        }
                        
                        collectionData.level = level;
                        collectionData.path = pathComponents;
                        collectionData.fullPath = pathComponents.join(' > ');
                        
                        metadata.collections.push(collectionData);
                    }
                }
            } catch (e) {
                Zotero.debug(`DeepTutorClaudeManagement: Error getting collections: ${e.message}`);
            }

            // Build hierarchy information
            metadata.hierarchy = {
                libraryName: metadata.library.name,
                collections: metadata.collections.map(c => c.fullPath),
                primaryCollection: metadata.collections.length > 0 ? metadata.collections[0].fullPath : 'Uncategorized',
                itemTitle: metadata.parent.title || metadata.item.title || 'Untitled',
                itemType: metadata.parent.itemType || 'attachment',
                fullHierarchy: metadata.collections.length > 0 
                    ? `${metadata.library.name} > ${metadata.collections[0].fullPath} > ${metadata.parent.title || metadata.item.title}`
                    : `${metadata.library.name} > Uncategorized > ${metadata.parent.title || metadata.item.title}`
            };

            return metadata;
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error extracting comprehensive metadata: ${error.message}`);
            return {
                item: { id: attachment.id },
                parent: {},
                collections: [],
                hierarchy: { libraryName: 'User Library', primaryCollection: 'Uncategorized' },
                library: { name: 'User Library' },
                error: error.message
            };
        }
    }

    /**
     * Generate a summary from the full text content
     * @param {string} fullText - The complete text content
     * @param {Object} abstractResult - Result from abstract extraction
     * @returns {Object} Summary generation result
     */
    generateSummary(fullText, abstractResult) {
        try {
            Zotero.debug("DeepTutorClaudeManagement: Generating document summary...");
            
            let summary = '';
            let method = 'generated';
            let confidence = 'medium';

            // Strategy 1: Use existing abstract if available and high confidence
            if (abstractResult && abstractResult.abstract && abstractResult.confidence === 'high') {
                summary = abstractResult.abstract;
                method = 'abstract';
                confidence = 'high';
                Zotero.debug("DeepTutorClaudeManagement: Using high-confidence abstract as summary");
            }
            // Strategy 2: Generate summary from first paragraphs
            else {
                // Split into paragraphs
                const paragraphs = fullText.split(/\n\s*\n/).filter(p => p.trim().length > 50);
                
                // Take first few substantial paragraphs (up to 500 words)
                let wordCount = 0;
                const summaryParagraphs = [];
                
                for (const paragraph of paragraphs.slice(0, 5)) { // Max 5 paragraphs
                    const cleanParagraph = paragraph.trim()
                        .replace(/\s+/g, ' ')
                        .replace(/^\d+\.\s*/, '') // Remove numbering
                        .replace(/^[A-Z][A-Z\s]+$/, ''); // Remove all-caps headers
                    
                    if (cleanParagraph.length > 50) {
                        const words = cleanParagraph.split(/\s+/);
                        if (wordCount + words.length <= 500) {
                            summaryParagraphs.push(cleanParagraph);
                            wordCount += words.length;
                        } else {
                            // Add partial paragraph to reach ~500 words
                            const remainingWords = Math.max(0, 500 - wordCount);
                            if (remainingWords > 10) {
                                const partialParagraph = words.slice(0, remainingWords).join(' ') + '...';
                                summaryParagraphs.push(partialParagraph);
                            }
                            break;
                        }
                    }
                }
                
                summary = summaryParagraphs.join('\n\n');
                method = 'first_paragraphs';
                confidence = 'medium';
                
                Zotero.debug(`DeepTutorClaudeManagement: Generated summary from first paragraphs (${wordCount} words)`);
            }

            // Validate and clean summary
            if (summary.length < 50) {
                // Fallback: use first 1000 characters
                summary = fullText.substring(0, 1000).replace(/\s+/g, ' ').trim() + '...';
                method = 'truncated';
                confidence = 'low';
            }

            return {
                summary: summary,
                method: method,
                confidence: confidence,
                wordCount: summary.split(/\s+/).length,
                charCount: summary.length
            };
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error generating summary: ${error.message}`);
            return {
                summary: fullText.substring(0, 500) + '...',
                method: 'error_fallback',
                confidence: 'low',
                error: error.message
            };
        }
    }

    /**
     * Save file hierarchy data to FileTree folder
     * @param {Object} metadata - Comprehensive metadata object
     * @param {string} itemID - Item ID for the file
     */
    async saveFileHierarchyData(metadata, itemID) {
        try {
            Zotero.debug(`DeepTutorClaudeManagement: Saving file hierarchy data for item ${itemID}`);
            
            const hierarchyFileName = `${itemID}_hierarchy.json`;
            const hierarchyFilePath = this.pathJoin(this.fileTreePath, hierarchyFileName);
            
            const hierarchyData = {
                itemID: itemID,
                timestamp: new Date().toISOString(),
                library: metadata.library,
                collections: metadata.collections,
                hierarchy: metadata.hierarchy,
                item: metadata.item,
                parent: metadata.parent,
                fileStructure: {
                    markdownFulltext: `${itemID}_fulltext.md`,
                    markdownSummary: `${itemID}_summary.md`,
                    hierarchyFile: hierarchyFileName
                }
            };
            
            const hierarchyJson = JSON.stringify(hierarchyData, null, 2);
            this.writeTextFile(hierarchyFilePath, hierarchyJson);
            
            Zotero.debug(`DeepTutorClaudeManagement: Hierarchy data saved to: ${hierarchyFilePath}`);
            return hierarchyData;
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error saving hierarchy data: ${error.message}`);
            throw error;
        }
    }

    /**
     * Load and process raw PDF documents
     * Converts PDFs to markdown and stores them in RawDocData folder
     */
    async loadRawPDFDoc() {
        try {
            Zotero.debug("DeepTutorClaudeManagement: Starting PDF document loading process...");
            
            // Ensure RawDocData folder exists
            const rawDocDataExists = this.pathExists(this.rawDocDataPath);
            if (!rawDocDataExists) {
                Zotero.debug("DeepTutorClaudeManagement: RawDocData folder does not exist, throwing error");
                throw new Error("RawDocData folder does not exist. Please run initializeDataBase first.");
            }
            Zotero.debug(`DeepTutorClaudeManagement: RawDocData folder verified at: ${this.rawDocDataPath}`);

            // Get all items with PDF attachments from the user's library (matches working pattern in ModelSelection)
            Zotero.debug("DeepTutorClaudeManagement: Fetching all items from user library...");
            const userLibID = (Zotero.Libraries && typeof Zotero.Libraries.userLibraryID !== 'undefined')
                ? Zotero.Libraries.userLibraryID
                : 1;
            const items = await Zotero.Items.getAll(userLibID);
            Zotero.debug(`DeepTutorClaudeManagement: Found ${items.length} total items in library ${userLibID}`);
            
            const pdfItems = [];
            let totalAttachments = 0;
            let pdfAttachments = 0;

            Zotero.debug("DeepTutorClaudeManagement: Scanning items for PDF attachments...");
            for (const item of items) {
                if (!item) continue;

                // If the item itself is an attachment, check if it's a PDF and include it
                if (item.isAttachment && item.isAttachment()) {
                    const mime = String(item.attachmentContentType || item.attachmentMIMEType || '').toLowerCase();
                    const filename = String(item.attachmentFilename || '');
                    const isPDF = (item.isPDFAttachment && item.isPDFAttachment()) || mime.includes('pdf') || /\.pdf$/i.test(filename);
                    if (isPDF) {
                        pdfAttachments++;
                        pdfItems.push({
                            // Use parentID if available for grouping; fall back to attachment id
                            itemID: (typeof item.parentID !== 'undefined' && item.parentID) ? item.parentID : item.id,
                            attachmentID: item.id,
                            attachment: item
                        });
                        Zotero.debug(`DeepTutorClaudeManagement: Found PDF attachment (direct) - Attachment ID: ${item.id}, Parent Item ID: ${(item.parentID || 'none')}`);
                    }
                    continue;
                }

                // If regular item, iterate its attachments
                if (item.isRegularItem && item.isRegularItem()) {
                    const attachments = (typeof item.getAttachments === 'function') ? item.getAttachments() : [];
                    totalAttachments += attachments.length;
                    
                    for (const attachmentID of attachments) {
                        const attachment = Zotero.Items.get(attachmentID);
                        if (!attachment) continue;
                        const mime = String(attachment.attachmentContentType || attachment.attachmentMIMEType || '').toLowerCase();
                        const filename = String(attachment.attachmentFilename || '');
                        const isPDF = (attachment.isPDFAttachment && attachment.isPDFAttachment()) || mime.includes('pdf') || /\.pdf$/i.test(filename);
                        if (attachment.isAttachment && attachment.isAttachment() && isPDF) {
                            pdfAttachments++;
                            pdfItems.push({
                                itemID: item.id,
                                attachmentID: attachmentID,
                                attachment: attachment
                            });
                            Zotero.debug(`DeepTutorClaudeManagement: Found PDF attachment - Item ID: ${item.id}, Attachment ID: ${attachmentID}`);
                        }
                    }
                }
            }

            Zotero.debug(`DeepTutorClaudeManagement: Attachment scan complete - Total attachments: ${totalAttachments}, PDF attachments: ${pdfAttachments}`);
            Zotero.debug(`DeepTutorClaudeManagement: Found ${pdfItems.length} PDF items to process`);

            if (pdfItems.length === 0) {
                Zotero.debug("DeepTutorClaudeManagement: No PDF items found to process");
                return true;
            }

            // Process each PDF item
            let processedCount = 0;
            let skippedCount = 0;
            let errorCount = 0;
            
            Zotero.debug("DeepTutorClaudeManagement: Starting PDF processing loop...");
            for (const pdfItem of pdfItems) {
                // New file naming with _fulltext and _summary suffixes
                const markdownFulltextFileName = `${pdfItem.itemID}_fulltext.md`;
                const markdownSummaryFileName = `${pdfItem.itemID}_summary.md`;
                const markdownFulltextFilePath = this.pathJoin(this.rawDocDataPath, markdownFulltextFileName);
                const markdownSummaryFilePath = this.pathJoin(this.rawDocDataPath, markdownSummaryFileName);

                Zotero.debug(`DeepTutorClaudeManagement: Processing PDF item ${pdfItem.itemID} (${processedCount + 1}/${pdfItems.length})`);

                // Check if markdown files already exist
                // const fulltextExists = this.pathExists(markdownFulltextFilePath);
                // const summaryExists = this.pathExists(markdownSummaryFilePath);
                // if (fulltextExists && summaryExists) {
                //     Zotero.debug(`DeepTutorClaudeManagement: Markdown files for item ${pdfItem.itemID} already exist, skipping`);
                //     skippedCount++;
                //     continue;
                // }

                try {
                    // Get the PDF file path for metadata purposes
                    Zotero.debug(`DeepTutorClaudeManagement: Getting file path for attachment ${pdfItem.attachmentID}`);
                    let pdfFilePath = null;
                    try {
                        if (typeof pdfItem.attachment.getFilePath === 'function') {
                            pdfFilePath = pdfItem.attachment.getFilePath();
                        }
                    } catch (e) { /* ignore */ }
                    if (!pdfFilePath && typeof pdfItem.attachment.getFilePathAsync === 'function') {
                        try {
                            pdfFilePath = await pdfItem.attachment.getFilePathAsync();
                        } catch (e) { /* ignore */ }
                    }
                    Zotero.debug(`DeepTutorClaudeManagement: PDF file path: ${pdfFilePath}`);
                    
                    if (!pdfFilePath) {
                        Zotero.debug(`DeepTutorClaudeManagement: No file path returned for item ${pdfItem.itemID}, skipping`);
                        errorCount++;
                        continue;
                    }
                    
                    const pdfFileExists = this.pathExists(pdfFilePath);
                    if (!pdfFileExists) {
                        Zotero.debug(`DeepTutorClaudeManagement: PDF file not found at path: ${pdfFilePath}, skipping`);
                        errorCount++;
                        continue;
                    }

                    // Extract comprehensive metadata including collections and hierarchy
                    Zotero.debug(`DeepTutorClaudeManagement: Extracting comprehensive metadata for item ${pdfItem.itemID}`);
                    const comprehensiveMetadata = await this.extractComprehensiveMetadata(pdfItem.attachment);

                    Zotero.debug(`DeepTutorClaudeManagement: PDF file verified, starting conversion for item ${pdfItem.itemID}`);
                    // Convert PDF to markdown using the enhanced approach
                    const { fulltextMarkdown, summaryMarkdown, abstractResult } = await this.convertPDFToEnhancedMarkdown(
                        pdfItem.attachment, 
                        pdfFilePath, 
                        comprehensiveMetadata
                    );
                    
                    Zotero.debug(`DeepTutorClaudeManagement: PDF conversion completed, saving markdown files`);
                    
                    // Save fulltext markdown
                    this.writeTextFile(markdownFulltextFilePath, fulltextMarkdown);
                    Zotero.debug(`DeepTutorClaudeManagement: Fulltext markdown saved: ${markdownFulltextFilePath}`);
                    
                    // Save summary markdown
                    this.writeTextFile(markdownSummaryFilePath, summaryMarkdown);
                    Zotero.debug(`DeepTutorClaudeManagement: Summary markdown saved: ${markdownSummaryFilePath}`);

                    // Save file hierarchy data to FileTree folder
                    try {
                        await this.saveFileHierarchyData(comprehensiveMetadata, pdfItem.itemID);
                        Zotero.debug(`DeepTutorClaudeManagement: File hierarchy data saved for item ${pdfItem.itemID}`);
                    } catch (hierarchyError) {
                        Zotero.debug(`DeepTutorClaudeManagement: Warning - could not save hierarchy data: ${hierarchyError.message}`);
                        // Don't fail the entire process for hierarchy errors
                    }

                    Zotero.debug(`DeepTutorClaudeManagement: Successfully processed PDF for item ${pdfItem.itemID}`);
                    processedCount++;

                } catch (error) {
                    Zotero.debug(`DeepTutorClaudeManagement: Error processing PDF for item ${pdfItem.itemID}: ${error.message}`);
                    Zotero.debug(`DeepTutorClaudeManagement: Error stack: ${error.stack}`);
                    errorCount++;
                    // Continue with next item instead of failing completely
                }
            }

            Zotero.debug(`DeepTutorClaudeManagement: PDF document loading completed - Processed: ${processedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);
            return true;

        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error loading raw PDF documents: ${error.message}`);
            Zotero.debug(`DeepTutorClaudeManagement: Error stack: ${error.stack}`);
            throw error;
        }
    }

    /**
     * Check if Zotero PDFWorker is available (alias for consistency)
     * Returns true if available, false otherwise
     */
    isPdfLibAvailable() {
        return this.isPDFWorkerAvailable();
    }



    /**
     * Convert PDF to enhanced markdown with comprehensive metadata, fulltext and summary versions
     * @param {Object} attachmentItem - Zotero attachment item
     * @param {string} pdfFilePath - Path to the PDF file
     * @param {Object} comprehensiveMetadata - Complete metadata object
     * @returns {Object} Object with fulltextMarkdown, summaryMarkdown, and abstractResult
     */
    async convertPDFToEnhancedMarkdown(attachmentItem, pdfFilePath, comprehensiveMetadata) {
        try {
            Zotero.debug(`DeepTutorClaudeManagement: Starting enhanced PDF conversion for attachment item: ${attachmentItem.id}`);
            
            const fileName = this.pathBasename(pdfFilePath);
            const currentDate = new Date().toISOString();
            
            // Check if PDFWorker is available
            if (!Zotero.PDFWorker) {
                throw new Error("Zotero PDFWorker is not available");
            }
            
            // Use Zotero's PDFWorker to extract full text directly
            const extractionResult = await Zotero.PDFWorker.getFullText(attachmentItem.id);
            
            if (!extractionResult || !extractionResult.text) {
                throw new Error("PDFWorker returned no text content");
            }
            
            const fullText = extractionResult.text;
            const extractedPages = extractionResult.extractedPages || 'Unknown';
            const totalPages = extractionResult.totalPages || 'Unknown';
            
            // Get file size
            let fileSize = 0;
            try {
                const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
                file.initWithPath(pdfFilePath);
                fileSize = file.fileSize;
            } catch (e) {
                Zotero.debug(`DeepTutorClaudeManagement: Could not get file size: ${e.message}`);
            }
            
            // Extract abstract
            const abstractResult = await this.extractAbstract(attachmentItem, pdfFilePath);
            
            // Generate summary
            const summaryResult = this.generateSummary(fullText, abstractResult);
            
            // Create enhanced metadata section
            const metadataSection = this.createEnhancedMetadataSection(comprehensiveMetadata, fileName, currentDate, fileSize, totalPages, extractedPages);
            
            // Build fulltext markdown
            let fulltextMarkdown = `# PDF Document: ${fileName} (Full Text)\n\n`;
            fulltextMarkdown += metadataSection;
            fulltextMarkdown += this.createAbstractSection(abstractResult);
            fulltextMarkdown += `---\n\n## Extracted Text Content\n\n`;
            
            if (fullText && fullText.trim()) {
                const cleanedText = fullText
                    .replace(/\r\n/g, '\n')
                    .replace(/\r/g, '\n')
                    .replace(/\n{3,}/g, '\n\n')
                    .trim();
                fulltextMarkdown += cleanedText;
            } else {
                fulltextMarkdown += `*No text content could be extracted from this PDF.*\n\n`;
            }
            
            fulltextMarkdown += this.createProcessingInfoSection(currentDate, fullText, extractedPages, totalPages);
            
            // Build summary markdown
            let summaryMarkdown = `# PDF Document: ${fileName} (Summary)\n\n`;
            summaryMarkdown += metadataSection;
            summaryMarkdown += this.createAbstractSection(abstractResult);
            summaryMarkdown += `---\n\n## Document Summary\n\n`;
            summaryMarkdown += `**Summary Method:** ${summaryResult.method}\n\n`;
            summaryMarkdown += `**Confidence:** ${summaryResult.confidence}\n\n`;
            summaryMarkdown += `**Word Count:** ${summaryResult.wordCount}\n\n`;
            summaryMarkdown += `**Summary Text:**\n\n`;
            summaryMarkdown += summaryResult.summary + `\n\n`;
            summaryMarkdown += this.createProcessingInfoSection(currentDate, fullText, extractedPages, totalPages);
            
            Zotero.debug(`DeepTutorClaudeManagement: Enhanced PDF conversion completed successfully`);
            
            return {
                fulltextMarkdown: fulltextMarkdown,
                summaryMarkdown: summaryMarkdown,
                abstractResult: abstractResult,
                summaryResult: summaryResult,
                metadata: comprehensiveMetadata
            };
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error in enhanced PDF conversion: ${error.message}`);
            
            // Return fallback content
            const fileName = this.pathBasename(pdfFilePath);
            const currentDate = new Date().toISOString();
            
            const fallbackContent = this.createFallbackContent(fileName, currentDate, error, comprehensiveMetadata);
            
            return {
                fulltextMarkdown: fallbackContent,
                summaryMarkdown: fallbackContent.replace('(Full Text)', '(Summary)'),
                abstractResult: { abstract: null, confidence: 'none', error: error.message },
                summaryResult: { summary: null, method: 'error', error: error.message },
                metadata: comprehensiveMetadata
            };
        }
    }

    /**
     * Create enhanced metadata section with comprehensive information
     */
    createEnhancedMetadataSection(metadata, fileName, currentDate, fileSize, totalPages, extractedPages) {
        let section = `**File Path:** ${fileName}\n\n`;
        section += `**Processed Date:** ${currentDate}\n\n`;
        section += `**File Size:** ${(fileSize / 1024).toFixed(2)} KB\n\n`;
        section += `**Total Pages:** ${totalPages}\n\n`;
        section += `**Extracted Pages:** ${extractedPages}\n\n`;
        section += `**PDF Library:** Zotero PDFWorker\n\n`;
        section += `**Attachment Item ID:** ${metadata.item.id}\n\n`;
        
        // Library and Collection Information
        section += `## Library and Collection Information\n\n`;
        section += `**Library:** ${metadata.library.name}\n\n`;
        section += `**Library Type:** ${metadata.library.libraryType || 'user'}\n\n`;
        
        if (metadata.collections.length > 0) {
            section += `**Collections:**\n\n`;
            for (const collection of metadata.collections) {
                section += `- ${collection.fullPath}\n`;
            }
            section += `\n`;
            section += `**Primary Collection:** ${metadata.hierarchy.primaryCollection}\n\n`;
        } else {
            section += `**Collections:** None (Uncategorized)\n\n`;
        }
        
        section += `**Full Hierarchy:** ${metadata.hierarchy.fullHierarchy}\n\n`;
        
        // Item Information
        if (metadata.parent.title) {
            section += `## Parent Item Information\n\n`;
            section += `**Title:** ${metadata.parent.title}\n\n`;
            section += `**Item Type:** ${metadata.parent.itemType}\n\n`;
            
            if (metadata.parent.authorsString) {
                section += `**Authors:** ${metadata.parent.authorsString}\n\n`;
            }
            
            if (metadata.parent.publicationTitle) {
                section += `**Publication:** ${metadata.parent.publicationTitle}\n\n`;
            }
            
            if (metadata.parent.date) {
                section += `**Date:** ${metadata.parent.date}\n\n`;
            }
            
            if (metadata.parent.volume) {
                section += `**Volume:** ${metadata.parent.volume}\n\n`;
            }
            
            if (metadata.parent.issue) {
                section += `**Issue:** ${metadata.parent.issue}\n\n`;
            }
            
            if (metadata.parent.pages) {
                section += `**Pages:** ${metadata.parent.pages}\n\n`;
            }
            
            if (metadata.parent.DOI) {
                section += `**DOI:** ${metadata.parent.DOI}\n\n`;
            }
            
            if (metadata.parent.url) {
                section += `**URL:** ${metadata.parent.url}\n\n`;
            }
            
            if (metadata.parent.tags && metadata.parent.tags.length > 0) {
                section += `**Tags:** ${metadata.parent.tags.join(', ')}\n\n`;
            }
        }
        
        // Attachment Information
        section += `## Attachment Information\n\n`;
        section += `**Attachment ID:** ${metadata.item.id}\n\n`;
        section += `**Filename:** ${metadata.item.filename}\n\n`;
        section += `**Content Type:** ${metadata.item.contentType}\n\n`;
        section += `**Date Added:** ${metadata.item.dateAdded}\n\n`;
        section += `**Date Modified:** ${metadata.item.dateModified}\n\n`;
        
        return section;
    }

    /**
     * Create abstract section for markdown
     */
    createAbstractSection(abstractResult) {
        let section = '';
        
        if (abstractResult.abstract) {
            section += `## Extracted Abstract\n\n`;
            section += `**Extraction Method:** ${abstractResult.method}\n\n`;
            section += `**Confidence:** ${abstractResult.confidence}\n\n`;
            if (abstractResult.note) {
                section += `**Note:** ${abstractResult.note}\n\n`;
            }
            section += `**Abstract Text:**\n\n`;
            section += abstractResult.abstract + `\n\n`;
        } else {
            section += `## Abstract Extraction\n\n`;
            section += `**Status:** Failed to extract abstract\n\n`;
            section += `**Method Attempted:** ${abstractResult.method}\n\n`;
            if (abstractResult.error) {
                section += `**Error:** ${abstractResult.error}\n\n`;
            }
        }
        
        return section;
    }

    /**
     * Create processing information section
     */
    createProcessingInfoSection(currentDate, fullText, extractedPages, totalPages) {
        let section = `\n\n---\n\n## Processing Information\n\n`;
        section += `- **Processing Library:** Zotero PDFWorker\n`;
        section += `- **Processing Date:** ${currentDate}\n`;
        section += `- **Text Length:** ${fullText ? fullText.length : 0} characters\n`;
        section += `- **Success:** Text extraction ${fullText && fullText.trim() ? 'completed' : 'failed'}\n`;
        section += `- **PDF Library Used:** Zotero PDFWorker\n`;
        section += `- **Pages Processed:** ${extractedPages} of ${totalPages}\n`;
        
        return section;
    }

    /**
     * Create fallback content for failed processing
     */
    createFallbackContent(fileName, currentDate, error, metadata) {
        let fallbackContent = `# PDF Document: ${fileName} (Processing Failed)\n\n`;
        fallbackContent += `**File Path:** ${fileName}\n\n`;
        fallbackContent += `**Processed Date:** ${currentDate}\n\n`;
        fallbackContent += `**Status:** ❌ Processing Failed\n\n`;
        
        // Add basic metadata if available
        if (metadata && metadata.hierarchy) {
            fallbackContent += `**Library:** ${metadata.library.name}\n\n`;
            fallbackContent += `**Collection:** ${metadata.hierarchy.primaryCollection}\n\n`;
        }
        
        fallbackContent += `## Error Information\n\n`;
        fallbackContent += `**Error:** ${error.message}\n\n`;
        fallbackContent += `**Error Type:** ${error.name || 'Unknown'}\n\n`;
        
        return fallbackContent;
    }

    /**
     * Convert PDF content to markdown text using Zotero's PDFWorker (optimized version)
     * Extracts actual text content from PDF files using attachment item directly
     */
    async convertPDFToMarkdownByItem(attachmentItem, pdfFilePath) {
        try {
            Zotero.debug(`DeepTutorClaudeManagement: Starting PDF conversion for attachment item: ${attachmentItem.id}`);
            
            const fileName = this.pathBasename(pdfFilePath);
            const currentDate = new Date().toISOString();
            Zotero.debug(`DeepTutorClaudeManagement: File name: ${fileName}, Processing date: ${currentDate}`);
            
            // Check if PDFWorker is available
            if (!Zotero.PDFWorker) {
                throw new Error("Zotero PDFWorker is not available");
            }
            Zotero.debug("DeepTutorClaudeManagement: Zotero PDFWorker is available");
            
            // Use Zotero's PDFWorker to extract full text directly
            Zotero.debug(`DeepTutorClaudeManagement: Extracting full text using PDFWorker for item ${attachmentItem.id}...`);
            const extractionResult = await Zotero.PDFWorker.getFullText(attachmentItem.id);
            
            if (!extractionResult || !extractionResult.text) {
                throw new Error("PDFWorker returned no text content");
            }
            
            const fullText = extractionResult.text;
            const extractedPages = extractionResult.extractedPages || 'Unknown';
            const totalPages = extractionResult.totalPages || 'Unknown';
            
            Zotero.debug(`DeepTutorClaudeManagement: Text extraction successful - Length: ${fullText.length} characters`);
            Zotero.debug(`DeepTutorClaudeManagement: Pages extracted: ${extractedPages} of ${totalPages}`);
            
            // Get file size
            let fileSize = 0;
            try {
                const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
                file.initWithPath(pdfFilePath);
                fileSize = file.fileSize;
            } catch (e) {
                Zotero.debug(`DeepTutorClaudeManagement: Could not get file size: ${e.message}`);
            }
            
            // Try to get PDF metadata from the attachment item
            const pdfInfo = {};
            
            try {
                const title = attachmentItem.getField('title');
                if (title) pdfInfo.Title = title;
            } catch (e) { /* ignore */ }
            
            try {
                const parentItem = attachmentItem.parentItem;
                if (parentItem) {
                    const author = parentItem.getCreators().map(creator => `${creator.firstName} ${creator.lastName}`).join(', ');
                    if (author) pdfInfo.Author = author;
                    
                    const parentTitle = parentItem.getField('title');
                    if (parentTitle && parentTitle !== pdfInfo.Title) pdfInfo.ParentTitle = parentTitle;
                    
                    const date = parentItem.getField('date');
                    if (date) pdfInfo.Date = date;
                    
                    const publication = parentItem.getField('publicationTitle');
                    if (publication) pdfInfo.Publication = publication;
                    
                    const abstractNote = parentItem.getField('abstractNote');
                    if (abstractNote) pdfInfo.Abstract = abstractNote;
                }
            } catch (e) { /* ignore */ }
            
            // Create markdown content
            Zotero.debug("DeepTutorClaudeManagement: Creating markdown content...");
            let markdownContent = `# PDF Document: ${fileName}\n\n`;
            markdownContent += `**File Path:** ${pdfFilePath}\n\n`;
            markdownContent += `**Processed Date:** ${currentDate}\n\n`;
            markdownContent += `**File Size:** ${(fileSize / 1024).toFixed(2)} KB\n\n`;
            markdownContent += `**Total Pages:** ${totalPages}\n\n`;
            markdownContent += `**Extracted Pages:** ${extractedPages}\n\n`;
            markdownContent += `**PDF Library:** Zotero PDFWorker\n\n`;
            markdownContent += `**Attachment Item ID:** ${attachmentItem.id}\n\n`;
            
            // Add PDF info metadata if available
            if (Object.keys(pdfInfo).length > 0) {
                markdownContent += `## Document Information\n\n`;
                for (const [key, value] of Object.entries(pdfInfo)) {
                    if (value && value.toString().trim()) {
                        markdownContent += `**${key}:** ${value}\n\n`;
                    }
                }
            }
            
            // Add abstract section
            markdownContent = await this.addAbstractToMarkdown(attachmentItem, pdfFilePath, markdownContent);
            
            markdownContent += `---\n\n`;
            markdownContent += `## Extracted Text Content\n\n`;
            
            // Process and format the extracted text
            if (fullText && fullText.trim()) {
                // Clean up the text and format it properly
                const cleanedText = fullText
                    .replace(/\r\n/g, '\n') // Normalize line endings
                    .replace(/\r/g, '\n') // Normalize line endings
                    .replace(/\n{3,}/g, '\n\n') // Remove excessive blank lines
                    .trim();
                
                markdownContent += cleanedText;
            } else {
                markdownContent += `*No text content could be extracted from this PDF.*\n\n`;
                markdownContent += `This could be due to:\n`;
                markdownContent += `- The PDF contains only images/scanned content\n`;
                markdownContent += `- The PDF is password protected\n`;
                markdownContent += `- The PDF is corrupted or has no text layer\n`;
                markdownContent += `- Text extraction failed for unknown reasons\n`;
            }
            
            markdownContent += `\n\n---\n\n`;
            markdownContent += `## Processing Information\n\n`;
            markdownContent += `- **Processing Library:** Zotero PDFWorker\n`;
            markdownContent += `- **Processing Date:** ${currentDate}\n`;
            markdownContent += `- **Text Length:** ${fullText ? fullText.length : 0} characters\n`;
            markdownContent += `- **Success:** Text extraction ${fullText && fullText.trim() ? 'completed' : 'failed'}\n`;
            markdownContent += `- **PDF Library Used:** Zotero PDFWorker\n`;
            markdownContent += `- **Pages Processed:** ${extractedPages} of ${totalPages}\n`;

            Zotero.debug(`DeepTutorClaudeManagement: Markdown content created successfully - Length: ${markdownContent.length} characters`);
            Zotero.debug(`DeepTutorClaudeManagement: PDF conversion completed successfully for: ${fileName}`);
            
            return markdownContent;

        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error converting PDF to markdown: ${error.message}`);
            Zotero.debug(`DeepTutorClaudeManagement: Error stack: ${error.stack}`);
            Zotero.debug(`DeepTutorClaudeManagement: Creating fallback markdown content for failed PDF`);
            
            // Return a fallback markdown with error information
            const fileName = this.pathBasename(pdfFilePath);
            const currentDate = new Date().toISOString();
            
            let fallbackContent = `# PDF Document: ${fileName}\n\n`;
            fallbackContent += `**File Path:** ${pdfFilePath}\n\n`;
            fallbackContent += `**Processed Date:** ${currentDate}\n\n`;
            fallbackContent += `**Status:** ❌ Processing Failed\n\n`;
            fallbackContent += `## Error Information\n\n`;
            fallbackContent += `**Error:** ${error.message}\n\n`;
            fallbackContent += `**Error Type:** ${error.name || 'Unknown'}\n\n`;
            fallbackContent += `## Troubleshooting\n\n`;
            fallbackContent += `Possible causes for this error:\n`;
            fallbackContent += `- PDF file is corrupted or damaged\n`;
            fallbackContent += `- PDF is password protected\n`;
            fallbackContent += `- Insufficient permissions to read the file\n`;
            fallbackContent += `- Zotero PDFWorker is not available\n`;
            fallbackContent += `- Memory issues with large PDF files\n\n`;
            fallbackContent += `## Manual Processing Required\n\n`;
            fallbackContent += `This PDF needs manual review or alternative processing methods.\n`;

            Zotero.debug(`DeepTutorClaudeManagement: Fallback markdown content created - Length: ${fallbackContent.length} characters`);
            return fallbackContent;
        }
    }

    /**
     * Convert PDF content to markdown text using Zotero's PDFWorker (legacy method)
     * Extracts actual text content from PDF files using Zotero's built-in capabilities
     */
    async convertPDFToMarkdown(pdfFilePath) {
        try {
            Zotero.debug(`DeepTutorClaudeManagement: Starting PDF conversion for: ${pdfFilePath}`);
            
            const fileName = this.pathBasename(pdfFilePath);
            const currentDate = new Date().toISOString();
            Zotero.debug(`DeepTutorClaudeManagement: File name: ${fileName}, Processing date: ${currentDate}`);
            
            // Check if PDFWorker is available
            if (!Zotero.PDFWorker) {
                throw new Error("Zotero PDFWorker is not available");
            }
            Zotero.debug("DeepTutorClaudeManagement: Zotero PDFWorker is available");
            
            // First, we need to find the attachment item corresponding to this PDF file
            // We'll need to search for it by file path since we only have the path
            let attachmentItem = null;
            
            Zotero.debug("DeepTutorClaudeManagement: Searching for attachment item by file path...");
            const userLibID = (Zotero.Libraries && typeof Zotero.Libraries.userLibraryID !== 'undefined')
                ? Zotero.Libraries.userLibraryID
                : 1;
            const items = await Zotero.Items.getAll(userLibID);
            
            for (const item of items) {
                if (!item || !item.isAttachment()) continue;
                
                try {
                    let itemFilePath = null;
                    if (typeof item.getFilePathAsync === 'function') {
                        itemFilePath = await item.getFilePathAsync();
                    } else if (typeof item.getFilePath === 'function') {
                        itemFilePath = item.getFilePath();
                    }
                    
                    if (itemFilePath && itemFilePath === pdfFilePath) {
                        attachmentItem = item;
                        Zotero.debug(`DeepTutorClaudeManagement: Found matching attachment item: ${item.id}`);
                        break;
                    }
                } catch (e) {
                    // Continue searching if there's an error with this item
                    continue;
                }
            }
            
            if (!attachmentItem) {
                throw new Error(`Could not find attachment item for PDF file: ${pdfFilePath}`);
            }
            
            // Use Zotero's PDFWorker to extract full text
            Zotero.debug(`DeepTutorClaudeManagement: Extracting full text using PDFWorker for item ${attachmentItem.id}...`);
            const extractionResult = await Zotero.PDFWorker.getFullText(attachmentItem.id);
            
            if (!extractionResult || !extractionResult.text) {
                throw new Error("PDFWorker returned no text content");
            }
            
            const fullText = extractionResult.text;
            const extractedPages = extractionResult.extractedPages || 'Unknown';
            const totalPages = extractionResult.totalPages || 'Unknown';
            
            Zotero.debug(`DeepTutorClaudeManagement: Text extraction successful - Length: ${fullText.length} characters`);
            Zotero.debug(`DeepTutorClaudeManagement: Pages extracted: ${extractedPages} of ${totalPages}`);
            
            // Get file size
            let fileSize = 0;
            try {
                const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
                file.initWithPath(pdfFilePath);
                fileSize = file.fileSize;
            } catch (e) {
                Zotero.debug(`DeepTutorClaudeManagement: Could not get file size: ${e.message}`);
            }
            
            // Try to get PDF metadata from the attachment item
            const pdfInfo = {};
            
            try {
                const title = attachmentItem.getField('title');
                if (title) pdfInfo.Title = title;
            } catch (e) { /* ignore */ }
            
            try {
                const parentItem = attachmentItem.parentItem;
                if (parentItem) {
                    const author = parentItem.getCreators().map(creator => `${creator.firstName} ${creator.lastName}`).join(', ');
                    if (author) pdfInfo.Author = author;
                    
                    const parentTitle = parentItem.getField('title');
                    if (parentTitle && parentTitle !== pdfInfo.Title) pdfInfo.ParentTitle = parentTitle;
                    
                    const date = parentItem.getField('date');
                    if (date) pdfInfo.Date = date;
                    
                    const publication = parentItem.getField('publicationTitle');
                    if (publication) pdfInfo.Publication = publication;
                }
            } catch (e) { /* ignore */ }
            
            // Create markdown content
            Zotero.debug("DeepTutorClaudeManagement: Creating markdown content...");
            let markdownContent = `# PDF Document: ${fileName}\n\n`;
            markdownContent += `**File Path:** ${pdfFilePath}\n\n`;
            markdownContent += `**Processed Date:** ${currentDate}\n\n`;
            markdownContent += `**File Size:** ${(fileSize / 1024).toFixed(2)} KB\n\n`;
            markdownContent += `**Total Pages:** ${totalPages}\n\n`;
            markdownContent += `**Extracted Pages:** ${extractedPages}\n\n`;
            markdownContent += `**PDF Library:** Zotero PDFWorker\n\n`;
            markdownContent += `**Attachment Item ID:** ${attachmentItem.id}\n\n`;
            
            // Add PDF info metadata if available
            if (Object.keys(pdfInfo).length > 0) {
                markdownContent += `## Document Information\n\n`;
                for (const [key, value] of Object.entries(pdfInfo)) {
                    if (value && value.toString().trim()) {
                        markdownContent += `**${key}:** ${value}\n\n`;
                    }
                }
            }
            
            // Add abstract section
            markdownContent = await this.addAbstractToMarkdown(attachmentItem, pdfFilePath, markdownContent);
            
            markdownContent += `---\n\n`;
            markdownContent += `## Extracted Text Content\n\n`;
            
            // Process and format the extracted text
            if (fullText && fullText.trim()) {
                // Clean up the text and format it properly
                const cleanedText = fullText
                    .replace(/\r\n/g, '\n') // Normalize line endings
                    .replace(/\r/g, '\n') // Normalize line endings
                    .replace(/\n{3,}/g, '\n\n') // Remove excessive blank lines
                    .trim();
                
                markdownContent += cleanedText;
            } else {
                markdownContent += `*No text content could be extracted from this PDF.*\n\n`;
                markdownContent += `This could be due to:\n`;
                markdownContent += `- The PDF contains only images/scanned content\n`;
                markdownContent += `- The PDF is password protected\n`;
                markdownContent += `- The PDF is corrupted or has no text layer\n`;
                markdownContent += `- Text extraction failed for unknown reasons\n`;
            }
            
            markdownContent += `\n\n---\n\n`;
            markdownContent += `## Processing Information\n\n`;
            markdownContent += `- **Processing Library:** Zotero PDFWorker\n`;
            markdownContent += `- **Processing Date:** ${currentDate}\n`;
            markdownContent += `- **Text Length:** ${fullText ? fullText.length : 0} characters\n`;
            markdownContent += `- **Success:** Text extraction ${fullText && fullText.trim() ? 'completed' : 'failed'}\n`;
            markdownContent += `- **PDF Library Used:** Zotero PDFWorker\n`;
            markdownContent += `- **Pages Processed:** ${extractedPages} of ${totalPages}\n`;

            Zotero.debug(`DeepTutorClaudeManagement: Markdown content created successfully - Length: ${markdownContent.length} characters`);
            Zotero.debug(`DeepTutorClaudeManagement: PDF conversion completed successfully for: ${fileName}`);
            
            return markdownContent;

        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error converting PDF to markdown: ${error.message}`);
            Zotero.debug(`DeepTutorClaudeManagement: Error stack: ${error.stack}`);
            Zotero.debug(`DeepTutorClaudeManagement: Creating fallback markdown content for failed PDF`);
            
            // Return a fallback markdown with error information
            const fileName = this.pathBasename(pdfFilePath);
            const currentDate = new Date().toISOString();
            
            let fallbackContent = `# PDF Document: ${fileName}\n\n`;
            fallbackContent += `**File Path:** ${pdfFilePath}\n\n`;
            fallbackContent += `**Processed Date:** ${currentDate}\n\n`;
            fallbackContent += `**Status:** ❌ Processing Failed\n\n`;
            fallbackContent += `## Error Information\n\n`;
            fallbackContent += `**Error:** ${error.message}\n\n`;
            fallbackContent += `**Error Type:** ${error.name || 'Unknown'}\n\n`;
            fallbackContent += `## Troubleshooting\n\n`;
            fallbackContent += `Possible causes for this error:\n`;
            fallbackContent += `- PDF file is corrupted or damaged\n`;
            fallbackContent += `- PDF is password protected\n`;
            fallbackContent += `- Insufficient permissions to read the file\n`;
            fallbackContent += `- Zotero PDFWorker is not available\n`;
            fallbackContent += `- Memory issues with large PDF files\n`;
            fallbackContent += `- Could not find corresponding attachment item in library\n\n`;
            fallbackContent += `## Manual Processing Required\n\n`;
            fallbackContent += `This PDF needs manual review or alternative processing methods.\n`;

            Zotero.debug(`DeepTutorClaudeManagement: Fallback markdown content created - Length: ${fallbackContent.length} characters`);
            return fallbackContent;
        }
    }

    /**
     * Get information about PDF processing capabilities
     * Returns a formatted string with current setup information
     */
    getPDFProcessingInfo() {
        return `# PDF Processing Information

## Current Setup
- **PDF Processing Engine:** Zotero PDFWorker (built-in)
- **Text Extraction:** Native Zotero capabilities
- **No External Dependencies:** pdf-lib library no longer required

## Features
- Full text extraction from PDF documents
- Metadata extraction from Zotero items
- Markdown conversion with proper formatting
- Error handling and fallback content

## Advantages of Zotero PDFWorker
- **Reliability:** Uses Zotero's proven PDF processing engine
- **Performance:** Optimized for Zotero's workflow
- **Compatibility:** Works with all PDF types supported by Zotero
- **No Setup Required:** No external library installation needed
- **Consistent Results:** Same engine used throughout Zotero

## Troubleshooting
If PDF processing fails, it may be due to:
- Corrupted or password-protected PDFs
- PDFs with no text layer (image-only content)
- Insufficient memory for very large files
- File permission issues

## Processing Information
The system will automatically:
1. Locate the PDF attachment in your Zotero library
2. Extract full text using Zotero's PDFWorker
3. Gather metadata from the parent item
4. Generate formatted markdown content
5. Save the result to the DeepTutor database`;
    }

    /**
     * Test PDF parsing functionality
     * Returns detailed information about the current setup
     */
    async testPdfParsing() {
        Zotero.debug("DeepTutorClaudeManagement: Starting PDF parsing test...");
        
        const testResult = {
            pdfWorkerAvailable: this.isPDFWorkerAvailable(),
            dataDirectory: this.dataDirectory,
            deepTutorDBPath: this.deepTutorDBPath,
            processingInfo: this.getPDFProcessingInfo()
        };

        Zotero.debug(`DeepTutorClaudeManagement: Test results - PDFWorker available: ${testResult.pdfWorkerAvailable}`);
        Zotero.debug(`DeepTutorClaudeManagement: Test results - data directory: ${testResult.dataDirectory}`);
        Zotero.debug(`DeepTutorClaudeManagement: Test results - deepTutor DB path: ${testResult.deepTutorDBPath}`);

        if (!testResult.pdfWorkerAvailable) {
            testResult.error = "Zotero PDFWorker is not available";
            testResult.solution = "Ensure you're running this within Zotero with PDFWorker support";
            Zotero.debug("DeepTutorClaudeManagement: Test failed - Zotero PDFWorker not available");
        } else {
            Zotero.debug("DeepTutorClaudeManagement: Test passed - Zotero PDFWorker is available");
        }

        return testResult;
    }

    /**
     * Extract abstract from PDF using multiple fallback strategies
     * @param {Object} attachmentItem - Zotero attachment item
     * @param {string} pdfFilePath - Path to the PDF file
     * @returns {Object} Abstract extraction result with text, confidence, and method used
     */
    async extractAbstract(attachmentItem, pdfFilePath) {
        try {
            Zotero.debug(`DeepTutorClaudeManagement: Starting abstract extraction for item ${attachmentItem.id}`);
            
            // Strategy 1: Use getRecognizerData for enhanced text analysis (first/last 2 pages)
            let abstractResult = await this.extractAbstractWithRecognizer(attachmentItem);
            
            if (abstractResult.abstract) {
                Zotero.debug(`DeepTutorClaudeManagement: Abstract extracted using recognizer method - confidence: ${abstractResult.confidence}`);
                return abstractResult;
            }
            
            // Strategy 2: Fallback to first page content
            Zotero.debug("DeepTutorClaudeManagement: Falling back to first page extraction");
            abstractResult = await this.extractFirstPageAsAbstract(attachmentItem);
            
            if (abstractResult.abstract) {
                Zotero.debug(`DeepTutorClaudeManagement: Abstract extracted using first page method - confidence: ${abstractResult.confidence}`);
                return abstractResult;
            }
            
            // Strategy 3: DeepTutor API call (future implementation)
            // TODO: Implement API call to DeepTutor pipeline for advanced abstract extraction
            // abstractResult = await this.extractAbstractWithAPI(attachmentItem, pdfFilePath);
            
            Zotero.debug("DeepTutorClaudeManagement: No abstract could be extracted");
            return {
                abstract: null,
                confidence: 'none',
                method: 'failed',
                error: 'No extraction method successful'
            };
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error in abstract extraction: ${error.message}`);
            return {
                abstract: null,
                confidence: 'none',
                method: 'error',
                error: error.message
            };
        }
    }

    /**
     * Extract abstract using getRecognizerData for enhanced text analysis
     * Looks for keywords like "Abstract", "Summary", "Overview" in first/last 2 pages
     * @param {Object} attachmentItem - Zotero attachment item
     * @returns {Object} Abstract extraction result
     */
    async extractAbstractWithRecognizer(attachmentItem) {
        try {
            Zotero.debug(`DeepTutorClaudeManagement: Using recognizer data for abstract extraction`);
            
            // Get both full text and recognizer data
            const [fullTextResult, recognizerData] = await Promise.all([
                Zotero.PDFWorker.getFullText(attachmentItem.id),
                Zotero.PDFWorker.getRecognizerData(attachmentItem.id)
            ]);
            
            if (!fullTextResult || !fullTextResult.text) {
                throw new Error("No full text available");
            }
            
            const fullText = fullTextResult.text;
            
            // Abstract section keywords to look for
            const abstractKeywords = [
                'abstract',
                'summary', 
                'overview',
                'résumé',
                'resumen',
                'zusammenfassung',
                'abstract:', 
                'summary:',
                'overview:'
            ];
            
            let abstractText = null;
            let confidence = 'none';
            let method = 'recognizer';
            
            // Strategy 1A: Use recognizer data to find styled headers (if available)
            if (recognizerData && recognizerData.pages && recognizerData.pages.length > 0) {
                Zotero.debug("DeepTutorClaudeManagement: Analyzing recognizer data for styled headers");
                
                // Analyze first 2 pages and last 2 pages
                const totalPages = recognizerData.pages.length;
                const pagesToAnalyze = [];
                
                // Add first 2 pages
                for (let i = 0; i < Math.min(2, totalPages); i++) {
                    pagesToAnalyze.push({ index: i, page: recognizerData.pages[i] });
                }
                
                // Add last 2 pages (if different from first pages)
                for (let i = Math.max(2, totalPages - 2); i < totalPages; i++) {
                    if (!pagesToAnalyze.some(p => p.index === i)) {
                        pagesToAnalyze.push({ index: i, page: recognizerData.pages[i] });
                    }
                }
                
                for (const { index, page } of pagesToAnalyze) {
                    const [pageWidth, pageHeight, content] = page;
                    if (content && content[0] && content[0][0] && content[0][0][0]) {
                        const lines = content[0][0][0];
                        
                        // Look for abstract headers with styling
                        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                            const line = lines[lineIndex];
                            if (!Array.isArray(line)) continue;
                            
                            for (const word of line) {
                                if (!Array.isArray(word) || word.length < 14) continue;
                                
                                const [x, y, xMax, yMax, fontSize, spaceAfter, baseline, rotation, underlined, bold, italic, colorIndex, fontIndex, text] = word;
                                
                                if (text && typeof text === 'string') {
                                    const lowerText = text.toLowerCase().trim();
                                    
                                    // Check if this word matches our abstract keywords
                                    const matchedKeyword = abstractKeywords.find(keyword => 
                                        lowerText.includes(keyword.toLowerCase())
                                    );
                                    
                                    if (matchedKeyword) {
                                        Zotero.debug(`DeepTutorClaudeManagement: Found abstract keyword "${matchedKeyword}" on page ${index + 1} with fontSize: ${fontSize}, bold: ${bold}`);
                                        
                                        // Try to extract text following this header
                                        const extractedText = this.extractTextAfterKeyword(fullText, matchedKeyword);
                                        if (extractedText && extractedText.length > 50) {
                                            abstractText = extractedText;
                                            confidence = (bold || fontSize > 12) ? 'high' : 'medium';
                                            Zotero.debug(`DeepTutorClaudeManagement: Successfully extracted abstract using keyword "${matchedKeyword}"`);
                                            return { abstract: abstractText, confidence, method };
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            // Strategy 1B: Fallback to simple text pattern matching in full text
            if (!abstractText) {
                Zotero.debug("DeepTutorClaudeManagement: Falling back to text pattern matching");
                
                for (const keyword of abstractKeywords) {
                    const extractedText = this.extractTextAfterKeyword(fullText, keyword);
                    if (extractedText && extractedText.length > 50) {
                        abstractText = extractedText;
                        confidence = 'medium';
                        Zotero.debug(`DeepTutorClaudeManagement: Successfully extracted abstract using text pattern "${keyword}"`);
                        break;
                    }
                }
            }
            
            return {
                abstract: abstractText,
                confidence: abstractText ? confidence : 'none',
                method: abstractText ? method : 'failed'
            };
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error in recognizer-based extraction: ${error.message}`);
            return {
                abstract: null,
                confidence: 'none',
                method: 'error',
                error: error.message
            };
        }
    }

    /**
     * Extract text content after finding a specific keyword
     * @param {string} fullText - The full text content
     * @param {string} keyword - The keyword to search for
     * @returns {string|null} Extracted text after the keyword
     */
    extractTextAfterKeyword(fullText, keyword) {
        try {
            const lowerFullText = fullText.toLowerCase();
            const lowerKeyword = keyword.toLowerCase();
            
            // Find the keyword in the text
            const keywordIndex = lowerFullText.indexOf(lowerKeyword);
            if (keywordIndex === -1) {
                return null;
            }
            
            // Extract text starting after the keyword
            let startIndex = keywordIndex + keyword.length;
            
            // Skip any colons, spaces, or newlines immediately after the keyword
            while (startIndex < fullText.length && /[\s:.\-]/.test(fullText[startIndex])) {
                startIndex++;
            }
            
            // Find the end of the abstract section
            const afterKeyword = fullText.substring(startIndex);
            
            // Look for common section endings
            const sectionEndings = [
                /\n\s*\n\s*[A-Z][A-Z\s]{3,}/,  // Next major section (all caps)
                /\n\s*\n\s*\d+\.\s*[A-Z]/,      // Numbered section
                /\n\s*\n\s*[IVX]+\.\s*[A-Z]/,   // Roman numeral section
                /\nKeywords?\s*[:]/i,           // Keywords section
                /\nIntroduction\s*\n/i,         // Introduction section
                /\n1\.\s*Introduction/i,       // Numbered Introduction
                /\nI\.\s*Introduction/i        // Roman numeral Introduction
            ];
            
            let endIndex = afterKeyword.length;
            
            for (const pattern of sectionEndings) {
                const match = afterKeyword.search(pattern);
                if (match !== -1 && match < endIndex) {
                    endIndex = match;
                }
            }
            
            // If no clear section ending found, limit to reasonable abstract length
            if (endIndex === afterKeyword.length) {
                endIndex = Math.min(1500, afterKeyword.length); // Max 1500 characters
            }
            
            let extractedText = afterKeyword.substring(0, endIndex).trim();
            
            // Clean up the extracted text
            extractedText = extractedText
                .replace(/\n{3,}/g, '\n\n')     // Remove excessive line breaks
                .replace(/\s{2,}/g, ' ')        // Remove excessive spaces
                .trim();
            
            // Validate the extracted text
            if (extractedText.length < 50) {
                return null; // Too short to be a meaningful abstract
            }
            
            if (extractedText.length > 2000) {
                // Truncate if too long
                extractedText = extractedText.substring(0, 2000) + '...';
            }
            
            return extractedText;
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error extracting text after keyword: ${error.message}`);
            return null;
        }
    }

    /**
     * Fallback method: Extract first page content as abstract
     * @param {Object} attachmentItem - Zotero attachment item
     * @returns {Object} Abstract extraction result
     */
    async extractFirstPageAsAbstract(attachmentItem) {
        try {
            Zotero.debug("DeepTutorClaudeManagement: Extracting first page as abstract");
            
            // Get full text with page limit
            const fullTextResult = await Zotero.PDFWorker.getFullText(attachmentItem.id, 1); // Only first page
            
            if (!fullTextResult || !fullTextResult.text) {
                throw new Error("No text content available from first page");
            }
            
            let firstPageText = fullTextResult.text.trim();
            
            // Clean up the first page text
            firstPageText = firstPageText
                .replace(/\n{3,}/g, '\n\n')     // Remove excessive line breaks
                .replace(/\s{2,}/g, ' ')        // Remove excessive spaces
                .trim();
            
            // Limit length for abstract
            if (firstPageText.length > 1000) {
                // Try to find a natural break point
                const sentences = firstPageText.split(/[.!?]+/);
                let truncatedText = '';
                
                for (const sentence of sentences) {
                    if ((truncatedText + sentence).length < 1000) {
                        truncatedText += sentence + '.';
                    } else {
                        break;
                    }
                }
                
                if (truncatedText.length > 100) {
                    firstPageText = truncatedText.trim();
                } else {
                    // Fallback to simple truncation
                    firstPageText = firstPageText.substring(0, 1000) + '...';
                }
            }
            
            return {
                abstract: firstPageText,
                confidence: 'low',
                method: 'first_page',
                note: 'Using first page content as abstract fallback'
            };
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error in first page extraction: ${error.message}`);
            return {
                abstract: null,
                confidence: 'none',
                method: 'error',
                error: error.message
            };
        }
    }

    /**
     * Future implementation: Extract abstract using DeepTutor API
     * @param {Object} attachmentItem - Zotero attachment item  
     * @param {string} pdfFilePath - Path to the PDF file
     * @returns {Object} Abstract extraction result
     */
    /*
    async extractAbstractWithAPI(attachmentItem, pdfFilePath) {
        try {
            Zotero.debug("DeepTutorClaudeManagement: Using DeepTutor API for abstract extraction");
            
            // TODO: Implement API call to DeepTutor pipeline
            // This would involve:
            // 1. Sending PDF content or text to DeepTutor API
            // 2. Receiving structured abstract extraction
            // 3. Processing API response
            
            const apiResult = {
                abstract: null,
                confidence: 'none',
                method: 'api',
                error: 'API implementation pending'
            };
            
            return apiResult;
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error in API-based extraction: ${error.message}`);
            return {
                abstract: null,
                confidence: 'none', 
                method: 'error',
                error: error.message
            };
        }
    }
    */

    /**
     * Add abstract section to markdown content
     * @param {Object} attachmentItem - Zotero attachment item
     * @param {string} pdfFilePath - Path to the PDF file
     * @param {string} markdownContent - Existing markdown content to append to
     * @returns {string} Updated markdown content with abstract section
     */
    async addAbstractToMarkdown(attachmentItem, pdfFilePath, markdownContent) {
        try {
            Zotero.debug("DeepTutorClaudeManagement: Adding abstract section to markdown...");
            
            const abstractResult = await this.extractAbstract(attachmentItem, pdfFilePath);
            
            if (abstractResult.abstract) {
                markdownContent += `## Extracted Abstract\n\n`;
                markdownContent += `**Extraction Method:** ${abstractResult.method}\n\n`;
                markdownContent += `**Confidence:** ${abstractResult.confidence}\n\n`;
                if (abstractResult.note) {
                    markdownContent += `**Note:** ${abstractResult.note}\n\n`;
                }
                markdownContent += `**Abstract Text:**\n\n`;
                markdownContent += abstractResult.abstract + `\n\n`;
                Zotero.debug(`DeepTutorClaudeManagement: Successfully added abstract (${abstractResult.method}, confidence: ${abstractResult.confidence})`);
            } else {
                markdownContent += `## Abstract Extraction\n\n`;
                markdownContent += `**Status:** Failed to extract abstract\n\n`;
                markdownContent += `**Method Attempted:** ${abstractResult.method}\n\n`;
                if (abstractResult.error) {
                    markdownContent += `**Error:** ${abstractResult.error}\n\n`;
                }
                Zotero.debug(`DeepTutorClaudeManagement: Abstract extraction failed: ${abstractResult.error || 'unknown error'}`);
            }
            
            return markdownContent;
            
        } catch (abstractError) {
            markdownContent += `## Abstract Extraction\n\n`;
            markdownContent += `**Status:** Error during abstract extraction\n\n`;
            markdownContent += `**Error:** ${abstractError.message}\n\n`;
            Zotero.debug(`DeepTutorClaudeManagement: Abstract extraction error: ${abstractError.message}`);
            return markdownContent;
        }
    }

    /**
     * Test PDF conversion with a sample PDF from the library
     * Returns the result of attempting to convert the first available PDF
     */
    async testPdfConversion() {
        try {
            Zotero.debug("DeepTutorClaudeManagement: Starting PDF conversion test...");
            
            // Find the first PDF attachment in the library
            const userLibID = (Zotero.Libraries && typeof Zotero.Libraries.userLibraryID !== 'undefined')
                ? Zotero.Libraries.userLibraryID
                : 1;
            const items = await Zotero.Items.getAll(userLibID);
            
            let testAttachment = null;
            for (const item of items) {
                if (item && item.isAttachment && item.isAttachment() && item.isPDFAttachment && item.isPDFAttachment()) {
                    testAttachment = item;
                    break;
                }
            }
            
            if (!testAttachment) {
                return {
                    success: false,
                    error: "No PDF attachments found in library for testing",
                    suggestion: "Add a PDF to your library and try again"
                };
            }
            
            Zotero.debug(`DeepTutorClaudeManagement: Testing with PDF attachment ${testAttachment.id}`);
            
            // Get file path
            let pdfFilePath = null;
            try {
                if (typeof testAttachment.getFilePathAsync === 'function') {
                    pdfFilePath = await testAttachment.getFilePathAsync();
                } else if (typeof testAttachment.getFilePath === 'function') {
                    pdfFilePath = testAttachment.getFilePath();
                }
            } catch (e) {
                return {
                    success: false,
                    error: `Could not get file path: ${e.message}`,
                    attachmentId: testAttachment.id
                };
            }
            
            if (!pdfFilePath) {
                return {
                    success: false,
                    error: "No file path returned for test attachment",
                    attachmentId: testAttachment.id
                };
            }
            
            // Test the conversion
            const startTime = Date.now();
            const markdownContent = await this.convertPDFToMarkdownByItem(testAttachment, pdfFilePath);
            const endTime = Date.now();
            
            const processingTime = endTime - startTime;
            
            return {
                success: true,
                attachmentId: testAttachment.id,
                filePath: pdfFilePath,
                markdownLength: markdownContent.length,
                processingTime: processingTime,
                containsText: markdownContent.includes('## Extracted Text Content'),
                hasErrorMessage: markdownContent.includes('❌ Processing Failed'),
                preview: markdownContent.substring(0, 200) + '...'
            };
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: PDF conversion test failed: ${error.message}`);
            return {
                success: false,
                error: error.message,
                errorType: error.name || 'Unknown'
            };
        }
    }

    // Removed legacy File/Components-based helpers in favor of IOUtils/PathUtils
    // Simple path helpers using nsIFile (Components) to avoid ChromeUtils dependencies
    pathJoin(base, leaf) {
        try {
            const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
            file.initWithPath(base);
            file.append(leaf);
            return file.path;
        } catch (e) {
            const sep = (Zotero.isWin ? "\\" : "/");
            return (base.endsWith(sep) ? base.slice(0, -1) : base) + sep + leaf;
        }
    }

    pathExists(path) {
        try {
            const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
            file.initWithPath(path);
            return file.exists();
        } catch (e) {
            return false;
        }
    }

    createDirectory(path) {
        const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
        file.initWithPath(path);
        if (!file.exists()) {
            // 0o755 permissions
            file.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
        }
    }

    readBinaryFile(path) {
        let file = null;
        let fis = null;
        let bis = null;
        
        try {
            // Validate input path
            if (!path || typeof path !== 'string') {
                throw new Error(`Invalid path: ${path}`);
            }
            
            // Create file object
            file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
            file.initWithPath(path);
            
            if (!file.exists()) {
                throw new Error(`File does not exist: ${path}`);
            }
            
            // Get file size first
            const fileSize = file.fileSize;
            Zotero.debug(`DeepTutorClaudeManagement: File size: ${fileSize} bytes`);
            
            if (fileSize <= 0) {
                throw new Error(`File is empty or invalid: ${path}`);
            }
            
            // Check file size limit (100MB) to prevent memory issues
            const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
            if (fileSize > MAX_FILE_SIZE) {
                throw new Error(`File too large: ${(fileSize / (1024 * 1024)).toFixed(2)}MB (max: 100MB)`);
            }
            
            // Create input stream
            fis = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
            fis.init(file, 0x01, 0o444, 0);
            
            // Create binary input stream
            bis = Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);
            bis.setInputStream(fis);
            
            const available = bis.available();
            Zotero.debug(`DeepTutorClaudeManagement: Stream available: ${available} bytes`);
            
            if (available !== fileSize) {
                Zotero.debug(`DeepTutorClaudeManagement: Warning: Stream size (${available}) differs from file size (${fileSize})`);
            }
            
            // Read the entire file at once (safer for smaller files)
            const bytes = bis.readByteArray(available);
            Zotero.debug(`DeepTutorClaudeManagement: Read ${bytes.length} bytes from stream`);
            
            // Create Uint8Array from the bytes
            const buffer = new Uint8Array(bytes);
            
            Zotero.debug(`DeepTutorClaudeManagement: Created buffer of size: ${buffer.byteLength} bytes`);
            Zotero.debug(`DeepTutorClaudeManagement: Buffer type: ${buffer.constructor.name}`);
            Zotero.debug(`DeepTutorClaudeManagement: Buffer is Uint8Array: ${buffer instanceof Uint8Array}`);
            Zotero.debug(`DeepTutorClaudeManagement: Buffer length: ${buffer.length}`);
            
            // Validate the buffer
            if (buffer.byteLength === 0 || buffer.length === 0) {
                throw new Error(`Buffer creation failed: buffer is empty`);
            }
            
            // Basic validation - check first few bytes for PDF signature
            if (buffer.length >= 4) {
                const signature = String.fromCharCode(buffer[0], buffer[1], buffer[2], buffer[3]);
                Zotero.debug(`DeepTutorClaudeManagement: File signature: ${signature}`);
                if (signature !== '%PDF') {
                    Zotero.debug(`DeepTutorClaudeManagement: Warning: File does not appear to be a valid PDF (signature: ${signature})`);
                }
            }
            
            return buffer;
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error reading binary file: ${error.message}`);
            throw error;
        } finally {
            // Always close streams to prevent resource leaks
            try {
                if (bis) {
                    bis.close();
                }
            } catch (e) {
                Zotero.debug(`DeepTutorClaudeManagement: Error closing binary input stream: ${e.message}`);
            }
            
            try {
                if (fis) {
                    fis.close();
                }
            } catch (e) {
                Zotero.debug(`DeepTutorClaudeManagement: Error closing file input stream: ${e.message}`);
            }
        }
    }

    writeTextFile(path, text) {
        const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
        file.initWithPath(path);
        const parent = file.parent;
        if (parent && !parent.exists()) parent.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
        const fos = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
        // flags: write|create|truncate
        fos.init(file, 0x02 | 0x08 | 0x20, 0o644, 0);
        const cos = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
        cos.init(fos, "UTF-8", 0, 0);
        cos.writeString(text);
        cos.close();
        fos.close();
    }

    pathBasename(path) {
        try {
            const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
            file.initWithPath(path);
            return file.leafName;
        } catch (e) {
            const sep = (Zotero.isWin ? "\\" : "/");
            const parts = path.split(sep);
            return parts[parts.length - 1] || path;
        }
    }
}

// Export the class for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeepTutorClaudeManagement;
}
