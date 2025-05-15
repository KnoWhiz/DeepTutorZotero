import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

// Enums
const SessionStatus = {
    CREATED: 'CREATED',
    READY: 'READY',
    PROCESSING_ERROR: 'PROCESSING_ERROR',
    FINAL_PROCESSING_ERROR: 'FINAL_PROCESSING_ERROR',
    PROCESSING: 'PROCESSING',
    DELETED: 'DELETED'
};

const SessionType = {
    LITE: 'LITE',
    BASIC: 'BASIC',
    ADVANCED: 'ADVANCED'
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

// Styles
const styles = {
    container: {
        padding: '16px',
        background: '#f8f9fa',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        height: '100%',
        width: '85%',
        display: 'flex',
        flexDirection: 'column',
    },
    sessionInfo: {
        fontSize: '1em',
        color: '#495057',
        marginBottom: '4px',
        paddingLeft: '4px',
    },
    chatLog: {
        borderRadius: '8px',
        padding: '12px',
        overflowY: 'auto',
        background: 'white',
        height: '100%',
        maxHeight: '400px',
        width: '100%',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '16px',
    },
    bottomBar: {
        marginTop: 'auto',
        padding: '10px 10px 6px 10px',
        background: '#e0e0e0',
        borderRadius: '12px 12px 0 0',
        boxShadow: '0 -1px 3px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    inputContainer: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '2px',
    },
    textInput: {
        width: '100%',
        padding: '6px 10px',
        border: '1px solid #495057',
        borderRadius: '6px',
        background: '#fff',
        color: '#1a65b0',
        minHeight: '32px',
        maxHeight: '80px',
        fontSize: '13px',
        overflowY: 'auto',
    },
    buttonContainer: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    modelButton: {
        background: '#e0e0e0',
        color: '#444',
        border: 'none',
        borderRadius: '4px',
        fontWeight: 500,
        padding: '2px 7px',
        marginRight: '4px',
        cursor: 'pointer',
        fontSize: '11px',
        minWidth: 0,
        minHeight: 0,
    },
    imageButton: {
        background: '#e0e0e0',
        border: 'none',
        borderRadius: '4px',
        width: '24px',
        height: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        marginRight: '2px',
        minWidth: 0,
        minHeight: 0,
        padding: 0,
    },
    sendButton: {
        background: '#2c25ac',
        color: '#fff',
        border: 'none',
        borderRadius: '50%',
        width: '26px',
        height: '26px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        fontSize: '13px',
        minWidth: 0,
        minHeight: 0,
        padding: 0,
    },
    messageContainer: {
        margin: '8px 0',
        width: '100%',
    },
    messageBubble: {
        padding: '10px 15px',
        borderRadius: '15px',
        maxWidth: '80%',
        wordWrap: 'break-word',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
    },
    userMessage: {
        backgroundColor: '#007AFF',
        color: 'white',
        marginLeft: 'auto',
    },
    botMessage: {
        backgroundColor: '#E9ECEF',
        color: 'black',
        marginRight: 'auto',
    },
    senderLabel: {
        fontWeight: 'bold',
        marginBottom: '4px',
        display: 'block',
    },
    messageText: {
        display: 'block',
    },
    sourcesContainer: {
        marginTop: '8px',
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
    },
    sourceButton: {
        background: '#2c25ac',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        padding: '4px 8px',
        cursor: 'pointer',
        fontSize: '12px',
    },
    questionContainer: {
        margin: '8px 0',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
    },
    questionButton: {
        background: '#2c25ac',
        color: 'black',
        border: 'none',
        borderRadius: '4px',
        padding: '6px 12px',
        margin: '4px',
        cursor: 'pointer',
        fontSize: '13px',
    },
};

const DeepTutorChatBox = ({ 
    onSessionIdUpdate, 
    onUserIdUpdate, 
    messages: propMessages, 
    documentIds: propDocumentIds, 
    currentSession 
}) => {
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [sessionId, setSessionId] = useState(null);
    const [userId, setUserId] = useState(null);
    const [documentIds, setDocumentIds] = useState([]);
    const [curDocumentFiles, setCurDocumentFiles] = useState([]);
    const [curSessionObj, setCurSessionObj] = useState(null);
    const [latestMessageId, setLatestMessageId] = useState(null);
    const [pdfDataList, setPdfDataList] = useState([]);
    const [showModelPopup, setShowModelPopup] = useState(false);
    const [showImagePopup, setShowImagePopup] = useState(false);

    const chatLogRef = useRef(null);
    const modelSelectionRef = useRef(null);

    // Conversation state
    const [conversation, setConversation] = useState({
        userId: null,
        sessionId: null,
        ragSessionId: null,
        storagePaths: [],
        history: [],
        message: null,
        streaming: true,
        type: SessionType.BASIC
    });

    // Handle session ID updates
    useEffect(() => {
        if (onSessionIdUpdate) {
            onSessionIdUpdate(sessionId);
        }
    }, [sessionId, onSessionIdUpdate]);

    // Handle user ID updates
    useEffect(() => {
        if (onUserIdUpdate) {
            onUserIdUpdate(userId);
        }
    }, [userId, onUserIdUpdate]);

    // Handle message loading when session changes
    useEffect(() => {
        if (currentSession?.id && propMessages && propDocumentIds) {
            Zotero.debug(`DeepTutorChatBox: Session changed to ${currentSession.id}, loading messages`);
            loadMessages(propMessages, propDocumentIds, currentSession);
        }
    }, [currentSession?.id]); // Only depend on session ID changes

    useEffect(() => {
        // Scroll to bottom when messages change
        if (chatLogRef.current) {
            chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!inputValue.trim()) return;

        try {
            if (!sessionId) throw new Error("No active session ID");
            if (!userId) throw new Error("No active user ID");

            const userMessage = {
                id: null,
                parentMessageId: latestMessageId,
                userId: userId,
                sessionId: sessionId,
                subMessages: [{
                    text: inputValue,
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

            // Add user message to state
            setMessages(prev => [...prev, userMessage]);
            setLatestMessageId(userMessage.id);
            setInputValue('');

            // Update conversation
            setConversation(prev => ({
                ...prev,
                history: [...prev.history, userMessage],
                message: userMessage
            }));

            // Send to API and handle response
            const response = await Zotero.HTTP.request(
                'POST',
                'https://api.staging.deeptutor.knowhiz.us/api/message/create',
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(userMessage)
                }
            );

            if (response.status !== 200) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const responseData = JSON.parse(response.responseText);
            
            // Add bot response to messages
            setMessages(prev => [...prev, responseData]);
            setLatestMessageId(responseData.id);

            // Update conversation
            setConversation(prev => ({
                ...prev,
                history: [...prev.history, responseData],
                message: responseData
            }));

        } catch (error) {
            console.error('Error in handleSend:', error);
            // Handle error message display
        }
    };

    const handleFileUpload = async (files) => {
        // Implementation for file upload
    };

    const handleModelSelection = (modelData) => {
        // Implementation for model selection
    };

    const loadMessages = async (newMessages, newDocumentIds, sessionObj) => {
        Zotero.debug(`DeepTutorChatBox: Loading ${newMessages.length} messages with ${newDocumentIds?.length || 0} document IDs`);
        setDocumentIds(newDocumentIds || []);
        setCurDocumentFiles([]);
        setCurSessionObj(sessionObj);

        // Update session info display
        if (newMessages.length > 0) {
            _updateSessionInfo(newMessages[0].sessionId, newDocumentIds);
        }

        // Fetch document information
        const newDocumentFiles = [];
        for (const documentId of newDocumentIds || []) {
            try {
                const newDoc = await Zotero.HTTP.request(
                    'GET',
                    `https://api.staging.deeptutor.knowhiz.us/api/document/${documentId}`,
                    {
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );

                if (newDoc.status !== 200) {
                    const errorText = newDoc.responseText;
                    Zotero.debug(`DeepTutorChatBox: Failed to fetch new session documents: ${errorText}`);
                    throw new Error(`Failed to fetch new session documents: ${newDoc.status} ${newDoc.statusText}`);
                }
                const newDocData = JSON.parse(newDoc.responseText);
                Zotero.debug(`DeepTutorChatBox: New session document: ${JSON.stringify(newDocData)}`);
                newDocumentFiles.push(newDocData);
            } catch (error) {
                Zotero.debug(`DeepTutorChatBox: Error fetching document ${documentId}: ${error.message}`);
            }
        }
        setCurDocumentFiles(newDocumentFiles);

        // Update conversation state
        setConversation(prev => ({
            ...prev,
            documentIds: newDocumentFiles.map(doc => doc.fileId),
            storagePaths: newDocumentFiles.map(doc => doc.storagePath),
            history: [] // Will be populated by _appendMessage
        }));

        // Clear existing messages
        setMessages([]);

        // Process and append each message
        if (newMessages.length > 0) {
            setSessionId(newMessages[0].sessionId);
            setLatestMessageId(newMessages[newMessages.length - 1].id);
            Zotero.debug(`DeepTutorChatBox: Session ID set to ${newMessages[0].sessionId} from loaded messages`);
            Zotero.debug(`DeepTutorChatBox: Latest message ID set to ${newMessages[newMessages.length - 1].id}`);

            // Append each message using _appendMessage
            for (const message of newMessages) {
                const sender = message.role === MessageRole.USER ? 'You' : 'DeepTutor';
                await _appendMessage(sender, message);
            }
        }

        // Scroll to bottom after all messages are loaded
        if (chatLogRef.current) {
            setTimeout(() => {
                chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
            }, 100);
        }
    };

    const _updateSessionInfo = (newSessionId, newDocumentIds) => {
        Zotero.debug(`DeepTutorChatBox: Updating session info - Session ID: ${newSessionId}, Document IDs: ${newDocumentIds?.length || 0}`);
        setSessionId(newSessionId);
        setDocumentIds(newDocumentIds || []);
    };

    const _appendMessage = async (sender, message) => {
        Zotero.debug(`DeepTutorChatBox: Appending message from ${sender}`);
        
        // Process subMessages
        if (message.subMessages && message.subMessages.length > 0) {
            Zotero.debug(`DeepTutorChatBox: Processing ${message.subMessages.length} subMessages for ${sender}`);
            
            // Create a new message object with processed subMessages
            const processedMessage = {
                ...message,
                subMessages: await Promise.all(message.subMessages.map(async (subMessage) => {
                    // Process sources if they exist
                    if (subMessage.sources && subMessage.sources.length > 0) {
                        Zotero.debug(`DeepTutorChatBox: Found ${subMessage.sources.length} sources in subMessage`);
                        
                        // Process each source
                        const processedSources = await Promise.all(subMessage.sources.map(async (source) => {
                            Zotero.debug(`DeepTutorBox: Processing source - index: ${source.index}, page: ${source.page}`);
                            
                            if (source.index >= 0 && source.index < documentIds.length) {
                                const attachmentId = documentIds[source.index];
                                Zotero.debug(`DeepTutorBox: Found valid attachment ID: ${attachmentId} for source index ${source.index}`);
                                
                                // Create highlight annotation
                                const annotation = await _createHighlightAnnotation(attachmentId, source.page, source.referenceString);
                                
                                if (annotation) {
                                    Zotero.debug(`DeepTutorBox: Created source button for annotation ${annotation.id}`);
                                    return {
                                        ...source,
                                        attachmentId,
                                        annotationId: annotation.id
                                    };
                                }
                            }
                            return source;
                        }));

                        return {
                            ...subMessage,
                            sources: processedSources.filter(source => source !== null)
                        };
                    }
                    return subMessage;
                }))
            };

            // Update messages state with the new message
            setMessages(prevMessages => [...prevMessages, processedMessage]);
            
            // Update conversation history
            setConversation(prev => ({
                ...prev,
                history: [...prev.history, processedMessage]
            }));

            // Scroll to bottom after message is added
            if (chatLogRef.current) {
                setTimeout(() => {
                    chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
                }, 100);
            }
        }
    };

    const _createHighlightAnnotation = async (attachmentId, page, referenceString) => {
        try {
            const attachment = Zotero.Items.get(attachmentId);
            if (!attachment) {
                Zotero.debug(`DeepTutorChatBox: No attachment found for ID ${attachmentId}`);
                return null;
            }

            // Create highlight annotation
            const annotation = await Zotero.Annotations.createHighlightAnnotation(attachment, {
                page,
                text: referenceString,
                color: '#ffeb3b'
            });

            Zotero.debug(`DeepTutorChatBox: Created highlight annotation ${annotation.id}`);
            return annotation;
        } catch (error) {
            Zotero.debug(`DeepTutorChatBox: Error creating highlight annotation: ${error.message}`);
            return null;
        }
    };

    const handleSourceClick = async (source) => {
        if (!source.attachmentId) return;

        Zotero.debug(`DeepTutorChatBox: Source button clicked for attachment ${source.attachmentId}`);
        
        // View the attachment
        ZoteroPane.viewAttachment(source.attachmentId);
        
        // Find and focus on the annotation
        const attachment = Zotero.Items.get(source.attachmentId);
        if (attachment) {
            Zotero.debug(`DeepTutorChatBox: Found attachment, retrieving annotations`);
            const annotations = await Zotero.Annotations.getAnnotationsForItem(attachment);
            Zotero.debug(`DeepTutorChatBox: Found ${annotations.length} annotations`);
            
            const highlight = annotations.find(a => 
                a.type === 'highlight' && 
                a.page === source.page
            );
            
            if (highlight) {
                Zotero.debug(`DeepTutorChatBox: Found matching highlight annotation ${highlight.id}, focusing on it`);
                Zotero.Annotations.focusAnnotation(highlight);
            } else {
                Zotero.debug(`DeepTutorChatBox: No matching highlight found for page ${source.page}`);
            }
        }
    };

    const renderMessage = (message, index) => {
        const isUser = message.role === MessageRole.USER;
        const messageStyle = {
            ...styles.messageContainer,
            animation: 'fadeIn 0.3s ease-in-out'
        };
        
        return (
            <div key={index} style={messageStyle}>
                <div style={{
                    ...styles.messageBubble,
                    ...(isUser ? styles.userMessage : styles.botMessage),
                    animation: 'slideIn 0.3s ease-out'
                }}>
                    <span style={styles.senderLabel}>
                        {isUser ? 'You' : 'DeepTutor'}
                    </span>
                    {message.subMessages.map((subMessage, subIndex) => (
                        <div key={subIndex} style={styles.messageText}>
                            {subMessage.text}
                            {subMessage.sources && subMessage.sources.length > 0 && (
                                <div style={styles.sourcesContainer}>
                                    {subMessage.sources.map((source, sourceIndex) => (
                                        <button
                                            key={sourceIndex}
                                            style={styles.sourceButton}
                                            onClick={() => handleSourceClick(source)}
                                        >
                                            Source {source.index + 1} (Page {source.page})
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                {message.followUpQuestions && message.followUpQuestions.length > 0 && (
                    <div style={styles.questionContainer}>
                        {message.followUpQuestions.map((question, qIndex) => (
                            <button
                                key={qIndex}
                                style={styles.questionButton}
                                onClick={() => handleQuestionClick(question)}
                            >
                                {question}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // Add animation styles
    const animationStyles = {
        '@keyframes fadeIn': {
            from: { opacity: 0 },
            to: { opacity: 1 }
        },
        '@keyframes slideIn': {
            from: { transform: 'translateY(20px)', opacity: 0 },
            to: { transform: 'translateY(0)', opacity: 1 }
        }
    };

    // Update styles object with new styles
    const updatedStyles = {
        ...styles,
        messageContainer: {
            ...styles.messageContainer,
            margin: '12px 0',
            opacity: 0,
            animation: 'fadeIn 0.3s ease-in-out forwards'
        },
        messageBubble: {
            ...styles.messageBubble,
            padding: '12px 16px',
            borderRadius: '16px',
            maxWidth: '85%',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
            animation: 'slideIn 0.3s ease-out forwards'
        },
        userMessage: {
            ...styles.userMessage,
            backgroundColor: '#007AFF',
            color: 'white',
            marginLeft: 'auto',
            borderBottomRightRadius: '4px'
        },
        botMessage: {
            ...styles.botMessage,
            backgroundColor: '#E9ECEF',
            color: '#212529',
            marginRight: 'auto',
            borderBottomLeftRadius: '4px'
        },
        senderLabel: {
            ...styles.senderLabel,
            fontSize: '0.85em',
            opacity: 0.8,
            marginBottom: '4px'
        },
        messageText: {
            ...styles.messageText,
            lineHeight: '1.4',
            whiteSpace: 'pre-wrap'
        }
    };

    return (
        <div style={updatedStyles.container}>
            <div style={updatedStyles.sessionInfo}>
                Session: {curSessionObj?.sessionName || 'None'}
            </div>
            <div style={updatedStyles.sessionInfo}>
                File: {curDocumentFiles[0]?.filename || 'None'}
            </div>
            
            <div ref={chatLogRef} style={updatedStyles.chatLog}>
                {messages.map((message, index) => renderMessage(message, index))}
            </div>

            <div style={updatedStyles.bottomBar}>
                <div style={updatedStyles.inputContainer}>
                    <textarea
                        style={updatedStyles.textInput}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Type your message..."
                        rows={1}
                    />
                </div>

                <div style={updatedStyles.buttonContainer}>
                    <div>
                        <button
                            style={updatedStyles.modelButton}
                            onClick={() => setShowModelPopup(!showModelPopup)}
                        >
                            Model
                        </button>
                        {showModelPopup && (
                            <div style={{ position: 'absolute', bottom: '100%', left: 0 }}>
                                {/* Model selection component */}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                            style={updatedStyles.imageButton}
                            onClick={() => setShowImagePopup(!showImagePopup)}
                        >
                            <img src="chrome://zotero/skin/image-icon.svg" alt="Image" style={{ width: '14px', height: '14px' }} />
                        </button>
                        <button
                            style={updatedStyles.sendButton}
                            onClick={handleSend}
                        >
                            <img src="chrome://zotero/skin/send-icon.svg" alt="Send" style={{ width: '13px', height: '13px' }} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

DeepTutorChatBox.propTypes = {
    onSessionIdUpdate: PropTypes.func,
    onUserIdUpdate: PropTypes.func,
    messages: PropTypes.array,
    documentIds: PropTypes.array,
    currentSession: PropTypes.object
};

// Add _LoadMessage to the component's prototype
DeepTutorChatBox._LoadMessage = DeepTutorChatBox._LoadMessage;

// Add _appendMessage to the component's prototype
DeepTutorChatBox._appendMessage = DeepTutorChatBox._appendMessage;

export default DeepTutorChatBox;
