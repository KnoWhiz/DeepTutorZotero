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
const PopupClosePath = "chrome://zotero/content/DeepTutorMaterials/Subscription/POPUP_CLOSE.svg";
const SubscriptionConfirmBookPath = 'chrome://zotero/content/DeepTutorMaterials/Subscription/SUB_SUCCESS.svg';
const SubscriptionManageMarkPath = 'chrome://zotero/content/DeepTutorMaterials/Subscription/SUB_MANAGEMENT.svg';

/**
 * DeepTutorSubscription component handles subscription-related functionality
 * including upgrade options, subscription management, and confirmation flows.
 */
class DeepTutorSubscription extends React.Component {
	static propTypes = {
		onUpgradeSuccess: PropTypes.func,
		onManageSubscription: PropTypes.func,
		onCancel: PropTypes.func,
		userId: PropTypes.string,
		userSubscribed: PropTypes.bool,
		isFreeTrial: PropTypes.bool
	};

	static defaultProps = {
		onUpgradeSuccess: () => {},
		onManageSubscription: () => {},
		onCancel: () => {},
		userId: null,
		userSubscribed: false,
		isFreeTrial: true
	};

	constructor(props) {
		super(props);
		this.state = {
			isLoading: false,
			error: null,
			selectedPlan: null
		};
	}

	/**
     * Handles the upgrade process for the selected plan
     * @param {string} planId - The ID of the selected plan
     */
	handleUpgrade = async (planId) => {
		try {
			this.setState({ isLoading: true, error: null });
            
			// TODO: Implement actual subscription upgrade logic
			// This would typically involve calling an API endpoint
            
			// For now, just simulate a successful upgrade
			await new Promise(resolve => setTimeout(resolve, 1000));
            
			this.props.onUpgradeSuccess();
		}
		catch (error) {
			this.setState({
				error: error.message || "Failed to process upgrade request"
			});
		}
		finally {
			this.setState({ isLoading: false });
		}
	};

	/**
     * Renders the subscription plans available for upgrade
     * @returns {JSX.Element} The subscription plans UI
     */
	renderSubscriptionPlans() {
		const plans = [
			{
				id: "basic",
				name: "Basic Plan",
				price: "$9.99",
				features: [
					"Basic AI assistance",
					"Limited document processing",
					"Standard support"
				]
			},
			{
				id: "premium",
				name: "Premium Plan",
				price: "$19.99",
				features: [
					"Advanced AI assistance",
					"Unlimited document processing",
					"Priority support",
					"Custom model training"
				]
			}
		];

		return (
			<div style={styles.plansContainer}>
				{plans.map(plan => (
					<div
						key={plan.id}
						style={styles.planCard}
						onClick={() => this.handleUpgrade(plan.id)}
					>
						<h3 style={styles.planName}>{plan.name}</h3>
						<div style={styles.planPrice}>{plan.price}/month</div>
						<ul style={styles.featureList}>
							{plan.features.map((feature, index) => (
								<li key={index} style={styles.featureItem}>
									{feature}
								</li>
							))}
						</ul>
						<button style={styles.upgradeButton}>
                            Upgrade Now
						</button>
					</div>
				))}
			</div>
		);
	}

	render() {
		const { isLoading, error } = this.state;

		return (
			<div style={styles.container}>
				<h2 style={styles.title}>Choose Your Plan</h2>
				{error && (
					<div style={styles.error}>
						{error}
					</div>
				)}
				{isLoading
					? (
						<div style={styles.loading}>
                        Processing...
						</div>
					)
					: (
						this.renderSubscriptionPlans()
					)}
				{/* Upgrade Premium Popup */}
				{this.state.showUpgradePopup && (
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
						onClick={this.toggleSubscriptionPopup}
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
							{/* Upgrade Premium Popup header */}
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
									Upgrade Your Plan
								</div>
								<button
									onClick={this.toggleSubscriptionPopup}
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
							<DeepTutorUpgradePremium onUpgradeSuccess={() => {
								Zotero.launchURL('https://staging.deeptutor.knowhiz.us/dzSubscription');
								this.setState({ showUpgradePopup: false, showSubscriptionConfirmPopup: true });
							}} />
						</div>
					</div>
				)}

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
						onClick={this.toggleSubscriptionConfirmPopup}
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
									onClick={this.toggleSubscriptionConfirmPopup}
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
								onClose={() => this.setState({ showSubscriptionConfirmPopup: false, showManageSubscriptionPopup: true })}
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
						onClick={this.toggleManageSubscriptionPopup}
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
									onClick={this.toggleManageSubscriptionPopup}
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
								onManage={() => this.setState({ showManageSubscriptionPopup: false })}
								onCancel={() => this.setState({ showManageSubscriptionPopup: false })}
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
		margin: "0 auto"
	},
	title: {
		fontSize: "1.5rem",
		fontWeight: 600,
		marginBottom: "2rem",
		textAlign: "center",
		color: "#0687E5"
	},
	plansContainer: {
		display: "flex",
		gap: "2rem",
		justifyContent: "center",
		flexWrap: "wrap"
	},
	planCard: {
		background: "#FFFFFF",
		borderRadius: "0.625rem",
		padding: "1.5rem",
		width: "280px",
		boxShadow: "0 0.125rem 0.5rem rgba(0,0,0,0.1)",
		cursor: "pointer",
		transition: "transform 0.2s ease",
		":hover": {
			transform: "translateY(-0.25rem)"
		}
	},
	planName: {
		fontSize: "1.25rem",
		fontWeight: 600,
		marginBottom: "0.5rem",
		color: "#0687E5"
	},
	planPrice: {
		fontSize: "1.5rem",
		fontWeight: 700,
		marginBottom: "1rem",
		color: "#2C3E50"
	},
	featureList: {
		listStyle: "none",
		padding: 0,
		margin: "0 0 1.5rem 0"
	},
	featureItem: {
		padding: "0.5rem 0",
		color: "#4A5568",
		display: "flex",
		alignItems: "center",
		gap: "0.5rem"
	},
	upgradeButton: {
		width: "100%",
		padding: "0.75rem",
		background: "#0687E5",
		color: "#FFFFFF",
		border: "none",
		borderRadius: "0.375rem",
		fontWeight: 600,
		cursor: "pointer",
		transition: "background-color 0.2s ease",
		":hover": {
			background: "#0570C9"
		}
	},
	error: {
		background: "#FEE2E2",
		color: "#DC2626",
		padding: "1rem",
		borderRadius: "0.375rem",
		marginBottom: "1rem",
		textAlign: "center"
	},
	loading: {
		textAlign: "center",
		padding: "2rem",
		color: "#4A5568"
	}
};

module.exports = DeepTutorSubscription;
