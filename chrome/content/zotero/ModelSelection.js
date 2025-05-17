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

const buttonStyle = {
  background: '#2c25ac',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  fontWeight: 600,
  padding: '4px 8px',
  fontSize: '11px',
  cursor: 'pointer',
  minWidth: 0,
  minHeight: 0,
  fontFamily: 'Roboto, sans-serif',
};

const fileButtonStyle = {
  background: '#F8F6F7',
  border: '1px solid #e0e0e0',
  borderRadius: '4px',
  padding: '4px 8px',
  alignItems: 'center',
  justifyContent: 'space-between',
  cursor: 'pointer',
  margin: '2px 0',
  display: 'flex',
  fontFamily: 'Roboto, sans-serif',
};

const removeButtonStyle = {
  color: '#dc3545',
  fontWeight: 'bold',
  fontSize: '16px',
  cursor: 'pointer',
  padding: '0 4px',
  background: 'none',
  border: 'none',
};

const modelTypeButtonBase = {
  flex: 1,
  padding: '6px 0',
  border: 'none',
  borderRadius: '4px',
  fontWeight: 600,
  fontSize: '1em',
  cursor: 'pointer',
  background: '#e0e0e0',
  color: '#444',
};

const selectedModelTypeButton = {
  background: '#2c25ac',
  color: '#fff',
};

function ModelSelection({ onSubmit }) {
  const [fileList, setFileList] = useState([]);
  const [originalFileList, setOriginalFileList] = useState([]);
  const [modelName, setModelName] = useState('');
  const [selectedType, setSelectedType] = useState('normal');

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

  return React.createElement(
    'div',
    { style: { display: 'flex', flexDirection: 'column', gap: 12, width: '100%', fontFamily: 'Roboto, sans-serif', background: '#F8F6F7' } },
    // Upload Buttons Section
    React.createElement(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 } },
      React.createElement(
        'label',
        { style: buttonStyle },
        'Upload',
        React.createElement('input', { type: 'file', multiple: true, style: { display: 'none' }, onChange: handleFileUpload })
      ),
      React.createElement(
        'button',
        { style: buttonStyle, onClick: handleUpload2 },
        'Upload2'
      )
    ),
    // File List Section
    React.createElement(
      'div',
      { style: { maxHeight: 100, border: '1px solid #e0e0e0', borderRadius: 4, background: 'white', padding: 4, overflowY: 'auto' } },
      React.createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
        fileList.map(file =>
          React.createElement(
            'div',
            { key: file.id, style: fileButtonStyle },
            React.createElement('span', { style: { flex: 1, marginRight: 8 } }, file.name),
            React.createElement('button', { style: removeButtonStyle, onClick: () => handleRemoveFile(file.id) }, '\u00D7')
          )
        )
      )
    ),
    // Model Name Section
    React.createElement(
      'div',
      { style: { display: 'flex', flexDirection: 'column' } },
      React.createElement('label', { style: { fontWeight: 'bold', marginBottom: 4 } }, 'Model Name'),
      React.createElement('input', {
        type: 'text',
        value: modelName,
        onChange: e => setModelName(e.target.value),
        style: { width: '100%', padding: '4px', borderRadius: 4, border: '1px solid #e0e0e0' }
      })
    ),
    // Model Type Buttons
    React.createElement(
      'div',
      { style: { display: 'flex', flexDirection: 'column' } },
      React.createElement('label', { style: { fontWeight: 'bold', marginBottom: 4 } }, 'Model Type'),
      React.createElement(
        'div',
        { style: { display: 'flex', gap: 8 } },
        React.createElement(
          'button',
          {
            style: Object.assign({}, modelTypeButtonBase, selectedType === 'lite' ? selectedModelTypeButton : {}),
            onClick: () => handleTypeSelection('lite')
          },
          'Lite'
        ),
        React.createElement(
          'button',
          {
            style: Object.assign({}, modelTypeButtonBase, selectedType === 'normal' ? selectedModelTypeButton : {}),
            onClick: () => handleTypeSelection('normal')
          },
          'Normal'
        ),
        React.createElement(
          'button',
          {
            style: Object.assign({}, modelTypeButtonBase, selectedType === 'advanced' ? selectedModelTypeButton : {}),
            onClick: () => handleTypeSelection('advanced')
          },
          'Advanced'
        )
      )
    ),
    // Submit Button Section
    React.createElement(
      'div',
      { style: { display: 'flex', justifyContent: 'center', marginTop: 16 } },
      React.createElement(
        'button',
        { style: Object.assign({ minWidth: 120 }, buttonStyle), onClick: handleSubmit },
        'Submit'
      )
    )
  );
}

export default ModelSelection;