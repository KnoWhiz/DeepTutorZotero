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
	},
	paneList: {
		width: '100%',
		height: '100%',
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
		position: 'relative',
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
			currentPane: 'main', // placeholder for pane switching
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
		Zotero.debug("DPTDPTDEBUG!! DeepTutor component mounted");
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

	render() {
		Zotero.debug("DPTDPTDEBUG!! DeepTutor render called");
		
		const placeholderSessions = [
			{ id: 1, sessionName: 'Session 1', lastUpdatedTime: new Date().toISOString() },
			{ id: 2, sessionName: 'Session 2', lastUpdatedTime: new Date(Date.now() - 10000000).toISOString() },
		];

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
				<div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: 12, padding: '8px 0', background: '#f8f9fa', borderBottom: '1px solid #e9ecef' }}>
					<button
						style={{ padding: '6px 18px', borderRadius: 6, border: '1px solid #0687E5', background: this.state.currentPane === 'main' ? '#0687E5' : '#fff', color: this.state.currentPane === 'main' ? '#fff' : '#0687E5', fontWeight: 600, cursor: 'pointer', fontFamily: 'Roboto, Inter, Arial, sans-serif' }}
						onClick={() => this.switchPane('main')}
					>
						Main
					</button>
					<button
						style={{ padding: '6px 18px', borderRadius: 6, border: '1px solid #0687E5', background: this.state.currentPane === 'modelSelection' ? '#0687E5' : '#fff', color: this.state.currentPane === 'modelSelection' ? '#fff' : '#0687E5', fontWeight: 600, cursor: 'pointer', fontFamily: 'Roboto, Inter, Arial, sans-serif' }}
						onClick={() => this.switchPane('modelSelection')}
					>
						Model Selection
					</button>
					<button
						style={{ padding: '6px 18px', borderRadius: 6, border: '1px solid #0687E5', background: this.state.currentPane === 'sessionHistory' ? '#0687E5' : '#fff', color: this.state.currentPane === 'sessionHistory' ? '#fff' : '#0687E5', fontWeight: 600, cursor: 'pointer', fontFamily: 'Roboto, Inter, Arial, sans-serif' }}
						onClick={() => this.switchPane('sessionHistory')}
					>
						Session History
					</button>
					<button
						style={{ padding: '6px 18px', borderRadius: 6, border: '1px solid #0687E5', background: this.state.currentPane === 'other' ? '#0687E5' : '#fff', color: this.state.currentPane === 'other' ? '#fff' : '#0687E5', fontWeight: 600, cursor: 'pointer', fontFamily: 'Roboto, Inter, Arial, sans-serif' }}
						onClick={() => this.switchPane('other')}
					>
						Other
					</button>
				</div>

				{/* Middle Section: Pane List Holder */}
				<div style={styles.middle}>
					<div style={styles.paneList}>
						{this.state.currentPane === 'main' && <div>Main Pane Placeholder</div>}
						{this.state.currentPane === 'modelSelection' && <ModelSelection />}
						{this.state.currentPane === 'sessionHistory' && <SessionHistory sessions={placeholderSessions} onSessionSelect={() => {}} />}
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
