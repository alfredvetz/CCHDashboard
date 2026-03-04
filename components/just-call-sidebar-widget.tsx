"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Phone,
    MessageSquare,
    LogIn,
    CheckCircle2,
    LogOut,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import {
    initializeJustCall,
    isJustCallReady,
    getDialerIframe,
} from "@/utils/justcall";
import { StaffTBAShifts } from "./staff-tba-shifts";

interface JustCallUserInfo {
    email?: string;
    name?: string;
}

/** Login callback can receive various shapes from JustCall SDK */
interface JustCallLoginCallbackData {
    user_info?: JustCallUserInfo;
    email?: string;
    name?: string;
    data?: { user_info?: JustCallUserInfo };
}

export function JustCallSidebarWidget() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(false);
    const [userInfo, setUserInfo] = useState<JustCallUserInfo | null>(null);
    const [selectedContact, setSelectedContact] = useState<{
        contactName: string;
        contactType: string;
        contactId: number;
    } | null>(null);

    // Debug log when selectedContact changes
    useEffect(() => {
        console.log(
            "[JustCallSidebarWidget] selectedContact changed:",
            selectedContact,
        );
    }, [selectedContact]);

    const checkAuthStatus = useCallback(async () => {
        setIsCheckingAuth(true);
        try {
            const dialer = window.justCallDialerInstance;
            if (dialer && typeof dialer.isLoggedIn === "function") {
                if (typeof dialer.ready === "function") {
                    await dialer.ready();
                }
                const loggedIn = await dialer.isLoggedIn();
                // Only update state if it changed to prevent unnecessary re-renders
                setIsLoggedIn((prev) => (prev !== loggedIn ? loggedIn : prev));

                // If logged in but we don't have user info yet, try to get it from the dialer
                if (loggedIn && !userInfo) {
                    // The user info will come from the login callback, but if we're already logged in,
                    // we might need to wait for it or check if there's a way to get it from the dialer
                    console.log(
                        "[JustCall] User is logged in, waiting for login callback to get user info",
                    );
                }
            }
        } catch (error) {
            console.error("[JustCall] Error checking auth status:", error);
        } finally {
            setIsCheckingAuth(false);
        }
    }, []);

    useEffect(() => {
        // Initialize JustCall when component mounts
        const init = async () => {
            if (!isJustCallReady()) {
                const initialized = await initializeJustCall();
                setIsInitialized(initialized);
                if (initialized) {
                    checkAuthStatus();
                }
            } else {
                setIsInitialized(true);
                checkAuthStatus();
            }
        };
        init();
    }, [checkAuthStatus]);

    // Listen for login/logout via callbacks (not events - SDK doesn't have login/logout events)
    useEffect(() => {
        if (!isInitialized) return;

        // Register callbacks for login/logout
        const handleLogin = (data: unknown) => {
            console.log(
                "[JustCall] Login callback received - full data:",
                JSON.stringify(data, null, 2),
            );
            console.log("[JustCall] Data type:", typeof data);
            console.log(
                "[JustCall] Data keys:",
                data ? Object.keys(data) : "null",
            );

            setIsLoggedIn(true);

            // Handle different possible data structures
            let userData: JustCallUserInfo | null = null;

            if (data && typeof data === "object") {
                const d = data as JustCallLoginCallbackData;
                // Check for user_info property
                if (d.user_info) {
                    userData = d.user_info;
                }
                // Check if data itself is user_info
                else if (d.email || d.name) {
                    userData = { email: d.email, name: d.name };
                }
                // Check nested structures
                else if (d.data?.user_info) {
                    userData = d.data.user_info;
                }
            }

            if (userData) {
                setUserInfo(userData);
                console.log("[JustCall] Stored user info:", userData);
            } else {
                console.warn(
                    "[JustCall] Could not extract user info from login data. Full data:",
                    data,
                );
                setUserInfo(null);
            }

            // No need to close dialog - we're using popup now
            checkAuthStatus(); // Verify the status
        };

        const handleLogout = () => {
            console.log("[JustCall] Logout callback received");
            setIsLoggedIn(false);
            setUserInfo(null);
        };

        // Add callbacks to the global arrays
        const loginCallbacks = window.justCallLoginCallbacks;
        const logoutCallbacks = window.justCallLogoutCallbacks;

        if (loginCallbacks && Array.isArray(loginCallbacks)) {
            loginCallbacks.push(handleLogin);
        }
        if (logoutCallbacks && Array.isArray(logoutCallbacks)) {
            logoutCallbacks.push(handleLogout);
        }

        // Also check auth status periodically (less frequently to avoid flashing)
        const interval = setInterval(() => {
            if (isInitialized) {
                checkAuthStatus();
            }
        }, 300000); // Check every 5 minutes

        return () => {
            clearInterval(interval);
            // Remove callbacks on cleanup
            if (loginCallbacks && Array.isArray(loginCallbacks)) {
                const index = loginCallbacks.indexOf(handleLogin);
                if (index > -1) loginCallbacks.splice(index, 1);
            }
            if (logoutCallbacks && Array.isArray(logoutCallbacks)) {
                const index = logoutCallbacks.indexOf(handleLogout);
                if (index > -1) logoutCallbacks.splice(index, 1);
            }
        };
    }, [isInitialized, checkAuthStatus]);

    // Listen for contact selection events from call buttons
    useEffect(() => {
        console.log(
            "[JustCallSidebarWidget] Setting up event listener for justcall-contact-selected",
        );
        const handleContactSelected: EventListener = (event) => {
            if (!(event instanceof CustomEvent)) return;
            console.log(
                "[JustCallSidebarWidget] Event received:",
                event.detail,
            );
            const { contactName, contactType, contactId } = event.detail;
            if (contactType === "staff") {
                console.log(
                    "[JustCallSidebarWidget] Setting selected contact:",
                    { contactName, contactType, contactId },
                );
                setSelectedContact({ contactName, contactType, contactId });
            }
        };

        window.addEventListener(
            "justcall-contact-selected",
            handleContactSelected,
        );

        return () => {
            window.removeEventListener(
                "justcall-contact-selected",
                handleContactSelected,
            );
        };
    }, []);

    // Listen for JustCall popup minimize/close events and clear selected contact
    useEffect(() => {
        if (!isInitialized) return;

        const handlePopupMinimized = () => {
            console.log(
                "[JustCallSidebarWidget] Popup minimized - clearing selected contact",
            );
            setSelectedContact(null);
        };

        const handlePopupClosed = () => {
            console.log(
                "[JustCallSidebarWidget] Popup closed - clearing selected contact",
            );
            setSelectedContact(null);
        };

        window.addEventListener(
            "justcall-popup-minimized",
            handlePopupMinimized,
        );
        window.addEventListener("justcall-popup-closed", handlePopupClosed);

        return () => {
            window.removeEventListener(
                "justcall-popup-minimized",
                handlePopupMinimized,
            );
            window.removeEventListener(
                "justcall-popup-closed",
                handlePopupClosed,
            );
        };
    }, [isInitialized]);

    const handleOpenAuth = async () => {
        // Ensure JustCall is initialized first
        if (!isJustCallReady()) {
            const initialized = await initializeJustCall();
            if (!initialized) {
                console.error("[JustCall] Failed to initialize for login");
                return;
            }
        }

        const dialer = window.justCallDialerInstance;
        if (!dialer) {
            console.error("[JustCall] Dialer instance not found");
            return;
        }

        // Wait for dialer to be ready
        try {
            if (typeof dialer.ready === "function") {
                await dialer.ready();
            }
        } catch (error) {
            console.error("[JustCall] Error waiting for dialer ready:", error);
        }

        // Open dialer popup for login (same as calling/messaging)
        const dialerElementId =
            process.env.NEXT_PUBLIC_JUSTCALL_DIALER_ID ||
            "justcall-dialer-container";
        const dialerElement: HTMLElement | null =
            window.justCallDialerElement ??
            document.getElementById(dialerElementId);

        if (dialerElement) {
            // Show the dialer popup (same style as calling/messaging)
            dialerElement.style.display = "block";
            // Ensure it's not minimized
            if (dialerElement.getAttribute("data-minimized") === "true") {
                dialerElement.style.height = "610px";
                dialerElement.setAttribute("data-minimized", "false");
                const headerId = `${dialerElementId}-header`;
                const header =
                    document.getElementById(headerId) ||
                    dialerElement.querySelector('[id="' + headerId + '"]');
                const minimizeBtn = header?.querySelector("button");
                if (minimizeBtn instanceof HTMLElement) {
                    minimizeBtn.innerHTML = "−";
                }
                const iframeRestore = getDialerIframe(dialerElement);
                if (iframeRestore) {
                    iframeRestore.style.display = "block";
                }
            }

            // Navigate to dialer (will show login if not logged in, or dialer if logged in)
            const iframe = getDialerIframe(dialerElement);
            if (iframe) {
                // Check current login status immediately
                try {
                    const currentStatus =
                        typeof dialer.isLoggedIn === "function"
                            ? await dialer.isLoggedIn()
                            : false;
                    console.log(
                        "[JustCall] Current login status before opening:",
                        currentStatus,
                    );
                    setIsLoggedIn(currentStatus);
                    if (currentStatus) {
                        // If already logged in, check auth status to get user info
                        await checkAuthStatus();
                    }
                } catch (error) {
                    console.error(
                        "[JustCall] Error checking login status:",
                        error,
                    );
                }

                // Set up iframe load listener to check login status after page loads
                const handleIframeLoad = async () => {
                    console.log(
                        "[JustCall] Iframe loaded, checking login status...",
                    );
                    // Wait a bit for the page to fully load
                    setTimeout(async () => {
                        try {
                            if (typeof dialer.isLoggedIn === "function") {
                                const loggedIn = await dialer.isLoggedIn();
                                console.log(
                                    "[JustCall] Login status after iframe load:",
                                    loggedIn,
                                );
                                setIsLoggedIn(loggedIn);
                                // If logged in, check auth status to get user info
                                if (loggedIn) {
                                    await checkAuthStatus();
                                }
                            }
                        } catch (error) {
                            console.error(
                                "[JustCall] Error checking login status after iframe load:",
                                error,
                            );
                        }
                    }, 1000); // Wait 1 second for page to fully load
                };

                // Remove old listener if it exists
                iframe.removeEventListener("load", handleIframeLoad);
                // Add new load listener
                iframe.addEventListener("load", handleIframeLoad);

                // Set up periodic check while popup is visible
                const checkInterval = setInterval(async () => {
                    if (dialerElement.style.display === "none") {
                        clearInterval(checkInterval);
                        // Clear the stored interval
                        if (
                            window.justCallAuthCheckInterval === checkInterval
                        ) {
                            delete window.justCallAuthCheckInterval;
                        }
                        return;
                    }
                    try {
                        if (typeof dialer.isLoggedIn === "function") {
                            const loggedIn = await dialer.isLoggedIn();
                            // Use functional update to get current state
                            setIsLoggedIn((prevLoggedIn) => {
                                if (loggedIn !== prevLoggedIn) {
                                    console.log(
                                        "[JustCall] Login status changed:",
                                        loggedIn,
                                    );
                                    if (loggedIn) {
                                        // Check auth status to get user info
                                        checkAuthStatus();
                                    } else {
                                        setUserInfo(null);
                                    }
                                    return loggedIn;
                                }
                                return prevLoggedIn;
                            });
                        }
                    } catch (error) {
                        console.error(
                            "[JustCall] Error in periodic login check:",
                            error,
                        );
                    }
                }, 2000); // Check every 2 seconds while popup is open

                // Store interval ID so we can clear it later
                window.justCallAuthCheckInterval = checkInterval;

                // Navigate to dialer
                iframe.src = "https://app.justcall.io/dialer";
            }
            console.log("[JustCall] Dialer popup opened for login");
        } else {
            console.error("[JustCall] Dialer element not found");
        }
    };

    const handleOpenCallDialer = async () => {
        // Open dialer for calls (without a specific number)
        const dialerElementId =
            process.env.NEXT_PUBLIC_JUSTCALL_DIALER_ID ||
            "justcall-dialer-container";
        const dialerElement: HTMLElement | null =
            window.justCallDialerElement ??
            document.getElementById(dialerElementId);

        if (dialerElement) {
            dialerElement.style.display = "block";
            // Ensure it's not minimized
            if (dialerElement.getAttribute("data-minimized") === "true") {
                dialerElement.style.height = "610px";
                dialerElement.setAttribute("data-minimized", "false");
                const headerId = `${dialerElementId}-header`;
                const header =
                    document.getElementById(headerId) ||
                    dialerElement.querySelector('[id="' + headerId + '"]');
                const minimizeBtn = header?.querySelector("button");
                if (minimizeBtn instanceof HTMLElement) {
                    minimizeBtn.innerHTML = "−";
                }
                const iframeRestore = getDialerIframe(dialerElement);
                if (iframeRestore) {
                    iframeRestore.style.display = "block";
                }
            }
            // Navigate to call page (default dialer page)
            const iframe = getDialerIframe(dialerElement);
            if (iframe) {
                iframe.src = "https://app.justcall.io/dialer";
            }
        }
    };

    const handleOpenSMSDialer = async () => {
        // Open dialer for SMS (without a specific number)
        const dialerElementId =
            process.env.NEXT_PUBLIC_JUSTCALL_DIALER_ID ||
            "justcall-dialer-container";
        const dialerElement: HTMLElement | null =
            window.justCallDialerElement ??
            document.getElementById(dialerElementId);

        if (dialerElement) {
            dialerElement.style.display = "block";
            // Ensure it's not minimized
            if (dialerElement.getAttribute("data-minimized") === "true") {
                dialerElement.style.height = "610px";
                dialerElement.setAttribute("data-minimized", "false");
                const headerId = `${dialerElementId}-header`;
                const header =
                    document.getElementById(headerId) ||
                    dialerElement.querySelector('[id="' + headerId + '"]');
                const minimizeBtn = header?.querySelector("button");
                if (minimizeBtn instanceof HTMLElement) {
                    minimizeBtn.innerHTML = "−";
                }
                const iframeRestore = getDialerIframe(dialerElement);
                if (iframeRestore) {
                    iframeRestore.style.display = "block";
                }
            }
            // Navigate to SMS page using URL scheme
            const iframe = getDialerIframe(dialerElement);
            if (iframe) {
                iframe.src = "https://app.justcall.io/dialer?sms=1";
            }
        }
    };

    const handleLogoutClick = async () => {
        try {
            const dialer = window.justCallDialerInstance;
            if (dialer) {
                // Try to trigger logout through the dialer iframe
                const dialerElementId =
                    process.env.NEXT_PUBLIC_JUSTCALL_DIALER_ID ||
                    "justcall-dialer-container";
                const dialerElement: HTMLElement | null =
                    window.justCallDialerElement ??
                    document.getElementById(dialerElementId);
                const iframe = dialerElement
                    ? getDialerIframe(dialerElement)
                    : null;

                if (iframe?.contentWindow) {
                    // Try to send logout message to iframe
                    iframe.contentWindow.postMessage(
                        { type: "logout", action: "logout" },
                        "*",
                    );
                }

                // Also trigger the logout callback manually
                const logoutCallbacks = window.justCallLogoutCallbacks;
                if (logoutCallbacks && Array.isArray(logoutCallbacks)) {
                    logoutCallbacks.forEach((callback: () => void) =>
                        callback(),
                    );
                }

                setIsLoggedIn(false);
                setUserInfo(null);
                console.log("[JustCall] Logout triggered");
            }
        } catch (error) {
            console.error("[JustCall] Error during logout:", error);
            // Still update local state even if logout fails
            setIsLoggedIn(false);
            setUserInfo(null);
        }
    };

    if (!isInitialized) {
        return (
            <div className="px-2 pt-2">
                <div className="flex items-center gap-2 text-xs text-sidebar-foreground/70">
                    <Spinner className="h-3 w-3 text-royal-blue" />
                    <span>Initializing JustCall...</span>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="px-2 pb-1 space-y-2 min-w-0 w-full overflow-hidden">
                <div className="flex items-center justify-between gap-2">
                    <div className="relative h-4 w-16 shrink-0">
                        <Image
                            src="/logo/justcalllogo.svg"
                            alt="JustCall"
                            fill
                            className="object-contain object-left"
                        />
                    </div>
                    {isCheckingAuth ? (
                        <Spinner className="h-3 w-3 text-sidebar-foreground/70 shrink-0" />
                    ) : isLoggedIn ? (
                        <Badge
                            variant="outline"
                            className="shrink-0 text-xs bg-royal-blue/20 text-royal-blue border-royal-blue/50 font-medium"
                        >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Ready
                        </Badge>
                    ) : (
                        <Badge
                            variant="outline"
                            className="shrink-0 text-xs bg-white/10 text-sidebar-foreground/80 border-white/20"
                        >
                            Not Connected
                        </Badge>
                    )}
                </div>

                {isLoggedIn && userInfo && (
                    <div className="text-xs text-sidebar-foreground/80">
                        {userInfo.name && (
                            <div className="truncate" title={userInfo.name}>
                                {userInfo.name}
                            </div>
                        )}
                        {userInfo.email && (
                            <div
                                className="truncate text-[10px] text-sidebar-foreground/60"
                                title={userInfo.email}
                            >
                                {userInfo.email}
                            </div>
                        )}
                    </div>
                )}

                {!isLoggedIn ? (
                        <Button
                            onClick={handleOpenAuth}
                            variant="outline"
                            size="sm"
                            className="w-full text-xs rounded-lg border-white/20 bg-white/5 text-sidebar-foreground hover:bg-royal-blue/90 hover:border-royal-blue/50 hover:text-white transition-colors"
                        >
                        <LogIn className="h-3 w-3 mr-2" />
                        Connect JustCall
                    </Button>
                ) : (
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={handleOpenCallDialer}
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 shrink-0 rounded-lg border-white/20 bg-white/5 text-sidebar-foreground hover:bg-royal-blue/90 hover:border-royal-blue/50 hover:text-white transition-colors"
                                title="Open Call Dialer"
                            >
                                <Phone className="h-4 w-4" />
                            </Button>
                            <Button
                                onClick={handleOpenSMSDialer}
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 shrink-0 rounded-lg border-white/20 bg-white/5 text-sidebar-foreground hover:bg-royal-blue/90 hover:border-royal-blue/50 hover:text-white transition-colors"
                                title="Open SMS Dialer"
                            >
                                <MessageSquare className="h-4 w-4" />
                            </Button>
                        </div>
                        <Button
                            onClick={handleLogoutClick}
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 shrink-0 rounded-md border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            title="Logout from JustCall"
                        >
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </div>
                )}

                {/* Display TBA shifts when a staff member is selected */}
                {selectedContact && selectedContact.contactType === "staff" && (
                    <div className="mt-2 pt-2 border-t border-sidebar-border min-w-0 w-full overflow-hidden flex flex-col">
                        <StaffTBAShifts
                            staffName={selectedContact.contactName}
                            onClose={() => setSelectedContact(null)}
                        />
                    </div>
                )}
            </div>
        </>
    );
}
