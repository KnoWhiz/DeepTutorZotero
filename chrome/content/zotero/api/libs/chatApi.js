/**
 * Chat and messaging API calls
 * Handles message creation, retrieval, and chat streaming
 */

import { getApiBaseUrl, getAuthHeaders, handleApiResponse } from './baseApi.js';

/**
 * Get a message by message ID
 * @param {string} messageId - The message ID
 * @returns {Promise<Object>} Message data
 */
export const getMessageByMessageId = async (messageId) => {
	const requestConfig = {
		method: 'GET',
		headers: getAuthHeaders()
	};

	const response = await window.fetch(`${getApiBaseUrl()}/message/${messageId}`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${getApiBaseUrl()}/message/${messageId}`,
		...requestConfig
	});

	return handledResponse.json();
};

/**
 * Get all messages for a session
 * @param {string} sessionId - The session ID
 * @returns {Promise<Array>} Array of message objects
 */
export const getMessagesBySessionId = async (sessionId) => {
	const requestConfig = {
		method: 'GET',
		headers: getAuthHeaders()
	};

	const response = await window.fetch(`${getApiBaseUrl()}/message/bySession/${sessionId}`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${getApiBaseUrl()}/message/bySession/${sessionId}`,
		...requestConfig
	});

	return handledResponse.json();
};

/**
 * Create a new message
 * @param {Object} message - Message data object
 * @returns {Promise<Object>} Created message data
 */
export const createMessage = async (message) => {
	const requestConfig = {
		method: 'POST',
		headers: getAuthHeaders(),
		body: JSON.stringify(message)
	};

	const response = await window.fetch(`${getApiBaseUrl()}/message/create`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${getApiBaseUrl()}/message/create`,
		...requestConfig
	});

	return handledResponse.json();
};

/**
 * Subscribe to chat stream
 * @param {Object} conversation - Conversation data object
 * @returns {Promise<Response>} Streaming response
 */
export const subscribeToChat = async (conversation) => {
	const requestConfig = {
		method: 'POST',
		headers: {
			...getAuthHeaders(),
			Accept: 'text/event-stream'
		},
		body: JSON.stringify(conversation)
	};

	const response = await window.fetch(`${getApiBaseUrl()}/chat/subscribe`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${getApiBaseUrl()}/chat/subscribe`,
		...requestConfig
	});

	return handledResponse;
};
