// Access ZOTERO_CONFIG from the global scope
export const DT_BASE_URL = 'staging.deeptutor.knowhiz.us';
// export const DT_BASE_URL = 'deeptutor.knowhiz.us';
// export const DT_BASE_URL = 'localhost:8081';

const API_BASE_URL = DT_BASE_URL.includes('localhost') ? `http://${DT_BASE_URL}/api` : DT_BASE_URL.includes('staging') ? `https://api.${DT_BASE_URL}/api` : `https://api.production.${DT_BASE_URL}/api`;
export const DT_SIGN_UP_URL = `https://${DT_BASE_URL}/dzSignUp`;
export const DT_FORGOT_PASSWORD_URL = `https://${DT_BASE_URL}/dzForgotPassword`;
// Import auth state to get access token
import { authState } from '../../auth/cognitoAuth.js';

// Helper function to get authorization headers
const getAuthHeaders = () => {
	const headers = {
		'Content-Type': 'application/json'
	};

	// Add Bearer token if user is authenticated
	const accessToken = authState.getAccessToken();
	Zotero.debug(`DeepTutor API: Getting auth headers - accessToken exists: ${!!accessToken}, authState.isAuthenticated: ${authState.isAuthenticated}`);
	
	if (accessToken) {
		headers['Authorization'] = `Bearer ${accessToken}`;
		Zotero.debug(`DeepTutor API: Added Authorization header (length: ${accessToken.length})`);
		
		// DEBUG: Try to decode the JWT token to check expiration
		try {
			const tokenParts = accessToken.split('.');
			if (tokenParts.length === 3) {
				const payload = JSON.parse(atob(tokenParts[1]));
				const exp = payload.exp;
				const now = Math.floor(Date.now() / 1000);
				const timeUntilExpiry = exp - now;
				Zotero.debug(`DeepTutor API: Token expires in ${timeUntilExpiry} seconds (${timeUntilExpiry / 60} minutes)`);
				
				if (timeUntilExpiry < 60) {
					Zotero.debug(`DeepTutor API: WARNING - Token expires in less than 1 minute!`);
				}
			}
		}
		catch (tokenError) {
			Zotero.debug(`DeepTutor API: Could not decode token: ${tokenError.message}`);
		}
	}
	else {
		Zotero.debug(`DeepTutor API: No access token available - user may not be authenticated`);
	}

	return headers;
};

// Helper function to create backend user object
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

// Helper function to handle API responses with token refresh
const handleApiResponse = async (response, originalRequest) => {
	// DEBUG: Log API response details
	Zotero.debug(`DeepTutor API: Response status: ${response.status}, URL: ${originalRequest.url}`);
	
	if (response.status === 401) {
		Zotero.debug('DeepTutor API: 401 Unauthorized - attempting token refresh');
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
				Zotero.debug(`DeepTutor API: Retry failed with status: ${retryResponse.status}`);
				throw new Error(`API request failed: ${retryResponse.status}`);
			}

			Zotero.debug('DeepTutor API: Token refresh and retry successful');
			return retryResponse;
		}
		catch (refreshError) {
			Zotero.debug(`DeepTutor API: Token refresh failed: ${refreshError.message}`);
			
			// Only clear auth state for certain types of refresh errors
			// Don't sign out for ScriptLoader errors or other technical issues
			if (refreshError.message && (
				refreshError.message.includes('ScriptLoader')
				|| refreshError.message.includes('context')
				|| refreshError.message.includes('import')
			)) {
				Zotero.debug(`DeepTutor API: Technical refresh error detected, not signing out user`);
				throw new Error(`Token refresh failed due to technical issue: ${refreshError.message}`);
			}
			
			Zotero.debug(`DeepTutor API: Clearing authentication state due to refresh failure`);
			// Clear auth state and redirect to login
			authState.setUnauthenticated();
			throw new Error('Authentication required');
		}
	}

	if (!response.ok) {
		Zotero.debug(`DeepTutor API: Non-401 error - status: ${response.status}, URL: ${originalRequest.url}`);
		throw new Error(`API request failed: ${response.status}`);
	}

	return response;
};

