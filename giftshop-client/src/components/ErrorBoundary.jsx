import { Component } from 'react';

// Catches render errors so one broken component shows a message instead of a blank page
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page flex min-h-[60vh] flex-col items-center justify-center text-center">
        <h1 className="text-4xl">This page didn't load</h1>
        <p className="mt-3 max-w-md text-muted">Something broke while showing this page. Reloading usually fixes it.</p>
        <div className="mt-6 flex gap-3">
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>Reload page</button>
          <a className="btn-outline" href="/">Go to home</a>
        </div>
      </div>
    );
  }
}
