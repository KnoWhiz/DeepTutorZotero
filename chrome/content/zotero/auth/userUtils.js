/**
 * Utility functions for handling user data consistently across different authentication scenarios
 */

/**
 * Gets the user's email from various user object structures
 * Handles:
 * - Restored users (plain objects with email property)
 * - Google OAuth users (with attributes.email)
 * - Live Cognito users (with fetchedAttributes.email)
 * - Regular Cognito users (with username as email)
 *
 * @param {Object} user - The user object (currentUser, cognitoUser, etc.)
 * @returns {string|null} - The user's email address or null if not found
 */
export const getUserEmail = (user) => {
	if (!user) {
		Zotero.debug('DeepTutor UserUtils: getUserEmail called with no user object');
		return null;
	}

	// Priority 1: Direct email property (for restored users)
	if (user.email) {
		Zotero.debug(`DeepTutor UserUtils: Using direct email property: ${user.email}`);
		return user.email;
	}

	// Priority 2: Email from attributes (for Google OAuth users)
	if (user.attributes && user.attributes.email) {
		Zotero.debug(`DeepTutor UserUtils: Using email from attributes: ${user.attributes.email}`);
		return user.attributes.email;
	}

	// Priority 3: Email from fetched attributes (for live Cognito users)
	if (user.fetchedAttributes && user.fetchedAttributes.email) {
		Zotero.debug(`DeepTutor UserUtils: Using email from fetched attributes: ${user.fetchedAttributes.email}`);
		return user.fetchedAttributes.email;
	}

	// Priority 4: Username as email (fallback for regular Cognito users)
	if (user.username) {
		Zotero.debug(`DeepTutor UserUtils: Using username as email: ${user.username}`);
		return user.username;
	}

	Zotero.debug('DeepTutor UserUtils: No email found in user object');
	return null;
};

/**
 * Gets the user's name from various user object structures
 *
 * @param {Object} user - The user object
 * @returns {string|null} - The user's name or null if not found
 */
export const getUserName = (user) => {
	if (!user) {
		return null;
	}

	// Priority 1: Direct name property
	if (user.name) {
		return user.name;
	}

	// Priority 2: Name from attributes
	if (user.attributes && user.attributes.name) {
		return user.attributes.name;
	}

	// Priority 3: Name from fetched attributes
	if (user.fetchedAttributes && user.fetchedAttributes.name) {
		return user.fetchedAttributes.name;
	}

	// Priority 4: Username as fallback
	if (user.username) {
		return user.username;
	}

	return null;
};

/**
 * Gets the user's sub (provider user ID) from various user object structures
 *
 * @param {Object} user - The user object
 * @returns {string|null} - The user's sub or null if not found
 */
export const getUserSub = (user) => {
	if (!user) {
		return null;
	}

	// Priority 1: Direct sub property (for restored users)
	if (user.sub) {
		return user.sub;
	}

	// Priority 2: Sub from attributes
	if (user.attributes && user.attributes.sub) {
		return user.attributes.sub;
	}

	return null;
};
