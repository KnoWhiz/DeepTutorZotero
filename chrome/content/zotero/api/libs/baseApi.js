/**
 * Base API utilities and configuration
 * Contains common functions, base URLs, and shared helpers used across all API modules
 */

// Access ZOTERO_CONFIG from the global scope
// export const DT_BASE_URL = 'staging.deeptutor.knowhiz.us';
export const DT_BASE_URL = 'deeptutor.knowhiz.us';
// export const DT_BASE_URL = 'localhost:8081';

const API_BASE_URL = DT_BASE_URL.includes('localhost') ? `http://${DT_BASE_URL}/api` : DT_BASE_URL.includes('staging') ? `https://api.${DT_BASE_URL}/api` : `https://api.production.${DT_BASE_URL}/api`;
export const DT_SIGN_UP_URL = `https://${DT_BASE_URL}/dzSignUp`;
export const DT_FORGOT_PASSWORD_URL = `https://${DT_BASE_URL}/dzForgotPassword`;

// Import auth state to get access token
import { authState } from '../../auth/cognitoAuth.js';

/**
 * Get authorization headers for API requests
 * @returns {Object} Headers object with Content-Type and Authorization if available
 */
export const getAuthHeaders = () => {
	const headers = {
		'Content-Type': 'application/json'
	};

	// Add Bearer token if user is authenticated
	const accessToken = authState.getAccessToken();
	if (accessToken) {
		headers['Authorization'] = `Bearer ${accessToken}`;
	}

	return headers;
};

/**
 * Create backend user object for user registration
 * @param {Object} userData - User data object
 * @param {string} userData.name - User's name
 * @param {string} userData.email - User's email
 * @param {string} userData.providerUserId - Provider user ID
 * @returns {Object} Backend user object
 */
export const createBackendUser = ({ name, email, providerUserId }) => {
	const currentTime = new Date().toISOString();
	return {
		name,
		email,
		passwordHash: '',
		profilePictureUrl: '',
		createdAt: currentTime,
		updatedAt: currentTime,
		provider: 'COGNITO_EMAIL',
		providerId: 'COGNITO',
		providerUserId,
	};
};

/**
 * Handle API responses with automatic token refresh on 401 errors
 * @param {Response} response - The fetch response object
 * @param {Object} originalRequest - The original request configuration
 * @returns {Promise<Response>} The handled response
 */
export const handleApiResponse = async (response, originalRequest) => {
	if (response.status === 401) {
		// Token might be expired, try to refresh
		try {
			const { refreshSession } = await import('../../auth/cognitoAuth.js');
			await refreshSession();

			// Retry the original request with new token
			const newHeaders = getAuthHeaders();
			const retryResponse = await window.fetch(originalRequest.url, {
				...originalRequest,
				headers: newHeaders
			});

			if (!retryResponse.ok) {
				throw new Error(`API request failed: ${retryResponse.status}`);
			}

			return retryResponse;
		}
		catch (refreshError) {
			// Only clear auth state for certain types of refresh errors
			// Don't sign out for ScriptLoader errors or other technical issues
			if (refreshError.message && (
				refreshError.message.includes('ScriptLoader')
				|| refreshError.message.includes('context')
				|| refreshError.message.includes('import')
			)) {
				throw new Error(`Token refresh failed due to technical issue: ${refreshError.message}`);
			}
			
			// Clear auth state and redirect to login
			authState.setUnauthenticated();
			throw new Error('Authentication required');
		}
	}

	if (!response.ok) {
		throw new Error(`API request failed: ${response.status}`);
	}

	return response;
};

/**
 * Get the base API URL for all requests
 * @returns {string} The base API URL
 */
export const getApiBaseUrl = () => API_BASE_URL;
