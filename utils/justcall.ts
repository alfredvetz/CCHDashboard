/**
 * JustCall SDK Service Utility
 * Handles initialization and provides helper functions for calls and SMS
 */

// ---------------------------------------------------------------------------
// Type declarations (no external types for @justcall/justcall-dialer-sdk)
// ---------------------------------------------------------------------------

interface JustCallDialerInstance {
    ready?: () => Promise<void>;
    dialNumber?: (number: string) => void;
    isLoggedIn?: () => boolean;
    isDialerReady?: () => boolean;
    on?: (event: string, callback: () => void) => void;
    [key: string]: unknown;
}

interface JustCallDialerConfig {
    dialerId: string;
    onLogin?: (data: unknown) => void;
    onLogout?: () => void;
    onReady?: () => void;
}

declare global {
    interface Window {
        justCallDialerInstance?: JustCallDialerInstance;
        justCallDialerElement?: HTMLElement;
        justCallDialerObserver?: MutationObserver;
        justCallLoginCallbacks?: Array<(data: unknown) => void>;
        justCallLogoutCallbacks?: Array<() => void>;
        justCallMicTimeout?: ReturnType<typeof setTimeout>;
        justCallAuthCheckInterval?: ReturnType<typeof setInterval>;
    }
}

export function getDialerIframe(
    parent: Element | null,
): HTMLIFrameElement | null {
    const el = parent?.querySelector("iframe");
    return el instanceof HTMLIFrameElement ? el : null;
}

function isHTMLElement(el: EventTarget | null): el is HTMLElement {
    return el instanceof HTMLElement;
}

// Phone number formatting for JustCall API
export function formatPhoneForJustCall(
    phone: string | number | null,
): string | null {
    if (!phone) return null;

    const phoneStr = String(phone);
    // Remove all non-digit characters
    const digitsOnly = phoneStr.replace(/\D/g, "");

    // Handle numbers with country code (12 digits starting with 6104)
    if (digitsOnly.length === 12 && digitsOnly.startsWith("6104")) {
        return `+${digitsOnly}`;
    }

    // Handle numbers with country code (11 digits starting with 614)
    if (digitsOnly.length === 11 && digitsOnly.startsWith("614")) {
        return `+${digitsOnly}`;
    }

    // Handle 9-digit numbers (add leading 0 to make it 10 digits)
    if (digitsOnly.length === 9) {
        const withLeadingZero = `0${digitsOnly}`;
        if (withLeadingZero.startsWith("04")) {
            return `+61${withLeadingZero.slice(1)}`;
        }
    }

    // Handle Australian mobile numbers (10 digits starting with 04)
    if (digitsOnly.length === 10 && digitsOnly.startsWith("04")) {
        return `+61${digitsOnly.slice(1)}`;
    }

    // If already has + prefix, return as is if valid
    if (phoneStr.startsWith("+")) {
        return phoneStr;
    }

    // Return null if format is unexpected
    return null;
}

// Check if phone number is valid for JustCall
export function isValidPhoneForJustCall(
    phone: string | number | null,
): boolean {
    const formatted = formatPhoneForJustCall(phone);
    return formatted !== null && formatted.length >= 10;
}

// Initialize JustCall SDK
let initializationPromise: Promise<boolean> | null = null;

export async function initializeJustCall(): Promise<boolean> {
    try {
        // Check if JustCall is available
        if (typeof window === "undefined") {
            console.error("[JustCall] Window is undefined - running on server");
            return false;
        }

        // Check if SDK is already initialized
        if (window.justCallDialerInstance) {
            console.log("[JustCall] SDK already initialized");
            return true;
        }

        // If initialization is in progress, wait for it
        if (initializationPromise) {
            console.log(
                "[JustCall] Initialization already in progress, waiting...",
            );
            return await initializationPromise;
        }

        // Start initialization and store the promise
        initializationPromise = (async () => {
            try {
                return await performInitialization();
            } finally {
                // Clear the promise when done (success or failure)
                initializationPromise = null;
            }
        })();

        return await initializationPromise;
    } catch (error) {
        console.error("[JustCall] Initialization failed:", error);
        initializationPromise = null;
        return false;
    }
}

