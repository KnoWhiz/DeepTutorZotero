import React, { useState } from 'react';

// Session Status Enum
const SessionStatus = {
    CREATED: 'CREATED',
    READY: 'READY',
    PROCESSING_ERROR: 'PROCESSING_ERROR',
    FINAL_PROCESSING_ERROR: 'FINAL_PROCESSING_ERROR',
    PROCESSING: 'PROCESSING',
    DELETED: 'DELETED'
};

// Session Type Enum
const SessionType = {
    LITE: 'LITE',
    BASIC: 'BASIC',
    ADVANCED: 'ADVANCED'
};

const PEARL = '#F8F6F7';
const SKY = '#0687E5';
const LIGHT_GREY2 = '#DADCE0';
const AQUA = '#0AE2FF';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    width: '100%',
    minHeight: '480px',
    height: '100%',
    background: '#FFFFFF',
    fontFamily: 'Roboto, sans-serif',
    borderRadius: 12,
    boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
    padding: '32px 18px 24px 18px',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  title: {
    background: 'linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    color: SKY, // fallback
    fontWeight: 700,
    fontSize: '1.35em',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  section: {
    width: '100%',
    maxWidth: 400,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    fontWeight: 500,
    color: '#292929',
    marginBottom: 2,
    fontSize: '1em',
  },
  input: {
    width: '100%',
    padding: '12px',
    borderRadius: 8,
    border: `1px solid ${LIGHT_GREY2}`,
    background: PEARL,
    fontSize: '1em',
    fontFamily: 'Roboto, sans-serif',
    outline: 'none',
  },
  searchArea: {
    width: '100%',
    maxWidth: 400,
    background: PEARL,
    borderRadius: 8,
    border: `1px solid ${LIGHT_GREY2}`,
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    margin: '8px 0',
    fontSize: '1em',
    color: '#292929',
    gap: 8,
  },
  searchIcon: {
    width: 18,
    height: 18,
    opacity: 0.6,
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: '1em',
    fontFamily: 'Roboto, sans-serif',
    color: '#292929',
  },
  contextRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    margin: '8px 0',
  },
  uploadButton: {
    background: SKY,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 600,
    padding: '8px 18px',
    fontSize: '1em',
    cursor: 'pointer',
    fontFamily: 'Roboto, sans-serif',
    minWidth: 0,
    minHeight: 0,
  },
  orText: {
    color: '#888',
    fontWeight: 500,
    fontSize: '1em',
    textAlign: 'center',
    minWidth: 32,
  },
  dragArea: {
    border: `1.5px dashed ${LIGHT_GREY2}`,
    borderRadius: 12,
    background: PEARL,
    minHeight: 80,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#888',
    fontSize: '1em',
    margin: '8px 0',
    width: '100%',
    flexDirection: 'column',
    gap: 6,
  },
  modelTypeRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginTop: 8,
    marginBottom: 8,
  },
  modelTypeButton: {
    flex: 1,
    padding: '12px 0',
    border: 'none',
    borderRadius: 8,
    fontWeight: 700,
    fontSize: '1em',
    cursor: 'pointer',
    background: LIGHT_GREY2,
    color: '#292929',
    transition: 'background 0.2s, color 0.2s',
  },
  modelTypeButtonSelected: {
    background: SKY,
    color: '#fff',
    fontWeight: 700,
  },
  createButton: {
    width: '100%',
    maxWidth: 400,
    margin: '32px auto 0 auto',
    padding: '14px 0',
    background: SKY,
    color: '#fff',
    fontWeight: 700,
    fontSize: '1.1em',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
    fontFamily: 'Roboto, sans-serif',
    letterSpacing: 0.2,
    transition: 'background 0.2s',
    display: 'block',
  },
};

