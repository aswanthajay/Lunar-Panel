import React from 'react';

interface Props {
    children?: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    showDetails: boolean;
    copied: boolean;
}

class ErrorBoundary extends React.Component<Props, State> {
    state: State = {
        hasError: false,
        error: null,
        showDetails: false,
        copied: false,
    };

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    }

    handleRefresh = () => {
        window.location.reload();
    };

    handleRetry = () => {
        this.setState({ hasError: false, error: null, showDetails: false, copied: false });
    };

    handleCopyError = () => {
        if (!this.state.error) return;
        const text = `${this.state.error.name}: ${this.state.error.message}\n\nStack:\n${this.state.error.stack || 'No stack trace available'}`;
        navigator.clipboard.writeText(text).then(() => {
            this.setState({ copied: true });
            setTimeout(() => this.setState({ copied: false }), 2000);
        });
    };

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        return (
            <div className="w-full min-h-[340px] flex items-center justify-center p-4 sm:p-8 my-4 select-none font-sans">
                <div className="w-full max-w-md sm:max-w-lg bg-[#050505] border border-[#1F1F1F] rounded-xl shadow-2xl p-6 sm:p-8 text-center relative overflow-hidden backdrop-blur-md">
                    {/* Subtle soft ambient glow */}
                    <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

                    {/* Icon Badge */}
                    <div className="relative w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-5 shadow-inner">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.75"
                                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                            />
                        </svg>
                    </div>

                    {/* Title */}
                    <h3 className="text-lg sm:text-xl font-medium text-[#FFFFFF] tracking-tight antialiased">
                        Unable to Render View
                    </h3>

                    {/* Description */}
                    <p className="text-xs text-[#A0A0A0] mt-2 max-w-sm mx-auto leading-relaxed antialiased">
                        An unexpected error was encountered while rendering this view. Try refreshing the page or retrying the component.
                    </p>

                    {/* Primary & Secondary Action Controls */}
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
                        {/* Refresh Page Button (Primary) */}
                        <button
                            type="button"
                            onClick={this.handleRefresh}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-[#FFFFFF] hover:bg-[#EAEAEA] active:scale-[0.98] text-[#0A0A0A] text-xs font-semibold shadow-sm transition-all duration-150 cursor-pointer"
                        >
                            <svg className="w-3.5 h-3.5 text-[#0A0A0A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                            </svg>
                            <span>Refresh Page</span>
                        </button>

                        {/* Try Again Button (Secondary) */}
                        <button
                            type="button"
                            onClick={this.handleRetry}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-md bg-[#141414] hover:bg-[#1E1E1E] text-[#D4D4D4] hover:text-[#FFFFFF] border border-[#262626] text-xs font-medium transition-colors cursor-pointer"
                        >
                            <span>Try Again</span>
                        </button>

                        {/* Dashboard Shortcut */}
                        <a
                            href="/"
                            className="inline-flex items-center gap-1 px-3 py-2.5 text-[#737373] hover:text-[#FFFFFF] text-xs font-mono transition-colors"
                        >
                            <span>Dashboard →</span>
                        </a>
                    </div>

                    {/* Technical Error Details Accordion */}
                    {this.state.error && (
                        <div className="mt-6 pt-5 border-t border-[#141414] text-left">
                            <div className="flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                                    className="text-[11px] font-mono text-[#737373] hover:text-[#A0A0A0] inline-flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                    <span>{this.state.showDetails ? '▼ Hide error details' : '▶ Show error details'}</span>
                                </button>
                                {this.state.showDetails && (
                                    <button
                                        type="button"
                                        onClick={this.handleCopyError}
                                        className="text-[10px] font-mono text-[#737373] hover:text-[#FFFFFF] transition-colors cursor-pointer"
                                    >
                                        {this.state.copied ? 'Copied to clipboard' : 'Copy error'}
                                    </button>
                                )}
                            </div>

                            {this.state.showDetails && (
                                <div className="mt-2.5 p-3 rounded-md bg-[#000000] border border-[#1A1A1A] font-mono text-[11px] text-rose-400 overflow-x-auto max-h-48 whitespace-pre-wrap select-text leading-relaxed">
                                    <div className="font-semibold text-rose-300 mb-1">
                                        {this.state.error.name}: {this.state.error.message}
                                    </div>
                                    {this.state.error.stack && (
                                        <div className="text-[#737373] text-[10px] mt-1">
                                            {this.state.error.stack}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