async function performInitialization(): Promise<boolean> {
    try {
        // Get dialer element ID from environment variable (or use default)
        const dialerElementId =
            process.env.NEXT_PUBLIC_JUSTCALL_DIALER_ID ||
            "justcall-dialer-container";

        console.log("[JustCall] Checking configuration...");
        console.log("[JustCall] Dialer element ID:", dialerElementId);

        // Ensure the dialer container element exists in the DOM
        let dialerElement = document.getElementById(dialerElementId);
        if (!dialerElement) {
            console.log("[JustCall] Creating dialer container element...");
            dialerElement = document.createElement("div");
            dialerElement.id = dialerElementId;
            // Hide the dialer by default - we'll use a custom UI component
            // The iframe is kept in the DOM for authentication and backend functionality
            dialerElement.style.position = "fixed";
            dialerElement.style.bottom = "20px";
            dialerElement.style.right = "20px";
            dialerElement.style.width = "365px"; // Regular JustCall dialer width
            dialerElement.style.height = "610px"; // Regular JustCall dialer height
            dialerElement.style.zIndex = "9999";
            dialerElement.style.display = "none"; // Hidden by default
            dialerElement.style.border = "1px solid #e5e7eb";
            dialerElement.style.borderRadius = "8px";
            dialerElement.style.boxShadow =
                "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)";
            dialerElement.style.backgroundColor = "#fff";
            dialerElement.style.overflow = "hidden";

            // Create header with minimize/maximize controls
            const header = document.createElement("div");
            header.id = `${dialerElementId}-header`;
            header.style.display = "flex";
            header.style.justifyContent = "space-between";
            header.style.alignItems = "center";
            header.style.padding = "8px 12px";
            header.style.backgroundColor = "#f9fafb";
            header.style.borderBottom = "1px solid #e5e7eb";
            header.style.cursor = "move";
            header.style.userSelect = "none";

            const title = document.createElement("img");
            title.src = "/justcalllogo.svg";
            title.alt = "JustCall";
            title.style.height = "24px";
            title.style.width = "auto";
            title.style.objectFit = "contain";

            const controls = document.createElement("div");
            controls.style.display = "flex";
            controls.style.gap = "8px";

            const minimizeBtn = document.createElement("button");
            minimizeBtn.innerHTML = "−";
            minimizeBtn.style.width = "24px";
            minimizeBtn.style.height = "24px";
            minimizeBtn.style.border = "none";
            minimizeBtn.style.backgroundColor = "transparent";
            minimizeBtn.style.cursor = "pointer";
            minimizeBtn.style.borderRadius = "4px";
            minimizeBtn.style.display = "flex";
            minimizeBtn.style.alignItems = "center";
            minimizeBtn.style.justifyContent = "center";
            minimizeBtn.style.fontSize = "18px";
            minimizeBtn.style.color = "#6b7280";
            minimizeBtn.title = "Minimize";
            minimizeBtn.onmouseover = () => {
                minimizeBtn.style.backgroundColor = "#e5e7eb";
            };
            minimizeBtn.onmouseout = () => {
                minimizeBtn.style.backgroundColor = "transparent";
            };

            const closeBtn = document.createElement("button");
            closeBtn.innerHTML = "×";
            closeBtn.style.width = "24px";
            closeBtn.style.height = "24px";
            closeBtn.style.border = "none";
            closeBtn.style.backgroundColor = "transparent";
            closeBtn.style.cursor = "pointer";
            closeBtn.style.borderRadius = "4px";
            closeBtn.style.display = "flex";
            closeBtn.style.alignItems = "center";
            closeBtn.style.justifyContent = "center";
            closeBtn.style.fontSize = "20px";
            closeBtn.style.color = "#6b7280";
            closeBtn.title = "Close";
            closeBtn.onmouseover = () => {
                closeBtn.style.backgroundColor = "#fee2e2";
                closeBtn.style.color = "#dc2626";
            };
            closeBtn.onmouseout = () => {
                closeBtn.style.backgroundColor = "transparent";
                closeBtn.style.color = "#6b7280";
            };

            // Minimize functionality
            minimizeBtn.onclick = (e) => {
                e.stopPropagation();
                const isMinimized =
                    dialerElement?.getAttribute("data-minimized") === "true";
                const iframe = getDialerIframe(dialerElement ?? null);
                if (isMinimized) {
                    // Restore
                    dialerElement!.style.height = "610px";
                    dialerElement!.setAttribute("data-minimized", "false");
                    minimizeBtn.innerHTML = "−";
                    if (iframe) {
                        iframe.style.display = "block";
                    }
                    // Dispatch event for restore
                    window.dispatchEvent(
                        new CustomEvent("justcall-popup-restored"),
                    );
                } else {
                    // Minimize
                    dialerElement!.style.height = "40px"; // Just show header
                    dialerElement!.setAttribute("data-minimized", "true");
                    minimizeBtn.innerHTML = "+";
                    if (iframe) {
                        iframe.style.display = "none";
                    }
                    // Dispatch event for minimize
                    window.dispatchEvent(
                        new CustomEvent("justcall-popup-minimized"),
                    );
                }
            };

            // Close functionality
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                if (dialerElement) {
                    dialerElement.style.display = "none";
                    // Remove microphone permission when popup is closed
                    removeMicrophonePermission(dialerElementId);
                    // Clear any pending microphone timeout
                    if (window.justCallMicTimeout) {
                        clearTimeout(window.justCallMicTimeout);
                        delete window.justCallMicTimeout;
                    }
                    // Clear any auth check interval when closing
                    if (window.justCallAuthCheckInterval) {
                        clearInterval(window.justCallAuthCheckInterval);
                        delete window.justCallAuthCheckInterval;
                    }
                    // Dispatch event for close
                    window.dispatchEvent(
                        new CustomEvent("justcall-popup-closed"),
                    );
                }
            };

            // Make header draggable
            let isDragging = false;
            let currentX = 0;
            let currentY = 0;
            let initialX = 0;
            let initialY = 0;

            header.onmousedown = (e) => {
                if (isHTMLElement(e.target) && e.target.tagName === "BUTTON")
                    return;
                isDragging = true;
                initialX = e.clientX - (dialerElement!.offsetLeft || 0);
                initialY = e.clientY - (dialerElement!.offsetTop || 0);
            };

            document.onmousemove = (e) => {
                if (isDragging && dialerElement) {
                    e.preventDefault();
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                    dialerElement.style.right = "auto";
                    dialerElement.style.bottom = "auto";
                    dialerElement.style.left = `${currentX}px`;
                    dialerElement.style.top = `${currentY}px`;
                }
            };

            document.onmouseup = () => {
                isDragging = false;
            };

            controls.appendChild(minimizeBtn);
            controls.appendChild(closeBtn);
            header.appendChild(title);
            header.appendChild(controls);
            dialerElement.appendChild(header);

            // Store reference for showing/hiding
            window.justCallDialerElement = dialerElement;
            document.body.appendChild(dialerElement);
            console.log(
                "[JustCall] Dialer container created with minimize controls",
            );
        }

        console.log("[JustCall] Attempting to import SDK...");
        // Dynamically import JustCall Dialer SDK
        let JustCallDialer: new (
            config: JustCallDialerConfig,
        ) => JustCallDialerInstance;
        try {
            const sdkModule = await import("@justcall/justcall-dialer-sdk");
            JustCallDialer = sdkModule.JustCallDialer || sdkModule.default;

            if (!JustCallDialer) {
                console.error(
                    "[JustCall] SDK module structure:",
                    Object.keys(sdkModule),
                );
                throw new Error("JustCallDialer not found in SDK module");
            }
            console.log("[JustCall] SDK imported successfully");
            console.log(
                "[JustCall] JustCallDialer type:",
                typeof JustCallDialer,
            );
        } catch (importError) {
            console.error("[JustCall] Failed to import SDK:", importError);
            throw new Error(
                `Failed to import JustCall SDK: ${importError instanceof Error ? importError.message : String(importError)}`,
            );
        }

        console.log("[JustCall] Initializing dialer...");
        console.log("[JustCall] Using dialer element ID:", dialerElementId);

        // Initialize the dialer with the correct constructor signature
        let dialer: JustCallDialerInstance;
        try {
            // Create dialer instance with callbacks
            // Store callbacks in window so components can access them
            const loginCallbacks: Array<(data: unknown) => void> = [];
            const logoutCallbacks: Array<() => void> = [];

            window.justCallLoginCallbacks = loginCallbacks;
            window.justCallLogoutCallbacks = logoutCallbacks;

            dialer = new JustCallDialer({
                dialerId: dialerElementId,
                onLogin: (data: unknown) => {
                    console.log("[JustCall] User logged in:", data);
                    // Notify all registered login callbacks
                    loginCallbacks.forEach((callback) => callback(data));
                },
                onLogout: () => {
                    console.log("[JustCall] User logged out");
                    // Notify all registered logout callbacks
                    logoutCallbacks.forEach((callback) => callback());
                },
                onReady: () => {
                    console.log("[JustCall] Dialer is ready");
                    // Log key methods for debugging
                    console.log("[JustCall] Dialer methods available:", {
                        hasReady: typeof dialer.ready === "function",
                        hasDialNumber: typeof dialer.dialNumber === "function",
                        hasIsLoggedIn: typeof dialer.isLoggedIn === "function",
                        hasOn: typeof dialer.on === "function",
                    });

                    // Remove microphone permission from iframe to prevent always-on mic
                    // We'll add it back only when a call is initiated
                    setTimeout(() => {
                        const iframe = getDialerIframe(dialerElement);
                        if (iframe) {
                            // Remove microphone from allow attribute
                            const currentAllow =
                                iframe.getAttribute("allow") || "";
                            const newAllow = currentAllow
                                .split(";")
                                .map((perm) => perm.trim())
                                .filter((perm) => perm !== "microphone")
                                .join("; ");
                            iframe.setAttribute(
                                "allow",
                                newAllow ||
                                    "autoplay; clipboard-read; clipboard-write; hid",
                            );
                            console.log(
                                "[JustCall] Microphone permission removed from iframe. Will be added when call is initiated.",
                            );
                        }
                    }, 500); // Wait a bit for iframe to be created

                    // Listen for call events to add microphone permission when call starts
                    if (typeof dialer.on === "function") {
                        // Add microphone permission when call starts ringing or is answered
                        dialer.on("call-ringing", () => {
                            const iframe = getDialerIframe(dialerElement);
                            if (iframe) {
                                const currentAllow =
                                    iframe.getAttribute("allow") || "";
                                if (!currentAllow.includes("microphone")) {
                                    const newAllow = currentAllow
                                        ? `${currentAllow}; microphone`
                                        : "microphone; autoplay; clipboard-read; clipboard-write; hid";
                                    iframe.setAttribute("allow", newAllow);
                                    console.log(
                                        "[JustCall] Microphone permission added for call (call-ringing event)",
                                    );
                                }
                            }
                            // Clear any pending timeout since call has started
                            if (window.justCallMicTimeout) {
                                clearTimeout(window.justCallMicTimeout);
                                delete window.justCallMicTimeout;
                            }
                        });

                        dialer.on("call-answered", () => {
                            const iframe = getDialerIframe(dialerElement);
                            if (iframe) {
                                const currentAllow =
                                    iframe.getAttribute("allow") || "";
                                if (!currentAllow.includes("microphone")) {
                                    const newAllow = currentAllow
                                        ? `${currentAllow}; microphone`
                                        : "microphone; autoplay; clipboard-read; clipboard-write; hid";
                                    iframe.setAttribute("allow", newAllow);
                                    console.log(
                                        "[JustCall] Microphone permission added for call (call-answered event)",
                                    );
                                }
                            }
                            // Clear any pending timeout since call has started
                            if (window.justCallMicTimeout) {
                                clearTimeout(window.justCallMicTimeout);
                                delete window.justCallMicTimeout;
                            }
                        });

                        // Remove microphone permission when call ends
                        dialer.on("call-ended", () => {
                            setTimeout(() => {
                                removeMicrophonePermission(dialerElementId);
                            }, 1000); // Wait a bit before removing to ensure call cleanup is complete
                        });

                        // Monitor when dialer element is hidden to remove microphone
                        const observer = new MutationObserver((mutations) => {
                            mutations.forEach((mutation) => {
                                if (
                                    mutation.type === "attributes" &&
                                    mutation.attributeName === "style"
                                ) {
                                    const target = mutation.target;
                                    if (
                                        target instanceof HTMLElement &&
                                        target.style.display === "none"
                                    ) {
                                        removeMicrophonePermission(
                                            dialerElementId,
                                        );
                                    }
                                }
                            });
                        });

                        observer.observe(dialerElement, {
                            attributes: true,
                            attributeFilter: ["style"],
                        });

                        // Store observer for cleanup if needed
                        window.justCallDialerObserver = observer;
                    }
                },
            });
            console.log("[JustCall] Dialer created successfully");
        } catch (constructorError) {
            console.error(
                "[JustCall] Failed to create dialer:",
                constructorError,
            );
            const errorMessage =
                constructorError instanceof Error
                    ? constructorError.message
                    : String(constructorError);
            throw new Error(
                `Failed to create JustCall dialer: ${errorMessage}`,
            );
        }

        // Store instance separately from the class
        window.justCallDialerInstance = dialer;

        console.log("[JustCall] SDK initialized successfully");
        return true;
    } catch (error) {
        console.error("[JustCall] Initialization failed:", error);
        if (error instanceof Error) {
            console.error("[JustCall] Error details:", {
                message: error.message,
                stack: error.stack,
            });
        }
        throw error; // Re-throw so the promise handler can catch it
    }
}

