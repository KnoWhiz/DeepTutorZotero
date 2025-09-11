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
        
        // Configuration options
        this.useEnhancedHierarchy = true; // Use enhanced hierarchy generation by default
        this.enableSQLFallbacks = true; // Enable SQL fallbacks for better reliability
        this.useSQLBasedHierarchy = true; // Use SQL-based hierarchy generation as primary method
        
        // Metadata tracking to avoid repetitive work
        this.metadataCache = new Map(); // Cache for PDF metadata
        this.abstractCache = new Map(); // Cache for PDF abstracts
        this.hierarchyCache = null; // Cache for file hierarchy
        
        // Set up global error handling to prevent crashes
        this.setupErrorHandling();
    }
    
    /**
     * Configure hierarchy generation settings
     * @param {Object} options - Configuration options
     * @param {boolean} options.useEnhancedHierarchy - Whether to use enhanced hierarchy generation
     * @param {boolean} options.enableSQLFallbacks - Whether to enable SQL fallbacks
     * @param {boolean} options.useSQLBasedHierarchy - Whether to use SQL-based hierarchy generation as primary method
     */
    configureHierarchyGeneration(options = {}) {
        if (options.hasOwnProperty('useEnhancedHierarchy')) {
            this.useEnhancedHierarchy = options.useEnhancedHierarchy;
            Zotero.debug(`DeepTutorClaudeManagement: Enhanced hierarchy generation ${this.useEnhancedHierarchy ? 'enabled' : 'disabled'}`);
        }
        
        if (options.hasOwnProperty('enableSQLFallbacks')) {
            this.enableSQLFallbacks = options.enableSQLFallbacks;
            Zotero.debug(`DeepTutorClaudeManagement: SQL fallbacks ${this.enableSQLFallbacks ? 'enabled' : 'disabled'}`);
        }
        
        if (options.hasOwnProperty('useSQLBasedHierarchy')) {
            this.useSQLBasedHierarchy = options.useSQLBasedHierarchy;
            Zotero.debug(`DeepTutorClaudeManagement: SQL-based hierarchy generation ${this.useSQLBasedHierarchy ? 'enabled' : 'disabled'}`);
        }
        
        // Clear cache when configuration changes
        this.hierarchyCache = null;
    }

    /**
     * Get current hierarchy generation configuration
     * @returns {Object} Current configuration
     */
    getHierarchyConfiguration() {
        return {
            useEnhancedHierarchy: this.useEnhancedHierarchy,
            enableSQLFallbacks: this.enableSQLFallbacks,
            useSQLBasedHierarchy: this.useSQLBasedHierarchy,
            description: this.useSQLBasedHierarchy 
                ? "Using SQL-based hierarchy generation as primary method" 
                : this.useEnhancedHierarchy 
                    ? "Using enhanced hierarchy generation with SQL fallbacks" 
                    : "Using original hierarchy generation method"
        };
    }

    /**
     * Test and compare all hierarchy generation methods
     * @returns {Object} Comparison results
     */
    async testHierarchyMethods() {
        try {
            Zotero.debug("DeepTutorClaudeManagement: Testing all hierarchy generation methods...");
            
            const results = {
                timestamp: new Date().toISOString(),
                original: null,
                enhanced: null,
                sql: null,
                comparison: {}
            };
            
            // Test SQL-based method
            try {
                const startTime = Date.now();
                results.sql = await this.generateFileHierarchySQL();
                const sqlTime = Date.now() - startTime;
                results.comparison.sqlTime = sqlTime;
                results.comparison.sqlSuccess = true;
                Zotero.debug(`DeepTutorClaudeManagement: SQL-based method completed in ${sqlTime}ms`);
            } catch (error) {
                results.comparison.sqlSuccess = false;
                results.comparison.sqlError = error.message;
                Zotero.debug(`DeepTutorClaudeManagement: SQL-based method failed: ${error.message}`);
            }
            
            // Test original method
            try {
                const startTime = Date.now();
                results.original = await this.generateFileHierarchy();
                const originalTime = Date.now() - startTime;
                results.comparison.originalTime = originalTime;
                results.comparison.originalSuccess = true;
                Zotero.debug(`DeepTutorClaudeManagement: Original method completed in ${originalTime}ms`);
            } catch (error) {
                results.comparison.originalSuccess = false;
                results.comparison.originalError = error.message;
                Zotero.debug(`DeepTutorClaudeManagement: Original method failed: ${error.message}`);
            }
            
            // Test enhanced method
            try {
                const startTime = Date.now();
                results.enhanced = await this.generateFileHierarchyEnhanced();
                const enhancedTime = Date.now() - startTime;
                results.comparison.enhancedTime = enhancedTime;
                results.comparison.enhancedSuccess = true;
                Zotero.debug(`DeepTutorClaudeManagement: Enhanced method completed in ${enhancedTime}ms`);
            } catch (error) {
                results.comparison.enhancedSuccess = false;
                results.comparison.enhancedError = error.message;
                Zotero.debug(`DeepTutorClaudeManagement: Enhanced method failed: ${error.message}`);
            }
            
            // Generate comparison summary
            const successfulMethods = [];
            if (results.comparison.sqlSuccess) successfulMethods.push({ name: 'SQL-based', time: results.comparison.sqlTime });
            if (results.comparison.originalSuccess) successfulMethods.push({ name: 'Original', time: results.comparison.originalTime });
            if (results.comparison.enhancedSuccess) successfulMethods.push({ name: 'Enhanced', time: results.comparison.enhancedTime });
            
            if (successfulMethods.length > 0) {
                successfulMethods.sort((a, b) => a.time - b.time);
                results.comparison.summary = `${successfulMethods.length} method(s) succeeded. Fastest: ${successfulMethods[0].name} (${successfulMethods[0].time}ms)`;
                results.comparison.recommendation = `Use ${successfulMethods[0].name} method for best performance`;
            } else {
                results.comparison.summary = "All methods failed";
                results.comparison.recommendation = "Check system configuration";
            }
            
            // Save test results
            const testResultsPath = this.pathJoin(this.fileTreePath, 'hierarchy_method_comparison.json');
            this.writeTextFile(testResultsPath, JSON.stringify(results, null, 2));
            
            Zotero.debug(`DeepTutorClaudeManagement: Hierarchy method comparison completed: ${results.comparison.summary}`);
            return results;
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error testing hierarchy methods: ${error.message}`);
            throw error;
        }
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

    // saveFileHierarchyData method removed - using comprehensive hierarchy generation instead

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
                // New file naming - only fulltext since summary is commented off
                const markdownFulltextFileName = `${pdfItem.itemID}_fulltext.md`;
                const markdownSummaryFileName = `${pdfItem.itemID}_summary.md`;
                const markdownFulltextFilePath = this.pathJoin(this.rawDocDataPath, markdownFulltextFileName);
                const markdownSummaryFilePath = this.pathJoin(this.rawDocDataPath, markdownSummaryFileName);

                Zotero.debug(`DeepTutorClaudeManagement: Processing PDF item ${pdfItem.itemID} (${processedCount + 1}/${pdfItems.length})`);

                // Check if markdown files already exist (only check fulltext since summary is commented off)
                const fulltextExists = this.pathExists(markdownFulltextFilePath);
                if (fulltextExists) {
                    Zotero.debug(`DeepTutorClaudeManagement: Fulltext markdown for item ${pdfItem.itemID} already exists, skipping`);
                    skippedCount++;
                    continue;
                }

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
                    
                    // Save summary markdown (only if not empty - currently commented off)
                    if (summaryMarkdown && summaryMarkdown.trim()) {
                        this.writeTextFile(markdownSummaryFilePath, summaryMarkdown);
                        Zotero.debug(`DeepTutorClaudeManagement: Summary markdown saved: ${markdownSummaryFilePath}`);
                    } else {
                        Zotero.debug(`DeepTutorClaudeManagement: Summary markdown is empty, skipping save`);
                    }

                    // Note: Individual file hierarchy data is no longer saved here
                    // Complete hierarchy mapping is generated at the end of processing

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
            
            // Generate comprehensive summary after processing all PDFs
            try {
                Zotero.debug("DeepTutorClaudeManagement: Generating comprehensive summary...");
                await this.generateComprehensiveSummary();
                Zotero.debug("DeepTutorClaudeManagement: Comprehensive summary generated successfully");
            } catch (summaryError) {
                Zotero.debug(`DeepTutorClaudeManagement: Error generating comprehensive summary: ${summaryError.message}`);
            }
            
            // Generate complete file hierarchy mapping using smart method
            try {
                Zotero.debug("DeepTutorClaudeManagement: Generating complete file hierarchy using smart method...");
                await this.generateFileHierarchySmart();
                Zotero.debug("DeepTutorClaudeManagement: File hierarchy generated successfully");
            } catch (hierarchyError) {
                Zotero.debug(`DeepTutorClaudeManagement: Error generating file hierarchy: ${hierarchyError.message}`);
            }
            
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
     * Check if an attachment is a PDF file
     * @param {Object} attachment - Zotero attachment item
     * @returns {boolean} True if the attachment is a PDF
     */
    isPDFAttachment(attachment) {
        try {
            if (!attachment || !attachment.isAttachment || !attachment.isAttachment()) {
                return false;
            }
            
            // Check using Zotero's built-in method first
            if (attachment.isPDFAttachment && attachment.isPDFAttachment()) {
                return true;
            }
            
            // Fallback: check MIME type and filename
            const mime = String(attachment.attachmentContentType || attachment.attachmentMIMEType || '').toLowerCase();
            const filename = String(attachment.attachmentFilename || '');
            
            return mime.includes('pdf') || /\.pdf$/i.test(filename);
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error checking PDF attachment: ${error.message}`);
            return false;
        }
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
            
            // Extract abstract (for comprehensive summary, not for individual files)
            const abstractResult = await this.extractAbstract(attachmentItem, pdfFilePath);
            
            // Store abstract in cache for comprehensive summary
            this.abstractCache.set(attachmentItem.id, abstractResult);
            
            // Create minimal metadata section for raw doc (only key metadata and process data)
            const rawDocMetadataSection = this.createRawDocMetadataSection(comprehensiveMetadata, fileName, currentDate, fileSize, totalPages, extractedPages);
            
            // Build fulltext markdown (raw doc - only key metadata, process data, and full text)
            let fulltextMarkdown = `# PDF Document: ${fileName}\n\n`;
            fulltextMarkdown += rawDocMetadataSection;
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
            
            // Build summary markdown (commented off to save space - only metadata and abstract)
            // let summaryMarkdown = `# PDF Document: ${fileName} (Summary)\n\n`;
            // summaryMarkdown += rawDocMetadataSection;
            // summaryMarkdown += `---\n\n## Document Abstract\n\n`;
            // if (abstractResult.abstract) {
            //     summaryMarkdown += `**Abstract:**\n\n`;
            //     summaryMarkdown += abstractResult.abstract + `\n\n`;
            // } else {
            //     summaryMarkdown += `*No abstract could be extracted from this PDF.*\n\n`;
            // }
            // summaryMarkdown += this.createProcessingInfoSection(currentDate, fullText, extractedPages, totalPages);
            
            // Return empty summary markdown since it's commented off
            const summaryMarkdown = '';
            
            Zotero.debug(`DeepTutorClaudeManagement: Enhanced PDF conversion completed successfully`);
            
            return {
                fulltextMarkdown: fulltextMarkdown,
                summaryMarkdown: summaryMarkdown,
                abstractResult: abstractResult,
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
                summaryMarkdown: '',
                abstractResult: { abstract: null, confidence: 'none', error: error.message },
                metadata: comprehensiveMetadata
            };
        }
    }

    /**
     * Create raw document metadata section (minimal - only key metadata and process data)
     */
    createRawDocMetadataSection(metadata, fileName, currentDate, fileSize, totalPages, extractedPages) {
        let section = `**File Path:** ${fileName}\n\n`;
        section += `**Processed Date:** ${currentDate}\n\n`;
        section += `**File Size:** ${(fileSize / 1024).toFixed(2)} KB\n\n`;
        section += `**Total Pages:** ${totalPages}\n\n`;
        section += `**Extracted Pages:** ${extractedPages}\n\n`;
        section += `**PDF Library:** Zotero PDFWorker\n\n`;
        section += `**Attachment Item ID:** ${metadata.item.id}\n\n`;
        
        // Only essential metadata
        if (metadata.parent.title) {
            section += `**Title:** ${metadata.parent.title}\n\n`;
        }
        
        if (metadata.parent.authorsString) {
            section += `**Authors:** ${metadata.parent.authorsString}\n\n`;
        }
        
        if (metadata.hierarchy.primaryCollection) {
            section += `**Collection:** ${metadata.hierarchy.primaryCollection}\n\n`;
        }
        
        return section;
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

    // Legacy method removed - using the main extractAbstract method instead

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
            Zotero.debug("DeepTutorClaudeManagement: Extracting first 1.5-2 pages as abstract");
            
            // Try to get 2 pages first, then fall back to 1.5 if needed
            let fullTextResult = await Zotero.PDFWorker.getFullText(attachmentItem.id, 2); // Try 2 pages
            
            if (!fullTextResult || !fullTextResult.text) {
                // Fallback to 1.5 pages
                Zotero.debug("DeepTutorClaudeManagement: 2 pages not available, trying 1.5 pages");
                fullTextResult = await Zotero.PDFWorker.getFullText(attachmentItem.id, 1.5);
                
                if (!fullTextResult || !fullTextResult.text) {
                    // Final fallback to 1 page
                    Zotero.debug("DeepTutorClaudeManagement: 1.5 pages not available, falling back to 1 page");
                    fullTextResult = await Zotero.PDFWorker.getFullText(attachmentItem.id, 1);
                    
                    if (!fullTextResult || !fullTextResult.text) {
                        throw new Error("No text content available from first page");
                    }
                }
            }
            
            let extractedText = fullTextResult.text.trim();
            
            // Clean up the extracted text
            extractedText = extractedText
                .replace(/\r\n/g, '\n')         // Normalize line endings
                .replace(/\r/g, '\n')           // Normalize line endings
                .replace(/\n{3,}/g, '\n\n')     // Remove excessive line breaks
                .replace(/\s{2,}/g, ' ')        // Remove excessive spaces
                .trim();
            
            // Determine the actual pages extracted
            const extractedPages = fullTextResult.extractedPages || 'Unknown';
            const totalPages = fullTextResult.totalPages || 'Unknown';
            
            // Much more merciful length constraint for abstracts (allowing up to 8000 characters for 1.5-2 pages)
            if (extractedText.length > 8000) {
                // Try to find a natural break point
                const sentences = extractedText.split(/[.!?]+/);
                let truncatedText = '';
                
                for (const sentence of sentences) {
                    if ((truncatedText + sentence).length < 8000) {
                        truncatedText += sentence + '.';
                    } else {
                        break;
                    }
                }
                
                if (truncatedText.length > 500) {
                    extractedText = truncatedText.trim();
                } else {
                    // Fallback to simple truncation
                    extractedText = extractedText.substring(0, 8000) + '...';
                }
            }
            
            // Determine method used based on pages extracted
            let method = 'first_page';
            let note = 'Using first page content as abstract fallback';
            
            if (extractedPages === 2 || extractedPages === '2') {
                method = 'first_two_pages';
                note = 'Using first 2 pages content as abstract fallback';
            } else if (extractedPages === 1.5 || extractedPages === '1.5') {
                method = 'first_one_and_half_pages';
                note = 'Using first 1.5 pages content as abstract fallback';
            } else if (extractedPages === 1 || extractedPages === '1') {
                method = 'first_page';
                note = 'Using first page content as abstract fallback';
            }
            
            Zotero.debug(`DeepTutorClaudeManagement: Successfully extracted ${extractedPages} pages (${extractedText.length} characters)`);
            
            return {
                abstract: extractedText,
                confidence: 'low',
                method: method,
                note: note,
                pagesExtracted: extractedPages,
                totalPages: totalPages
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
     * Extract abstract from PDF using multiple strategies
     * @param {Object} attachmentItem - Zotero attachment item
     * @param {string} pdfFilePath - Path to the PDF file
     * @returns {Object} Abstract extraction result
     */
    async extractAbstract(attachmentItem, pdfFilePath) {
        try {
            Zotero.debug(`DeepTutorClaudeManagement: Starting abstract extraction for attachment ${attachmentItem.id}`);
            
            // Strategy 1: Try to get abstract from parent item metadata
            try {
                const parentItem = attachmentItem.parentItem;
                if (parentItem && parentItem.getField) {
                    const abstractNote = parentItem.getField('abstractNote');
                    if (abstractNote && abstractNote.trim()) {
                        Zotero.debug("DeepTutorClaudeManagement: Found abstract in parent item metadata");
                        return {
                            abstract: abstractNote.trim(),
                            confidence: 'high',
                            method: 'metadata',
                            note: 'Extracted from Zotero item metadata'
                        };
                    }
                }
            } catch (e) {
                Zotero.debug(`DeepTutorClaudeManagement: Error checking parent metadata: ${e.message}`);
            }
            
            // Strategy 2: Try to extract from first page content
            try {
                const firstPageResult = await this.extractFirstPageAsAbstract(attachmentItem);
                if (firstPageResult.abstract) {
                    Zotero.debug("DeepTutorClaudeManagement: Successfully extracted abstract from first page");
                    return firstPageResult;
                }
            } catch (e) {
                Zotero.debug(`DeepTutorClaudeManagement: Error in first page extraction: ${e.message}`);
            }
            
            // Strategy 3: Try to extract using recognizer-based approach
            try {
                const recognizerResult = await this.extractAbstractWithRecognizer(attachmentItem, pdfFilePath);
                if (recognizerResult.abstract) {
                    Zotero.debug("DeepTutorClaudeManagement: Successfully extracted abstract using recognizer");
                    return recognizerResult;
                }
            } catch (e) {
                Zotero.debug(`DeepTutorClaudeManagement: Error in recognizer extraction: ${e.message}`);
            }
            
            // All strategies failed
            Zotero.debug("DeepTutorClaudeManagement: All abstract extraction strategies failed");
            return {
                abstract: null,
                confidence: 'none',
                method: 'failed',
                note: 'All extraction strategies failed'
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
     * Extract abstract using recognizer-based approach
     * @param {Object} attachmentItem - Zotero attachment item
     * @param {string} pdfFilePath - Path to the PDF file
     * @returns {Object} Abstract extraction result
     */
    async extractAbstractWithRecognizer(attachmentItem, pdfFilePath) {
        try {
            Zotero.debug("DeepTutorClaudeManagement: Using recognizer-based abstract extraction");
            
            // Get full text to analyze
            const extractionResult = await Zotero.PDFWorker.getFullText(attachmentItem.id);
            if (!extractionResult || !extractionResult.text) {
                throw new Error("No text content available for recognizer analysis");
            }
            
            const fullText = extractionResult.text;
            
            // Simple keyword-based abstract extraction
            const abstractKeywords = [
                'abstract',
                'summary', 
                'overview',
                'résumé',
                'resumen',
                'zusammenfassung'
            ];
            
            for (const keyword of abstractKeywords) {
                const extractedText = this.extractTextAfterKeyword(fullText, keyword);
                if (extractedText && extractedText.length > 50) {
                    Zotero.debug(`DeepTutorClaudeManagement: Successfully extracted abstract using keyword "${keyword}"`);
                    return {
                        abstract: extractedText,
                        confidence: 'medium',
                        method: 'recognizer_keyword',
                        note: `Extracted using keyword "${keyword}"`
                    };
                }
            }
            
            // If no keyword found, try to extract first few paragraphs
            const paragraphs = fullText.split(/\n\s*\n/).filter(p => p.trim().length > 50);
            if (paragraphs.length > 0) {
                const firstParagraphs = paragraphs.slice(0, 2).join('\n\n');
                if (firstParagraphs.length > 100) {
                    Zotero.debug("DeepTutorClaudeManagement: Extracted abstract from first paragraphs");
                    return {
                        abstract: firstParagraphs,
                        confidence: 'low',
                        method: 'recognizer_first_paragraphs',
                        note: 'Using first paragraphs as abstract fallback'
                    };
                }
            }
            
            throw new Error("No abstract content found using recognizer approach");
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error in recognizer-based extraction: ${error.message}`);
            return {
                abstract: null,
                confidence: 'none',
                method: 'recognizer_error',
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

    /**
     * Generate comprehensive file hierarchy mapping using simple approach
     * Creates a complete hierarchy map of collections and their attachments
     */
    async generateFileHierarchy() {
        try {
            Zotero.debug("DeepTutorClaudeManagement: Starting file hierarchy generation...");
            
            if (this.hierarchyCache) {
                Zotero.debug("DeepTutorClaudeManagement: Using cached hierarchy data");
                return this.hierarchyCache;
            }

            const hierarchyData = {
                timestamp: new Date().toISOString(),
                library: {
                    id: Zotero.Libraries.userLibraryID,
                    name: 'User Library',
                    type: 'user'
                },
                collections: [],
                uncategorized: {
                    name: 'Uncategorized',
                    items: [],
                    itemCount: 0
                },
                statistics: {
                    totalCollections: 0,
                    totalItems: 0,
                    totalAttachments: 0,
                    totalPDFs: 0
                }
            };

            // Use proper Zotero API to get collections
            let collections = [];
            try {
                const userLibID = Zotero.Libraries.userLibraryID;
                Zotero.debug(`DeepTutorClaudeManagement: Getting collections for library ${userLibID} using Zotero.Collections.getByLibrary`);
                
                // Use the correct Zotero API method
                collections = Zotero.Collections.getByLibrary(userLibID);
                Zotero.debug(`DeepTutorClaudeManagement: Found ${collections.length} collections using getByLibrary`);
                
            } catch (error) {
                Zotero.debug(`DeepTutorClaudeManagement: Error getting collections with getByLibrary, trying alternative: ${error.message}`);
                // Fallback: use search approach
                try {
                    const search = new Zotero.Search();
                    search.libraryID = userLibID;
                    search.addCondition('itemType', 'is', 'collection');
                    const collectionIDs = await search.search();
                    collections = collectionIDs.map(id => Zotero.Collections.get(id)).filter(col => col);
                    Zotero.debug(`DeepTutorClaudeManagement: Found ${collections.length} collections using search fallback`);
                } catch (searchError) {
                    Zotero.debug(`DeepTutorClaudeManagement: Search fallback failed, trying database query: ${searchError.message}`);
                    // Last resort: direct database query
                    try {
                        const allObjects = await Zotero.DB.columnQueryAsync(
                            "SELECT collectionID FROM collections WHERE libraryID=?", 
                            [userLibID]
                        );
                        collections = allObjects.map(id => Zotero.Collections.get(id)).filter(col => col);
                        Zotero.debug(`DeepTutorClaudeManagement: Found ${collections.length} collections using database query`);
                    } catch (dbError) {
                        Zotero.debug(`DeepTutorClaudeManagement: All collection retrieval methods failed: ${dbError.message}`);
                        collections = [];
                    }
                }
            }
            
            Zotero.debug(`DeepTutorClaudeManagement: Found ${collections.length} collections`);

            // Build complete collection hierarchy using proper Zotero API
            for (const collection of collections) {
                try {
                    if (!collection.parentID) { // Only top-level collections
                        Zotero.debug(`DeepTutorClaudeManagement: Processing top-level collection: ${collection.name} (ID: ${collection.id})`);
                        
                        const collectionData = await this.buildCollectionHierarchyRecursive(collection, 0);
                        hierarchyData.collections.push(collectionData);
                        hierarchyData.statistics.totalCollections++;
                        
                        // Update statistics
                        hierarchyData.statistics.totalItems += collectionData.itemCount;
                        hierarchyData.statistics.totalAttachments += collectionData.attachmentCount;
                        hierarchyData.statistics.totalPDFs += collectionData.pdfCount;
                    }
                } catch (error) {
                    Zotero.debug(`DeepTutorClaudeManagement: Error processing collection ${collection.id}: ${error.message}`);
                }
            }

            // Add uncategorized items (use same approach as comprehensive summary)
            try {
                const uncategorizedItems = await this.getUncategorizedItems();
                hierarchyData.uncategorized.items = uncategorizedItems;
                hierarchyData.uncategorized.itemCount = uncategorizedItems.length;
                hierarchyData.statistics.totalItems += uncategorizedItems.length;
            } catch (uncatError) {
                Zotero.debug(`DeepTutorClaudeManagement: Error getting uncategorized items: ${uncatError.message}`);
            }

            // Save hierarchy data as both JSON and Markdown
            const hierarchyJsonPath = this.pathJoin(this.fileTreePath, 'complete_hierarchy.json');
            const hierarchyMdPath = this.pathJoin(this.fileTreePath, 'complete_hierarchy.md');
            
            this.writeTextFile(hierarchyJsonPath, JSON.stringify(hierarchyData, null, 2));
            
            // Generate comprehensive markdown mapping
            const hierarchyMarkdown = this.generateHierarchyMarkdown(hierarchyData);
            this.writeTextFile(hierarchyMdPath, hierarchyMarkdown);
            
            // Cache the result
            this.hierarchyCache = hierarchyData;
            
            Zotero.debug(`DeepTutorClaudeManagement: File hierarchy generated successfully. Collections: ${hierarchyData.statistics.totalCollections}, Items: ${hierarchyData.statistics.totalItems}`);
            return hierarchyData;
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error generating file hierarchy: ${error.message}`);
            throw error;
        }
    }

    /**
     * Build collection hierarchy recursively using proper Zotero API
     * @param {Object} collection - Zotero collection object
     * @param {number} level - Current nesting level
     * @returns {Object} Collection hierarchy data
     */
    async buildCollectionHierarchyRecursive(collection, level) {
        try {
            const collectionData = {
                id: collection.id,
                key: collection.key,
                name: collection.name,
                level: level,
                parentID: collection.parentID || null,
                fullPath: collection.name,
                items: [],
                subcollections: [],
                itemCount: 0,
                attachmentCount: 0,
                pdfCount: 0
            };

            // Get items in this collection using proper Zotero API
            try {
                const items = collection.getChildItems();
                Zotero.debug(`DeepTutorClaudeManagement: Collection ${collection.name} has ${items.length} child items`);
                
                for (const item of items) {
                    if (item && item.isRegularItem && item.isRegularItem()) {
                        const itemData = {
                            id: item.id,
                            title: item.getField('title') || 'Untitled',
                            itemType: item.itemType,
                            date: item.getField('date') || '',
                            attachmentCount: 0,
                            pdfCount: 0,
                            attachments: []
                        };
                        
                        // Count attachments using proper Zotero API
                        try {
                            const attachments = item.getAttachments();
                            itemData.attachmentCount = attachments.length;
                            
                            for (const attachmentID of attachments) {
                                const attachment = Zotero.Items.get(attachmentID);
                                if (attachment && attachment.isAttachment && attachment.isAttachment()) {
                                    const attachmentData = {
                                        id: attachment.id,
                                        filename: attachment.attachmentFilename || '',
                                        isPDF: this.isPDFAttachment(attachment),
                                        fileSize: attachment.attachmentFileSize || 0
                                    };
                                    itemData.attachments.push(attachmentData);
                                    
                                    if (attachmentData.isPDF) {
                                        itemData.pdfCount++;
                                    }
                                }
                            }
                        } catch (attachError) {
                            Zotero.debug(`DeepTutorClaudeManagement: Error getting attachments for item ${item.id}: ${attachError.message}`);
                        }
                        
                        collectionData.items.push(itemData);
                        collectionData.itemCount++;
                        collectionData.attachmentCount += itemData.attachmentCount;
                        collectionData.pdfCount += itemData.pdfCount;
                    }
                }
            } catch (itemError) {
                Zotero.debug(`DeepTutorClaudeManagement: Error getting items for collection ${collection.id}: ${itemError.message}`);
            }

            // Get subcollections using proper Zotero API
            try {
                const subcollections = collection.getChildCollections();
                Zotero.debug(`DeepTutorClaudeManagement: Collection ${collection.name} has ${subcollections.length} subcollections`);
                
                for (const subcollection of subcollections) {
                    const subcollectionData = await this.buildCollectionHierarchyRecursive(subcollection, level + 1);
                    collectionData.subcollections.push(subcollectionData);
                    
                    // Update parent collection statistics
                    collectionData.itemCount += subcollectionData.itemCount;
                    collectionData.attachmentCount += subcollectionData.attachmentCount;
                    collectionData.pdfCount += subcollectionData.pdfCount;
                }
            } catch (subcolError) {
                Zotero.debug(`DeepTutorClaudeManagement: Error getting subcollections for collection ${collection.id}: ${subcolError.message}`);
            }

            // Build full path for this collection
            if (collection.parentID) {
                try {
                    const parentCollection = await Zotero.Collections.getAsync(collection.parentID);
                    if (parentCollection) {
                        collectionData.fullPath = `${parentCollection.name} > ${collection.name}`;
                    }
                } catch (pathError) {
                    Zotero.debug(`DeepTutorClaudeManagement: Error building path for collection ${collection.id}: ${pathError.message}`);
                }
            }

            return collectionData;
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error building collection hierarchy: ${error.message}`);
            return {
                id: collection.id,
                name: collection.name,
                error: error.message
            };
        }
    }

    /**
     * Build collection hierarchy recursively (legacy method - kept for compatibility)
     * @param {Object} collection - Zotero collection object
     * @returns {Object} Collection hierarchy data
     */
    async buildCollectionHierarchy(collection) {
        // Use non-recursive version to avoid stack overflow
        const collectionMap = new Map();
        const allCollections = await Zotero.Collections.getAll(collection.libraryID);
        for (const col of allCollections) {
            collectionMap.set(col.id, col);
        }
        return this.buildCollectionHierarchyNonRecursive(collection, collectionMap);
    }

    /**
     * Build item data with attachment information
     * @param {Object} item - Zotero item object
     * @returns {Object} Item data with attachment details
     */
    async buildItemData(item) {
        try {
            const itemData = {
                id: item.id,
                key: item.key,
                title: item.getField('title') || 'Untitled',
                itemType: item.itemType,
                creators: item.getCreators().map(creator => ({
                    firstName: creator.firstName || '',
                    lastName: creator.lastName || '',
                    name: creator.name || '',
                    creatorType: creator.creatorType || 'author'
                })),
                date: item.getField('date') || '',
                abstract: item.getField('abstractNote') || '',
                tags: item.getTags().map(tag => tag.tag),
                attachments: [],
                attachmentCount: 0,
                pdfCount: 0
            };

            // Get attachments
            const attachments = item.getAttachments();
            for (const attachmentID of attachments) {
                const attachment = Zotero.Items.get(attachmentID);
                if (attachment && attachment.isAttachment && attachment.isAttachment()) {
                    const attachmentData = {
                        id: attachment.id,
                        key: attachment.key,
                        filename: attachment.attachmentFilename || '',
                        contentType: attachment.attachmentContentType || '',
                        isPDF: this.isPDFAttachment(attachment),
                        fileSize: attachment.attachmentFileSize || 0
                    };
                    
                    itemData.attachments.push(attachmentData);
                    itemData.attachmentCount++;
                    
                    if (attachmentData.isPDF) {
                        itemData.pdfCount++;
                    }
                }
            }

            return itemData;
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error building item data: ${error.message}`);
            return {
                id: item.id,
                title: 'Error loading item',
                error: error.message
            };
        }
    }

    /**
     * Get uncategorized items (items not in any collection)
     * @returns {Array} Array of uncategorized items
     */
    async getUncategorizedItems() {
        try {
            // Use the same approach as comprehensive summary that works
            const libraryID = Zotero.Libraries.userLibraryID;
            let allItems;
            
            try {
                allItems = await Zotero.Items.getAll(libraryID);
            } catch (error) {
                Zotero.debug(`DeepTutorClaudeManagement: Error getting items with getAll for uncategorized, trying alternative: ${error.message}`);
                // Fallback: get items from search
                const search = new Zotero.Search();
                search.libraryID = libraryID;
                search.addCondition('itemType', 'isNot', 'note');
                search.addCondition('itemType', 'isNot', 'annotation');
                const itemIDs = await search.search();
                allItems = itemIDs.map(id => Zotero.Items.get(id)).filter(item => item);
            }
            
            if (!allItems || !Array.isArray(allItems)) {
                return [];
            }
            
            const uncategorizedItems = [];
            
            for (const item of allItems) {
                try {
                    if (item && item.isRegularItem && item.isRegularItem()) {
                        const collections = item.getCollections();
                        if (collections.length === 0) {
                            const itemData = {
                                id: item.id,
                                title: item.getField('title') || 'Untitled',
                                itemType: item.itemType,
                                date: item.getField('date') || '',
                                attachmentCount: 0,
                                pdfCount: 0,
                                attachments: []
                            };
                            
                            // Get attachments for this item
                            try {
                                const attachments = item.getAttachments();
                                itemData.attachmentCount = attachments.length;
                                for (const attachmentID of attachments) {
                                    const attachment = Zotero.Items.get(attachmentID);
                                    if (attachment && attachment.isAttachment && attachment.isAttachment()) {
                                        const attachmentData = {
                                            id: attachment.id,
                                            filename: attachment.attachmentFilename || '',
                                            isPDF: this.isPDFAttachment(attachment),
                                            fileSize: attachment.attachmentFileSize || 0
                                        };
                                        itemData.attachments.push(attachmentData);
                                        if (attachmentData.isPDF) {
                                            itemData.pdfCount++;
                                        }
                                    }
                                }
                            } catch (attachError) {
                                Zotero.debug(`DeepTutorClaudeManagement: Error getting attachments for uncategorized item ${item.id}: ${attachError.message}`);
                            }
                            
                            uncategorizedItems.push(itemData);
                        }
                    }
                } catch (itemError) {
                    Zotero.debug(`DeepTutorClaudeManagement: Error processing uncategorized item ${item.id}: ${itemError.message}`);
                }
            }
            
            return uncategorizedItems;
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error getting uncategorized items: ${error.message}`);
            return [];
        }
    }

    /**
     * Generate comprehensive summary of all PDF files
     * Saves metadata and abstracts to General folder
     */
    async generateComprehensiveSummary() {
        try {
            Zotero.debug("DeepTutorClaudeManagement: Starting comprehensive summary generation...");
            
            const summaryData = {
                timestamp: new Date().toISOString(),
                totalPDFs: 0,
                totalItems: 0,
                pdfs: [],
                statistics: {
                    totalSize: 0,
                    totalPages: 0,
                    byItemType: {},
                    byCollection: {},
                    byYear: {}
                }
            };

            // Use the same simple approach as in loadRawPDFDoc that works
            const libraryID = Zotero.Libraries.userLibraryID;
            let allItems;
            
            try {
                allItems = await Zotero.Items.getAll(libraryID);
            } catch (error) {
                Zotero.debug(`DeepTutorClaudeManagement: Error getting items with getAll, trying alternative: ${error.message}`);
                // Fallback: get items from search
                const search = new Zotero.Search();
                search.libraryID = libraryID;
                search.addCondition('itemType', 'isNot', 'note');
                search.addCondition('itemType', 'isNot', 'annotation');
                const itemIDs = await search.search();
                allItems = itemIDs.map(id => Zotero.Items.get(id)).filter(item => item);
            }
            
            if (!allItems || !Array.isArray(allItems)) {
                Zotero.debug("DeepTutorClaudeManagement: Failed to get items array, creating empty summary");
                allItems = [];
            }
            
            Zotero.debug(`DeepTutorClaudeManagement: Processing ${allItems.length} items for summary`);
            
            for (const item of allItems) {
                try {
                    if (!item) continue;
                    
                    if (item.isAttachment && item.isAttachment()) {
                        if (this.isPDFAttachment(item)) {
                            await this.processItemForSummary(item, summaryData);
                        }
                    } else if (item.isRegularItem && item.isRegularItem()) {
                        const attachments = item.getAttachments();
                        for (const attachmentID of attachments) {
                            const attachment = Zotero.Items.get(attachmentID);
                            if (attachment && this.isPDFAttachment(attachment)) {
                                await this.processItemForSummary(attachment, summaryData);
                            }
                        }
                    }
                } catch (error) {
                    Zotero.debug(`DeepTutorClaudeManagement: Error processing item ${item.id} for summary: ${error.message}`);
                }
            }

            // Generate summary markdown
            const summaryMarkdown = this.generateSummaryMarkdown(summaryData);
            
            // Save to General folder
            const summaryFilePath = this.pathJoin(this.generalPath, 'comprehensive_summary.md');
            this.writeTextFile(summaryFilePath, summaryMarkdown);
            
            // Also save as JSON for programmatic access
            const summaryJsonPath = this.pathJoin(this.generalPath, 'comprehensive_summary.json');
            this.writeTextFile(summaryJsonPath, JSON.stringify(summaryData, null, 2));
            
            Zotero.debug(`DeepTutorClaudeManagement: Comprehensive summary generated successfully. Total PDFs: ${summaryData.totalPDFs}`);
            return summaryData;
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error generating comprehensive summary: ${error.message}`);
            throw error;
        }
    }

    /**
     * Process individual item for comprehensive summary
     * @param {Object} attachment - PDF attachment item
     * @param {Object} summaryData - Summary data object to update
     */
    async processItemForSummary(attachment, summaryData) {
        try {
            // Check cache first
            const cacheKey = attachment.id;
            if (this.metadataCache.has(cacheKey)) {
                const cachedMetadata = this.metadataCache.get(cacheKey);
                this.addToSummaryData(cachedMetadata, summaryData);
                return;
            }

            // Extract metadata if not cached
            const metadata = await this.extractComprehensiveMetadata(attachment);
            this.metadataCache.set(cacheKey, metadata);
            
            // Extract abstract if not cached - ensure we get the full, detailed abstract
            if (!this.abstractCache.has(cacheKey)) {
                try {
                    Zotero.debug(`DeepTutorClaudeManagement: Extracting full abstract for comprehensive summary - item ${attachment.id}`);
                    const abstractResult = await this.extractAbstract(attachment);
                    this.abstractCache.set(cacheKey, abstractResult);
                    
                    // Store the full abstract with all details
                    metadata.abstract = abstractResult.abstract || '';
                    metadata.abstractMethod = abstractResult.method || 'unknown';
                    metadata.abstractConfidence = abstractResult.confidence || 'none';
                    
                    Zotero.debug(`DeepTutorClaudeManagement: Abstract extracted for item ${attachment.id} - method: ${metadata.abstractMethod}, confidence: ${metadata.abstractConfidence}, length: ${metadata.abstract.length} characters`);
                } catch (error) {
                    Zotero.debug(`DeepTutorClaudeManagement: Error extracting abstract for ${attachment.id}: ${error.message}`);
                    metadata.abstract = '';
                    metadata.abstractMethod = 'error';
                    metadata.abstractConfidence = 'none';
                }
            } else {
                const cachedAbstract = this.abstractCache.get(cacheKey);
                metadata.abstract = cachedAbstract.abstract || '';
                metadata.abstractMethod = cachedAbstract.method || 'cached';
                metadata.abstractConfidence = cachedAbstract.confidence || 'none';
                Zotero.debug(`DeepTutorClaudeManagement: Using cached abstract for item ${attachment.id} - length: ${metadata.abstract.length} characters`);
            }

            this.addToSummaryData(metadata, summaryData);
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error processing item for summary: ${error.message}`);
        }
    }

    /**
     * Add item metadata to summary data
     * @param {Object} metadata - Item metadata
     * @param {Object} summaryData - Summary data to update
     */
    addToSummaryData(metadata, summaryData) {
        try {
            summaryData.totalPDFs++;
            
            const pdfInfo = {
                id: metadata.item.id,
                title: metadata.parent.title || metadata.item.title || 'Untitled',
                filename: metadata.item.filename || '',
                itemType: metadata.parent.itemType || 'attachment',
                creators: metadata.parent.creators || [],
                date: metadata.parent.date || '',
                abstract: metadata.abstract || '',
                abstractMethod: metadata.abstractMethod || 'unknown',
                abstractConfidence: metadata.abstractConfidence || 'none',
                collections: metadata.collections.map(c => c.fullPath),
                primaryCollection: metadata.hierarchy.primaryCollection,
                fileSize: metadata.item.fileSize || 0,
                pageCount: metadata.item.pageCount || 0
            };
            
            summaryData.pdfs.push(pdfInfo);
            
            // Update statistics
            summaryData.statistics.totalSize += pdfInfo.fileSize;
            summaryData.statistics.totalPages += pdfInfo.pageCount;
            
            // Count by item type
            const itemType = pdfInfo.itemType;
            summaryData.statistics.byItemType[itemType] = (summaryData.statistics.byItemType[itemType] || 0) + 1;
            
            // Count by collection
            const primaryCollection = pdfInfo.primaryCollection;
            summaryData.statistics.byCollection[primaryCollection] = (summaryData.statistics.byCollection[primaryCollection] || 0) + 1;
            
            // Count by year
            if (pdfInfo.date) {
                const year = pdfInfo.date.substring(0, 4);
                if (/^\d{4}$/.test(year)) {
                    summaryData.statistics.byYear[year] = (summaryData.statistics.byYear[year] || 0) + 1;
                }
            }
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error adding to summary data: ${error.message}`);
        }
    }

    /**
     * Generate markdown summary from summary data
     * @param {Object} summaryData - Summary data object
     * @returns {string} Markdown formatted summary
     */
    generateSummaryMarkdown(summaryData) {
        try {
            let markdown = `# Comprehensive PDF Summary\n\n`;
            markdown += `**Generated:** ${new Date(summaryData.timestamp).toLocaleString()}\n\n`;
            
            // Statistics
            markdown += `## Statistics\n\n`;
            markdown += `- **Total PDFs:** ${summaryData.totalPDFs}\n`;
            markdown += `- **Total Items:** ${summaryData.totalItems}\n`;
            markdown += `- **Total Size:** ${this.formatFileSize(summaryData.statistics.totalSize)}\n`;
            markdown += `- **Total Pages:** ${summaryData.statistics.totalPages.toLocaleString()}\n\n`;
            
            // By Item Type
            if (Object.keys(summaryData.statistics.byItemType).length > 0) {
                markdown += `### By Item Type\n\n`;
                Object.entries(summaryData.statistics.byItemType)
                    .sort(([,a], [,b]) => b - a)
                    .forEach(([type, count]) => {
                        markdown += `- **${type}:** ${count}\n`;
                    });
                markdown += `\n`;
            }
            
            // By Collection
            if (Object.keys(summaryData.statistics.byCollection).length > 0) {
                markdown += `### By Collection\n\n`;
                Object.entries(summaryData.statistics.byCollection)
                    .sort(([,a], [,b]) => b - a)
                    .forEach(([collection, count]) => {
                        markdown += `- **${collection}:** ${count}\n`;
                    });
                markdown += `\n`;
            }
            
            // By Year
            if (Object.keys(summaryData.statistics.byYear).length > 0) {
                markdown += `### By Year\n\n`;
                Object.entries(summaryData.statistics.byYear)
                    .sort(([a], [b]) => b - a)
                    .forEach(([year, count]) => {
                        markdown += `- **${year}:** ${count}\n`;
                    });
                markdown += `\n`;
            }
            
            // PDF List with full abstracts
            markdown += `## PDF Documents\n\n`;
            summaryData.pdfs.forEach((pdf, index) => {
                markdown += `### ${index + 1}. ${pdf.title}\n\n`;
                markdown += `- **ID:** ${pdf.id}\n`;
                markdown += `- **Filename:** ${pdf.filename}\n`;
                markdown += `- **Type:** ${pdf.itemType}\n`;
                markdown += `- **Date:** ${pdf.date}\n`;
                markdown += `- **Size:** ${this.formatFileSize(pdf.fileSize)}\n`;
                markdown += `- **Pages:** ${pdf.pageCount}\n`;
                markdown += `- **Collection:** ${pdf.primaryCollection}\n`;
                
                if (pdf.creators && pdf.creators.length > 0) {
                    markdown += `- **Authors:** ${pdf.creators.map(c => `${c.firstName} ${c.lastName}`.trim()).join(', ')}\n`;
                }
                
                // Show abstract extraction details and full abstract (not summary)
                if (pdf.abstract && pdf.abstract.trim()) {
                    markdown += `- **Abstract Extraction:** Method: ${pdf.abstractMethod || 'unknown'}, Confidence: ${pdf.abstractConfidence || 'none'}\n`;
                    markdown += `\n**Extracted Abstract:**\n\n${pdf.abstract.trim()}\n`;
                } else {
                    markdown += `- **Abstract:** No abstract available (Method: ${pdf.abstractMethod || 'unknown'})\n`;
                }
                
                markdown += `\n---\n\n`;
            });
            
            return markdown;
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error generating summary markdown: ${error.message}`);
            return `# Error Generating Summary\n\n${error.message}`;
        }
    }

    /**
     * Format file size in human-readable format
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Generate comprehensive hierarchy markdown from hierarchy data
     * @param {Object} hierarchyData - Complete hierarchy data
     * @returns {string} Markdown formatted hierarchy
     */
    generateHierarchyMarkdown(hierarchyData) {
        try {
            let markdown = `# Complete Zotero Library Hierarchy\n\n`;
            markdown += `**Generated:** ${new Date(hierarchyData.timestamp).toLocaleString()}\n\n`;
            
            // Statistics
            markdown += `## Library Statistics\n\n`;
            markdown += `- **Library:** ${hierarchyData.library.name}\n`;
            markdown += `- **Library ID:** ${hierarchyData.library.id}\n`;
            markdown += `- **Library Type:** ${hierarchyData.library.type}\n`;
            markdown += `- **Total Collections:** ${hierarchyData.statistics.totalCollections}\n`;
            markdown += `- **Total Items:** ${hierarchyData.statistics.totalItems}\n`;
            markdown += `- **Total Attachments:** ${hierarchyData.statistics.totalAttachments}\n`;
            markdown += `- **Total PDFs:** ${hierarchyData.statistics.totalPDFs}\n\n`;
            
            // Collections hierarchy
            if (hierarchyData.collections && hierarchyData.collections.length > 0) {
                markdown += `## Collections Hierarchy\n\n`;
                
                // Group collections by level for better organization
                const collectionsByLevel = {};
                for (const collection of hierarchyData.collections) {
                    const level = collection.level || 0;
                    if (!collectionsByLevel[level]) {
                        collectionsByLevel[level] = [];
                    }
                    collectionsByLevel[level].push(collection);
                }
                
                // Render top-level collections first
                const topLevelCollections = collectionsByLevel[0] || [];
                for (const collection of topLevelCollections) {
                    markdown += this.renderCollectionHierarchy(collection, 0);
                }
            }
            
            // Uncategorized items
            if (hierarchyData.uncategorized && hierarchyData.uncategorized.items.length > 0) {
                markdown += `## Uncategorized Items\n\n`;
                markdown += `**Total Uncategorized Items:** ${hierarchyData.uncategorized.itemCount}\n\n`;
                
                for (const item of hierarchyData.uncategorized.items) {
                    markdown += `### ${item.title}\n\n`;
                    markdown += `- **ID:** ${item.id}\n`;
                    markdown += `- **Type:** ${item.itemType}\n`;
                    markdown += `- **Date:** ${item.date}\n`;
                    
                    if (item.creators && item.creators.length > 0) {
                        const authors = item.creators
                            .filter(c => c.creatorType === 'author')
                            .map(c => `${c.firstName} ${c.lastName}`.trim())
                            .join(', ');
                        if (authors) {
                            markdown += `- **Authors:** ${authors}\n`;
                        }
                    }
                    
                    markdown += `- **Attachments:** ${item.attachmentCount}\n`;
                    markdown += `- **PDFs:** ${item.pdfCount}\n`;
                    
                    if (item.attachments && item.attachments.length > 0) {
                        markdown += `- **Files:**\n`;
                        for (const attachment of item.attachments) {
                            const pdfIndicator = attachment.isPDF ? ' 📄' : '';
                            markdown += `  - ${attachment.filename}${pdfIndicator} (${this.formatFileSize(attachment.fileSize)})\n`;
                        }
                    }
                    
                    markdown += `\n`;
                }
            }
            
            return markdown;
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error generating hierarchy markdown: ${error.message}`);
            return `# Error Generating Hierarchy\n\n${error.message}`;
        }
    }

    /**
     * Render a collection and its hierarchy recursively
     * @param {Object} collection - Collection data
     * @param {number} level - Indentation level
     * @returns {string} Markdown for the collection
     */
    renderCollectionHierarchy(collection, level) {
        try {
            const indent = '  '.repeat(level);
            const headerLevel = Math.min(level + 3, 6); // Max H6
            const header = '#'.repeat(headerLevel);
            
            let markdown = `${header} ${collection.name}\n\n`;
            
            // Collection metadata
            markdown += `${indent}- **Collection ID:** ${collection.id}\n`;
            markdown += `${indent}- **Full Path:** ${collection.fullPath}\n`;
            markdown += `${indent}- **Level:** ${collection.level}\n`;
            markdown += `${indent}- **Items:** ${collection.itemCount}\n`;
            markdown += `${indent}- **Attachments:** ${collection.attachmentCount}\n`;
            markdown += `${indent}- **PDFs:** ${collection.pdfCount}\n\n`;
            
            // Items in this collection
            if (collection.items && collection.items.length > 0) {
                markdown += `${indent}**Items in this collection:**\n\n`;
                
                for (const item of collection.items) {
                    markdown += `${indent}- **${item.title}**\n`;
                    markdown += `${indent}  - ID: ${item.id}\n`;
                    markdown += `${indent}  - Type: ${item.itemType}\n`;
                    markdown += `${indent}  - Date: ${item.date}\n`;
                    
                    if (item.creators && item.creators.length > 0) {
                        const authors = item.creators
                            .filter(c => c.creatorType === 'author')
                            .map(c => `${c.firstName} ${c.lastName}`.trim())
                            .join(', ');
                        if (authors) {
                            markdown += `${indent}  - Authors: ${authors}\n`;
                        }
                    }
                    
                    markdown += `${indent}  - Attachments: ${item.attachmentCount}\n`;
                    markdown += `${indent}  - PDFs: ${item.pdfCount}\n`;
                    
                    if (item.attachments && item.attachments.length > 0) {
                        markdown += `${indent}  - Files:\n`;
                        for (const attachment of item.attachments) {
                            const pdfIndicator = attachment.isPDF ? ' 📄' : '';
                            markdown += `${indent}    - ${attachment.filename}${pdfIndicator} (${this.formatFileSize(attachment.fileSize)})\n`;
                        }
                    }
                    
                    markdown += `\n`;
                }
            }
            
            // Subcollections
            if (collection.subcollections && collection.subcollections.length > 0) {
                markdown += `${indent}**Subcollections:**\n\n`;
                for (const subcollection of collection.subcollections) {
                    markdown += this.renderCollectionHierarchy(subcollection, level + 1);
                }
            }
            
            return markdown;
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error rendering collection hierarchy: ${error.message}`);
            return `Error rendering collection: ${error.message}\n\n`;
        }
    }

    /**
     * Smart hierarchy generation that automatically chooses the best method
     * @returns {Object} Hierarchy data
     */
    async generateFileHierarchySmart() {
        try {
            // Priority order: SQL-based > Enhanced > Original
            if (this.useSQLBasedHierarchy && this.enableSQLFallbacks) {
                try {
                    Zotero.debug("DeepTutorClaudeManagement: Attempting SQL-based hierarchy generation...");
                    return await this.generateFileHierarchySQL();
                } catch (sqlError) {
                    Zotero.debug(`DeepTutorClaudeManagement: SQL-based method failed, falling back to enhanced: ${sqlError.message}`);
                }
            }
            
            if (this.useEnhancedHierarchy) {
                Zotero.debug("DeepTutorClaudeManagement: Using enhanced hierarchy generation...");
                return await this.generateFileHierarchyEnhanced();
            } else {
                Zotero.debug("DeepTutorClaudeManagement: Using original hierarchy generation...");
                return await this.generateFileHierarchy();
            }
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Smart hierarchy generation failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Generate comprehensive file hierarchy following Zotero's native tree building patterns
     * Uses recursive collection discovery and proper parent-child relationships
     */
    async generateFileHierarchyEnhanced() {
        try {
            Zotero.debug("DeepTutorClaudeManagement: Starting enhanced file hierarchy generation following Zotero patterns...");
            
            if (this.hierarchyCache) {
                Zotero.debug("DeepTutorClaudeManagement: Using cached hierarchy data");
                return this.hierarchyCache;
            }

            const hierarchyData = {
                timestamp: new Date().toISOString(),
                library: {
                    id: Zotero.Libraries.userLibraryID,
                    name: 'User Library',
                    type: 'user'
                },
                collections: [],
                uncategorized: {
                    name: 'Uncategorized',
                    items: [],
                    itemCount: 0
                },
                statistics: {
                    totalCollections: 0,
                    totalItems: 0,
                    totalAttachments: 0,
                    totalPDFs: 0
                }
            };

            // Enhanced collection retrieval with multiple fallback strategies
            let collections = [];
            const userLibID = Zotero.Libraries.userLibraryID;
            
            try {
                Zotero.debug(`DeepTutorClaudeManagement: Getting collections for library ${userLibID} using Zotero.Collections.getByLibrary`);
                
                // Primary method: Use Zotero API
                collections = Zotero.Collections.getByLibrary(userLibID);
                Zotero.debug(`DeepTutorClaudeManagement: Found ${collections.length} collections using getByLibrary`);
                
            } catch (error) {
                Zotero.debug(`DeepTutorClaudeManagement: Error getting collections with getByLibrary, trying search fallback: ${error.message}`);
                
                // Fallback 1: Use search approach
                try {
                    const search = new Zotero.Search();
                    search.libraryID = userLibID;
                    search.addCondition('itemType', 'is', 'collection');
                    const collectionIDs = await search.search();
                    collections = collectionIDs.map(id => Zotero.Collections.get(id)).filter(col => col);
                    Zotero.debug(`DeepTutorClaudeManagement: Found ${collections.length} collections using search fallback`);
                } catch (searchError) {
                    Zotero.debug(`DeepTutorClaudeManagement: Search fallback failed, trying direct SQL query: ${searchError.message}`);
                    
                    // Fallback 2: Direct database query for collections
                    try {
                        const allObjects = await Zotero.DB.columnQueryAsync(
                            "SELECT collectionID FROM collections WHERE libraryID=? AND deleted=0", 
                            [userLibID]
                        );
                        collections = allObjects.map(id => Zotero.Collections.get(id)).filter(col => col);
                        Zotero.debug(`DeepTutorClaudeManagement: Found ${collections.length} collections using direct SQL query`);
                    } catch (dbError) {
                        Zotero.debug(`DeepTutorClaudeManagement: Direct SQL query failed, trying comprehensive SQL approach: ${dbError.message}`);
                        
                        // Fallback 3: Comprehensive SQL query with joins
                        try {
                            const comprehensiveQuery = `
                                SELECT 
                                    c.collectionID,
                                    c.collectionName,
                                    c.parentCollectionID,
                                    c.libraryID,
                                    c.key,
                                    c.dateAdded,
                                    c.dateModified
                                FROM collections c
                                WHERE c.libraryID = ? AND c.deleted = 0
                                ORDER BY c.parentCollectionID NULLS FIRST, c.collectionName
                            `;
                            
                            const comprehensiveResults = await Zotero.DB.queryAsync(comprehensiveQuery, [userLibID]);
                            Zotero.debug(`DeepTutorClaudeManagement: Comprehensive SQL query returned ${comprehensiveResults.length} rows`);
                            
                            // Create collection objects from SQL results
                            collections = comprehensiveResults.map(row => ({
                                id: row.collectionID,
                                key: row.key,
                                name: row.collectionName,
                                parentID: row.parentCollectionID,
                                libraryID: row.libraryID,
                                dateAdded: row.dateAdded,
                                dateModified: row.dateModified
                            }));
                            
                            Zotero.debug(`DeepTutorClaudeManagement: Created ${collections.length} collection objects from SQL results`);
                        } catch (comprehensiveError) {
                            Zotero.debug(`DeepTutorClaudeManagement: All collection retrieval methods failed: ${comprehensiveError.message}`);
                            collections = [];
                        }
                    }
                }
            }
            
            Zotero.debug(`DeepTutorClaudeManagement: Final collection count: ${collections.length}`);

            // Build complete collection hierarchy using enhanced approach
            for (const collection of collections) {
                try {
                    if (!collection.parentID) { // Only top-level collections
                        Zotero.debug(`DeepTutorClaudeManagement: Processing top-level collection: ${collection.name} (ID: ${collection.id})`);
                        
                        const collectionData = await this.buildCollectionHierarchyRecursiveEnhanced(collection, 0, userLibID);
                        hierarchyData.collections.push(collectionData);
                        hierarchyData.statistics.totalCollections++;
                        
                        // Update statistics
                        hierarchyData.statistics.totalItems += collectionData.itemCount;
                        hierarchyData.statistics.totalAttachments += collectionData.attachmentCount;
                        hierarchyData.statistics.totalPDFs += collectionData.pdfCount;
                    }
                } catch (error) {
                    Zotero.debug(`DeepTutorClaudeManagement: Error processing collection ${collection.id}: ${error.message}`);
                }
            }

            // Add uncategorized items with enhanced retrieval
            try {
                const uncategorizedItems = await this.getUncategorizedItemsEnhanced(userLibID);
                hierarchyData.uncategorized.items = uncategorizedItems;
                hierarchyData.uncategorized.itemCount = uncategorizedItems.length;
                hierarchyData.statistics.totalItems += uncategorizedItems.length;
            } catch (uncatError) {
                Zotero.debug(`DeepTutorClaudeManagement: Error getting uncategorized items: ${uncatError.message}`);
            }

            // Save hierarchy data as both JSON and Markdown
            const hierarchyJsonPath = this.pathJoin(this.fileTreePath, 'complete_hierarchy_enhanced.json');
            const hierarchyMdPath = this.pathJoin(this.fileTreePath, 'complete_hierarchy_enhanced.md');
            
            this.writeTextFile(hierarchyJsonPath, JSON.stringify(hierarchyData, null, 2));
            
            // Generate comprehensive markdown mapping
            const hierarchyMarkdown = this.generateHierarchyMarkdown(hierarchyData);
            this.writeTextFile(hierarchyMdPath, hierarchyMarkdown);
            
            // Cache the result
            this.hierarchyCache = hierarchyData;
            
            Zotero.debug(`DeepTutorClaudeManagement: Enhanced file hierarchy generated successfully. Collections: ${hierarchyData.statistics.totalCollections}, Items: ${hierarchyData.statistics.totalItems}`);
            return hierarchyData;
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error generating enhanced file hierarchy: ${error.message}`);
            throw error;
        }
    }

    /**
     * Build collection tree recursively following Zotero's getByParent pattern
     * @param {Integer|null} parentID - Parent collection ID, null for root collections
     * @param {Integer} libraryID - Library ID
     * @param {Integer} level - Nesting level
     * @returns {Array} Array of collection objects with children
     */
    async buildCollectionTreeRecursive(parentID, libraryID, level = 0) {
        try {
            // Use Zotero's native methods - getByLibrary for root, getByParent for children
            let collections;
            if (parentID === null) {
                // Root level: get all top-level collections in library
                collections = Zotero.Collections.getByLibrary(libraryID).filter(c => !c.parentID);
            } else {
                // Child level: get collections that have this parent
                collections = Zotero.Collections.getByParent(parentID);
            }

            const result = [];
            
            for (let collection of collections) {
                try {
                    // Skip deleted collections
                    if (collection.deleted) continue;
                    
                    // Create collection tree row to use Zotero's native item retrieval
                    const collectionTreeRow = new Zotero.CollectionTreeRow(
                        null,
                        'collection',
                        collection,
                        level
                    );
                    
                    // Get items using Zotero's search mechanism
                    const items = await this.getCollectionItemsUsingZoteroSearch(collectionTreeRow);
                    
                    // Process items to get attachments and PDFs
                    const { attachments, pdfCount } = await this.processCollectionItems(items);
                    
                    // Recursively get child collections
                    const childCollections = await this.buildCollectionTreeRecursive(
                        collection.id, 
                        libraryID, 
                        level + 1
                    );
                    
                    const collectionData = {
                        id: collection.id,
                        name: collection.name,
                        level: level,
                        parentID: collection.parentID,
                        path: await this.getCollectionPath(collection),
                        itemCount: items.length,
                        attachmentCount: attachments.length,
                        pdfCount: pdfCount,
                        items: items.map(item => ({
                            id: item.id,
                            title: item.getField('title'),
                            itemType: item.itemType,
                            key: item.key,
                            dateAdded: item.dateAdded,
                            dateModified: item.dateModified
                        })),
                        attachments: attachments,
                        children: childCollections, // Recursive children
                        hasChildren: childCollections.length > 0,
                        isExpanded: false
                    };
                    
                    result.push(collectionData);
                    
                } catch (collectionError) {
                    Zotero.debug(`DeepTutorClaudeManagement: Error processing collection ${collection.id}: ${collectionError.message}`);
                }
            }
            
            return result;
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error in buildCollectionTreeRecursive: ${error.message}`);
            return [];
        }
    }

    /**
     * Get collection items using Zotero's native search mechanism
     * @param {CollectionTreeRow} collectionTreeRow - Zotero collection tree row
     * @returns {Array} Array of items
     */
    async getCollectionItemsUsingZoteroSearch(collectionTreeRow) {
        try {
            // Use Zotero's native search mechanism
            const searchResults = await collectionTreeRow.getSearchResults();
            
            if (!searchResults || searchResults.length === 0) {
                return [];
            }
            
            // Get actual item objects
            const items = await Zotero.Items.getAsync(searchResults);
            
            // Filter to only top-level items (no child attachments/notes)
            return items.filter(item => item.isTopLevelItem());
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error getting collection items via search: ${error.message}`);
            
            // Fallback to direct collection item retrieval
            try {
                const collection = collectionTreeRow.ref;
                const itemIDs = collection.getChildItems();
                return await Zotero.Items.getAsync(itemIDs);
            } catch (fallbackError) {
                Zotero.debug(`DeepTutorClaudeManagement: Fallback item retrieval failed: ${fallbackError.message}`);
                return [];
            }
        }
    }

    /**
     * Add virtual collections following Zotero's pattern
     * @param {Object} hierarchyData - Hierarchy data object to modify
     * @param {Integer} libraryID - Library ID
     */
    async addVirtualCollections(hierarchyData, libraryID) {
        try {
            // Duplicates
            try {
                const duplicatesSearch = new Zotero.Duplicates(libraryID);
                const duplicateTreeRow = new Zotero.CollectionTreeRow(null, 'duplicates', duplicatesSearch);
                const duplicateItems = await duplicateTreeRow.getItems();
                
                hierarchyData.virtualCollections.duplicates = {
                    name: 'Duplicate Items',
                    type: 'duplicates',
                    itemCount: duplicateItems.length,
                    items: duplicateItems.map(item => ({
                        id: item.id,
                        title: item.getField('title'),
                        itemType: item.itemType
                    }))
                };
            } catch (dupError) {
                Zotero.debug(`DeepTutorClaudeManagement: Error getting duplicates: ${dupError.message}`);
            }

            // Unfiled items
            try {
                const unfiledSearch = new Zotero.Search();
                unfiledSearch.libraryID = libraryID;
                unfiledSearch.addCondition('unfiled', 'true');
                const unfiledResults = await unfiledSearch.search();
                const unfiledItems = await Zotero.Items.getAsync(unfiledResults);
                
                hierarchyData.virtualCollections.unfiled = {
                    name: 'Unfiled Items',
                    type: 'unfiled',
                    itemCount: unfiledItems.length,
                    items: unfiledItems.map(item => ({
                        id: item.id,
                        title: item.getField('title'),
                        itemType: item.itemType
                    }))
                };
                
                // Use unfiled as uncategorized for backward compatibility
                hierarchyData.uncategorized = {
                    name: 'Uncategorized Items',
                    items: hierarchyData.virtualCollections.unfiled.items,
                    itemCount: hierarchyData.virtualCollections.unfiled.itemCount
                };
            } catch (unfiledError) {
                Zotero.debug(`DeepTutorClaudeManagement: Error getting unfiled items: ${unfiledError.message}`);
            }

            // Trash
            try {
                const deletedItems = await Zotero.Items.getDeleted(libraryID, true);
                hierarchyData.virtualCollections.trash = {
                    name: 'Trash',
                    type: 'trash',
                    itemCount: deletedItems.length,
                    items: deletedItems.map(item => ({
                        id: item.id,
                        title: item.getField('title'),
                        itemType: item.itemType,
                        deleted: true
                    }))
                };
            } catch (trashError) {
                Zotero.debug(`DeepTutorClaudeManagement: Error getting trash items: ${trashError.message}`);
            }

        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error adding virtual collections: ${error.message}`);
        }
    }

    /**
     * Get the full path of a collection
     * @param {Collection} collection - Zotero collection
     * @returns {String} Full collection path
     */
    async getCollectionPath(collection) {
        try {
            const pathParts = [collection.name];
            let current = collection;
            
            while (current.parentID) {
                const parent = await Zotero.Collections.getAsync(current.parentID);
                if (parent) {
                    pathParts.unshift(parent.name);
                    current = parent;
                } else {
                    break;
                }
            }
            
            return pathParts.join(' > ');
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error getting collection path: ${error.message}`);
            return collection.name;
        }
    }

    /**
     * Calculate statistics for the hierarchy
     * @param {Object} hierarchyData - Hierarchy data to calculate statistics for
     */
    calculateHierarchyStatistics(hierarchyData) {
        try {
            let totalCollections = 0;
            let totalItems = 0;
            let totalAttachments = 0;
            let totalPDFs = 0;

            const countRecursive = (collections) => {
                for (let collection of collections) {
                    totalCollections++;
                    totalItems += collection.itemCount || 0;
                    totalAttachments += collection.attachmentCount || 0;
                    totalPDFs += collection.pdfCount || 0;
                    
                    if (collection.children && collection.children.length > 0) {
                        countRecursive(collection.children);
                    }
                }
            };

            countRecursive(hierarchyData.collections);

            // Add virtual collections to statistics
            if (hierarchyData.virtualCollections) {
                Object.values(hierarchyData.virtualCollections).forEach(vc => {
                    totalItems += vc.itemCount || 0;
                });
            }

            hierarchyData.statistics = {
                totalCollections,
                totalItems,
                totalAttachments,
                totalPDFs
            };

        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error calculating statistics: ${error.message}`);
        }
    }

    /**
     * Generate enhanced markdown representation of the hierarchy
     * @param {Object} hierarchyData - Hierarchy data
     * @returns {String} Markdown representation
     */
    generateEnhancedHierarchyMarkdown(hierarchyData) {
        try {
            let markdown = `# Enhanced File Hierarchy\n\n`;
            markdown += `Generated: ${hierarchyData.timestamp}\n\n`;
            markdown += `## Library: ${hierarchyData.library.name}\n\n`;
            
            // Statistics
            markdown += `### Statistics\n`;
            markdown += `- Total Collections: ${hierarchyData.statistics.totalCollections}\n`;
            markdown += `- Total Items: ${hierarchyData.statistics.totalItems}\n`;
            markdown += `- Total Attachments: ${hierarchyData.statistics.totalAttachments}\n`;
            markdown += `- Total PDFs: ${hierarchyData.statistics.totalPDFs}\n\n`;

            // Collections
            if (hierarchyData.collections.length > 0) {
                markdown += `## Collections\n\n`;
                markdown += this.generateCollectionMarkdownRecursive(hierarchyData.collections, 0);
            }

            // Virtual Collections
            if (hierarchyData.virtualCollections) {
                markdown += `## Virtual Collections\n\n`;
                Object.entries(hierarchyData.virtualCollections).forEach(([key, vc]) => {
                    markdown += `### ${vc.name}\n`;
                    markdown += `- Type: ${vc.type}\n`;
                    markdown += `- Items: ${vc.itemCount}\n\n`;
                });
            }

            return markdown;
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error generating enhanced markdown: ${error.message}`);
            return "Error generating markdown representation";
        }
    }

    /**
     * Generate markdown for collections recursively
     * @param {Array} collections - Collections array
     * @param {Integer} level - Nesting level
     * @returns {String} Markdown string
     */
    generateCollectionMarkdownRecursive(collections, level) {
        let markdown = '';
        const indent = '  '.repeat(level);
        
        for (let collection of collections) {
            markdown += `${indent}- **${collection.name}** (${collection.itemCount} items)\n`;
            markdown += `${indent}  - Path: ${collection.path}\n`;
            markdown += `${indent}  - Attachments: ${collection.attachmentCount}\n`;
            markdown += `${indent}  - PDFs: ${collection.pdfCount}\n`;
            
            if (collection.children && collection.children.length > 0) {
                markdown += this.generateCollectionMarkdownRecursive(collection.children, level + 1);
            }
            markdown += '\n';
        }
        
        return markdown;
    }

    /**
     * Build collection hierarchy recursively using enhanced approach with SQL fallbacks
     * @param {Object} collection - Zotero collection object
     * @param {number} level - Current nesting level
     * @param {number} libraryID - Library ID for SQL queries
     * @returns {Object} Collection hierarchy data
     */
    async buildCollectionHierarchyRecursiveEnhanced(collection, level, libraryID) {
        try {
            const collectionData = {
                id: collection.id,
                key: collection.key,
                name: collection.name,
                level: level,
                parentID: collection.parentID || null,
                fullPath: collection.name,
                items: [],
                subcollections: [],
                itemCount: 0,
                attachmentCount: 0,
                pdfCount: 0,
                metadata: {
                    dateAdded: collection.dateAdded || null,
                    dateModified: collection.dateModified || null
                }
            };

            // Enhanced item retrieval with SQL fallback
            try {
                let items = [];
                
                // Primary method: Use Zotero API
                try {
                    items = collection.getChildItems();
                    Zotero.debug(`DeepTutorClaudeManagement: Collection ${collection.name} has ${items.length} child items using API`);
                } catch (apiError) {
                    Zotero.debug(`DeepTutorClaudeManagement: API method failed for items, trying SQL fallback: ${apiError.message}`);
                    
                    // SQL fallback: Get items by collection ID
                    try {
                        const itemsQuery = `
                            SELECT DISTINCT i.itemID, i.key, i.itemTypeID, i.dateAdded, i.dateModified
                            FROM items i
                            INNER JOIN collectionItems ci ON i.itemID = ci.itemID
                            WHERE ci.collectionID = ? AND i.deleted = 0
                            ORDER BY i.dateAdded DESC
                        `;
                        
                        const itemResults = await Zotero.DB.queryAsync(itemsQuery, [collection.id]);
                        Zotero.debug(`DeepTutorClaudeManagement: SQL query returned ${itemResults.length} items for collection ${collection.id}`);
                        
                        // Convert SQL results to item objects
                        items = itemResults.map(row => ({
                            id: row.itemID,
                            key: row.key,
                            itemTypeID: row.itemTypeID,
                            dateAdded: row.dateAdded,
                            dateModified: row.dateModified
                        }));
                    } catch (sqlError) {
                        Zotero.debug(`DeepTutorClaudeManagement: SQL fallback for items failed: ${sqlError.message}`);
                        items = [];
                    }
                }
                
                // Process items with enhanced attachment retrieval
                for (const item of items) {
                    try {
                        if (item && (item.isRegularItem ? item.isRegularItem() : true)) {
                            const itemData = await this.buildItemDataEnhanced(item, libraryID);
                            if (itemData) {
                                collectionData.items.push(itemData);
                                collectionData.itemCount++;
                                collectionData.attachmentCount += itemData.attachmentCount;
                                collectionData.pdfCount += itemData.pdfCount;
                            }
                        }
                    } catch (itemError) {
                        Zotero.debug(`DeepTutorClaudeManagement: Error processing item ${item.id}: ${itemError.message}`);
                    }
                }
            } catch (itemError) {
                Zotero.debug(`DeepTutorClaudeManagement: Error getting items for collection ${collection.id}: ${itemError.message}`);
            }

            // Enhanced subcollection retrieval with SQL fallback
            try {
                let subcollections = [];
                
                // Primary method: Use Zotero API
                try {
                    subcollections = collection.getChildCollections();
                    Zotero.debug(`DeepTutorClaudeManagement: Collection ${collection.name} has ${subcollections.length} subcollections using API`);
                } catch (apiError) {
                    Zotero.debug(`DeepTutorClaudeManagement: API method failed for subcollections, trying SQL fallback: ${apiError.message}`);
                    
                    // SQL fallback: Get subcollections by parent ID
                    try {
                        const subcollectionsQuery = `
                            SELECT collectionID, key, collectionName, dateAdded, dateModified
                            FROM collections
                            WHERE parentCollectionID = ? AND libraryID = ? AND deleted = 0
                            ORDER BY collectionName
                        `;
                        
                        const subcollectionResults = await Zotero.DB.queryAsync(subcollectionsQuery, [collection.id, libraryID]);
                        Zotero.debug(`DeepTutorClaudeManagement: SQL query returned ${subcollectionResults.length} subcollections for collection ${collection.id}`);
                        
                        // Convert SQL results to collection objects
                        subcollections = subcollectionResults.map(row => ({
                            id: row.collectionID,
                            key: row.key,
                            name: row.collectionName,
                            parentID: collection.id,
                            libraryID: libraryID,
                            dateAdded: row.dateAdded,
                            dateModified: row.dateModified
                        }));
                    } catch (sqlError) {
                        Zotero.debug(`DeepTutorClaudeManagement: SQL fallback for subcollections failed: ${sqlError.message}`);
                        subcollections = [];
                    }
                }
                
                // Process subcollections recursively
                for (const subcollection of subcollections) {
                    const subcollectionData = await this.buildCollectionHierarchyRecursiveEnhanced(subcollection, level + 1, libraryID);
                    collectionData.subcollections.push(subcollectionData);
                    
                    // Update parent collection statistics
                    collectionData.itemCount += subcollectionData.itemCount;
                    collectionData.attachmentCount += subcollectionData.attachmentCount;
                    collectionData.pdfCount += subcollectionData.pdfCount;
                }
            } catch (subcolError) {
                Zotero.debug(`DeepTutorClaudeManagement: Error getting subcollections for collection ${collection.id}: ${subcolError.message}`);
            }

            // Build full path for this collection
            if (collection.parentID) {
                try {
                    let parentCollection = null;
                    
                    // Try to get parent collection
                    try {
                        parentCollection = await Zotero.Collections.getAsync(collection.parentID);
                    } catch (apiError) {
                        // SQL fallback for parent collection
                        try {
                            const parentQuery = "SELECT collectionName FROM collections WHERE collectionID = ? AND deleted = 0";
                            const parentResult = await Zotero.DB.rowQueryAsync(parentQuery, [collection.parentID]);
                            if (parentResult) {
                                parentCollection = { name: parentResult.collectionName };
                            }
                        } catch (sqlError) {
                            Zotero.debug(`DeepTutorClaudeManagement: Could not get parent collection name: ${sqlError.message}`);
                        }
                    }
                    
                    if (parentCollection) {
                        collectionData.fullPath = `${parentCollection.name} > ${collection.name}`;
                    }
                } catch (pathError) {
                    Zotero.debug(`DeepTutorClaudeManagement: Error building path for collection ${collection.id}: ${pathError.message}`);
                }
            }

            return collectionData;
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error building enhanced collection hierarchy: ${error.message}`);
            return {
                id: collection.id,
                name: collection.name,
                error: error.message
            };
        }
    }

    /**
     * Build enhanced item data with SQL fallback for attachments
     * @param {Object} item - Zotero item object or SQL result
     * @param {number} libraryID - Library ID for SQL queries
     * @returns {Object} Enhanced item data with attachment details
     */
    async buildItemDataEnhanced(item, libraryID) {
        try {
            const itemData = {
                id: item.id,
                key: item.key,
                title: '',
                itemType: '',
                creators: [],
                date: '',
                abstract: '',
                tags: [],
                attachments: [],
                attachmentCount: 0,
                pdfCount: 0,
                metadata: {
                    dateAdded: item.dateAdded || null,
                    dateModified: item.dateModified || null
                }
            };

            // Get item details - try API first, then SQL fallback
            try {
                // Try to get full item object if we have one
                let fullItem = item;
                if (typeof item.getField === 'function') {
                    // This is already a full Zotero item
                    fullItem = item;
                } else {
                    // This is a SQL result, try to get the full item
                    try {
                        fullItem = Zotero.Items.get(item.id);
                    } catch (getError) {
                        Zotero.debug(`DeepTutorClaudeManagement: Could not get full item ${item.id}: ${getError.message}`);
                        // Continue with SQL fallback
                    }
                }

                // Extract item data using available methods
                if (fullItem && typeof fullItem.getField === 'function') {
                    // Use Zotero API methods
                    itemData.title = fullItem.getField('title') || 'Untitled';
                    itemData.itemType = fullItem.itemType;
                    itemData.date = fullItem.getField('date') || '';
                    itemData.abstract = fullItem.getField('abstractNote') || '';
                    
                    try {
                        const creators = fullItem.getCreators();
                        itemData.creators = creators.map(creator => ({
                            firstName: creator.firstName || '',
                            lastName: creator.lastName || '',
                            name: creator.name || '',
                            creatorType: creator.creatorType || 'author'
                        }));
                    } catch (creatorError) {
                        Zotero.debug(`DeepTutorClaudeManagement: Error getting creators: ${creatorError.message}`);
                    }
                    
                    try {
                        const tags = fullItem.getTags();
                        itemData.tags = tags.map(tag => tag.tag);
                    } catch (tagError) {
                        Zotero.debug(`DeepTutorClaudeManagement: Error getting tags: ${tagError.message}`);
                    }
                } else {
                    // SQL fallback for item details
                    try {
                        const itemDetailsQuery = `
                            SELECT 
                                i.itemTypeID,
                                id.title,
                                id.date,
                                id.abstractNote
                            FROM items i
                            LEFT JOIN itemData id ON i.itemID = id.itemID
                            WHERE i.itemID = ? AND i.deleted = 0
                        `;
                        
                        const itemDetails = await Zotero.DB.rowQueryAsync(itemDetailsQuery, [item.id]);
                        if (itemDetails) {
                            itemData.title = itemDetails.title || 'Untitled';
                            itemData.date = itemDetails.date || '';
                            itemData.abstract = itemDetails.abstractNote || '';
                            
                            // Get item type name
                            if (itemDetails.itemTypeID) {
                                try {
                                    const itemTypeQuery = "SELECT typeName FROM itemTypes WHERE itemTypeID = ?";
                                    const itemTypeResult = await Zotero.DB.rowQueryAsync(itemTypeQuery, [itemDetails.itemTypeID]);
                                    if (itemTypeResult) {
                                        itemData.itemType = itemTypeResult.typeName;
                                    }
                                } catch (typeError) {
                                    Zotero.debug(`DeepTutorClaudeManagement: Error getting item type: ${typeError.message}`);
                                    itemData.itemType = 'unknown';
                                }
                            }
                        }
                    } catch (detailsError) {
                        Zotero.debug(`DeepTutorClaudeManagement: Error getting item details via SQL: ${detailsError.message}`);
                    }
                }

                // Enhanced attachment retrieval with SQL fallback
                try {
                    let attachments = [];
                    
                    if (fullItem && typeof fullItem.getAttachments === 'function') {
                        // Use Zotero API method
                        const attachmentIDs = fullItem.getAttachments();
                        attachments = attachmentIDs.map(id => Zotero.Items.get(id)).filter(att => att);
                    } else {
                        // SQL fallback for attachments
                        try {
                            const attachmentsQuery = `
                                SELECT 
                                    a.itemID,
                                    a.key,
                                    a.attachmentFilename,
                                    a.attachmentContentType,
                                    a.attachmentFileSize,
                                    a.dateAdded,
                                    a.dateModified
                                FROM items a
                                WHERE a.parentItemID = ? AND a.deleted = 0
                                ORDER BY a.dateAdded
                            `;
                            
                            const attachmentResults = await Zotero.DB.queryAsync(attachmentsQuery, [item.id]);
                            Zotero.debug(`DeepTutorClaudeManagement: SQL query returned ${attachmentResults.length} attachments for item ${item.id}`);
                            
                            // Convert SQL results to attachment objects
                            attachments = attachmentResults.map(row => ({
                                id: row.itemID,
                                key: row.key,
                                attachmentFilename: row.attachmentFilename,
                                attachmentContentType: row.attachmentContentType,
                                attachmentFileSize: row.attachmentFileSize,
                                dateAdded: row.dateAdded,
                                dateModified: row.dateModified
                            }));
                        } catch (sqlError) {
                            Zotero.debug(`DeepTutorClaudeManagement: SQL fallback for attachments failed: ${sqlError.message}`);
                        }
                    }
                    
                    // Process attachments
                    for (const attachment of attachments) {
                        try {
                            const attachmentData = {
                                id: attachment.id,
                                filename: attachment.attachmentFilename || '',
                                contentType: attachment.attachmentContentType || '',
                                isPDF: this.isPDFAttachment(attachment),
                                fileSize: attachment.attachmentFileSize || 0,
                                metadata: {
                                    dateAdded: attachment.dateAdded || null,
                                    dateModified: attachment.dateModified || null
                                }
                            };
                            
                            itemData.attachments.push(attachmentData);
                            itemData.attachmentCount++;
                            
                            if (attachmentData.isPDF) {
                                itemData.pdfCount++;
                            }
                        } catch (attachError) {
                            Zotero.debug(`DeepTutorClaudeManagement: Error processing attachment ${attachment.id}: ${attachError.message}`);
                        }
                    }
                } catch (attachError) {
                    Zotero.debug(`DeepTutorClaudeManagement: Error getting attachments for item ${item.id}: ${attachError.message}`);
                }

            } catch (error) {
                Zotero.debug(`DeepTutorClaudeManagement: Error building enhanced item data: ${error.message}`);
            }

            return itemData;
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error in buildItemDataEnhanced: ${error.message}`);
            return {
                id: item.id,
                title: 'Error loading item',
                error: error.message
            };
        }
    }

    /**
     * Get uncategorized items with enhanced SQL fallback
     * @param {number} libraryID - Library ID for SQL queries
     * @returns {Array} Array of uncategorized items
     */
    async getUncategorizedItemsEnhanced(libraryID) {
        try {
            Zotero.debug("DeepTutorClaudeManagement: Getting uncategorized items with enhanced method...");
            
            let allItems = [];
            
            // Primary method: Use Zotero API
            try {
                allItems = await Zotero.Items.getAll(libraryID);
                Zotero.debug(`DeepTutorClaudeManagement: Found ${allItems.length} items using getAll API`);
            } catch (error) {
                Zotero.debug(`DeepTutorClaudeManagement: Error getting items with getAll, trying search fallback: ${error.message}`);
                
                // Fallback 1: Use search approach
                try {
                    const search = new Zotero.Search();
                    search.libraryID = libraryID;
                    search.addCondition('itemType', 'isNot', 'note');
                    search.addCondition('itemType', 'isNot', 'annotation');
                    const itemIDs = await search.search();
                    allItems = itemIDs.map(id => Zotero.Items.get(id)).filter(item => item);
                    Zotero.debug(`DeepTutorClaudeManagement: Found ${allItems.length} items using search fallback`);
                } catch (searchError) {
                    Zotero.debug(`DeepTutorClaudeManagement: Search fallback failed, trying SQL fallback: ${searchError.message}`);
                    
                    // Fallback 2: Direct SQL query for items
                    try {
                        const itemsQuery = `
                            SELECT 
                                i.itemID,
                                i.key,
                                i.itemTypeID,
                                i.dateAdded,
                                i.dateModified
                            FROM items i
                            WHERE i.libraryID = ? 
                                AND i.deleted = 0 
                                AND i.itemTypeID NOT IN (
                                    SELECT itemTypeID FROM itemTypes WHERE typeName IN ('note', 'annotation')
                                )
                            ORDER BY i.dateAdded DESC
                        `;
                        
                        const itemResults = await Zotero.DB.queryAsync(itemsQuery, [libraryID]);
                        Zotero.debug(`DeepTutorClaudeManagement: SQL query returned ${itemResults.length} items`);
                        
                        // Convert SQL results to item objects
                        allItems = itemResults.map(row => ({
                            id: row.itemID,
                            key: row.key,
                            itemTypeID: row.itemTypeID,
                            dateAdded: row.dateAdded,
                            dateModified: row.dateModified
                        }));
                    } catch (sqlError) {
                        Zotero.debug(`DeepTutorClaudeManagement: SQL fallback for items failed: ${sqlError.message}`);
                        allItems = [];
                    }
                }
            }
            
            if (!allItems || !Array.isArray(allItems)) {
                Zotero.debug("DeepTutorClaudeManagement: No items found, returning empty array");
                return [];
            }
            
            const uncategorizedItems = [];
            
            for (const item of allItems) {
                try {
                    // Check if item is in any collection
                    let isInCollection = false;
                    
                    try {
                        if (typeof item.getCollections === 'function') {
                            // Use Zotero API method
                            const collections = item.getCollections();
                            isInCollection = collections.length > 0;
                        } else {
                            // SQL fallback: Check collection membership
                            try {
                                const collectionCheckQuery = `
                                    SELECT COUNT(*) as count 
                                    FROM collectionItems 
                                    WHERE itemID = ? AND collectionID IN (
                                        SELECT collectionID FROM collections WHERE libraryID = ? AND deleted = 0
                                    )
                                `;
                                
                                const result = await Zotero.DB.rowQueryAsync(collectionCheckQuery, [item.id, libraryID]);
                                isInCollection = result && result.count > 0;
                            } catch (checkError) {
                                Zotero.debug(`DeepTutorClaudeManagement: Error checking collection membership for item ${item.id}: ${checkError.message}`);
                                // Assume not in collection if we can't check
                                isInCollection = false;
                            }
                        }
                    } catch (collectionError) {
                        Zotero.debug(`DeepTutorClaudeManagement: Error checking collections for item ${item.id}: ${collectionError.message}`);
                        isInCollection = false;
                    }
                    
                    if (!isInCollection) {
                        const itemData = await this.buildItemDataEnhanced(item, libraryID);
                        if (itemData) {
                            uncategorizedItems.push(itemData);
                        }
                    }
                } catch (itemError) {
                    Zotero.debug(`DeepTutorClaudeManagement: Error processing uncategorized item ${item.id}: ${itemError.message}`);
                }
            }
            
            Zotero.debug(`DeepTutorClaudeManagement: Found ${uncategorizedItems.length} uncategorized items`);
            return uncategorizedItems;
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error getting enhanced uncategorized items: ${error.message}`);
            return [];
        }
    }

    /**
     * ============================================================================
     * USAGE TRACKING BACKUP SYSTEM - DO NOT USE IN PRODUCTION
     * ============================================================================
     * This is a backup implementation of user behavior tracking for DeepTutor.
     * Contains all necessary methods for tracking user interactions, preferences,
     * and usage patterns. This system is designed to be integrated with Claude
     * requests to provide personalized responses based on user behavior.
     * 
     * WARNING: This is a backup/reference implementation. Do not activate without
     * proper user consent and privacy considerations.
     * ============================================================================
     */

    /**
     * Initialize usage tracking system (BACKUP - DO NOT USE)
     * Sets up data structures and loads existing tracking data
     */
    initializeUsageTracking() {
        // DO NOT USE - BACKUP IMPLEMENTATION ONLY
        if (this.usageTrackingEnabled) {
            Zotero.debug("DeepTutorClaudeManagement: Usage tracking is DISABLED - this is backup code only");
            return;
        }

        this.usageTrackingData = {
            // Collection access tracking
            collectionAccess: new Map(),
            // Item view tracking  
            itemViews: new Map(),
            // Tag usage tracking
            tagUsage: new Map(),
            // Search query tracking
            searchQueries: new Map(),
            // DeepTutor feature usage
            deepTutorInteractions: new Map(),
            // User preferences tracking
            preferenceChanges: new Map(),
            // Session tracking
            sessionData: new Map(),
            // Document analysis tracking
            documentAnalysis: new Map(),
            // Last updated timestamp
            lastUpdated: new Date().toISOString()
        };

        // Load existing tracking data from preferences
        this.loadUsageTrackingFromPrefs();
        
        // Set up periodic cleanup and export
        this.setupUsageTrackingMaintenance();
        
        Zotero.debug("DeepTutorClaudeManagement: Usage tracking system initialized (BACKUP MODE)");
    }

    /**
     * Load usage tracking data from Zotero preferences (BACKUP - DO NOT USE)
     */
    loadUsageTrackingFromPrefs() {
        // DO NOT USE - BACKUP IMPLEMENTATION ONLY
        try {
            const savedData = Zotero.Prefs.get('deeptutor.usage.tracking.backup');
            if (savedData) {
                const parsed = JSON.parse(savedData);
                
                // Restore Maps from serialized objects
                this.usageTrackingData.collectionAccess = new Map(Object.entries(parsed.collectionAccess || {}));
                this.usageTrackingData.itemViews = new Map(Object.entries(parsed.itemViews || {}));
                this.usageTrackingData.tagUsage = new Map(Object.entries(parsed.tagUsage || {}));
                this.usageTrackingData.searchQueries = new Map(Object.entries(parsed.searchQueries || {}));
                this.usageTrackingData.deepTutorInteractions = new Map(Object.entries(parsed.deepTutorInteractions || {}));
                this.usageTrackingData.preferenceChanges = new Map(Object.entries(parsed.preferenceChanges || {}));
                this.usageTrackingData.sessionData = new Map(Object.entries(parsed.sessionData || {}));
                this.usageTrackingData.documentAnalysis = new Map(Object.entries(parsed.documentAnalysis || {}));
                
                Zotero.debug("DeepTutorClaudeManagement: Loaded usage tracking data from preferences (BACKUP)");
            }
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error loading usage tracking data: ${error.message}`);
        }
    }

    /**
     * Save usage tracking data to Zotero preferences (BACKUP - DO NOT USE)
     */
    saveUsageTrackingToPrefs() {
        // DO NOT USE - BACKUP IMPLEMENTATION ONLY
        try {
            this.usageTrackingData.lastUpdated = new Date().toISOString();
            
            const serializedData = JSON.stringify({
                collectionAccess: Object.fromEntries(this.usageTrackingData.collectionAccess),
                itemViews: Object.fromEntries(this.usageTrackingData.itemViews),
                tagUsage: Object.fromEntries(this.usageTrackingData.tagUsage),
                searchQueries: Object.fromEntries(this.usageTrackingData.searchQueries),
                deepTutorInteractions: Object.fromEntries(this.usageTrackingData.deepTutorInteractions),
                preferenceChanges: Object.fromEntries(this.usageTrackingData.preferenceChanges),
                sessionData: Object.fromEntries(this.usageTrackingData.sessionData),
                documentAnalysis: Object.fromEntries(this.usageTrackingData.documentAnalysis),
                lastUpdated: this.usageTrackingData.lastUpdated
            });
            
            Zotero.Prefs.set('deeptutor.usage.tracking.backup', serializedData);
            Zotero.debug("DeepTutorClaudeManagement: Saved usage tracking data to preferences (BACKUP)");
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error saving usage tracking data: ${error.message}`);
        }
    }

    /**
     * Track collection access (BACKUP - DO NOT USE)
     * @param {number} collectionID - ID of the collection
     * @param {string} collectionName - Name of the collection
     * @param {string} action - Type of action (select, browse, etc.)
     */
    trackCollectionAccess(collectionID, collectionName, action = 'select') {
        // DO NOT USE - BACKUP IMPLEMENTATION ONLY
        if (!this.usageTrackingEnabled) return;
        
        const key = `collection_${collectionID}`;
        const current = this.usageTrackingData.collectionAccess.get(key) || {
            id: collectionID,
            name: collectionName,
            accessCount: 0,
            lastAccess: null,
            actions: []
        };
        
        current.accessCount++;
        current.lastAccess = new Date().toISOString();
        current.actions.push({
            action: action,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 50 actions to prevent data bloat
        if (current.actions.length > 50) {
            current.actions = current.actions.slice(-50);
        }
        
        this.usageTrackingData.collectionAccess.set(key, current);
        this.saveUsageTrackingToPrefs();
    }

    /**
     * Track item view/interaction (BACKUP - DO NOT USE)
     * @param {number} itemID - ID of the item
     * @param {string} itemTitle - Title of the item
     * @param {string} itemType - Type of item (journalArticle, book, etc.)
     * @param {string} action - Type of action (view, select, open, etc.)
     */
    trackItemView(itemID, itemTitle, itemType, action = 'view') {
        // DO NOT USE - BACKUP IMPLEMENTATION ONLY
        if (!this.usageTrackingEnabled) return;
        
        const key = `item_${itemID}`;
        const current = this.usageTrackingData.itemViews.get(key) || {
            id: itemID,
            title: itemTitle,
            type: itemType,
            viewCount: 0,
            lastView: null,
            actions: []
        };
        
        current.viewCount++;
        current.lastView = new Date().toISOString();
        current.actions.push({
            action: action,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 30 actions per item
        if (current.actions.length > 30) {
            current.actions = current.actions.slice(-30);
        }
        
        this.usageTrackingData.itemViews.set(key, current);
        this.saveUsageTrackingToPrefs();
    }

    /**
     * Track tag usage (BACKUP - DO NOT USE)
     * @param {string} tagName - Name of the tag
     * @param {number} itemID - ID of the item being tagged
     * @param {string} action - Type of action (add, remove, search)
     */
    trackTagUsage(tagName, itemID, action = 'add') {
        // DO NOT USE - BACKUP IMPLEMENTATION ONLY
        if (!this.usageTrackingEnabled) return;
        
        const key = `tag_${tagName}`;
        const current = this.usageTrackingData.tagUsage.get(key) || {
            name: tagName,
            usageCount: 0,
            lastUsed: null,
            items: new Set(),
            actions: []
        };
        
        current.usageCount++;
        current.lastUsed = new Date().toISOString();
        current.items.add(itemID);
        current.actions.push({
            action: action,
            itemID: itemID,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 100 actions per tag
        if (current.actions.length > 100) {
            current.actions = current.actions.slice(-100);
        }
        
        this.usageTrackingData.tagUsage.set(key, current);
        this.saveUsageTrackingToPrefs();
    }

    /**
     * Track DeepTutor feature usage (BACKUP - DO NOT USE)
     * @param {string} feature - Name of the feature used
     * @param {Object} metadata - Additional metadata about the usage
     */
    trackDeepTutorInteraction(feature, metadata = {}) {
        // DO NOT USE - BACKUP IMPLEMENTATION ONLY
        if (!this.usageTrackingEnabled) return;
        
        const key = `feature_${feature}`;
        const current = this.usageTrackingData.deepTutorInteractions.get(key) || {
            feature: feature,
            usageCount: 0,
            lastUsed: null,
            sessions: new Set(),
            metadata: []
        };
        
        current.usageCount++;
        current.lastUsed = new Date().toISOString();
        current.sessions.add(metadata.sessionId || 'unknown');
        current.metadata.push({
            ...metadata,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 200 interactions per feature
        if (current.metadata.length > 200) {
            current.metadata = current.metadata.slice(-200);
        }
        
        this.usageTrackingData.deepTutorInteractions.set(key, current);
        this.saveUsageTrackingToPrefs();
    }

    /**
     * Track document analysis (BACKUP - DO NOT USE)
     * @param {number} itemID - ID of the document analyzed
     * @param {string} analysisType - Type of analysis performed
     * @param {Object} results - Analysis results metadata
     */
    trackDocumentAnalysis(itemID, analysisType, results = {}) {
        // DO NOT USE - BACKUP IMPLEMENTATION ONLY
        if (!this.usageTrackingEnabled) return;
        
        const key = `analysis_${itemID}_${analysisType}`;
        const current = this.usageTrackingData.documentAnalysis.get(key) || {
            itemID: itemID,
            analysisType: analysisType,
            analysisCount: 0,
            lastAnalysis: null,
            results: []
        };
        
        current.analysisCount++;
        current.lastAnalysis = new Date().toISOString();
        current.results.push({
            ...results,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 50 analyses per document/type combination
        if (current.results.length > 50) {
            current.results = current.results.slice(-50);
        }
        
        this.usageTrackingData.documentAnalysis.set(key, current);
        this.saveUsageTrackingToPrefs();
    }

    /**
     * Generate usage statistics report (BACKUP - DO NOT USE)
     * @returns {Object} Comprehensive usage statistics
     */
    generateUsageStatistics() {
        // DO NOT USE - BACKUP IMPLEMENTATION ONLY
        if (!this.usageTrackingEnabled) return null;
        
        const stats = {
            timestamp: new Date().toISOString(),
            summary: {
                totalCollectionAccesses: 0,
                totalItemViews: 0,
                totalTagUsages: 0,
                totalDeepTutorInteractions: 0,
                totalDocumentAnalyses: 0
            },
            topCollections: [],
            topItems: [],
            topTags: [],
            topFeatures: [],
            recentActivity: []
        };
        
        // Calculate collection statistics
        for (const [key, data] of this.usageTrackingData.collectionAccess) {
            stats.summary.totalCollectionAccesses += data.accessCount;
            stats.topCollections.push({
                id: data.id,
                name: data.name,
                accessCount: data.accessCount,
                lastAccess: data.lastAccess
            });
        }
        
        // Calculate item statistics
        for (const [key, data] of this.usageTrackingData.itemViews) {
            stats.summary.totalItemViews += data.viewCount;
            stats.topItems.push({
                id: data.id,
                title: data.title,
                type: data.type,
                viewCount: data.viewCount,
                lastView: data.lastView
            });
        }
        
        // Calculate tag statistics
        for (const [key, data] of this.usageTrackingData.tagUsage) {
            stats.summary.totalTagUsages += data.usageCount;
            stats.topTags.push({
                name: data.name,
                usageCount: data.usageCount,
                lastUsed: data.lastUsed,
                uniqueItems: data.items.size
            });
        }
        
        // Calculate feature statistics
        for (const [key, data] of this.usageTrackingData.deepTutorInteractions) {
            stats.summary.totalDeepTutorInteractions += data.usageCount;
            stats.topFeatures.push({
                feature: data.feature,
                usageCount: data.usageCount,
                lastUsed: data.lastUsed,
                uniqueSessions: data.sessions.size
            });
        }
        
        // Calculate analysis statistics
        for (const [key, data] of this.usageTrackingData.documentAnalysis) {
            stats.summary.totalDocumentAnalyses += data.analysisCount;
        }
        
        // Sort top lists
        stats.topCollections.sort((a, b) => b.accessCount - a.accessCount);
        stats.topItems.sort((a, b) => b.viewCount - a.viewCount);
        stats.topTags.sort((a, b) => b.usageCount - a.usageCount);
        stats.topFeatures.sort((a, b) => b.usageCount - a.usageCount);
        
        // Keep only top 10 of each
        stats.topCollections = stats.topCollections.slice(0, 10);
        stats.topItems = stats.topItems.slice(0, 10);
        stats.topTags = stats.topTags.slice(0, 10);
        stats.topFeatures = stats.topFeatures.slice(0, 10);
        
        return stats;
    }

    /**
     * Export usage data to markdown file (BACKUP - DO NOT USE)
     * @param {string} filePath - Path to save the markdown file
     */
    async exportUsageDataToMarkdown(filePath) {
        // DO NOT USE - BACKUP IMPLEMENTATION ONLY
        if (!this.usageTrackingEnabled) return;
        
        try {
            const stats = this.generateUsageStatistics();
            if (!stats) return;
            
            const markdown = this.formatUsageDataAsMarkdown(stats);
            await this.writeTextFile(filePath, markdown);
            Zotero.debug(`DeepTutorClaudeManagement: Exported usage data to ${filePath} (BACKUP)`);
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error exporting usage data: ${error.message}`);
        }
    }

    /**
     * Format usage data as markdown (BACKUP - DO NOT USE)
     * @param {Object} stats - Usage statistics object
     * @returns {string} Formatted markdown content
     */
    formatUsageDataAsMarkdown(stats) {
        // DO NOT USE - BACKUP IMPLEMENTATION ONLY
        const markdown = `# DeepTutor Usage Report (BACKUP)

Generated: ${stats.timestamp}

## Summary
- Total Collection Accesses: ${stats.summary.totalCollectionAccesses}
- Total Item Views: ${stats.summary.totalItemViews}
- Total Tag Usages: ${stats.summary.totalTagUsages}
- Total DeepTutor Interactions: ${stats.summary.totalDeepTutorInteractions}
- Total Document Analyses: ${stats.summary.totalDocumentAnalyses}

## Top Collections
${stats.topCollections.map(col => `- **${col.name}**: ${col.accessCount} accesses (last: ${col.lastAccess})`).join('\n')}

## Top Items
${stats.topItems.map(item => `- **${item.title}** (${item.type}): ${item.viewCount} views (last: ${item.lastView})`).join('\n')}

## Top Tags
${stats.topTags.map(tag => `- **${tag.name}**: ${tag.usageCount} uses, ${tag.uniqueItems} unique items (last: ${tag.lastUsed})`).join('\n')}

## Top DeepTutor Features
${stats.topFeatures.map(feature => `- **${feature.feature}**: ${feature.usageCount} uses, ${feature.uniqueSessions} sessions (last: ${feature.lastUsed})`).join('\n')}

---
*This is a backup usage tracking report. Data collection is disabled by default.*
`;

        return markdown;
    }

    /**
     * Setup maintenance tasks for usage tracking (BACKUP - DO NOT USE)
     */
    setupUsageTrackingMaintenance() {
        // DO NOT USE - BACKUP IMPLEMENTATION ONLY
        if (!this.usageTrackingEnabled) return;
        
        // Clean up old data every 24 hours
        setInterval(() => {
            this.cleanupOldUsageData();
        }, 24 * 60 * 60 * 1000);
        
        // Export data every 7 days
        setInterval(async () => {
            const exportPath = this.getUserDataPath() + '/usage_report_backup.md';
            await this.exportUsageDataToMarkdown(exportPath);
        }, 7 * 24 * 60 * 60 * 1000);
    }

    /**
     * Clean up old usage data (BACKUP - DO NOT USE)
     */
    cleanupOldUsageData() {
        // DO NOT USE - BACKUP IMPLEMENTATION ONLY
        if (!this.usageTrackingEnabled) return;
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 90); // Keep 90 days of data
        
        // Clean up old collection access data
        for (const [key, data] of this.usageTrackingData.collectionAccess) {
            if (new Date(data.lastAccess) < cutoffDate) {
                this.usageTrackingData.collectionAccess.delete(key);
            }
        }
        
        // Clean up old item view data
        for (const [key, data] of this.usageTrackingData.itemViews) {
            if (new Date(data.lastView) < cutoffDate) {
                this.usageTrackingData.itemViews.delete(key);
            }
        }
        
        this.saveUsageTrackingToPrefs();
        Zotero.debug("DeepTutorClaudeManagement: Cleaned up old usage data (BACKUP)");
    }

    /**
     * Get usage data for Claude integration (BACKUP - DO NOT USE)
     * @returns {Object} Formatted usage data for Claude requests
     */
    getUserUsageDataForClaude() {
        // DO NOT USE - BACKUP IMPLEMENTATION ONLY
        if (!this.usageTrackingEnabled) return null;
        
        const stats = this.generateUsageStatistics();
        if (!stats) return null;
        
        return {
            userProfile: {
                researchPatterns: {
                    mostUsedCollections: stats.topCollections.slice(0, 5),
                    mostViewedItems: stats.topItems.slice(0, 5),
                    mostUsedTags: stats.topTags.slice(0, 5),
                    preferredItemTypes: this.getPreferredItemTypes()
                },
                deepTutorUsage: {
                    mostUsedFeatures: stats.topFeatures.slice(0, 5),
                    totalInteractions: stats.summary.totalDeepTutorInteractions,
                    analysisPatterns: this.getAnalysisPatterns()
                },
                activityLevel: this.getActivityLevel(stats),
                lastUpdated: stats.timestamp
            }
        };
    }

    /**
     * Get preferred item types from usage data (BACKUP - DO NOT USE)
     * @returns {Array} Array of preferred item types
     */
    getPreferredItemTypes() {
        // DO NOT USE - BACKUP IMPLEMENTATION ONLY
        const typeCounts = {};
        
        for (const [key, data] of this.usageTrackingData.itemViews) {
            typeCounts[data.type] = (typeCounts[data.type] || 0) + data.viewCount;
        }
        
        return Object.entries(typeCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([type, count]) => ({ type, count }));
    }

    /**
     * Get analysis patterns from usage data (BACKUP - DO NOT USE)
     * @returns {Array} Array of analysis patterns
     */
    getAnalysisPatterns() {
        // DO NOT USE - BACKUP IMPLEMENTATION ONLY
        const analysisCounts = {};
        
        for (const [key, data] of this.usageTrackingData.documentAnalysis) {
            analysisCounts[data.analysisType] = (analysisCounts[data.analysisType] || 0) + data.analysisCount;
        }
        
        return Object.entries(analysisCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([type, count]) => ({ type, count }));
    }

    /**
     * Get user activity level (BACKUP - DO NOT USE)
     * @param {Object} stats - Usage statistics
     * @returns {string} Activity level (low, medium, high)
     */
    getActivityLevel(stats) {
        // DO NOT USE - BACKUP IMPLEMENTATION ONLY
        const totalActivity = stats.summary.totalCollectionAccesses + 
                            stats.summary.totalItemViews + 
                            stats.summary.totalDeepTutorInteractions;
        
        if (totalActivity < 50) return 'low';
        if (totalActivity < 200) return 'medium';
        return 'high';
    }

    /**
     * ============================================================================
     * EVENT TRACKING ENDPOINT EXAMPLES (COMMENTED OUT - DO NOT USE)
     * ============================================================================
     * 
     * These are examples of where to place tracking endpoints in the existing
     * Zotero codebase. DO NOT uncomment or use these without proper implementation.
     * ============================================================================
     */

    /*
    // EXAMPLE 1: Collection Selection Tracking
    // Location: chrome/content/zotero/zoteroPane.js, line ~1913
    // In the onCollectionSelected function:
    
    this.onCollectionSelected = Zotero.serial(async function () {
        var collectionTreeRow = this.getCollectionTreeRow();
        if (!collectionTreeRow) {
            Zotero.debug('ZoteroPane.onCollectionSelected: No selected collection found');
            return;
        }
        
        // ... existing Zotero logic ...
        
        // ADD TRACKING ENDPOINT HERE:
        // if (window.DeepTutorClaudeManagement && window.DeepTutorClaudeManagement.usageTrackingEnabled) {
        //     window.DeepTutorClaudeManagement.trackCollectionAccess(
        //         collectionTreeRow.id, 
        //         collectionTreeRow.getName(), 
        //         'select'
        //     );
        // }
        
        this.itemsView.changeCollectionTreeRow(collectionTreeRow);
    });
    */

    /*
    // EXAMPLE 2: Item Selection Tracking
    // Location: chrome/content/zotero/zoteroPane.js, line ~2041
    // In the itemSelected function:
    
    this.itemSelected = function () {
        return Zotero.Promise.coroutine(function* () {
            // ... existing logic ...
            
            var selectedItems = this.itemsView.getSelectedObjects();
            
            // ADD TRACKING ENDPOINT HERE:
            // if (window.DeepTutorClaudeManagement && window.DeepTutorClaudeManagement.usageTrackingEnabled) {
            //     selectedItems.forEach(item => {
            //         window.DeepTutorClaudeManagement.trackItemView(
            //             item.id, 
            //             item.getField('title'), 
            //             item.itemTypeID, 
            //             'select'
            //     );
            //     });
            // }
            
            return this.itemPane.render();
        }.bind(this))()
    }
    */

    /*
    // EXAMPLE 3: Tag Addition Tracking
    // Location: chrome/content/zotero/xpcom/data/items.js
    // In the addTag function:
    
    addTag: function (tag, type) {
        // ... existing logic ...
        
        // ADD TRACKING ENDPOINT HERE:
        // if (window.DeepTutorClaudeManagement && window.DeepTutorClaudeManagement.usageTrackingEnabled) {
        //     window.DeepTutorClaudeManagement.trackTagUsage(tag, this.id, 'add');
        // }
        
        return this.save();
    }
    */

    /*
    // EXAMPLE 4: DeepTutor Feature Usage Tracking
    // Location: chrome/content/zotero/DeepTutorChatBox.js
    // In the sendToAPI function:
    
    const sendToAPI = async (userMessage, context) => {
        // ADD TRACKING ENDPOINT HERE:
        // if (window.DeepTutorClaudeManagement && window.DeepTutorClaudeManagement.usageTrackingEnabled) {
        //     window.DeepTutorClaudeManagement.trackDeepTutorInteraction('claude_query', {
        //         messageLength: userMessage.length,
        //         contextDocuments: context.length,
        //         sessionId: sessionId,
        //         timestamp: new Date().toISOString()
        //     });
        // }
        
        // ... existing API call logic ...
    }
    */

    /*
    // EXAMPLE 5: Document Analysis Tracking
    // Location: chrome/content/zotero/DeepTutorClaudeManagement.js
    // In the convertPDFToMarkdown function:
    
    async convertPDFToMarkdown(pdfFilePath) {
        // ... existing logic ...
        
        // ADD TRACKING ENDPOINT HERE:
        // if (this.usageTrackingEnabled) {
        //     this.trackDocumentAnalysis(
        //         attachmentItem.id, 
        //         'pdf_conversion', 
        //         {
        //             fileSize: fileSize,
        //             totalPages: totalPages,
        //             extractedPages: extractedPages,
        //             processingTime: Date.now() - startTime
        //         }
        //     );
        // }
        
        return markdownContent;
    }
    */

    /*
    // EXAMPLE 6: Search Query Tracking
    // Location: chrome/content/zotero/zoteroPane.js
    // In search-related functions:
    
    this.performSearch = function(query) {
        // ... existing search logic ...
        
        // ADD TRACKING ENDPOINT HERE:
        // if (window.DeepTutorClaudeManagement && window.DeepTutorClaudeManagement.usageTrackingEnabled) {
        //     window.DeepTutorClaudeManagement.trackSearchQuery(query, {
        //         resultCount: results.length,
        //         searchType: 'quick_search',
        //         timestamp: new Date().toISOString()
        //     });
        // }
        
        return results;
    }
    */

    /*
    // EXAMPLE 7: Preference Change Tracking
    // Location: chrome/content/zotero/preferences/
    // In preference change handlers:
    
    onPreferenceChange = function(prefName, newValue, oldValue) {
        // ... existing logic ...
        
        // ADD TRACKING ENDPOINT HERE:
        // if (window.DeepTutorClaudeManagement && window.DeepTutorClaudeManagement.usageTrackingEnabled) {
        //     window.DeepTutorClaudeManagement.trackPreferenceChange(prefName, newValue, oldValue);
        // }
    }
    */

    /**
     * ============================================================================
     * END OF USAGE TRACKING BACKUP SYSTEM
     * ============================================================================
     */

    /**
     * Generate file hierarchy using direct SQL queries for better performance and reliability
     * Creates a hierarchical map structure based on parent/child relationships
     * @returns {Object} Complete hierarchy mapping object
     */
    async generateFileHierarchySQL() {
        try {
            Zotero.debug("DeepTutorClaudeManagement: Starting SQL-based file hierarchy generation...");
            
            if (this.hierarchyCache) {
                Zotero.debug("DeepTutorClaudeManagement: Using cached hierarchy data");
                return this.hierarchyCache;
            }

            const userLibID = Zotero.Libraries.userLibraryID;
            const hierarchyData = {
                timestamp: new Date().toISOString(),
                library: {
                    id: userLibID,
                    name: 'User Library',
                    type: 'user'
                },
                collections: {},
                uncategorized: {
                    type: 'uncategorized',
                    name: 'Uncategorized',
                    items: [],
                    itemCount: 0
                },
                statistics: {
                    totalCollections: 0,
                    totalItems: 0,
                    totalAttachments: 0,
                    totalPDFs: 0
                }
            };

            // Step 1: Get all collections using API (not SQL - bro learned his lesson!)
            Zotero.debug("DeepTutorClaudeManagement: Step 1 - Retrieving collections via API (no more SQL pain!)...");
            const collections = await this.getCollectionsViaAPI(userLibID);
            Zotero.debug(`DeepTutorClaudeManagement: Found ${collections.length} collections`);

            // Step 2: Build hierarchical collection map
            Zotero.debug("DeepTutorClaudeManagement: Step 2 - Building hierarchical collection map...");
            const collectionMap = this.buildCollectionHierarchyMap(collections);
            hierarchyData.collections = collectionMap;

            // Step 3: Get all items using API (ditched SQL for good!)
            Zotero.debug("DeepTutorClaudeManagement: Step 3 - Retrieving items via API (much safer!)...");
            const items = await this.getItemsViaAPI(userLibID);
            Zotero.debug(`DeepTutorClaudeManagement: Found ${items.length} items`);

            // Step 4: Position items in collection hierarchy
            Zotero.debug("DeepTutorClaudeManagement: Step 4 - Positioning items in collection hierarchy...");
            await this.positionItemsInHierarchy(items, collectionMap, hierarchyData);

            // Step 5: Calculate statistics
            Zotero.debug("DeepTutorClaudeManagement: Step 5 - Calculating statistics...");
            this.calculateHierarchyStatisticsSQL(hierarchyData);

            // Step 6: Export to markdown
            Zotero.debug("DeepTutorClaudeManagement: Step 6 - Exporting to markdown...");
            const hierarchyMarkdown = this.generateSQLHierarchyMarkdown(hierarchyData);
            
            // Save files with clear naming
            const hierarchyJsonPath = this.pathJoin(this.fileTreePath, 'File_Hierarchy_SQL_REAL.json');
            const hierarchyMdPath = this.pathJoin(this.fileTreePath, 'File_Hierarchy_SQL_REAL.md');
            
            this.writeTextFile(hierarchyJsonPath, JSON.stringify(hierarchyData, null, 2));
            this.writeTextFile(hierarchyMdPath, hierarchyMarkdown);
            
            Zotero.debug(`DeepTutorClaudeManagement: 🎉 BRO! FILES EXPORTED TO:`);
            Zotero.debug(`DeepTutorClaudeManagement: 📄 JSON FILE: ${hierarchyJsonPath}`);
            Zotero.debug(`DeepTutorClaudeManagement: 📝 MARKDOWN FILE: ${hierarchyMdPath}`);
            Zotero.debug(`DeepTutorClaudeManagement: 📁 BASE DIRECTORY: ${this.dataDirectory}`);
            Zotero.debug(`DeepTutorClaudeManagement: 🏗️ DEEPTUTOR PATH: ${this.deepTutorDBPath}`);
            Zotero.debug(`DeepTutorClaudeManagement: 🌳 FILETREE PATH: ${this.fileTreePath}`);
            
            // Cache the result
            this.hierarchyCache = hierarchyData;
            
            Zotero.debug(`DeepTutorClaudeManagement: SQL-based file hierarchy generated successfully. Collections: ${hierarchyData.statistics.totalCollections}, Items: ${hierarchyData.statistics.totalItems}`);
            return hierarchyData;
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error generating SQL-based file hierarchy: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get all collections using Zotero API instead of SQL - BRO SAFE VERSION! 😎
     * @param {number} libraryID - Library ID
     * @returns {Array} Array of collection objects with metadata
     */
    async getCollectionsViaAPI(libraryID) {
        try {
            Zotero.debug(`DeepTutorClaudeManagement: 🚀 BRO! Using Zotero API to get collections for library ${libraryID}`);
            
            // Use the actual Zotero Collections API that KNOWS what it's doing!
            const collections = Zotero.Collections.getByLibrary(libraryID, true); // recursive = true
            
            if (!collections) {
                Zotero.debug("DeepTutorClaudeManagement: 😅 No collections found, but that's cool!");
                return [];
            }
            
            Zotero.debug(`DeepTutorClaudeManagement: 🎉 Found ${collections.length} collections using the API like a boss!`);
            
            return collections.map(collection => ({
                id: collection.id,
                key: collection.key,
                name: collection.name,
                parentID: collection.parentID,
                libraryID: collection.libraryID,
                version: collection.version || 0,
                synced: collection.synced || true,
                deleted: collection.deleted || false,
                level: collection.level || 0 // Zotero might give us this for free!
            }));
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: 😱 Error getting collections via API: ${error.message}`);
            throw error;
        }
    }

    /**
     * Build hierarchical collection map based on parent/child relationships
     * @param {Array} collections - Array of collection objects
     * @returns {Object} Hierarchical collection map
     */
    buildCollectionHierarchyMap(collections) {
        try {
            const collectionMap = {};
            const collectionById = {};
            
            // First pass: create all collection objects
            for (const collection of collections) {
                const collectionData = {
                    id: collection.id,
                    key: collection.key,
                    name: collection.name,
                    parentID: collection.parentID,
                    libraryID: collection.libraryID,
                    version: collection.version,
                    synced: collection.synced,
                    deleted: collection.deleted,
                    type: 'collection',
                    level: 0,
                    fullPath: collection.name,
                    items: [],
                    subcollections: {},
                    itemCount: 0,
                    attachmentCount: 0,
                    pdfCount: 0,
                    metadata: {
                        version: collection.version,
                        synced: collection.synced,
                        deleted: collection.deleted
                    }
                };
                
                collectionById[collection.id] = collectionData;
                
                // Root collections go directly to the map
                if (!collection.parentID) {
                    collectionMap[collection.key] = collectionData;
                }
            }
            
            // Second pass: establish parent/child relationships
            for (const collection of collections) {
                if (collection.parentID && collectionById[collection.parentID]) {
                    const parent = collectionById[collection.parentID];
                    const child = collectionById[collection.id];
                    
                    // Add to parent's subcollections
                    parent.subcollections[child.key] = child;
                    
                    // Calculate level and full path
                    child.level = parent.level + 1;
                    child.fullPath = `${parent.fullPath} > ${child.name}`;
                    
                    // Update parent's full path if needed
                    if (parent.fullPath === parent.name) {
                        parent.fullPath = parent.name;
                    }
                }
            }
            
            // Third pass: calculate levels for all collections
            const calculateLevels = (collections, baseLevel = 0) => {
                for (const key in collections) {
                    const collection = collections[key];
                    collection.level = baseLevel;
                    
                    if (Object.keys(collection.subcollections).length > 0) {
                        calculateLevels(collection.subcollections, baseLevel + 1);
                    }
                }
            };
            
            calculateLevels(collectionMap);
            
            Zotero.debug(`DeepTutorClaudeManagement: Built hierarchical map with ${Object.keys(collectionMap).length} root collections`);
            return collectionMap;
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error building collection hierarchy map: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get all items using Zotero API instead of SQL - BRO SAFE VERSION! 🎯
     * @param {number} libraryID - Library ID
     * @returns {Array} Array of item objects with metadata
     */
    async getItemsViaAPI(libraryID) {
        try {
            Zotero.debug(`DeepTutorClaudeManagement: 🎯 BRO! Using Zotero API to get items for library ${libraryID}`);
            
            // Use the actual Zotero Items API that actually works!
            const items = await Zotero.Items.getAll(libraryID);
            
            if (!items) {
                Zotero.debug("DeepTutorClaudeManagement: 😅 No items found, but that's totally fine!");
                return [];
            }
            
            Zotero.debug(`DeepTutorClaudeManagement: 🎉 Found ${items.length} total items using the API!`);
            
            // Filter to only regular items (not attachments, notes, etc.)
            const regularItems = items.filter(item => {
                try {
                    return item.isRegularItem && item.isRegularItem();
                } catch (e) {
                    return false; // If we can't check, skip it
                }
            });
            
            Zotero.debug(`DeepTutorClaudeManagement: 🔥 Filtered to ${regularItems.length} regular items!`);
            
            const processedItems = [];
            
            for (const item of regularItems) {
                try {
                    const processedItem = {
                        id: item.id,
                        key: item.key,
                        itemTypeID: item.itemTypeID,
                        libraryID: item.libraryID,
                        dateAdded: item.dateAdded,
                        dateModified: item.dateModified,
                        version: item.version || 0,
                        synced: item.synced || true,
                        itemType: item.itemType,
                        title: item.getField('title') || `Item ${item.id}`,
                        date: item.getField('date') || '',
                        abstractNote: item.getField('abstractNote') || '',
                        publicationTitle: item.getField('publicationTitle') || '',
                        volume: item.getField('volume') || '',
                        issue: item.getField('issue') || '',
                        pages: item.getField('pages') || '',
                        DOI: item.getField('DOI') || '',
                        ISBN: item.getField('ISBN') || '',
                        ISSN: item.getField('ISSN') || '',
                        url: item.getField('url') || '',
                        attachments: [],
                        attachmentCount: 0,
                        pdfCount: 0
                    };
                    
                    // Get attachments the PROPER way!
                    try {
                        const attachmentIDs = item.getAttachments();
                        processedItem.attachmentCount = attachmentIDs.length;
                        
                        for (const attachmentID of attachmentIDs) {
                            const attachment = Zotero.Items.get(attachmentID);
                            if (attachment && attachment.isAttachment && attachment.isAttachment()) {
                                const attachmentData = {
                                    id: attachment.id,
                                    key: attachment.key,
                                    filename: attachment.attachmentFilename || '',
                                    contentType: attachment.attachmentContentType || '',
                                    fileSize: attachment.attachmentFileSize || 0,
                                    type: 'attachment',
                                    isPDF: this.isPDFAttachment(attachment)
                                };
                                
                                processedItem.attachments.push(attachmentData);
                                if (attachmentData.isPDF) {
                                    processedItem.pdfCount++;
                                }
                            }
                        }
                    } catch (attachError) {
                        Zotero.debug(`DeepTutorClaudeManagement: 😅 Error getting attachments for item ${item.id}: ${attachError.message}`);
                    }
                    
                    processedItems.push(processedItem);
                } catch (itemError) {
                    Zotero.debug(`DeepTutorClaudeManagement: 😅 Error processing item ${item.id}: ${itemError.message}`);
                }
            }
            
            Zotero.debug(`DeepTutorClaudeManagement: 🚀 Successfully processed ${processedItems.length} items!`);
            return processedItems;
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: 😱 Error getting items via API: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get metadata for a specific item using SQL
     * @param {Object} item - Item object to populate with metadata
     */
    async getItemMetadataViaSQL(item) {
        try {
            // Get item data values
            const dataSQL = `
                SELECT 
                    f.fieldName,
                    idv.value
                FROM itemData id
                JOIN itemDataValues idv ON id.valueID = idv.valueID
                JOIN fields f ON id.fieldID = f.fieldID
                WHERE id.itemID = ?
            `;
            
            const dataResults = await Zotero.DB.queryAsync(dataSQL, [item.id]);
            
            for (const row of dataResults) {
                switch (row.fieldName) {
                    case 'title':
                        item.title = row.value || '';
                        break;
                    case 'date':
                        item.date = row.value || '';
                        break;
                    case 'abstractNote':
                        item.abstractNote = row.value || '';
                        break;
                    case 'publicationTitle':
                        item.publicationTitle = row.value || '';
                        break;
                    case 'volume':
                        item.volume = row.value || '';
                        break;
                    case 'issue':
                        item.issue = row.value || '';
                        break;
                    case 'pages':
                        item.pages = row.value || '';
                        break;
                    case 'DOI':
                        item.DOI = row.value || '';
                        break;
                    case 'ISBN':
                        item.ISBN = row.value || '';
                        break;
                    case 'ISSN':
                        item.ISSN = row.value || '';
                        break;
                    case 'url':
                        item.url = row.value || '';
                        break;
                }
            }
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error getting metadata for item ${item.id}: ${error.message}`);
        }
    }

    /**
     * Get attachments for a specific item using SQL
     * @param {Object} item - Item object to populate with attachments
     */
    async getItemAttachmentsViaSQL(item) {
        try {
            const sql = `
                SELECT 
                    a.itemID,
                    a.key,
                    ia.path,
                    ia.mimeType,
                    a.dateAdded,
                    a.dateModified,
                    a.version,
                    a.synced
                FROM items a
                LEFT JOIN itemAttachments ia ON a.itemID = ia.itemID
                WHERE a.parentItemID = ? AND a.deleted = 0
                ORDER BY a.dateAdded
            `;
            
            const results = await Zotero.DB.queryAsync(sql, [item.id]);
            
            for (const row of results) {
                // Extract filename from path
                let filename = '';
                if (row.path) {
                    const pathParts = row.path.split(/[/\\]/);
                    filename = pathParts[pathParts.length - 1] || '';
                }
                
                const attachment = {
                    id: row.itemID,
                    key: row.key,
                    filename: filename,
                    contentType: row.mimeType || '',
                    fileSize: 0, // File size not easily available via SQL
                    dateAdded: row.dateAdded,
                    dateModified: row.dateModified,
                    version: row.version,
                    synced: row.synced,
                    type: 'attachment',
                    isPDF: this.isPDFAttachmentFromData(row.mimeType, filename)
                };
                
                item.attachments.push(attachment);
                item.attachmentCount++;
                
                if (attachment.isPDF) {
                    item.pdfCount++;
                }
            }
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error getting attachments for item ${item.id}: ${error.message}`);
        }
    }

    /**
     * Check if attachment is PDF based on content type and filename
     * @param {string} contentType - MIME content type
     * @param {string} filename - Filename
     * @returns {boolean} True if PDF
     */
    isPDFAttachmentFromData(contentType, filename) {
        if (!contentType && !filename) return false;
        
        const mime = String(contentType || '').toLowerCase();
        const filenameStr = String(filename || '');
        
        return mime.includes('pdf') || /\.pdf$/i.test(filenameStr);
    }

    /**
     * Position items in the collection hierarchy
     * @param {Array} items - Array of item objects
     * @param {Object} collectionMap - Collection hierarchy map
     * @param {Object} hierarchyData - Main hierarchy data object
     */
    async positionItemsInHierarchy(items, collectionMap, hierarchyData) {
        try {
            // Get collection membership for all items using API (no more SQL nightmares!)
            const itemCollectionMap = await this.getItemCollectionMembershipViaAPI(items);
            
            for (const item of items) {
                const collectionIDs = itemCollectionMap.get(item.id) || [];
                
                if (collectionIDs.length === 0) {
                    // Uncategorized item
                    const uncategorizedItem = {
                        id: item.id,
                        key: item.key,
                        title: item.title || 'Untitled',
                        itemType: item.itemType,
                        date: item.date || '',
                        type: 'item',
                        attachments: item.attachments,
                        attachmentCount: item.attachmentCount,
                        pdfCount: item.pdfCount,
                        metadata: {
                            dateAdded: item.dateAdded,
                            dateModified: item.dateModified,
                            abstractNote: item.abstractNote,
                            publicationTitle: item.publicationTitle,
                            volume: item.volume,
                            issue: item.issue,
                            pages: item.pages,
                            DOI: item.DOI,
                            ISBN: item.ISBN,
                            ISSN: item.ISSN,
                            url: item.url,
                            version: item.version,
                            synced: item.synced
                        }
                    };
                    
                    hierarchyData.uncategorized.items.push(uncategorizedItem);
                    hierarchyData.uncategorized.itemCount++;
                } else {
                    // Add to collections
                    for (const collectionID of collectionIDs) {
                        this.addItemToCollection(item, collectionID, collectionMap);
                    }
                }
            }
            
            Zotero.debug(`DeepTutorClaudeManagement: Positioned ${items.length} items in hierarchy`);
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error positioning items in hierarchy: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get collection membership using Zotero API - BRO SAFE VERSION! 🎪
     * @param {Array} items - Array of item objects (not just IDs)
     * @returns {Map} Map of itemID to array of collectionIDs
     */
    async getItemCollectionMembershipViaAPI(items) {
        try {
            if (items.length === 0) return new Map();
            
            Zotero.debug(`DeepTutorClaudeManagement: 🎪 Getting collection membership for ${items.length} items via API!`);
            
            const membershipMap = new Map();
            
            for (const itemData of items) {
                try {
                    // Get the actual Zotero item object
                    const item = Zotero.Items.get(itemData.id);
                    if (item) {
                        // Use the API method that actually works!
                        const collectionIDs = item.getCollections();
                        if (collectionIDs && collectionIDs.length > 0) {
                            membershipMap.set(itemData.id, collectionIDs);
                            Zotero.debug(`DeepTutorClaudeManagement: 🎯 Item ${itemData.id} is in ${collectionIDs.length} collections`);
                        } else {
                            membershipMap.set(itemData.id, []);
                        }
                    }
                } catch (itemError) {
                    Zotero.debug(`DeepTutorClaudeManagement: 😅 Error getting collections for item ${itemData.id}: ${itemError.message}`);
                    membershipMap.set(itemData.id, []); // Default to uncategorized
                }
            }
            
            Zotero.debug(`DeepTutorClaudeManagement: 🚀 Successfully mapped ${membershipMap.size} items to their collections!`);
            return membershipMap;
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: 😱 Error getting item collection membership via API: ${error.message}`);
            return new Map();
        }
    }

    /**
     * Add item to collection in the hierarchy map
     * @param {Object} item - Item object
     * @param {number} collectionID - Collection ID
     * @param {Object} collectionMap - Collection hierarchy map
     */
    addItemToCollection(item, collectionID, collectionMap) {
        try {
            const findCollection = (collections, targetID) => {
                for (const key in collections) {
                    const collection = collections[key];
                    if (collection.id === targetID) {
                        return collection;
                    }
                    if (Object.keys(collection.subcollections).length > 0) {
                        const found = findCollection(collection.subcollections, targetID);
                        if (found) return found;
                    }
                }
                return null;
            };
            
            const collection = findCollection(collectionMap, collectionID);
            if (collection) {
                const collectionItem = {
                    id: item.id,
                    key: item.key,
                    title: item.title || 'Untitled',
                    itemType: item.itemType,
                    date: item.date || '',
                    type: 'item',
                    attachments: item.attachments,
                    attachmentCount: item.attachmentCount,
                    pdfCount: item.pdfCount,
                    metadata: {
                        dateAdded: item.dateAdded,
                        dateModified: item.dateModified,
                        abstractNote: item.abstractNote,
                        publicationTitle: item.publicationTitle,
                        volume: item.volume,
                        issue: item.issue,
                        pages: item.pages,
                        DOI: item.DOI,
                        ISBN: item.ISBN,
                        ISSN: item.ISSN,
                        url: item.url,
                        version: item.version,
                        synced: item.synced
                    }
                };
                
                collection.items.push(collectionItem);
                collection.itemCount++;
                collection.attachmentCount += item.attachmentCount;
                collection.pdfCount += item.pdfCount;
            }
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error adding item to collection: ${error.message}`);
        }
    }

    /**
     * Calculate statistics for the hierarchy
     * @param {Object} hierarchyData - Hierarchy data object
     */
    calculateHierarchyStatisticsSQL(hierarchyData) {
        try {
            const calculateCollectionStats = (collections) => {
                let stats = { collections: 0, items: 0, attachments: 0, pdfs: 0 };
                
                for (const key in collections) {
                    const collection = collections[key];
                    stats.collections++;
                    stats.items += collection.itemCount || 0;
                    stats.attachments += collection.attachmentCount || 0;
                    stats.pdfs += collection.pdfCount || 0;
                    
                    if (Object.keys(collection.subcollections).length > 0) {
                        const subStats = calculateCollectionStats(collection.subcollections);
                        stats.collections += subStats.collections;
                        stats.items += subStats.items;
                        stats.attachments += subStats.attachments;
                        stats.pdfs += subStats.pdfs;
                    }
                }
                
                return stats;
            };
            
            const collectionStats = calculateCollectionStats(hierarchyData.collections);
            
            hierarchyData.statistics = {
                totalCollections: collectionStats.collections,
                totalItems: collectionStats.items + hierarchyData.uncategorized.itemCount,
                totalAttachments: collectionStats.attachments,
                totalPDFs: collectionStats.pdfs
            };
            
            Zotero.debug(`DeepTutorClaudeManagement: Calculated statistics - Collections: ${hierarchyData.statistics.totalCollections}, Items: ${hierarchyData.statistics.totalItems}`);
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error calculating hierarchy statistics: ${error.message}`);
        }
    }

    /**
     * Generate markdown representation of the SQL-based hierarchy
     * @param {Object} hierarchyData - Hierarchy data object
     * @returns {string} Markdown formatted hierarchy
     */
    generateSQLHierarchyMarkdown(hierarchyData) {
        try {
            let markdown = `# Complete Zotero Library Hierarchy (SQL-Based)\n\n`;
            markdown += `**Generated:** ${new Date(hierarchyData.timestamp).toLocaleString()}\n\n`;
            
            // Statistics
            markdown += `## Library Statistics\n\n`;
            markdown += `- **Library:** ${hierarchyData.library.name}\n`;
            markdown += `- **Library ID:** ${hierarchyData.library.id}\n`;
            markdown += `- **Library Type:** ${hierarchyData.library.type}\n`;
            markdown += `- **Total Collections:** ${hierarchyData.statistics.totalCollections}\n`;
            markdown += `- **Total Items:** ${hierarchyData.statistics.totalItems}\n`;
            markdown += `- **Total Attachments:** ${hierarchyData.statistics.totalAttachments}\n`;
            markdown += `- **Total PDFs:** ${hierarchyData.statistics.totalPDFs}\n\n`;
            
            // Collections hierarchy
            if (Object.keys(hierarchyData.collections).length > 0) {
                markdown += `## Collections Hierarchy\n\n`;
                markdown += this.renderSQLCollectionHierarchy(hierarchyData.collections, 0);
            }
            
            // Uncategorized items
            if (hierarchyData.uncategorized.items.length > 0) {
                markdown += `## Uncategorized Items\n\n`;
                markdown += `**Total Uncategorized Items:** ${hierarchyData.uncategorized.itemCount}\n\n`;
                
                for (const item of hierarchyData.uncategorized.items) {
                    markdown += `### ${item.title}\n\n`;
                    markdown += `- **ID:** ${item.id}\n`;
                    markdown += `- **Type:** ${item.itemType}\n`;
                    markdown += `- **Date:** ${item.date}\n`;
                    markdown += `- **Attachments:** ${item.attachmentCount}\n`;
                    markdown += `- **PDFs:** ${item.pdfCount}\n`;
                    
                    if (item.attachments && item.attachments.length > 0) {
                        markdown += `- **Files:**\n`;
                        for (const attachment of item.attachments) {
                            const pdfIndicator = attachment.isPDF ? ' 📄' : '';
                            markdown += `  - ${attachment.filename}${pdfIndicator} (${this.formatFileSize(attachment.fileSize)})\n`;
                        }
                    }
                    
                    markdown += `\n`;
                }
            }
            
            return markdown;
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error generating SQL hierarchy markdown: ${error.message}`);
            return `# Error Generating Hierarchy\n\n${error.message}`;
        }
    }

    /**
     * Render collection hierarchy recursively for SQL-based data
     * @param {Object} collections - Collections object
     * @param {number} level - Indentation level
     * @returns {string} Markdown for the collections
     */
    renderSQLCollectionHierarchy(collections, level) {
        try {
            let markdown = '';
            const indent = '  '.repeat(level);
            
            for (const key in collections) {
                const collection = collections[key];
                const headerLevel = Math.min(level + 3, 6); // Max H6
                const header = '#'.repeat(headerLevel);
                
                markdown += `${header} ${collection.name}\n\n`;
                
                // Collection metadata
                markdown += `${indent}- **Collection ID:** ${collection.id}\n`;
                markdown += `${indent}- **Full Path:** ${collection.fullPath}\n`;
                markdown += `${indent}- **Level:** ${collection.level}\n`;
                markdown += `${indent}- **Items:** ${collection.itemCount}\n`;
                markdown += `${indent}- **Attachments:** ${collection.attachmentCount}\n`;
                markdown += `${indent}- **PDFs:** ${collection.pdfCount}\n`;
                markdown += `${indent}- **Version:** ${collection.version || 0}\n`;
                markdown += `${indent}- **Synced:** ${collection.synced ? 'Yes' : 'No'}\n\n`;
                
                // Items in this collection
                if (collection.items && collection.items.length > 0) {
                    markdown += `${indent}**Items in this collection:**\n\n`;
                    
                    for (const item of collection.items) {
                        markdown += `${indent}- **${item.title}**\n`;
                        markdown += `${indent}  - ID: ${item.id}\n`;
                        markdown += `${indent}  - Type: ${item.itemType}\n`;
                        markdown += `${indent}  - Date: ${item.date}\n`;
                        markdown += `${indent}  - Attachments: ${item.attachmentCount}\n`;
                        markdown += `${indent}  - PDFs: ${item.pdfCount}\n`;
                        
                        if (item.attachments && item.attachments.length > 0) {
                            markdown += `${indent}  - Files:\n`;
                            for (const attachment of item.attachments) {
                                const pdfIndicator = attachment.isPDF ? ' 📄' : '';
                                markdown += `${indent}    - ${attachment.filename}${pdfIndicator} (${this.formatFileSize(attachment.fileSize)})\n`;
                            }
                        }
                        
                        markdown += `\n`;
                    }
                }
                
                // Subcollections
                if (Object.keys(collection.subcollections).length > 0) {
                    markdown += `${indent}**Subcollections:**\n\n`;
                    markdown += this.renderSQLCollectionHierarchy(collection.subcollections, level + 1);
                }
            }
            
            return markdown;
            
        } catch (error) {
            Zotero.debug(`DeepTutorClaudeManagement: Error rendering SQL collection hierarchy: ${error.message}`);
            return `Error rendering collection: ${error.message}\n\n`;
        }
    }
}

// Export the class for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeepTutorClaudeManagement;
}

