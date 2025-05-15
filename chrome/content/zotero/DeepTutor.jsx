/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2019 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
					http://zotero.org
	
	This file is part of Zotero.
	
	Zotero is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	Zotero is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
	
	***** END LICENSE BLOCK *****
*/

import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import ModelSelection from './ModelSelection.js';
import SessionHistory from './SessionHistory.js';
import DeepTutorChatBox from './DeepTutorChatBox.js';

// Enums
const SessionStatus = {
	CREATED: 'CREATED',
	READY: 'READY',
	PROCESSING_ERROR: 'PROCESSING_ERROR',
	FINAL_PROCESSING_ERROR: 'FINAL_PROCESSING_ERROR',
	PROCESSING: 'PROCESSING',
	DELETED: 'DELETED'
};

const SessionType = {
	LITE: 'LITE',
	BASIC: 'BASIC',
	ADVANCED: 'ADVANCED'
};

const ContentType = {
	THINK: 'THINK',
	TEXT: 'TEXT',
	IMAGE: 'IMAGE',
	AUDIO: 'AUDIO'
};

const MessageStatus = {
	UNVIEW: 'UNVIEW',
	DELETED: 'DELETED',
	VIEWED: 'VIEWED',
	PROCESSING_ERROR: 'PROCESSING_ERROR'
};

const MessageRole = {
	TUTOR: 'TUTOR',
	USER: 'USER'
};

// Utility Classes
class SessionStatusEvent {
	constructor(effectiveTime, status) {
		this.effectiveTime = effectiveTime;
		this.status = status;
	}
}

class PresignedUrl {
	constructor(preSignedUrl, preSignedReadUrl) {
		this.preSignedUrl = preSignedUrl;
		this.preSignedReadUrl = preSignedReadUrl;
	}
}

class FileDocumentMap {
	constructor() {
		this._map = new Map(); // Maps file name to document ID
		this._reverseMap = new Map(); // Maps document ID to file name
		this._fileIdMap = new Map(); // Maps document ID to original file ID
		this._preSignedUrlDataMap = new Map(); // Maps document ID to preSignedUrlData
	}

	addMapping(fileName, documentId, fileId, preSignedUrlData) {
		this._map.set(fileName, documentId);
		this._reverseMap.set(documentId, fileName);
		this._fileIdMap.set(documentId, fileId);
		if (preSignedUrlData) {
			this._preSignedUrlDataMap.set(documentId, preSignedUrlData);
		}
	}

	getDocumentId(fileName) {
		return this._map.get(fileName);
	}

	getFileName(documentId) {
		return this._reverseMap.get(documentId);
	}

	getFileId(documentId) {
		return this._fileIdMap.get(documentId);
	}

	getAllDocumentIds() {
		return Array.from(this._map.values());
	}

	getAllFileNames() {
		return Array.from(this._map.keys());
	}

	hasFile(fileName) {
		return this._map.has(fileName);
	}

	hasDocument(documentId) {
		return this._reverseMap.has(documentId);
	}

	removeMapping(fileName) {
		const documentId = this._map.get(fileName);
		if (documentId) {
			this._map.delete(fileName);
			this._reverseMap.delete(documentId);
			this._fileIdMap.delete(documentId);
		}
	}

	clear() {
		this._map.clear();
		this._reverseMap.clear();
		this._fileIdMap.clear();
	}

	toJSON() {
		return {
			fileToDocument: Object.fromEntries(this._map),
			documentToFile: Object.fromEntries(this._reverseMap),
			documentToFileId: Object.fromEntries(this._fileIdMap),
			documentToPreSignedUrlData: Object.fromEntries(this._preSignedUrlDataMap)
		};
	}
}

class Message {
	constructor({
		id = null,
		parentMessageId = null,
		userId = null,
		sessionId = null,
		subMessages = [],
		followUpQuestions = [],
		creationTime = new Date().toISOString(),
		lastUpdatedTime = new Date().toISOString(),
		status = MessageStatus.UNVIEW,
		role = MessageRole.USER
	} = {}) {
		this.id = null;  // Always set id to null
		this.parentMessageId = parentMessageId;
		this.userId = userId;
		this.sessionId = sessionId;
		this.subMessages = subMessages;
		this.followUpQuestions = followUpQuestions;
		this.creationTime = creationTime;
		this.lastUpdatedTime = lastUpdatedTime;
		this.status = status;
		this.role = role;
	}
}

