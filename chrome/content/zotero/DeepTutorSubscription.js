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

import React from "react";
import PropTypes from "prop-types";
import DeepTutorUpgradePremium from "./DeepTutorUpgradePremium.js";
import DeepTutorSubscriptionConfirm from "./DeepTutorSubscriptionConfirm.js";
import DeepTutorManageSubscription from "./DeepTutorManageSubscription.js";
import DeepTutorFreeTrial from "./DeepTutorFreeTrial.js";

const PopupClosePath = "chrome://zotero/content/DeepTutorMaterials/Subscription/POPUP_CLOSE.svg";
const SubscriptionConfirmBookPath = 'chrome://zotero/content/DeepTutorMaterials/Subscription/SUB_SUCCESS.svg';
const SubscriptionManageMarkPath = 'chrome://zotero/content/DeepTutorMaterials/Subscription/SUB_MANAGEMENT.svg';

/**
 * DeepTutorSubscription component handles subscription-related functionality
 * with conditional display based on user subscription status and free trial status.
 */
class DeepTutorSubscription extends React.Component {
	static propTypes = {
		onUpgradeSuccess: PropTypes.func,
		onManageSubscription: PropTypes.func,
		onCancel: PropTypes.func,
		userId: PropTypes.string,
		userSubscribed: PropTypes.bool,
		isFreeTrial: PropTypes.bool,
		toggleSubscriptionPopup: PropTypes.func
	};

	static defaultProps = {
		onUpgradeSuccess: () => {},
		onManageSubscription: () => {},
		onCancel: () => {},
		userId: null,
		userSubscribed: false,
		isFreeTrial: true,
		toggleSubscriptionPopup: () => {}
	};

	constructor(props) {
		super(props);
		this.state = {
			showSubscriptionConfirmPopup: false,
			showManageSubscriptionPopup: false
		};
	}

	/**
	 * Handles upgrade success and shows confirmation popup
	 */
	handleUpgradeSuccess = () => {
		Zotero.launchURL('https://staging.deeptutor.knowhiz.us/dzSubscription');
		this.setState({ showSubscriptionConfirmPopup: true });
	};

	/**
	 * Handles subscription confirmation close and shows management popup
	 */
	handleSubscriptionConfirmClose = () => {
		this.setState({
			showSubscriptionConfirmPopup: false,
			showManageSubscriptionPopup: true
		});
	};

	/**
	 * Handles manage subscription action
	 */
	handleManageSubscription = () => {
		this.setState({ showManageSubscriptionPopup: false });
		this.props.onManageSubscription();
		this.props.toggleSubscriptionPopup();
	};

	/**
	 * Handles cancel action
	 */
	handleCancel = () => {
		this.props.toggleSubscriptionPopup();
	};

	/**
	 * Renders the appropriate panel based on subscription status
	 * @returns {JSX.Element} The appropriate subscription panel
	 */
	renderSubscriptionPanel() {
		const { userSubscribed, isFreeTrial } = this.props;

		if (userSubscribed) {
			// User is subscribed - show management panel
			return (
				<DeepTutorManageSubscription
					imagePath={SubscriptionManageMarkPath}
					onManage={this.handleManageSubscription}
					onCancel={this.handleCancel}
				/>
			);
		}
		else if (isFreeTrial) {
			// User is not subscribed but has free trial - show free trial panel
			return (
				<DeepTutorFreeTrial
					onUpgradeSuccess={this.handleUpgradeSuccess}
				/>
			);
		}
		else {
			// User is not subscribed and no free trial - show upgrade premium panel
			return (
				<DeepTutorUpgradePremium
					onUpgradeSuccess={this.handleUpgradeSuccess}
				/>
			);
		}
	}

