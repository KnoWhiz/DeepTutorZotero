// DeepTutorChatBox with Claude Integration
// This version supports both DeepTutor pipeline and Claude API

import { createMessage, subscribeToChat } from './api/libs/api.js';
import { 
	createClaudeMessage, 
	subscribeToClaudeStream, 
	convertConversationToClaudeFormat,
	checkClaudeProxyHealth 
} from './api/libs/claudeApi.js';

// Configuration for Claude integration
const CLAUDE_INTEGRATION_CONFIG = {
	ENABLED: true, // Set to false to disable Claude integration
	USE_CLAUDE_BY_DEFAULT: false, // Set to true to use Claude by default
	FALLBACK_TO_DEEPTUTOR: true, // Fallback to DeepTutor if Claude fails
	HEALTH_CHECK_INTERVAL: 300000, // 5 minutes
	CLAUDE_PROMPT_PREFIX: "You are a helpful AI tutor. Please respond to the user's question: "
};

// Global state for Claude health
let claudeHealthStatus = {
	isHealthy: false,
	lastChecked: 0,
	error: null
};

// Check Claude proxy health
const checkClaudeHealth = async () => {
	try {
		const now = Date.now();
		if (now - claudeHealthStatus.lastChecked < CLAUDE_INTEGRATION_CONFIG.HEALTH_CHECK_INTERVAL) {
			return claudeHealthStatus.isHealthy;
		}

		const healthResponse = await checkClaudeProxyHealth();
		claudeHealthStatus = {
			isHealthy: healthResponse.status === 'healthy',
			lastChecked: now,
			error: null
		};

		Zotero.debug(`Claude health check: ${claudeHealthStatus.isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
		return claudeHealthStatus.isHealthy;
	} catch (error) {
		claudeHealthStatus = {
			isHealthy: false,
			lastChecked: Date.now(),
			error: error.message
		};
		Zotero.debug(`Claude health check failed: ${error.message}`);
		return false;
	}
};

// Determine which API to use based on configuration and health
const shouldUseClaude = async (userMessage) => {
	if (!CLAUDE_INTEGRATION_CONFIG.ENABLED) {
		return false;
	}

	// Check if user explicitly wants Claude (you can add UI controls for this)
	const useClaude = CLAUDE_INTEGRATION_CONFIG.USE_CLAUDE_BY_DEFAULT || 
					  userMessage.toLowerCase().includes('[claude]') ||
					  userMessage.toLowerCase().includes('[use claude]');

	if (!useClaude) {
		return false;
	}

	// Check Claude health
	const isClaudeHealthy = await checkClaudeHealth();
	return isClaudeHealthy;
};

// Modified sendToAPI function that supports both DeepTutor and Claude
const sendToAPIWithClaude = async (message, conversation) => {
	try {
		setIsStreaming(true);
		isAutoScrollingRef.current = true;
		Zotero.debug(`DeepTutorChatBox: Auto-scrolling FORCE ENABLED for streaming`);

		// Determine which API to use
		const useClaude = await shouldUseClaude(message.subMessages[0].text);
		
		if (useClaude) {
			Zotero.debug(`DeepTutorChatBox: Using Claude API for message`);
			return await sendToClaudeAPI(message, conversation);
		} else {
			Zotero.debug(`DeepTutorChatBox: Using DeepTutor API for message`);
			return await sendToDeepTutorAPI(message, conversation);
		}
	} catch (error) {
		Zotero.debug(`DeepTutorChatBox: Error in sendToAPIWithClaude: ${error.message}`);
		
		// If Claude failed and fallback is enabled, try DeepTutor
		if (CLAUDE_INTEGRATION_CONFIG.FALLBACK_TO_DEEPTUTOR && 
			error.message.includes('Claude')) {
			Zotero.debug(`DeepTutorChatBox: Claude failed, falling back to DeepTutor`);
			return await sendToDeepTutorAPI(message, conversation);
		}
		
		throw error;
	}
};

// Send message to Claude API
const sendToClaudeAPI = async (message, conversation) => {
	try {
		// Convert conversation to Claude format
		const claudeFormat = convertConversationToClaudeFormat(conversation);
		
		// Add Claude prompt prefix
		const userMessage = message.subMessages[0].text;
		const claudeMessage = CLAUDE_INTEGRATION_CONFIG.CLAUDE_PROMPT_PREFIX + userMessage;
		
		// Create Claude message
		const responseData = await createClaudeMessage(claudeMessage, claudeFormat);
		Zotero.debug(`DeepTutorChatBox: Claude message created: ${JSON.stringify(responseData)}`);
		
		// Subscribe to Claude stream
		const streamResponse = await subscribeToClaudeStream(claudeMessage, claudeFormat);
		
		if (!streamResponse.ok) {
			setIsStreaming(false);
			throw new Error(`Claude stream request failed: ${streamResponse.status}`);
		}
		
		if (!streamResponse.body) {
			setIsStreaming(false);
			throw new Error('Claude stream response body is null');
		}

		// Process Claude stream (similar to DeepTutor stream processing)
		const reader = streamResponse.body.getReader();
		streamReaderRef.current = reader;
		const decoder = new TextDecoder();
		let streamText = "";
		let hasReceivedData = false;
		let lastDataTime = Date.now();

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
			streamText: "",
			source: 'claude' // Tag to identify Claude responses
		};

		// Add streaming message to chat
		await _appendMessage("Claude", initialStreamingMessage);

		// Process stream
		while (true) {
			const { done, value } = await reader.read();
			
			// Check for timeout
			if (Date.now() - lastDataTime > 300000) {
				setIsStreaming(false);
				throw new Error('Claude stream timeout - no data received for 300 seconds');
			}
			
			if (done) {
				if (!hasReceivedData) {
					setIsStreaming(false);
					throw new Error('Claude stream closed without receiving any data');
				}
				break;
			}

			lastDataTime = Date.now();
			const data = decoder.decode(value);
			
			data.split('\n\n').forEach((event) => {
				if (!event.startsWith('data:')) return;

				const jsonStr = event.slice(5);
				if (!jsonStr || !jsonStr.trim()) return;

				try {
					const parsed = JSON.parse(jsonStr);
					const output = parsed.content || parsed.text || parsed.msg_content;
					Zotero.debug(`DeepTutorChatBox: Claude received data: ${output}`);
					
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
							streamText: streamText,
							source: 'claude'
						};

						// Update the last message in the chat
						setMessages((prev) => {
							const newMessages = [...prev];
							newMessages[newMessages.length - 1] = streamMessage;
							return newMessages;
						});
					}
				} catch (error) {
					Zotero.debug('DeepTutorChatBox: Error parsing Claude SSE data:', error);
				}
			});
		}

		// Finalize the message
		const finalMessage = {
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
			isStreaming: false,
			source: 'claude'
		};

		// Update the final message
		setMessages((prev) => {
			const newMessages = [...prev];
			newMessages[newMessages.length - 1] = finalMessage;
			return newMessages;
		});

		setIsStreaming(false);
		return responseData;

	} catch (error) {
		setIsStreaming(false);
		Zotero.debug(`DeepTutorChatBox: Claude API error: ${error.message}`);
		throw new Error(`Claude API error: ${error.message}`);
	}
};

// Original DeepTutor API function (renamed for clarity)
const sendToDeepTutorAPI = async (message, conversation) => {
	try {
		// Send message to API
		const responseData = await createMessage(message);
		Zotero.debug(`DeepTutorChatBox: Create Message Response from API: ${JSON.stringify(responseData)}`);
		
		const newDocumentFiles2 = [];
		for (const documentId of currentSession.documentIds || []) {
			try {
				const docData = await getDocumentById(documentId);
				newDocumentFiles2.push(docData);
			}
			catch (error) {
				Zotero.debug(`DeepTutorChatBox: Error fetching document ${documentId}: ${error.message}`);
			}
		}
		
		// Update conversation state
		const newState = new Conversation({
			userId: userId,
			sessionId: sessionId,
			ragSessionId: null,
			storagePaths: newDocumentFiles2.map(doc => doc.storagePath),
			history: messages,
			message: responseData,
			streaming: true,
			type: currentSession?.type || SessionType.BASIC
		});
		
		setConversation(newState);

		// Subscribe to chat stream
		const streamResponse = await subscribeToChat(newState);
		
		if (!streamResponse.ok) {
			setIsStreaming(false);
			throw new Error(`Stream request failed: ${streamResponse.status}`);
		}
		
		if (!streamResponse.body) {
			setIsStreaming(false);
			throw new Error('Stream response body is null');
		}

		// Process DeepTutor stream (existing logic)
		const reader = streamResponse.body.getReader();
		streamReaderRef.current = reader;
		const decoder = new TextDecoder();
		let streamText = "";
		let hasReceivedData = false;
		let lastDataTime = Date.now();

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
			streamText: "",
			source: 'deeptutor'
		};

		// Add streaming message to chat
		await _appendMessage("DeepTutor", initialStreamingMessage);

		// Process stream (existing logic)
		while (true) {
			const { done, value } = await reader.read();
			
			if (Date.now() - lastDataTime > 300000) {
				setIsStreaming(false);
				throw new Error('Stream timeout - no data received for 300 seconds');
			}
			
			if (done) {
				if (!hasReceivedData) {
					setIsStreaming(false);
					throw new Error('Stream closed without receiving any data');
				}
				break;
			}

			lastDataTime = Date.now();
			const data = decoder.decode(value);
			
			data.split('\n\n').forEach((event) => {
				if (!event.startsWith('data:')) return;

				const jsonStr = event.slice(5);
				if (!jsonStr || !jsonStr.trim()) return;

				try {
					const parsed = JSON.parse(jsonStr);
					const output = parsed.msg_content;
					Zotero.debug(`DeepTutorChatBox: Received data: ${output}`);
					
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
							streamText: streamText,
							source: 'deeptutor'
						};

						// Update the last message in the chat
						setMessages((prev) => {
							const newMessages = [...prev];
							newMessages[newMessages.length - 1] = streamMessage;
							return newMessages;
						});
					}
				} catch (error) {
					Zotero.debug('DeepTutorChatBox: Error parsing SSE data:', error);
				}
			});
		}

		// Finalize the message
		const finalMessage = {
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
			isStreaming: false,
			source: 'deeptutor'
		};

		// Update the final message
		setMessages((prev) => {
			const newMessages = [...prev];
			newMessages[newMessages.length - 1] = finalMessage;
			return newMessages;
		});

		setIsStreaming(false);
		return responseData;

	} catch (error) {
		setIsStreaming(false);
		Zotero.debug(`DeepTutorChatBox: DeepTutor API error: ${error.message}`);
		throw new Error(`DeepTutor API error: ${error.message}`);
	}
};

// Export the modified functions
export {
	sendToAPIWithClaude,
	sendToClaudeAPI,
	sendToDeepTutorAPI,
	shouldUseClaude,
	checkClaudeHealth,
	CLAUDE_INTEGRATION_CONFIG
};