// Message related API calls
export const getMessageByMessageId = async (messageId) => {
	const requestConfig = {
		method: 'GET',
		headers: getAuthHeaders()
	};

	const response = await window.fetch(`${API_BASE_URL}/message/${messageId}`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${API_BASE_URL}/message/${messageId}`,
		...requestConfig
	});

	return handledResponse.json();
};

export const getMessagesBySessionId = async (sessionId) => {
	const requestConfig = {
		method: 'GET',
		headers: getAuthHeaders()
	};

	const response = await window.fetch(`${API_BASE_URL}/message/bySession/${sessionId}`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${API_BASE_URL}/message/bySession/${sessionId}`,
		...requestConfig
	});

	return handledResponse.json();
};

export const createMessage = async (message) => {
	const requestConfig = {
		method: 'POST',
		headers: getAuthHeaders(),
		body: JSON.stringify(message)
	};

	const response = await window.fetch(`${API_BASE_URL}/message/create`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${API_BASE_URL}/message/create`,
		...requestConfig
	});

	return handledResponse.json();
};

// Session related API calls
export const createSession = async (sessionData) => {
	// DEBUG: Log session creation details
	Zotero.debug(`DeepTutor API: Creating session with data: ${JSON.stringify(sessionData, null, 2)}`);
	
	const requestConfig = {
		method: 'POST',
		headers: getAuthHeaders(),
		body: JSON.stringify(sessionData)
	};

	// DEBUG: Log request headers (excluding sensitive data)
	const debugHeaders = { ...requestConfig.headers };
	if (debugHeaders.Authorization) {
		debugHeaders.Authorization = debugHeaders.Authorization.substring(0, 20) + '...';
	}
	Zotero.debug(`DeepTutor API: Request headers: ${JSON.stringify(debugHeaders, null, 2)}`);

	const response = await window.fetch(`${API_BASE_URL}/session/create`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${API_BASE_URL}/session/create`,
		...requestConfig
	});

	return handledResponse.json();
};

export const updateSessionName = async (sessionId, sessionName) => {
	const requestConfig = {
		method: 'PUT',
		headers: getAuthHeaders(),
		body: sessionName
	};

	const response = await window.fetch(`${API_BASE_URL}/session/${sessionId}/name`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${API_BASE_URL}/session/${sessionId}/name`,
		...requestConfig
	});

	return handledResponse.json();
};

export const getSessionById = async (sessionId) => {
	const requestConfig = {
		method: 'GET',
		headers: getAuthHeaders()
	};

	const response = await window.fetch(`${API_BASE_URL}/session/${sessionId}`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${API_BASE_URL}/session/${sessionId}`,
		...requestConfig
	});

	return handledResponse.json();
};

export const getSessionsByUserId = async (userId) => {
	const requestConfig = {
		method: 'GET',
		headers: getAuthHeaders()
	};

	const response = await window.fetch(`${API_BASE_URL}/session/byUser/${userId}`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${API_BASE_URL}/session/byUser/${userId}`,
		...requestConfig
	});

	return handledResponse.json();
};

// Usage related API calls
export const getSessionUsageForUser = async (userId) => {
	const requestConfig = {
		method: 'GET',
		headers: getAuthHeaders()
	};

	const response = await window.fetch(`${API_BASE_URL}/session/usage/byUser/${userId}`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${API_BASE_URL}/session/usage/byUser/${userId}`,
		...requestConfig
	});

	return handledResponse.json();
};

