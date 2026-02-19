import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Keep logging simple so crashes are visible in dev tools.
    // eslint-disable-next-line no-console
    console.error("App crash caught by ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="hud-bg full-center">
          <div className="hud-card" style={{ maxWidth: 560 }}>
            <div className="hud-card-title">Something broke</div>
            <div className="hud-big">We hit an unexpected error.</div>
            <div className="hud-dim" style={{ marginTop: 8 }}>
              Reload the app. If this keeps happening, return to home and try again.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button className="studio-back" type="button" onClick={() => window.location.reload()}>
                Reload
              </button>
              <button className="studio-back" type="button" onClick={() => (window.location.href = "/")}>
                Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

