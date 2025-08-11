// Claude API Integration for DeepTutor
// This module handles communication with the company's Claude proxy server

// Configuration for Claude proxy server
const CLAUDE_PROXY_CONFIG = {
	// This should be configured based on your company's proxy server
	PROXY_BASE_URL: 'https://api.anthropic.com' || 'http://localhost:8082' || 'http://localhost:8080/api/claude',
	API_KEY: 'TODO' || '', // Should be set on backend
	MODEL: 'claude-3-5-sonnet-20241022', // Updated to match working model from test
	MAX_TOKENS: 1000,
	STREAMING: true
};

// Helper function to get authorization headers for Claude requests
const getClaudeAuthHeaders = () => {
	const headers = {
		'Content-Type': 'application/json',
		'X-Request-Type': 'claude', // Tag to identify Claude requests
		'X-DeepTutor-Source': 'zotero-extension'
	};

	// Add API key if available
	if (CLAUDE_PROXY_CONFIG.API_KEY) {
		headers['x-api-key'] = CLAUDE_PROXY_CONFIG.API_KEY;
	}

	return headers;
};

// Helper function to handle Claude API responses
const handleClaudeApiResponse = async (response, originalRequest) => {
	if (response.status !== 200) {
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
			model: CLAUDE_PROXY_CONFIG.MODEL,
			max_tokens: CLAUDE_PROXY_CONFIG.MAX_TOKENS,
			messages: [{
				role: 'user',
				content: message.subMessages?.[0]?.text || message.text || ''
			}]
		})
	};

	const response = await window.fetch(`${CLAUDE_PROXY_CONFIG.PROXY_BASE_URL}/v1/messages`, requestConfig);
	Zotero.debug('SSSS createClaudeMessage: Response', response);
	const handledResponse = await handleClaudeApiResponse(response, {
		url: `${CLAUDE_PROXY_CONFIG.PROXY_BASE_URL}/v1/messages`,
		...requestConfig
	});
	Zotero.debug('SSSS createClaudeMessage: Handled response', handledResponse);

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
			model: CLAUDE_PROXY_CONFIG.MODEL,
			max_tokens: CLAUDE_PROXY_CONFIG.MAX_TOKENS,
			messages: [{
				role: 'user',
				content: message.subMessages?.[0]?.text || message.text || ''
			}],
			stream: true
		})
	};

	Zotero.debug('SSSS subscribeToClaudeStream: Request config', requestConfig);

	const response = await window.fetch(`${CLAUDE_PROXY_CONFIG.PROXY_BASE_URL}/v1/messages`, requestConfig);
	const handledResponse = await handleClaudeApiResponse(response, {
		url: `${CLAUDE_PROXY_CONFIG.PROXY_BASE_URL}/v1/messages`,
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
			model: CLAUDE_PROXY_CONFIG.MODEL,
			max_tokens: CLAUDE_PROXY_CONFIG.MAX_TOKENS,
			messages: requests.map(req => ({
				role: 'user',
				content: req.subMessages?.[0]?.text || req.text || ''
			}))
		})
	};

	const response = await window.fetch(`${CLAUDE_PROXY_CONFIG.PROXY_BASE_URL}/v1/messages`, requestConfig);
	const handledResponse = await handleClaudeApiResponse(response, {
		url: `${CLAUDE_PROXY_CONFIG.PROXY_BASE_URL}/v1/messages`,
		...requestConfig
	});

	return handledResponse.json();
};

// Get Claude batch results - Not supported by proxy, return single response
export const getClaudeBatchResults = async (batchId) => {
	Zotero.debug('Claude batch results not supported by proxy, returning empty response');
	return { content: 'Batch processing not supported by this proxy server' };
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
