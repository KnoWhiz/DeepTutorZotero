/**
 * Main API module - Re-exports all API functions from separate modules
 * This maintains backward compatibility while organizing code into focused modules
 */

// Re-export base utilities and URLs
export {
	DT_BASE_URL,
	DT_SIGN_UP_URL,
	DT_FORGOT_PASSWORD_URL,
	getAuthHeaders,
	createBackendUser,
	handleApiResponse,
	getApiBaseUrl
} from './baseApi.js';

// Re-export authentication APIs
export {
	getUserById,
	getUserByProviderUserId,
	registerUser
} from './authApi.js';

// Re-export session management APIs
export {
	createSession,
	updateSessionName,
	getSessionById,
	getSessionsByUserId,
	getSessionUsageForUser,
	deleteSessionById
} from './sessionApi.js';

// Re-export chat and messaging APIs
export {
	getMessageByMessageId,
	getMessagesBySessionId,
	createMessage,
	subscribeToChat
} from './chatApi.js';

// Re-export subscription APIs
export {
	getActiveUserSubscriptionByUserId,
	getLatestUserSubscriptionByUserId
} from './subscriptionApi.js';

// Re-export document and file upload APIs
export {
	getDocumentById,
	getPreSignedUrl,
	uploadFileToAzure
} from './documentApi.js';