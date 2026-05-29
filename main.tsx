import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// ─────────────────────────────────────────────────────────────────────────────
// WHY dynamic import instead of `import App from './App'`?
//
// A static import is evaluated synchronously at module load time.
// If ANY file in the import chain throws at module level (e.g. supabaseClient's
// `throw new Error("Missing Supabase credentials")`), the exception propagates
// up through the entire chain BEFORE React even mounts. A class-based
// ErrorBoundary inside the app can't help — React isn't running yet.
// The result is always a silent blank white screen.
//
// A dynamic import wraps that whole evaluation inside a Promise, so any
// module-level throw becomes a rejected promise that we can `.catch()` and
// display as a readable error panel. This is the only way to catch such crashes.
// ─────────────────────────────────────────────────────────────────────────────

const root = createRoot(document.getElementById('root')!);

function showFatalError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const stack   = err instanceof Error ? (err.stack ?? '') : '';

  // Log so DevTools / Netlify function logs capture it
  console.error('[main] Fatal module-load error:', err);

  root.render(
    <div style={{
      fontFamily: '"Courier New", monospace',
      padding: '2rem',
      background: '#0b1120',
      color: '#f87171',
      minHeight: '100vh',
      boxSizing: 'border-box' as const,
    }}>
      <h1 style={{ color: '#fb7185', fontSize: '1.15rem', marginBottom: '0.4rem' }}>
        ⚠ Fatal startup error — app could not load
      </h1>
      <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
        Open DevTools → Console for the full trace. Copy the text below and share it to get help.
      </p>

      <div style={{ background: '#1e293b', borderRadius: '0.5rem', padding: '1rem',
                    marginBottom: '1rem', border: '1px solid #334155' }}>
        <p style={{ color: '#fca5a5', fontWeight: 'bold', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
          Error message:
        </p>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      color: '#fcd34d', fontSize: '0.85rem', margin: 0 }}>
          {message}
        </pre>
      </div>

      {stack && (
        <details open>
          <summary style={{ color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            Stack trace (click to collapse)
          </summary>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        color: '#64748b', fontSize: '0.72rem', marginTop: '0.4rem' }}>
            {stack}
          </pre>
        </details>
      )}

      <button
        onClick={() => window.location.reload()}
        style={{ marginTop: '1.5rem', padding: '0.5rem 1.25rem', background: '#1e293b',
                 color: '#94a3b8', border: '1px solid #334155', borderRadius: '0.375rem',
                 cursor: 'pointer', fontSize: '0.875rem' }}
      >
        ↺ Reload
      </button>
    </div>
  );
}

// Dynamic import — catches any module-level throw in App.tsx or its entire
// import chain (AdminPanel → globalStateManager → realtimeSync → supabaseClient)
import('./App.tsx')
  .then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  })
  .catch(showFatalError);