// Check if JustCall SDK is ready
export function isJustCallReady(): boolean {
    if (typeof window === "undefined") {
        return false;
    }
    return !!window.justCallDialerInstance;
}

// Helper function to remove microphone permission from iframe
function removeMicrophonePermission(dialerElementId?: string): void {
    const elementId =
        dialerElementId ||
        process.env.NEXT_PUBLIC_JUSTCALL_DIALER_ID ||
        "justcall-dialer-container";
    const dialerElement =
        window.justCallDialerElement ?? document.getElementById(elementId);
    if (dialerElement) {
        const iframe = getDialerIframe(dialerElement);
        if (iframe) {
            const currentAllow = iframe.getAttribute("allow") || "";
            const newAllow = currentAllow
                .split(";")
                .map((perm) => perm.trim())
                .filter((perm) => perm !== "microphone")
                .join("; ");
            iframe.setAttribute(
                "allow",
                newAllow || "autoplay; clipboard-read; clipboard-write; hid",
            );
            console.log("[JustCall] Microphone permission removed");
        }
    }
}

// Make a call using JustCall
export async function makeCall(
    phoneNumber: string | number | null,
    contactName?: string | null,
): Promise<{ success: boolean; error?: string }> {
    try {
        const dialerElementId =
            process.env.NEXT_PUBLIC_JUSTCALL_DIALER_ID ||
            "justcall-dialer-container";
        const formattedPhone = formatPhoneForJustCall(phoneNumber);
        if (!formattedPhone) {
            return { success: false, error: "Invalid phone number format" };
        }

        // Try to initialize if not ready
        if (!isJustCallReady()) {
            console.log(
                "[JustCall] SDK not ready, attempting initialization...",
            );
            const initialized = await initializeJustCall();
            if (!initialized) {
                return {
                    success: false,
                    error: "JustCall SDK failed to initialize. Please check the browser console for details.",
                };
            }
        }

        const dialer = window.justCallDialerInstance;

        if (!dialer) {
            return {
                success: false,
                error: "JustCall dialer instance not found. Please ensure the dialer is initialized.",
            };
        }

        console.log("[JustCall] Attempting to dial:", formattedPhone);

        // Make call using JustCall Dialer SDK
        // According to SDK docs: use dialNumber() method after ensuring dialer is ready
        try {
            // Ensure dialer is ready before using dialNumber
            if (typeof dialer.ready === "function") {
                await dialer.ready();
            } else if (dialer.isDialerReady && !dialer.isDialerReady()) {
                return {
                    success: false,
                    error: "Dialer is not ready yet. Please wait a moment and try again.",
                };
            }

            // Note: We don't check login status here because:
            // 1. dialNumber() will prepopulate the number even if not logged in
            // 2. The user can log in through the dialer iframe UI if needed
            // 3. The dialer will prompt for login when the user tries to call

            // Use dialNumber method to prepopulate the dialer with the phone number
            if (typeof dialer.dialNumber === "function") {
                dialer.dialNumber(formattedPhone);
                console.log(
                    "[JustCall] Number dialed:",
                    formattedPhone,
                    "Contact:",
                    contactName,
                );

                // Add microphone permission to iframe when call is initiated
                const dialerElement: HTMLElement | null =
                    window.justCallDialerElement ??
                    document.getElementById(dialerElementId);
                if (dialerElement) {
                    const iframe = getDialerIframe(dialerElement);
                    if (iframe) {
                        // Add microphone permission back for the call
                        const currentAllow = iframe.getAttribute("allow") || "";
                        if (!currentAllow.includes("microphone")) {
                            const newAllow = currentAllow
                                ? `${currentAllow}; microphone`
                                : "microphone; autoplay; clipboard-read; clipboard-write; hid";
                            iframe.setAttribute("allow", newAllow);
                            console.log(
                                "[JustCall] Microphone permission added for call",
                            );

                            // Set up a timeout to remove microphone if no call is started within 60 seconds
                            // This handles the case where user initiates a call but doesn't complete it
                            const micTimeoutId = setTimeout(() => {
                                // Check if dialer is still visible - if hidden, remove mic immediately
                                if (dialerElement.style.display === "none") {
                                    removeMicrophonePermission(dialerElementId);
                                } else {
                                    // If still visible but no call started, remove mic anyway
                                    removeMicrophonePermission(dialerElementId);
                                    console.log(
                                        "[JustCall] Microphone permission removed after timeout (no call started)",
                                    );
                                }
                                if (
                                    window.justCallMicTimeout === micTimeoutId
                                ) {
                                    delete window.justCallMicTimeout;
                                }
                            }, 60000); // 60 seconds timeout

                            // Store timeout ID to clear it if call actually starts
                            window.justCallMicTimeout = micTimeoutId;
                        }
                    }
                }

                // Show the dialer iframe so user can click the call button
                // The dialer needs to be visible for the user to actually initiate the call
                if (dialerElement) {
                    dialerElement.style.display = "block";
                    // Ensure it's not minimized when showing
                    if (
                        dialerElement.getAttribute("data-minimized") === "true"
                    ) {
                        dialerElement.style.height = "610px";
                        dialerElement.setAttribute("data-minimized", "false");
                        const headerId = `${dialerElementId}-header`;
                        const header =
                            document.getElementById(headerId) ||
                            dialerElement.querySelector(
                                '[id="' + headerId + '"]',
                            );
                        const minimizeBtn = header?.querySelector("button");
                        if (minimizeBtn instanceof HTMLElement) {
                            minimizeBtn.innerHTML = "−";
                        }
                        const iframe = getDialerIframe(dialerElement);
                        if (iframe) {
                            iframe.style.display = "block";
                        }
                    }
                    console.log(
                        "[JustCall] Dialer iframe shown - please click the call button in the dialer",
                    );
                }

                // Try to programmatically trigger the call via postMessage
                // This is a workaround since dialNumber() only prepopulates
                try {
                    const iframe =
                        getDialerIframe(dialerElement) ??
                        getDialerIframe(
                            document.getElementById(dialerElementId),
                        );
                    if (iframe?.contentWindow) {
                        // Try different message formats that might trigger the call
                        iframe.contentWindow.postMessage(
                            {
                                type: "dial",
                                number: formattedPhone,
                                action: "call",
                            },
                            "*",
                        );

                        // Also try clicking the call button programmatically
                        setTimeout(() => {
                            try {
                                if (iframe.contentDocument) {
                                    const callButton =
                                        iframe.contentDocument.querySelector(
                                            'button[aria-label*="call"], button[title*="call"], .call-button, [data-action="call"]',
                                        );
                                    if (
                                        callButton instanceof HTMLElement
                                    ) {
                                        callButton.click();
                                        console.log(
                                            "[JustCall] Attempted to trigger call button click",
                                        );
                                    }
                                }
                            } catch {
                                // Cross-origin restrictions may prevent accessing iframe content
                                console.log(
                                    "[JustCall] Cannot access iframe content (cross-origin), user must click call button manually",
                                );
                            }
                        }, 500);
                    }
                } catch (postMessageError) {
                    console.warn(
                        "[JustCall] Could not trigger call programmatically, user must click call button:",
                        postMessageError,
                    );
                }

                return { success: true };
            } else {
                console.warn(
                    "[JustCall] dialNumber method not found. Available methods:",
                    Object.keys(dialer).filter(
                        (key) => typeof dialer[key] === "function",
                    ),
                );
                return {
                    success: false,
                    error: "dialNumber method not found on dialer instance.",
                };
            }
        } catch (sdkError) {
            console.error("[JustCall] SDK dialNumber error:", sdkError);
            return {
                success: false,
                error: `SDK dial failed: ${sdkError instanceof Error ? sdkError.message : String(sdkError)}`,
            };
        }
    } catch (error) {
        console.error("[JustCall] Call failed:", error);
        return {
            success: false,
            error:
                error instanceof Error ? error.message : "Failed to make call",
        };
    }
}

