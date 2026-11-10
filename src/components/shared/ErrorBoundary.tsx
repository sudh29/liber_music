import React, { Component, ErrorInfo, ReactNode } from "react";
import { t } from "@/utils/i18n/i18n";

interface Props {
	children: ReactNode;
	fallbackTitle?: string;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
		console.error("MusicPlayer encountered an unhandled error:", error, errorInfo);
	}

	handleReset = (): void => {
		this.setState({ hasError: false, error: null });
	};

	render(): ReactNode {
		if (this.state.hasError) {
			return (
				<div className="music-player-error-boundary" style={{ padding: "16px", textAlign: "center", color: "var(--text-error)" }}>
					<p style={{ fontWeight: 600, marginBottom: "8px" }}>
						{this.props.fallbackTitle || t("view.initFailed") || "Something went wrong in Liber Music Player."}
					</p>
					<pre style={{ fontSize: "11px", whiteSpace: "pre-wrap", color: "var(--text-muted)", marginBottom: "12px" }}>
						{this.state.error?.message}
					</pre>
					<button
						type="button"
						className="mod-cta"
						onClick={this.handleReset}
					>
						{t("common.ok") || "Retry"}
					</button>
				</div>
			);
		}

		return this.props.children;
	}
}

