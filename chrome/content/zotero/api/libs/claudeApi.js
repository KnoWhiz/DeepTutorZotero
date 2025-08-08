// Claude API Integration for DeepTutor
// This module handles communication with the company's Claude proxy server

import { authState } from '../../auth/cognitoAuth.js';

// Configuration for Claude proxy server
const CLAUDE_PROXY_CONFIG = {
	// This should be configured based on your company's proxy server
	PROXY_BASE_URL: process.env.CLAUDE_PROXY_URL || 'http://localhost:8080/api/claude',
	API_KEY: process.env.CLAUDE_API_KEY || '', // Should be set on backend
	MODEL: 'claude-sonnet-4-20250514',
	MAX_TOKENS: 1024,
	STREAMING: true
};

// Helper function to get authorization headers for Claude requests
const getClaudeAuthHeaders = () => {
	const headers = {
		'Content-Type': 'application/json',
		'X-Request-Type': 'claude', // Tag to identify Claude requests
		'X-DeepTutor-Source': 'zotero-extension'
	};

	// Add Bearer token if user is authenticated
	const accessToken = authState.getAccessToken();
	if (accessToken) {
		headers['Authorization'] = `Bearer ${accessToken}`;
	}

	return headers;
};

// Helper function to handle Claude API responses
const handleClaudeApiResponse = async (response, originalRequest) => {
	if (response.status === 401) {
		// Token might be expired, try to refresh
		try {
			const { refreshSession } = await import('../../auth/cognitoAuth.js');
			await refreshSession();

			// Retry the original request with new token
			const newHeaders = getClaudeAuthHeaders();
			const retryResponse = await window.fetch(originalRequest.url, {
				...originalRequest,
				headers: newHeaders
			});

			if (!retryResponse.ok) {
				throw new Error(`Claude API request failed: ${retryResponse.status}`);
			}

			return retryResponse;
		} catch (refreshError) {
			Zotero.debug(`Claude API: Token refresh failed: ${refreshError.message}`);
			authState.setUnauthenticated();
			throw new Error('Authentication required');
		}
	}

	if (!response.ok) {
		throw new Error(`Claude API request failed: ${response.status}`);
	}

	return response;
};

// Create a Claude message (non-streaming)
export const createClaudeMessage = async (message, conversationContext = {}) => {
	const requestConfig = {
		method: 'POST',
		headers: getClaudeAuthHeaders(),
		body: JSON.stringify({
			message: message,
			conversationContext: conversationContext,
			model: CLAUDE_PROXY_CONFIG.MODEL,
			max_tokens: CLAUDE_PROXY_CONFIG.MAX_TOKENS,
			stream: false
		})
	};

	const response = await window.fetch(`${CLAUDE_PROXY_CONFIG.PROXY_BASE_URL}/messages/create`, requestConfig);
	const handledResponse = await handleClaudeApiResponse(response, {
		url: `${CLAUDE_PROXY_CONFIG.PROXY_BASE_URL}/messages/create`,
		...requestConfig
	});

	return handledResponse.json();
};

// Subscribe to Claude streaming response
export const subscribeToClaudeStream = async (message, conversationContext = {}) => {
	const requestConfig = {
		method: 'POST',
		headers: {
			...getClaudeAuthHeaders(),
			'Accept': 'text/event-stream'
		},
		body: JSON.stringify({
			message: message,
			conversationContext: conversationContext,
			model: CLAUDE_PROXY_CONFIG.MODEL,
			max_tokens: CLAUDE_PROXY_CONFIG.MAX_TOKENS,
			stream: true
		})
	};

	const response = await window.fetch(`${CLAUDE_PROXY_CONFIG.PROXY_BASE_URL}/messages/stream`, requestConfig);
	const handledResponse = await handleClaudeApiResponse(response, {
		url: `${CLAUDE_PROXY_CONFIG.PROXY_BASE_URL}/messages/stream`,
		...requestConfig
	});

	return handledResponse;
};

// Create a Claude message batch (for multiple requests)
export const createClaudeMessageBatch = async (requests) => {
	const requestConfig = {
		method: 'POST',
		headers: getClaudeAuthHeaders(),
		body: JSON.stringify({
			requests: requests,
			model: CLAUDE_PROXY_CONFIG.MODEL,
			max_tokens: CLAUDE_PROXY_CONFIG.MAX_TOKENS
		})
	};

	const response = await window.fetch(`${CLAUDE_PROXY_CONFIG.PROXY_BASE_URL}/messages/batches/create`, requestConfig);
	const handledResponse = await handleClaudeApiResponse(response, {
		url: `${CLAUDE_PROXY_CONFIG.PROXY_BASE_URL}/messages/batches/create`,
		...requestConfig
	});

	return handledResponse.json();
};

// Get Claude batch results
export const getClaudeBatchResults = async (batchId) => {
	const requestConfig = {
		method: 'GET',
		headers: getClaudeAuthHeaders()
	};

	const response = await window.fetch(`${CLAUDE_PROXY_CONFIG.PROXY_BASE_URL}/messages/batches/${batchId}/results`, requestConfig);
	const handledResponse = await handleClaudeApiResponse(response, {
		url: `${CLAUDE_PROXY_CONFIG.PROXY_BASE_URL}/messages/batches/${batchId}/results`,
		...requestConfig
	});

	return handledResponse;
};

// Health check for Claude proxy
export const checkClaudeProxyHealth = async () => {
	const requestConfig = {
		method: 'GET',
		headers: getClaudeAuthHeaders()
	};

	const response = await window.fetch(`${CLAUDE_PROXY_CONFIG.PROXY_BASE_URL}/health`, requestConfig);
	const handledResponse = await handleClaudeApiResponse(response, {
		url: `${CLAUDE_PROXY_CONFIG.PROXY_BASE_URL}/health`,
		...requestConfig
	});

	return handledResponse.json();
};

// Utility function to convert DeepTutor conversation to Claude format
export const convertConversationToClaudeFormat = (conversation) => {
	const messages = [];
	
	// Add conversation history
	if (conversation.history && conversation.history.length > 0) {
		conversation.history.forEach(msg => {
			if (msg.role === 'USER') {
				messages.push({
					role: 'user',
					content: msg.subMessages?.[0]?.text || ''
				});
			} else if (msg.role === 'TUTOR') {
				messages.push({
					role: 'assistant',
					content: msg.subMessages?.[0]?.text || ''
				});
			}
		});
	}

	// Add current message if exists
	if (conversation.message) {
		if (conversation.message.role === 'USER') {
			messages.push({
				role: 'user',
				content: conversation.message.subMessages?.[0]?.text || ''
			});
		}
	}

	return {
		messages: messages,
		context: {
			sessionId: conversation.sessionId,
			userId: conversation.userId,
			sessionType: conversation.type,
			storagePaths: conversation.storagePaths || []
		}
	};
};

// Export configuration for external use
export const CLAUDE_CONFIG = CLAUDE_PROXY_CONFIG;