// Open SMS page in JustCall dialer using URL scheme
// Reference: https://developer.justcall.io/docs/justcall-dialer-setup-guide
export async function sendSMS(
    phoneNumber: string | number | null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Reserved for future pre-filled SMS body
    message?: string | null,
): Promise<{ success: boolean; error?: string }> {
    try {
        const formattedPhone = formatPhoneForJustCall(phoneNumber);
        if (!formattedPhone) {
            return { success: false, error: "Invalid phone number format" };
        }

        // Try to initialize if not ready
        if (!isJustCallReady()) {
            console.log(
                "[JustCall] SDK not ready, attempting initialization...",
            );
            const initialized = await initializeJustCall();
            if (!initialized) {
                return {
                    success: false,
                    error: "JustCall SDK failed to initialize. Please check the browser console for details.",
                };
            }
        }

        const dialer = window.justCallDialerInstance;

        if (!dialer) {
            return {
                success: false,
                error: "JustCall dialer instance not found. Please ensure the dialer is initialized.",
            };
        }

        console.log("[JustCall] Opening SMS page for:", formattedPhone);

        // Open SMS page in JustCall dialer using URL scheme
        // According to docs: https://app.justcall.io/dialer?numbers=+1234567XXXX&sms=1
        try {
            // Ensure dialer is ready
            if (typeof dialer.ready === "function") {
                await dialer.ready();
            }

            const dialerElementId =
                process.env.NEXT_PUBLIC_JUSTCALL_DIALER_ID ||
                "justcall-dialer-container";
            const dialerElement: HTMLElement | null =
                window.justCallDialerElement ??
                document.getElementById(dialerElementId);

            if (dialerElement) {
                // Show the dialer iframe
                dialerElement.style.display = "block";
                // Ensure it's not minimized when showing
                if (dialerElement.getAttribute("data-minimized") === "true") {
                    dialerElement.style.height = "610px";
                    dialerElement.setAttribute("data-minimized", "false");
                    const headerId = `${dialerElementId}-header`;
                    const header =
                        document.getElementById(headerId) ??
                        dialerElement.querySelector(
                            '[id="' + headerId + '"]',
                        );
                    const minimizeBtn = header?.querySelector("button");
                    if (minimizeBtn instanceof HTMLElement) {
                        minimizeBtn.innerHTML = "−";
                    }
                    const iframeRestore = getDialerIframe(dialerElement);
                    if (iframeRestore) {
                        iframeRestore.style.display = "block";
                    }
                }

                // Add microphone permission to iframe for SMS (needed for sending messages)
                const iframe = getDialerIframe(dialerElement);
                if (iframe) {
                    // Add microphone permission back for SMS
                    const currentAllow = iframe.getAttribute("allow") || "";
                    if (!currentAllow.includes("microphone")) {
                        const newAllow = currentAllow
                            ? `${currentAllow}; microphone`
                            : "microphone; autoplay; clipboard-read; clipboard-write; hid";
                        iframe.setAttribute("allow", newAllow);
                        console.log(
                            "[JustCall] Microphone permission added for SMS",
                        );
                    }

                    // Use URL scheme to open SMS page directly
                    // Format: https://app.justcall.io/dialer?numbers=+1234567XXXX&sms=1
                    const smsUrl = `https://app.justcall.io/dialer?numbers=${encodeURIComponent(formattedPhone)}&sms=1`;
                    iframe.src = smsUrl;
                    console.log(
                        "[JustCall] Navigated iframe to SMS page:",
                        smsUrl,
                    );
                } else {
                    // If iframe doesn't exist yet, wait a bit and try again
                    setTimeout(() => {
                        const iframe = getDialerIframe(dialerElement);
                        if (iframe) {
                            // Add microphone permission back for SMS
                            const currentAllow =
                                iframe.getAttribute("allow") || "";
                            if (!currentAllow.includes("microphone")) {
                                const newAllow = currentAllow
                                    ? `${currentAllow}; microphone`
                                    : "microphone; autoplay; clipboard-read; clipboard-write; hid";
                                iframe.setAttribute("allow", newAllow);
                                console.log(
                                    "[JustCall] Microphone permission added for SMS (delayed)",
                                );
                            }

                            const smsUrl = `https://app.justcall.io/dialer?numbers=${encodeURIComponent(formattedPhone)}&sms=1`;
                            iframe.src = smsUrl;
                            console.log(
                                "[JustCall] Navigated iframe to SMS page (delayed):",
                                smsUrl,
                            );
                        }
                    }, 1000);
                }

                return { success: true };
            } else {
                return {
                    success: false,
                    error: "JustCall dialer element not found",
                };
            }
        } catch (sdkError) {
            console.error("[JustCall] SDK SMS error:", sdkError);
            return {
                success: false,
                error: `SDK SMS failed: ${sdkError instanceof Error ? sdkError.message : String(sdkError)}`,
            };
        }
    } catch (error) {
        console.error("[JustCall] SMS failed:", error);
        return {
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : "Failed to open SMS page",
        };
    }
}
