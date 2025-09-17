/**
 * Document and file upload API calls
 * Handles document retrieval, pre-signed URL generation, and file uploads
 */

import { getApiBaseUrl, getAuthHeaders, handleApiResponse } from './baseApi.js';

/**
 * Get document by ID
 * @param {string} documentId - The document ID
 * @returns {Promise<Object>} Document data
 */
export const getDocumentById = async (documentId) => {
	const requestConfig = {
		method: 'GET',
		headers: getAuthHeaders()
	};

	const response = await window.fetch(`${getApiBaseUrl()}/document/${documentId}`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${getApiBaseUrl()}/document/${documentId}`,
		...requestConfig
	});

	return handledResponse.json();
};

/**
 * Get pre-signed URL for file upload
 * @param {string} userId - The user ID
 * @param {string} fileName - The file name
 * @returns {Promise<Object>} Pre-signed URL data
 */
export const getPreSignedUrl = async (userId, fileName) => {
	const requestConfig = {
		method: 'GET',
		headers: getAuthHeaders()
	};

	const response = await window.fetch(`${getApiBaseUrl()}/document/preSignedUrl/${userId}/${fileName}`, requestConfig);
	const handledResponse = await handleApiResponse(response, {
		url: `${getApiBaseUrl()}/document/preSignedUrl/${userId}/${fileName}`,
		...requestConfig
	});

	return handledResponse.json();
};

/**
 * Upload file to Azure using pre-signed URL
 * @param {string} preSignedUrl - The pre-signed URL for upload
 * @param {Blob} fileBlob - The file blob to upload
 * @returns {Promise<Response>} Upload response
 */
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
