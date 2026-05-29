// ─── REPLACE handleSave in AdminPanel.tsx with this ───────────────────────
//
// Only this function changes. Everything else in AdminPanel.tsx stays identical.
//
// The old version called globalStateManager.broadcast() 4 times, which only
// wrote to localStorage + sent an ephemeral Realtime message. No data was ever
// written to the Supabase database, so changes vanished on refresh.
//
// The new version calls globalStateManager.saveConfig() which:
//   1. Saves to localStorage (instant local update)
//   2. Writes to Supabase site_config table (persists across refreshes)
//   3. Broadcasts via Realtime channel (live update for other open tabs)

  const handleSave = async () => {
    setSaveStatus('saving');
    
    try {
      // Single atomic call: DB write + Realtime broadcast + localStorage
      await globalStateManager.saveConfig({ person, senders, theme, polaroids });

      // Dispatch custom events for any other listeners in the app
      window.dispatchEvent(new Event('friendsUpdated'));
      window.dispatchEvent(new Event('themeUpdated'));
      window.dispatchEvent(new Event('polaroidsUpdated'));

      setSaveStatus('saved');

      setTimeout(() => {
        setSaveStatus('idle');
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Save failed:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };
