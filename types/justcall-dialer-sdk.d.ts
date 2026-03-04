declare module "@justcall/justcall-dialer-sdk" {
    interface JustCallDialerConfig {
        dialerId: string;
        onLogin?: (data: unknown) => void;
        onLogout?: () => void;
        onReady?: () => void;
    }

    interface JustCallDialerInstance {
        ready?: () => Promise<void>;
        dialNumber?: (number: string) => void;
        isLoggedIn?: () => boolean;
        isDialerReady?: () => boolean;
        on?: (event: string, callback: () => void) => void;
        [key: string]: unknown;
    }

    const JustCallDialer: new (
        config: JustCallDialerConfig,
    ) => JustCallDialerInstance;
    export { JustCallDialer };
    export default JustCallDialer;
}