class SubMessage {
	constructor({
		text = null,
		image = null,
		audio = null,
		contentType = ContentType.TEXT,
		creationTime = new Date().toISOString(),
		sources = []
	} = {}) {
		this.text = text;
		this.image = image;
		this.audio = audio;
		this.contentType = contentType;
		this.creationTime = creationTime;
		this.sources = sources;
	}
}

class MessageSource {
	constructor({
		index = 0,
		page = 0,
		referenceString = ""
	} = {}) {
		this.index = index;
		this.page = page;
		this.referenceString = referenceString;
	}
}

class Conversation {
	constructor({
		userId = null,
		sessionId = null,
		ragSessionId = null,
		storagePaths = [],
		history = [],
		message = null,
		streaming = false,
		type = SessionType.BASIC
	} = {}) {
		this.userId = userId;
		this.sessionId = sessionId;
		this.ragSessionId = ragSessionId;
		this.storagePaths = storagePaths;
		this.history = history;
		this.message = message;
		this.streaming = streaming;
		this.type = type;
	}
}

class DeepTutorSession {
	constructor({
		id = null,
		userId = 1234,
		sessionName = new Date().toISOString(),
		creationTime = new Date().toISOString(),
		lastUpdatedTime = new Date().toISOString(),
		type = SessionType.BASIC,
		status = SessionStatus.CREATED,
		statusTimeline = [],
		documentIds = [],
		generateHash = null
	} = {}) {
		this.id = id;
		this.userId = userId;
		this.sessionName = sessionName;
		this.creationTime = creationTime;
		this.lastUpdatedTime = lastUpdatedTime;
		this.type = type;
		this.status = status;
		this.statusTimeline = statusTimeline;
		this.documentIds = documentIds;
		this.generateHash = generateHash;
	}

	update() {
		this.lastUpdatedTime = new Date().toISOString();
	}

	toJSON() {
		return {
			id: this.id,
			userId: this.userId,
			sessionName: this.sessionName,
			creationTime: this.creationTime,
			lastUpdatedTime: this.lastUpdatedTime,
			type: this.type,
			status: this.status,
			statusTimeline: this.statusTimeline,
			documentIds: this.documentIds,
			generateHash: this.generateHash
		};
	}
}

class DeepTutorMessage {
	constructor({ 
		id = null, 
		parentMessageId = null, 
		userId = null, 
		sessionId = null, 
		subMessages = [], 
		followUpQuestions = [], 
		creationTime = new Date().toISOString(), 
		lastUpdatedTime = new Date().toISOString(), 
		status = 'active', 
		role = 'user' 
	} = {}) {
		this.id = id;
		this.parentMessageId = parentMessageId;
		this.userId = userId;
		this.sessionId = sessionId;
		this.subMessages = subMessages;
		this.followUpQuestions = followUpQuestions;
		this.creationTime = creationTime;
		this.lastUpdatedTime = lastUpdatedTime;
		this.status = status;
		this.role = role;
	}
}

const logoPath = 'chrome://zotero/content/DeepTutorMaterials/DPTLogo.png';

const styles = {
	container: {
		display: 'flex',
		flexDirection: 'column',
		height: '100%',
		width: '100%',
		background: '#f8f9fa',
		fontFamily: 'Roboto, Inter, Arial, sans-serif',
	},
	top: {
		display: 'flex',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: '6px 8px 3px 8px',
		minHeight: '64px',
		background: '#fff',
		borderBottom: '1px solid #e9ecef',
	},
	logo: {
		height: '32px',
		width: 'auto',
		display: 'block',
	},
	topRight: {
		display: 'flex',
		flexDirection: 'row',
		gap: '12px',
	},
	fillerBox: {
		width: '40px',
		height: '20px',
		background: '#0687E5',
		borderRadius: '6px',
	},
	middle: {
		flex: 1,
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
		position: 'relative',
		background: '#f8f9fa',
		minHeight: 0,
		width: '100%',
	},
	paneList: {
		width: '100%',
		height: '100%',
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
		position: 'relative',
		padding: '0 16px',
	},
	bottom: {
		display: 'flex',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: '18px 32px 24px 32px',
		background: '#fff',
		borderTop: '1px solid #e9ecef',
	},
	bottomLeft: {
		display: 'flex',
		flexDirection: 'column',
		gap: '8px',
	},
	textButton: {
		background: 'none',
		border: 'none',
		color: '#0687E5',
		fontWeight: 500,
		fontSize: '1em',
		fontFamily: 'Roboto, Inter, Arial, sans-serif',
		cursor: 'pointer',
		padding: 0,
		margin: 0,
		borderBottom: '2px solid #0687E5',
		width: 'fit-content',
		textAlign: 'left',
	},
	upgradeButton: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		height: '33px',
		minWidth: '33px',
		padding: '0 18px',
		background: '#0687E5',
		border: 'none',
		borderRadius: '8px',
		fontWeight: 600,
		fontSize: '1em',
		color: '#ffffff',
		cursor: 'pointer',
		boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
		transition: 'background 0.2s',
		fontFamily: 'Roboto, Inter, Arial, sans-serif',
	},
};

