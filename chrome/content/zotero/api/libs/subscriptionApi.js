/**
 * Subscription-related API calls
 * Handles user subscription management and retrieval
 */

import { getApiBaseUrl, getAuthHeaders, handleApiResponse } from './baseApi.js';

/**
 * Get active subscription for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} Active subscription data
 */
export const getActiveUserSubscriptionByUserId = async (userId) => {
	const requestConfig = {
		method: 'GET',
		headers: getAuthHeaders()
	};

	const response = await window.fetch(`${getApiBaseUrl()}/subscriptions/activeForUser/${userId}`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${getApiBaseUrl()}/users/subscription/${userId}`,
		...requestConfig
	});

	return handledResponse.json();
};

/**
 * Get latest subscription for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} Latest subscription data
 */
export const getLatestUserSubscriptionByUserId = async (userId) => {
	const requestConfig = {
		method: 'GET',
		headers: getAuthHeaders()
	};
	
	const response = await window.fetch(`${getApiBaseUrl()}/subscriptions/latestForUser/${userId}`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${getApiBaseUrl()}/users/subscription/latest/${userId}`,
		...requestConfig
	});

	return handledResponse.json();
};