function ModelSelection({ onSubmit }) {
  const [fileList, setFileList] = useState([]);
  const [originalFileList, setOriginalFileList] = useState([]);
  const [modelName, setModelName] = useState('');
  const [selectedType, setSelectedType] = useState('lite');
  const [searchValue, setSearchValue] = useState('');

  // Get model data in the same format as XUL version
  const getModelData = () => {
    return {
      fileList,
      name: modelName,
      type: selectedType,
      originalFileList
    };
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const newFiles = files.map((file, idx) => ({ 
      id: `${file.name}-${Date.now()}-${idx}`, 
      name: file.name 
    }));
    setFileList(prev => [...prev, ...newFiles]);
    setOriginalFileList(prev => [...prev, ...files]);
  };

  const handleUpload2 = async () => {
    try {
      Zotero.debug("ModelSelection: Starting Upload2 process");
      const selectedItems = Zotero.getActiveZoteroPane().getSelectedItems();
      if (!selectedItems.length) {
        Zotero.debug("ModelSelection: No items selected");
        return;
      }

      const pdfAttachments = selectedItems.reduce((arr, item) => {
        if (item.isPDFAttachment()) {
          return arr.concat([item]);
        }
        if (item.isRegularItem()) {
          return arr.concat(item.getAttachments()
            .map(x => Zotero.Items.get(x))
            .filter(x => x.isPDFAttachment()));
        }
        return arr;
      }, []);

      if (!pdfAttachments.length) {
        Zotero.debug("ModelSelection: No PDF attachments found in selected items");
        return;
      }

      Zotero.debug(`ModelSelection: Found ${pdfAttachments.length} PDF attachments`);
      
      // Store original PDF attachments
      setOriginalFileList(pdfAttachments);

      // Process all PDFs concurrently using Promise.all
      const pdfProcessingPromises = pdfAttachments.map(async (pdf) => {
        try {
          const { text } = await Zotero.PDFWorker.getFullText(pdf.id);
          if (text) {
            return {
              id: pdf.id,
              name: pdf.name,
              content: text.substring(0, 200)
            };
          }
          return null;
        } catch (e) {
          Zotero.debug(`ModelSelection: Error extracting text from PDF: ${e.message}`);
          return null;
        }
      });

      // Wait for all PDFs to be processed
      const results = await Promise.all(pdfProcessingPromises);
      
      // Filter out any null results and update fileList
      const validResults = results.filter(result => result !== null);
      setFileList(prev => [
        ...prev,
        ...validResults.map(result => ({ 
          id: result.id,
          name: result.name
        }))
      ]);

      Zotero.debug(`ModelSelection: Successfully processed ${validResults.length} PDFs`);
    } catch (error) {
      Zotero.debug(`ModelSelection: Error in handleUpload2: ${error.message}`);
    }
  };

  const handleRemoveFile = (id) => {
    setFileList(prev => prev.filter(file => file.id !== id));
    setOriginalFileList(prev => prev.filter(file => file.id !== id));
  };

  const handleTypeSelection = (type) => {
    setSelectedType(type);
  };

  const handleSubmit = async () => {
    if (!modelName.trim()) {
      Zotero.debug("ModelSelection: Model name is required");
      return;
    }

    try {
      // Get user ID from API
      const userResponse = await window.fetch('https://api.staging.deeptutor.knowhiz.us/api/users/byUserId/67f5b836cb8bb15b67a1149e', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!userResponse.ok) {
        throw new Error(`Failed to fetch user: ${userResponse.status} ${userResponse.statusText}`);
      }
      
      const userData = await userResponse.json();
      Zotero.debug('ModelSelection: Fetched user data:', userData);

      // Handle file uploads if fileList exists
      const uploadedDocumentIds = [];
      if (fileList.length > 0) {
        for (const file of originalFileList) {
          try {
            const fileName = file.name;
            Zotero.debug('ModelSelection: Processing file:', fileName);

            // 1. Get pre-signed URL for the file
            const preSignedUrlResponse = await window.fetch(
              `https://api.staging.deeptutor.knowhiz.us/api/document/preSignedUrl/${userData.id}/${fileName}`,
              {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json'
                }
              }
            );

            if (!preSignedUrlResponse.ok) {
              throw new Error(`Failed to get pre-signed URL: ${preSignedUrlResponse.status}`);
            }

            const preSignedUrlData = await preSignedUrlResponse.json();
            Zotero.debug('ModelSelection: Got pre-signed URL:', preSignedUrlData);

            // 2. Upload file to Azure Blob Storage
            const uploadResponse = await window.fetch(preSignedUrlData.preSignedUrl, {
              method: 'PUT',
              headers: {
                'x-ms-blob-type': 'BlockBlob',
                'Content-Type': 'application/pdf'
              },
              body: file
            });

            if (!uploadResponse.ok) {
              throw new Error(`Failed to upload file: ${uploadResponse.status}`);
            }

            Zotero.debug('ModelSelection: File uploaded successfully:', fileName);
            uploadedDocumentIds.push(preSignedUrlData.documentId);
            
          } catch (fileError) {
            Zotero.debug('ModelSelection: Error uploading file:', fileError);
            continue;
          }
        }
      }

      // Create session data
      const sessionData = {
        userId: userData.id,
        sessionName: modelName || "New Session",
        type: selectedType === 'lite' ? SessionType.LITE : 
              selectedType === 'advanced' ? SessionType.ADVANCED : 
              SessionType.BASIC,
        status: SessionStatus.CREATED,
        documentIds: uploadedDocumentIds,
        creationTime: new Date().toISOString(),
        lastUpdatedTime: new Date().toISOString(),
        statusTimeline: [],
        generateHash: null
      };

      Zotero.debug(`ModelSelection: Creating session with data: ${JSON.stringify(sessionData, null, 2)}`);

      // Create session with uploaded files
      const sessionResponse = await window.fetch('https://api.staging.deeptutor.knowhiz.us/api/session/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sessionData)
      });

      if (!sessionResponse.ok) {
        throw new Error(`Failed to create session: ${sessionResponse.status} ${sessionResponse.statusText}`);
      }

      const createdSession = await sessionResponse.json();
      Zotero.debug('ModelSelection: Session created successfully:', createdSession);

      // Call onSubmit with the session ID
      if (onSubmit) {
        onSubmit(createdSession.id);
      }

    } catch (error) {
      Zotero.debug('ModelSelection: Error creating session:', error);
    }
  };

  return (
    <div style={styles.container}>
      {/* Title Section */}
      <div style={styles.title}>Create a new session</div>

      {/* Name Section */}
      <div style={styles.section}>
        <label style={styles.label}>Name Your Session</label>
        <input
          type="text"
          value={modelName}
          onChange={e => setModelName(e.target.value)}
          style={styles.input}
          placeholder="Default Name According to the Paper Title"
        />
      </div>

      {/* Context Section */}
      <div style={styles.section}>
        <label style={styles.label}>Add Context</label>
        {/* Search Area */}
        <div style={styles.searchArea}>
          <svg style={styles.searchIcon} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="9" cy="9" r="7" stroke="#0687E5" strokeWidth="2" />
            <line x1="14.2" y1="14.2" x2="18" y2="18" stroke="#0687E5" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            style={styles.searchInput}
            type="text"
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            placeholder="Search for an Item"
          />
        </div>
        <div style={styles.contextRow}>
          <button style={styles.uploadButton}>Upload</button>
          <span style={styles.orText}>or</span>
          <button style={styles.uploadButton}>Upload2</button>
        </div>
        <div style={styles.dragArea}>
          <span style={{fontSize: '1.2em', opacity: 0.7}}>📄</span>
          Drag a file here
        </div>
      </div>

      {/* Model Type Section */}
      <div style={styles.section}>
        <label style={styles.label}>Select Your Model</label>
        <div style={styles.modelTypeRow}>
          <button
            style={{
              ...styles.modelTypeButton,
              ...(selectedType === 'lite' ? styles.modelTypeButtonSelected : {})
            }}
            onClick={() => handleTypeSelection('lite')}
          >
            LITE
          </button>
          <button
            style={{
              ...styles.modelTypeButton,
              ...(selectedType === 'normal' ? styles.modelTypeButtonSelected : {})
            }}
            onClick={() => handleTypeSelection('normal')}
          >
            STANDARD
          </button>
          <button
            style={{
              ...styles.modelTypeButton,
              ...(selectedType === 'advanced' ? styles.modelTypeButtonSelected : {})
            }}
            onClick={() => handleTypeSelection('advanced')}
          >
            ADVANCED
          </button>
        </div>
      </div>
      {/* Create Button at the bottom */}
      <button style={styles.createButton} onClick={handleSubmit}>
        Create
      </button>
    </div>
  );
}

export default ModelSelection;