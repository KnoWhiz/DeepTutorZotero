import React from 'react';
import PropTypes from 'prop-types';

const styles = {
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
    iconButton: {
        width: '40px',
        height: '40px',
        background: '#F8F6F7',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 0.2s ease',
        padding: '8px',
    },
    iconButtonActive: {
        background: '#D9D9D9',
    },
    iconImage: {
        width: '24px',
        height: '24px',
        objectFit: 'contain',
    },
    // New styles for different pane designs
    mainTop: {
        ...styles.top,
        background: 'linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)',
    },
    mainLogo: {
        ...styles.logo,
        filter: 'brightness(0) invert(1)', // Makes the logo white
    },
    mainIconButton: {
        ...styles.iconButton,
        background: 'rgba(255, 255, 255, 0.2)',
        color: '#fff',
    },
    mainIconButtonActive: {
        ...styles.iconButtonActive,
        background: 'rgba(255, 255, 255, 0.4)',
    },
    sessionHistoryTop: {
        ...styles.top,
        background: '#F8F9FA',
    },
    modelSelectionTop: {
        ...styles.top,
        background: '#FFFFFF',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    },
    welcomeTop: {
        ...styles.top,
        background: 'transparent',
        borderBottom: 'none',
    },
};

class DeepTutorTopSection extends React.Component {
    getTopSectionStyle() {
        switch (this.props.currentPane) {
            case 'main':
                return styles.mainTop;
            case 'sessionHistory':
                return styles.sessionHistoryTop;
            case 'modelSelection':
                return styles.modelSelectionTop;
            case 'welcome':
                return styles.welcomeTop;
            default:
                return styles.top;
        }
    }

    getLogoStyle() {
        return this.props.currentPane === 'main' ? styles.mainLogo : styles.logo;
    }

    getIconButtonStyle(isActive) {
        if (this.props.currentPane === 'main') {
            return {
                ...styles.mainIconButton,
                ...(isActive ? styles.mainIconButtonActive : {})
            };
        }
        return {
            ...styles.iconButton,
            ...(isActive ? styles.iconButtonActive : {})
        };
    }

    render() {
        return (
            <div style={this.getTopSectionStyle()}>
                <img src={this.props.logoPath} alt="DeepTutor Logo" style={this.getLogoStyle()} />
                <div style={styles.topRight}>
                    <button
                        style={this.getIconButtonStyle(this.props.currentPane === 'sessionHistory')}
                        onClick={() => this.props.onSwitchPane('sessionHistory')}
                    >
                        <img 
                            src={this.props.HistoryIconPath}
                            alt="History" 
                            style={styles.iconImage}
                        />
                    </button>
                    <button
                        style={this.getIconButtonStyle(this.props.currentPane === 'modelSelection')}
                        onClick={() => this.props.onSwitchPane('modelSelection')}
                    >
                        <img 
                            src={this.props.PlusIconPath}
                            alt="New Session" 
                            style={styles.iconImage}
                        />
                    </button>
                </div>
            </div>
        );
    }
}

DeepTutorTopSection.propTypes = {
    currentPane: PropTypes.string.isRequired,
    onSwitchPane: PropTypes.func.isRequired,
    logoPath: PropTypes.string.isRequired,
    HistoryIconPath: PropTypes.string.isRequired,
    PlusIconPath: PropTypes.string.isRequired
};

export default DeepTutorTopSection; 