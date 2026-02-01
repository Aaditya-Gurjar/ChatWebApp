import { useState, useEffect } from 'react';

/**
 * InstallPrompt Component
 * Shows a banner prompting iOS users to add the app to their home screen
 * for push notification support. Only displays on iOS Safari when not already installed.
 */
const InstallPrompt = () => {
    const [showPrompt, setShowPrompt] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Check if we should show the install prompt
        const checkInstallStatus = () => {
            // Check if already dismissed this session
            const isDismissed = sessionStorage.getItem('pwa-install-dismissed');
            if (isDismissed) {
                setDismissed(true);
                return;
            }

            // Check if already installed (running as standalone PWA)
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                || window.navigator.standalone === true;

            if (isStandalone) {
                // Already running as PWA, no need to show prompt
                return;
            }

            // Detect iOS Safari
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            const isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);

            // Check iOS version (need 16.4+ for push notifications)
            const iOSVersion = parseIOSVersion();
            const supportsNotifications = iOSVersion >= 16.4;

            // Show prompt on iOS Safari for devices that support notifications
            if (isIOS && isSafari && supportsNotifications) {
                // Small delay to not interrupt initial page load
                setTimeout(() => setShowPrompt(true), 3000);
            }
        };

        checkInstallStatus();
    }, []);

    const parseIOSVersion = () => {
        const match = navigator.userAgent.match(/OS (\d+)_(\d+)/);
        if (match) {
            return parseFloat(`${match[1]}.${match[2]}`);
        }
        return 0;
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        setDismissed(true);
        sessionStorage.setItem('pwa-install-dismissed', 'true');
    };

    const handleNeverShow = () => {
        setShowPrompt(false);
        setDismissed(true);
        localStorage.setItem('pwa-install-never-show', 'true');
    };

    // Don't render if dismissed or shouldn't show
    if (!showPrompt || dismissed) {
        return null;
    }

    return (
        <div className="install-prompt-overlay">
            <div className="install-prompt">
                <button
                    className="install-prompt-close"
                    onClick={handleDismiss}
                    aria-label="Close"
                >
                    ×
                </button>

                <div className="install-prompt-content">
                    <div className="install-prompt-icon">
                        <img src="/pwa-icons/icon-96x96.png" alt="ChatApp" />
                    </div>

                    <h3 className="install-prompt-title">
                        Install ChatApp
                    </h3>

                    <p className="install-prompt-text">
                        Add to your Home Screen to receive push notifications for messages and calls!
                    </p>

                    <div className="install-prompt-steps">
                        <div className="install-step">
                            <span className="step-number">1</span>
                            <span className="step-text">
                                Tap the <ShareIcon /> Share button below
                            </span>
                        </div>
                        <div className="install-step">
                            <span className="step-number">2</span>
                            <span className="step-text">
                                Scroll and tap <strong>"Add to Home Screen"</strong>
                            </span>
                        </div>
                        <div className="install-step">
                            <span className="step-number">3</span>
                            <span className="step-text">
                                Tap <strong>"Add"</strong> in the top right
                            </span>
                        </div>
                    </div>

                    <div className="install-prompt-actions">
                        <button
                            className="install-prompt-btn-primary"
                            onClick={handleDismiss}
                        >
                            Got it!
                        </button>
                        <button
                            className="install-prompt-btn-secondary"
                            onClick={handleNeverShow}
                        >
                            Don't show again
                        </button>
                    </div>
                </div>

                {/* Arrow pointing to Safari share button */}
                <div className="install-prompt-arrow">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 21l-1.41-1.41L16.17 14H4v-2h12.17l-5.58-5.59L12 5l8 8z" transform="rotate(90 12 12)" />
                    </svg>
                </div>
            </div>

            <style>{`
                .install-prompt-overlay {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    z-index: 10000;
                    padding: 16px;
                    padding-bottom: calc(16px + env(safe-area-inset-bottom));
                    background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
                    animation: slideUp 0.3s ease-out;
                }
                
                @keyframes slideUp {
                    from {
                        transform: translateY(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
                
                .install-prompt {
                    position: relative;
                    background: #1e293b;
                    border-radius: 16px;
                    padding: 20px;
                    box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
                    border: 1px solid rgba(255,255,255,0.1);
                }
                
                .install-prompt-close {
                    position: absolute;
                    top: 12px;
                    right: 12px;
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    border: none;
                    background: rgba(255,255,255,0.1);
                    color: #94a3b8;
                    font-size: 20px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                
                .install-prompt-close:hover {
                    background: rgba(255,255,255,0.2);
                    color: white;
                }
                
                .install-prompt-content {
                    text-align: center;
                }
                
                .install-prompt-icon {
                    width: 64px;
                    height: 64px;
                    margin: 0 auto 12px;
                    border-radius: 14px;
                    overflow: hidden;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                }
                
                .install-prompt-icon img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                
                .install-prompt-title {
                    color: white;
                    font-size: 18px;
                    font-weight: 600;
                    margin: 0 0 8px;
                }
                
                .install-prompt-text {
                    color: #94a3b8;
                    font-size: 14px;
                    margin: 0 0 16px;
                    line-height: 1.4;
                }
                
                .install-prompt-steps {
                    text-align: left;
                    margin-bottom: 16px;
                }
                
                .install-step {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 8px 0;
                    color: #e2e8f0;
                    font-size: 14px;
                }
                
                .step-number {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: #3b82f6;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    font-weight: 600;
                    flex-shrink: 0;
                }
                
                .step-text {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    flex-wrap: wrap;
                }
                
                .step-text strong {
                    color: #3b82f6;
                }
                
                .install-prompt-actions {
                    display: flex;
                    gap: 12px;
                }
                
                .install-prompt-btn-primary {
                    flex: 1;
                    padding: 12px 16px;
                    border-radius: 10px;
                    border: none;
                    background: #3b82f6;
                    color: white;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .install-prompt-btn-primary:hover {
                    background: #2563eb;
                }
                
                .install-prompt-btn-secondary {
                    padding: 12px 16px;
                    border-radius: 10px;
                    border: 1px solid rgba(255,255,255,0.2);
                    background: transparent;
                    color: #94a3b8;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .install-prompt-btn-secondary:hover {
                    border-color: rgba(255,255,255,0.4);
                    color: white;
                }
                
                .install-prompt-arrow {
                    position: absolute;
                    bottom: -30px;
                    left: 50%;
                    transform: translateX(-50%);
                    color: #3b82f6;
                    animation: bounce 1s infinite;
                }
                
                @keyframes bounce {
                    0%, 100% {
                        transform: translateX(-50%) translateY(0);
                    }
                    50% {
                        transform: translateX(-50%) translateY(5px);
                    }
                }
            `}</style>
        </div>
    );
};

// iOS Share Icon component
const ShareIcon = () => (
    <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        style={{ verticalAlign: 'middle', margin: '0 2px' }}
    >
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
);

export default InstallPrompt;
