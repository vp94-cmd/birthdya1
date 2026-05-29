import { StrictMode, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// ── ErrorBoundary ─────────────────────────────────────────────────────────────
// React error boundaries ONLY catch errors thrown during rendering, in lifecycle
// methods, and in constructors of child components — NOT module-level throws
// (those must be fixed at the source, i.e. supabaseClient.ts).
//
// This boundary catches any remaining render-time crashes and displays a
// readable error panel instead of a blank white screen, which makes debugging
// on Netlify dramatically easier.
// ─────────────────────────────────────────────────────────────────────────────
interface EBState {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error, componentStack: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to browser console so the Netlify function log / browser devtools captures it
    console.error('[AppErrorBoundary] Render error:', error);
    console.error('[AppErrorBoundary] Component stack:', info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, componentStack: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { error, componentStack } = this.state;
      return (
        <div style={{
          fontFamily: '"Courier New", monospace',
          padding: '2rem',
          background: '#0b1120',
          color: '#f87171',
          minHeight: '100vh',
          boxSizing: 'border-box',
        }}>
          <h1 style={{ color: '#fb7185', marginBottom: '0.5rem', fontSize: '1.25rem' }}>
            ⚠ App Error — check the browser console for details
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
            If you are the admin, open DevTools → Console tab to see the full trace.
          </p>

          <div style={{ background: '#1e293b', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem', border: '1px solid #334155' }}>
            <p style={{ color: '#fca5a5', fontWeight: 'bold', marginBottom: '0.5rem' }}>Error message:</p>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#fcd34d', fontSize: '0.85rem', margin: 0 }}>
              {error?.message ?? 'Unknown error'}
            </pre>
          </div>

          {error?.stack && (
            <details style={{ marginBottom: '1rem' }}>
              <summary style={{ color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}>Stack trace</summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#64748b', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                {error.stack}
              </pre>
            </details>
          )}

          {componentStack && (
            <details style={{ marginBottom: '1.5rem' }}>
              <summary style={{ color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}>Component stack</summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#64748b', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                {componentStack}
              </pre>
            </details>
          )}

          <button
            onClick={this.handleReload}
            style={{
              padding: '0.5rem 1.25rem',
              background: '#1e293b',
              color: '#94a3b8',
              border: '1px solid #334155',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            ↺ Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