export const deleteSessionById = async (sessionId) => {
	const requestConfig = {
		method: 'DELETE',
		headers: getAuthHeaders()
	};

	const response = await window.fetch(`${API_BASE_URL}/session/delete/${sessionId}`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${API_BASE_URL}/session/delete/${sessionId}`,
		...requestConfig
	});

	return handledResponse.json();
};

// User related API calls
export const getUserById = async (userId) => {
	const requestConfig = {
		method: 'GET',
		headers: getAuthHeaders()
	};

	const response = await window.fetch(`${API_BASE_URL}/users/byUserId/${userId}`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${API_BASE_URL}/users/byUserId/${userId}`,
		...requestConfig
	});

	return handledResponse.json();
};

export const getUserByProviderUserId = async (providerUserId) => {
	const requestConfig = {
		method: 'GET',
		headers: getAuthHeaders()
	};

	const response = await window.fetch(`${API_BASE_URL}/users/byProviderUserId/${providerUserId}`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${API_BASE_URL}/users/byProviderUserId/${providerUserId}`,
		...requestConfig
	});

	return handledResponse.json();
};

export const registerUser = async (newUser) => {
	const requestConfig = {
		method: 'POST',
		headers: getAuthHeaders(),
		body: JSON.stringify(newUser)
	};

	const response = await window.fetch(`${API_BASE_URL}/users/register`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${API_BASE_URL}/users/register`,
		...requestConfig
	});

	return handledResponse.json();
};

export const getActiveUserSubscriptionByUserId = async (userId) => {
	const requestConfig = {
		method: 'GET',
		headers: getAuthHeaders()
	};

	const response = await window.fetch(`${API_BASE_URL}/subscriptions/activeForUser/${userId}`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${API_BASE_URL}/users/subscription/${userId}`,
		...requestConfig
	});

	return handledResponse.json();
};

export const getLatestUserSubscriptionByUserId = async (userId) => {
	const requestConfig = {
		method: 'GET',
		headers: getAuthHeaders()
	};
	
	const response = await window.fetch(`${API_BASE_URL}/subscriptions/latestForUser/${userId}`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${API_BASE_URL}/users/subscription/latest/${userId}`,
		...requestConfig
	});

	return handledResponse.json();
};

// Document related API calls
export const getDocumentById = async (documentId) => {
	const requestConfig = {
		method: 'GET',
		headers: getAuthHeaders()
	};

	const response = await window.fetch(`${API_BASE_URL}/document/${documentId}`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${API_BASE_URL}/document/${documentId}`,
		...requestConfig
	});

	return handledResponse.json();
};

export const getPreSignedUrl = async (userId, fileName) => {
	// DEBUG: Log the full URL being called
	const fullUrl = `${API_BASE_URL}/document/preSignedUrl/${userId}/${fileName}`;
	Zotero.debug(`DeepTutor API: getPreSignedUrl full URL: ${fullUrl}`);
	
	const requestConfig = {
		method: 'GET',
		headers: getAuthHeaders()
	};

	const response = await window.fetch(fullUrl, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: fullUrl,
		...requestConfig
	});

	return handledResponse.json();
};

// Chat stream related API calls
export const subscribeToChat = async (conversation) => {
	const requestConfig = {
		method: 'POST',
		headers: {
			...getAuthHeaders(),
			Accept: 'text/event-stream'
		},
		body: JSON.stringify(conversation)
	};

	const response = await window.fetch(`${API_BASE_URL}/chat/subscribe`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${API_BASE_URL}/chat/subscribe`,
		...requestConfig
	});

	return handledResponse;
};

// File upload related API calls
export const uploadFileToAzure = async (preSignedUrl, fileBlob) => {
	const response = await window.fetch(preSignedUrl, {
		method: 'PUT',
		headers: {
			'x-ms-blob-type': 'BlockBlob',
			'Content-Type': 'application/pdf'
		},
		body: fileBlob
	});

	if (!response.ok) {
		throw new Error(`Failed to upload file: ${response.status} ${response.statusText}`);
	}

	return response;
};