	render() {
		return (
			<div style={styles.container}>
				{/* Main Subscription Panel */}
				{this.renderSubscriptionPanel()}

				{/* Subscription Confirm Popup */}
				{this.state.showSubscriptionConfirmPopup && (
					<div
						style={{
							position: 'absolute',
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							backgroundColor: 'rgba(0, 0, 0, 0.5)',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							zIndex: 1000,
						}}
						onClick={this.handleSubscriptionConfirmClose}
					>
						<div
							style={{
								position: 'relative',
								width: '80%',
								maxWidth: '26.875rem',
								maxHeight: '80%',
								background: '#FFFFFF',
								borderRadius: '0.625rem',
								padding: '1.25rem',
								overflow: 'auto'
							}}
							onClick={(e) => e.stopPropagation()}
						>
							{/* Subscription Confirm Popup header */}
							<div style={{
								display: 'flex',
								width: '100%',
								alignItems: 'center',
								marginBottom: '1.875rem',
								minHeight: '1rem',
								position: 'relative',
							}}>
								<div style={{
									width: '100%',
									textAlign: 'center',
									background: 'linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)',
									WebkitBackgroundClip: 'text',
									WebkitTextFillColor: 'transparent',
									backgroundClip: 'text',
									color: '#0687E5',
									fontWeight: 700,
									fontSize: '1.5rem',
									lineHeight: '1.2',
									letterSpacing: '0%',
								}}>
									Upgrade Successfully!
								</div>
								<button
									onClick={this.handleSubscriptionConfirmClose}
									style={{
										background: 'none',
										border: 'none',
										cursor: 'pointer',
										position: 'absolute',
										right: 0,
										top: '50%',
										transform: 'translateY(-50%)',
										width: '1rem',
										height: '1rem',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
									}}
								>
									<img src={PopupClosePath} alt="Close" style={{ width: '1rem', height: '1rem' }} />
								</button>
							</div>
							<DeepTutorSubscriptionConfirm
								imagePath={SubscriptionConfirmBookPath}
								onClose={this.handleSubscriptionConfirmClose}
							/>
						</div>
					</div>
				)}

				{/* Manage Subscription Popup */}
				{this.state.showManageSubscriptionPopup && (
					<div
						style={{
							position: 'absolute',
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							backgroundColor: 'rgba(0, 0, 0, 0.5)',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							zIndex: 1000,
						}}
						onClick={this.handleCancel}
					>
						<div
							style={{
								position: 'relative',
								width: '80%',
								maxWidth: '26.875rem',
								maxHeight: '80%',
								background: '#FFFFFF',
								borderRadius: '0.625rem',
								padding: '1.25rem',
								overflow: 'auto'
							}}
							onClick={(e) => e.stopPropagation()}
						>
							{/* Manage Subscription Popup header */}
							<div style={{
								display: 'flex',
								width: '100%',
								alignItems: 'center',
								marginBottom: '1.875rem',
								minHeight: '1rem',
								position: 'relative',
							}}>
								<div style={{
									width: '100%',
									textAlign: 'center',
									background: 'linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)',
									WebkitBackgroundClip: 'text',
									WebkitTextFillColor: 'transparent',
									backgroundClip: 'text',
									color: '#0687E5',
									fontWeight: 700,
									fontSize: '1.5rem',
									lineHeight: '1.2',
									letterSpacing: '0%',
								}}>
									Manage Subscription
								</div>
								<button
									onClick={this.handleCancel}
									style={{
										background: 'none',
										border: 'none',
										cursor: 'pointer',
										position: 'absolute',
										right: 0,
										top: '50%',
										transform: 'translateY(-50%)',
										width: '1rem',
										height: '1rem',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
									}}
								>
									<img src={PopupClosePath} alt="Close" style={{ width: '1rem', height: '1rem' }} />
								</button>
							</div>
							<DeepTutorManageSubscription
								imagePath={SubscriptionManageMarkPath}
								onManage={this.handleManageSubscription}
								onCancel={this.handleCancel}
							/>
						</div>
					</div>
				)}
			</div>
		);
	}
}

const styles = {
	container: {
		padding: "1.5rem",
		maxWidth: "800px",
		margin: "0 auto",
		position: "relative"
	}
};

module.exports = DeepTutorSubscription;
