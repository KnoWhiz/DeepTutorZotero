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

const React = require('react');
const ReactDOM = require('react-dom');
const PropTypes = require('prop-types');

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

	render() {
		Zotero.debug("DPTDPTDEBUG!! DeepTutor render called");
		
		const styles = {
			container: {
				display: 'flex',
				flexDirection: 'column',
				height: '100%',
				width: '100%',
				backgroundColor: '#ffffff'
			},
			header: {
				padding: '10px',
				borderBottom: '1px solid #ccc',
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center'
			},
			content: {
				flex: 1,
				overflow: 'auto',
				padding: '10px'
			},
			messageList: {
				display: 'flex',
				flexDirection: 'column',
				gap: '10px'
			},
			message: {
				padding: '10px',
				borderRadius: '5px',
				backgroundColor: '#f0f0f0'
			},
			button: {
				padding: '5px 10px',
				margin: '0 5px',
				border: '1px solid #ccc',
				borderRadius: '3px',
				backgroundColor: '#f8f8f8',
				cursor: 'pointer'
			},
			input: {
				width: '100%',
				padding: '5px',
				margin: '5px 0',
				border: '1px solid #ccc',
				borderRadius: '3px'
			}
		};

		return (
			<div style={styles.container}>
				<div style={styles.header}>
					<button style={styles.button} onClick={this.handleNewSession}>
						New Session
					</button>
					<div>
						<button style={styles.button} onClick={() => this.handleSwitchComponent('chat')}>
							Chat
						</button>
						<button style={styles.button} onClick={() => this.handleSwitchComponent('history')}>
							History
						</button>
					</div>
				</div>
				<div style={styles.content}>
					{this._messages.length === 0 ? (
						<div>{this.props.emptyMessage}</div>
					) : (
						<div style={styles.messageList}>
							{this._messages.map((message, index) => (
								<div key={index} style={styles.message}>
									{message.text}
								</div>
							))}
						</div>
					)}
					<input 
						type="text" 
						style={styles.input}
						placeholder="Type your message..."
					/>
					<button style={styles.button} onClick={this.handleSendMessage}>
						Send
					</button>
				</div>
			</div>
		);
	}
}

// Add event dispatcher functionality
Zotero.Utilities.Internal.makeClassEventDispatcher(DeepTutor);

// Export the component
module.exports = DeepTutor;
