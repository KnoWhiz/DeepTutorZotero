/**
 * Session management API calls
 * Handles session creation, updates, retrieval, and deletion
 */

import { getApiBaseUrl, getAuthHeaders, handleApiResponse } from './baseApi.js';

/**
 * Create a new session
 * @param {Object} sessionData - Session data object
 * @returns {Promise<Object>} Created session data
 */
export const createSession = async (sessionData) => {
	const requestConfig = {
		method: 'POST',
		headers: getAuthHeaders(),
		body: JSON.stringify(sessionData)
	};

	const response = await window.fetch(`${getApiBaseUrl()}/session/create`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${getApiBaseUrl()}/session/create`,
		...requestConfig
	});

	return handledResponse.json();
};

/**
 * Update session name
 * @param {string} sessionId - The session ID
 * @param {string} sessionName - New session name
 * @returns {Promise<Object>} Updated session data
 */
export const updateSessionName = async (sessionId, sessionName) => {
	const requestConfig = {
		method: 'PUT',
		headers: getAuthHeaders(),
		body: sessionName
	};

	const response = await window.fetch(`${getApiBaseUrl()}/session/${sessionId}/name`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${getApiBaseUrl()}/session/${sessionId}/name`,
		...requestConfig
	});

	return handledResponse.json();
};

/**
 * Get session by ID
 * @param {string} sessionId - The session ID
 * @returns {Promise<Object>} Session data
 */
export const getSessionById = async (sessionId) => {
	const requestConfig = {
		method: 'GET',
		headers: getAuthHeaders()
	};

	const response = await window.fetch(`${getApiBaseUrl()}/session/${sessionId}`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${getApiBaseUrl()}/session/${sessionId}`,
		...requestConfig
	});

	return handledResponse.json();
};

/**
 * Get all sessions for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Array>} Array of session objects
 */
export const getSessionsByUserId = async (userId) => {
	const requestConfig = {
		method: 'GET',
		headers: getAuthHeaders()
	};

	const response = await window.fetch(`${getApiBaseUrl()}/session/byUser/${userId}`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${getApiBaseUrl()}/session/byUser/${userId}`,
		...requestConfig
	});

	return handledResponse.json();
};

/**
 * Get session usage statistics for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} Usage statistics
 */
export const getSessionUsageForUser = async (userId) => {
	const requestConfig = {
		method: 'GET',
		headers: getAuthHeaders()
	};

	const response = await window.fetch(`${getApiBaseUrl()}/session/usage/byUser/${userId}`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${getApiBaseUrl()}/session/usage/byUser/${userId}`,
		...requestConfig
	});

	return handledResponse.json();
};

/**
 * Delete a session by ID
 * @param {string} sessionId - The session ID
 * @returns {Promise<Object>} Deletion confirmation
 */
export const deleteSessionById = async (sessionId) => {
	const requestConfig = {
		method: 'DELETE',
		headers: getAuthHeaders()
	};

	const response = await window.fetch(`${getApiBaseUrl()}/session/delete/${sessionId}`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${getApiBaseUrl()}/session/delete/${sessionId}`,
		...requestConfig
	});

	return handledResponse.json();
};
