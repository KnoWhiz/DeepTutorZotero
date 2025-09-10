/**
 * Authentication-related API calls
 * Handles user authentication, registration, and user data management
 */

import { getApiBaseUrl, getAuthHeaders, handleApiResponse, createBackendUser } from './baseApi.js';

/**
 * Get user by user ID
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} User data object
 */
export const getUserById = async (userId) => {
	const requestConfig = {
		method: 'GET',
		headers: getAuthHeaders()
	};

	const response = await window.fetch(`${getApiBaseUrl()}/users/byUserId/${userId}`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${getApiBaseUrl()}/users/byUserId/${userId}`,
		...requestConfig
	});

	return handledResponse.json();
};

/**
 * Get user by provider user ID (Cognito sub)
 * @param {string} providerUserId - The provider user ID
 * @returns {Promise<Object>} User data object
 */
export const getUserByProviderUserId = async (providerUserId) => {
	const requestConfig = {
		method: 'GET',
		headers: getAuthHeaders()
	};

	const response = await window.fetch(`${getApiBaseUrl()}/users/byProviderUserId/${providerUserId}`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${getApiBaseUrl()}/users/byProviderUserId/${providerUserId}`,
		...requestConfig
	});

	return handledResponse.json();
};

/**
 * Register a new user
 * @param {Object} newUser - User data object
 * @returns {Promise<Object>} Registered user data
 */
export const registerUser = async (newUser) => {
	const requestConfig = {
		method: 'POST',
		headers: getAuthHeaders(),
		body: JSON.stringify(newUser)
	};

	const response = await window.fetch(`${getApiBaseUrl()}/users/register`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${getApiBaseUrl()}/users/register`,
		...requestConfig
	});

	return handledResponse.json();
};

// Re-export createBackendUser for convenience
export { createBackendUser };