var DeepTutor = class DeepTutor extends React.Component {
	/**
	 * Initialize the DeepTutor React component in the given DOM element.
	 * @param {Element} domEl - The DOM element to render into
	 * @param {Object} opts - Options to pass as props
	 * @returns {Promise<DeepTutor>}
	 */
	static async init(domEl, opts={}) {
		Zotero.debug("DPTDPTDEBUG!! DeepTutor.init called with options:", opts);
		var ref;
		opts.domEl = domEl;
		await new Promise((resolve) => {
			Zotero.debug("DPTDPTDEBUG!! Creating React root for DeepTutor");
			ReactDOM.createRoot(domEl).render(<DeepTutor ref={(c) => {
				ref = c;
				Zotero.debug("DPTDPTDEBUG!! DeepTutor component mounted");
				resolve();
			}} {...opts} />);
		});
		Zotero.debug("DPTDPTDEBUG!! DeepTutor initialization complete");
		return ref;
	}
	
	static defaultProps = {
		onSelectionChange: () => {},
		onContextMenu: () => {},
		onActivate: () => {},
		emptyMessage: "No messages",
		onNewSession: () => {},
		onSendMessage: () => {},
		onSwitchComponent: () => {}
	};

	static propTypes = {
		onSelectionChange: PropTypes.func,
		onContextMenu: PropTypes.func,
		onActivate: PropTypes.func,
		emptyMessage: PropTypes.string,
		onNewSession: PropTypes.func,
		onSendMessage: PropTypes.func,
		onSwitchComponent: PropTypes.func
	};
	
	constructor(props) {
		super(props);
		this.state = {
			currentPane: 'main',
			sessions: [],
			sesNamToObj: new Map(), // Map to store session name to session object mapping
			isLoading: false,
			error: null
		};
		this._initialized = false;
		this._selection = null;
		this._messages = [];
		this._currentSession = null;
		this._loadingPromise = new Promise(resolve => {
			this._loadingPromiseResolve = resolve;
		});
	}

	componentDidMount() {
		this._initialized = true;
		this._loadingPromiseResolve();
		Zotero.debug("DeepTutor: Component mounted");
		// Load sessions when component mounts
		this.loadSession();
	}

	waitForLoad() {
		return this._loadingPromise;
	}

	async setMessages(messages) {
		this._messages = messages;
		this.forceUpdate();
	}

	async setCurrentSession(session) {
		this._currentSession = session;
		this.forceUpdate();
	}

	handleNewSession = () => {
		this.props.onNewSession();
	}

	handleSendMessage = () => {
		this.props.onSendMessage();
	}

	handleSwitchComponent = (componentId) => {
		this.props.onSwitchComponent(componentId);
	}

	// Placeholder for pane switching logic
	switchPane = (pane) => {
		this.setState({ currentPane: pane });
	};

	async loadSession() {
		try {
			this.setState({ isLoading: true, error: null });
			Zotero.debug("DeepTutor: Loading sessions...");

			// Fetch user data using Zotero.HTTP.request
			const userResponse = await Zotero.HTTP.request(
				'GET',
				'https://api.staging.deeptutor.knowhiz.us/api/users/byUserId/67f5b836cb8bb15b67a1149e',
				{
					headers: {
						'Content-Type': 'application/json'
					}
				}
			);
			
			if (userResponse.status !== 200) {
				Zotero.debug(`DeepTutorPane: Failed to fetch user data. Status: ${userResponse.status}, StatusText: ${userResponse.statusText}`);
				throw new Error(`Failed to fetch user: ${userResponse.status} ${userResponse.statusText}`);
			}
			
			const userData = JSON.parse(userResponse.responseText);

			// Fetch sessions using Zotero.HTTP.request
			const response = await Zotero.HTTP.request(
				'GET',
				`https://api.staging.deeptutor.knowhiz.us/api/session/byUser/${userData.id}`,
				{
					headers: {
						'Content-Type': 'application/json'
					}
				}
			);

			if (response.status !== 200) {
				throw new Error(`Failed to fetch sessions: ${response.status}`);
			}

			const sessionsData = JSON.parse(response.responseText);
			Zotero.debug(`DeepTutor: Fetched ${sessionsData.length} sessions`);

			// Convert API data to DeepTutorSession objects
			const sessions = sessionsData.map(sessionData => new DeepTutorSession(sessionData));

			// Update session name to object mapping
			const sesNamToObj = new Map();
			sessions.forEach(session => {
				sesNamToObj.set(session.sessionName, session);
			});

			// Update state with new sessions
			this.setState({ 
				sessions,
				sesNamToObj,
				isLoading: false
			});

			// If no sessions, switch to model selection pane
			if (sessions.length === 0) {
				this.switchPane('modelSelection');
			} else {
				// If sessions exist, switch to main pane
				this.switchPane('main');
			}

			Zotero.debug(`DeepTutor: Successfully loaded ${sessions.length} sessions`);
		} catch (error) {
			Zotero.debug(`DeepTutor: Error loading sessions: ${error.message}`);
			this.setState({ 
				error: error.message,
				isLoading: false
			});
		}
	}

	handleSessionSelect = async (sessionName) => {
		try {
			const session = this.state.sesNamToObj.get(sessionName);
			if (!session) {
				Zotero.debug(`DeepTutor: No session object found for: ${sessionName}`);
				return;
			}

			Zotero.debug(`DeepTutor: Fetching messages for session: ${sessionName}`);
			try {
				const response = await Zotero.HTTP.request(
					'GET',
					`https://api.staging.deeptutor.knowhiz.us/api/message/bySession/${session.id}`,
					{
						headers: {
							'Content-Type': 'application/json'
						}
					}
				);

				if (response.status !== 200) {
					throw new Error(`Failed to fetch messages: ${response.status} ${response.statusText}`);
				}

				const messages = JSON.parse(response.responseText);
				Zotero.debug(`DeepTutor: Successfully fetched ${messages.length} messages`);
				Zotero.debug(`DeepTutor: Messages content: ${JSON.stringify(messages)}`);

				// Update state with current session and messages
				this.setState({
					currentSession: session,
					messages: messages,
					documentIds: session.documentIds || []
				});

				// Switch to main pane
				this.switchPane('main');

				// Update DeepTutorChatBox through props
				if (session.id) {
					// Update session ID through props
					if (this.props.onSessionIdUpdate) {
						this.props.onSessionIdUpdate(session.id);
						Zotero.debug(`DeepTutor: Updated session ID to ${session.id}`);
					}

					// Update user ID through props
					if (session.userId && this.props.onUserIdUpdate) {
						this.props.onUserIdUpdate(session.userId);
						Zotero.debug(`DeepTutor: Updated user ID to ${session.userId}`);
					}
				}

				Zotero.debug(`DeepTutor: Messages loaded successfully`);

			} catch (error) {
				Zotero.debug(`DeepTutor: Error in fetching messages: ${error.message}`);
			}
		} catch (error) {
			Zotero.debug(`DeepTutor: Error in handleSessionSelect: ${error.message}`);
		}
	}

	render() {
		Zotero.debug("DeepTutor: Render called");
		
		return (
			<div style={styles.container}>
				{/* Top Section */}
				<div style={styles.top}>
					<img src={logoPath} alt="DeepTutor Logo" style={styles.logo} />
					<div style={styles.topRight}>
						<div style={styles.fillerBox}></div>
						<div style={styles.fillerBox}></div>
					</div>
				</div>

				{/* Temporary Component Button List */}
				<div style={{ 
					display: 'flex', 
					flexDirection: 'row', 
					justifyContent: 'flex-start', 
					gap: 12, 
					padding: '8px 16px', 
					background: '#f8f9fa', 
					borderBottom: '1px solid #e9ecef',
					overflowX: 'auto',
					overflowY: 'hidden',
					whiteSpace: 'nowrap',
					scrollbarWidth: 'thin',
					scrollbarColor: '#0687E5 #f8f9fa',
					'&::-webkit-scrollbar': {
						height: '6px',
					},
					'&::-webkit-scrollbar-track': {
						background: '#f8f9fa',
					},
					'&::-webkit-scrollbar-thumb': {
						background: '#0687E5',
						borderRadius: '3px',
					}
				}}>
					<button
						style={{ 
							padding: '6px 18px', 
							borderRadius: 6, 
							border: '1px solid #0687E5', 
							background: this.state.currentPane === 'main' ? '#0687E5' : '#fff', 
							color: this.state.currentPane === 'main' ? '#fff' : '#0687E5', 
							fontWeight: 600, 
							cursor: 'pointer', 
							fontFamily: 'Roboto, Inter, Arial, sans-serif',
							flexShrink: 0
						}}
						onClick={() => this.switchPane('main')}
					>
						Main
					</button>
					<button
						style={{ 
							padding: '6px 18px', 
							borderRadius: 6, 
							border: '1px solid #0687E5', 
							background: this.state.currentPane === 'modelSelection' ? '#0687E5' : '#fff', 
							color: this.state.currentPane === 'modelSelection' ? '#fff' : '#0687E5', 
							fontWeight: 600, 
							cursor: 'pointer', 
							fontFamily: 'Roboto, Inter, Arial, sans-serif',
							flexShrink: 0
						}}
						onClick={() => this.switchPane('modelSelection')}
					>
						Model Selection
					</button>
					<button
						style={{ 
							padding: '6px 18px', 
							borderRadius: 6, 
							border: '1px solid #0687E5', 
							background: this.state.currentPane === 'sessionHistory' ? '#0687E5' : '#fff', 
							color: this.state.currentPane === 'sessionHistory' ? '#fff' : '#0687E5', 
							fontWeight: 600, 
							cursor: 'pointer', 
							fontFamily: 'Roboto, Inter, Arial, sans-serif',
							flexShrink: 0
						}}
						onClick={() => this.switchPane('sessionHistory')}
					>
						Session History
					</button>
					<button
						style={{ 
							padding: '6px 18px', 
							borderRadius: 6, 
							border: '1px solid #0687E5', 
							background: this.state.currentPane === 'other' ? '#0687E5' : '#fff', 
							color: this.state.currentPane === 'other' ? '#fff' : '#0687E5', 
							fontWeight: 600, 
							cursor: 'pointer', 
							fontFamily: 'Roboto, Inter, Arial, sans-serif',
							flexShrink: 0
						}}
						onClick={() => this.switchPane('other')}
					>
						Other
					</button>
				</div>

				{/* Middle Section: Pane List Holder */}
				<div style={styles.middle}>
					<div style={styles.paneList}>
						{this.state.currentPane === 'main' && <DeepTutorChatBox 
							ref={ref => this._tutorBox = ref}
							onSessionIdUpdate={(sessionId) => {
								Zotero.debug(`DeepTutor: Session ID updated to ${sessionId}`);
							}}
							onUserIdUpdate={(userId) => {
								Zotero.debug(`DeepTutor: User ID updated to ${userId}`);
							}}
							messages={this.state.messages}
							documentIds={this.state.documentIds}
							currentSession={this.state.currentSession}
						/>}
						{this.state.currentPane === 'modelSelection' && <ModelSelection />}
						{this.state.currentPane === 'sessionHistory' && 
							<SessionHistory 
								sessions={this.state.sessions} 
								onSessionSelect={this.handleSessionSelect}
								isLoading={this.state.isLoading}
								error={this.state.error}
							/>
						}
						{this.state.currentPane === 'other' && <div>Other Pane Placeholder</div>}
					</div>
				</div>

				{/* Bottom Section: Utility Buttons */}
				<div style={styles.bottom}>
					<div style={styles.bottomLeft}>
						<button style={styles.textButton}>Feedback</button>
						<button style={styles.textButton}>Profile</button>
					</div>
					<button style={styles.upgradeButton}>Upgrade</button>
				</div>
			</div>
		);
	}
}

// Add event dispatcher functionality
Zotero.Utilities.Internal.makeClassEventDispatcher(DeepTutor);

// Export the component
module.exports = DeepTutor;
