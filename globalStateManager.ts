/**
 * Global State Manager for Cross-Tab Communication
 * Integrates Supabase Realtime for instant global state synchronization
 * Ensures all users see admin changes without page refresh
 */

import { realtimeSyncManager } from './realtimeSync';

type StateListener = (data: any) => void;
type StateType = 'person' | 'senders' | 'theme' | 'polaroids';

class GlobalStateManager {
  private listeners: Map<StateType, Set<StateListener>> = new Map();
  private pendingUpdates: Map<StateType, any> = new Map();
  private debounceTimers: Map<StateType, ReturnType<typeof setTimeout>> = new Map();
  private updateDebounceTime = 100;

  constructor() {
    this.setupRealtimeSync();
    this.setupStorageListener();
  }

  private setupRealtimeSync() {
    // Subscribe so remote Supabase updates (and local broadcast() calls)
    // flow through realtimeSyncManager → here → React components.
    const types: StateType[] = ['person', 'senders', 'theme', 'polaroids'];
    types.forEach(type => {
      try {
        realtimeSyncManager.subscribe(type, (data) => {
          this.notifyListeners(type, data);
        });
      } catch (e) {
        console.error(`Failed to subscribe to realtimeSyncManager for "${type}":`, e);
      }
    });
  }

  private setupStorageListener() {
    // Cross-tab fallback: picks up localStorage changes from other tabs
    // when Supabase is unavailable. realtimeSync.ts intentionally does NOT
    // have its own storage listener to avoid double-notifications.
    try {
      window.addEventListener('storage', (event) => {
        if (!event.key) return;
        const stateType = this.getStateTypeFromKey(event.key);
        if (stateType && event.newValue) {
          try {
            this.notifyListeners(stateType, JSON.parse(event.newValue));
          } catch (e) {
            console.error('Failed to parse storage event data:', e);
          }
        }
      });
    } catch (e) {
      console.error('Failed to set up storage listener:', e);
    }
  }

  private getStateTypeFromKey(key: string): StateType | null {
    const mapping: { [key: string]: StateType } = {
      'chaarYaarPerson': 'person',
      'chaarYaarSenders': 'senders',
      'chaarYaarTheme': 'theme',
      'chaarYaarPolaroids': 'polaroids',
    };
    return mapping[key] || null;
  }

  private getKeyFromStateType(type: StateType): string {
    const mapping: { [key in StateType]: string } = {
      'person': 'chaarYaarPerson',
      'senders': 'chaarYaarSenders',
      'theme': 'chaarYaarTheme',
      'polaroids': 'chaarYaarPolaroids',
    };
    return mapping[type];
  }

  private notifyListeners(type: StateType, data: any) {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.forEach(listener => {
        try { listener(data); } catch (e) {
          console.error('Error in state listener:', e);
        }
      });
    }
  }

  /**
   * Internal: performs the actual write + broadcast after debounce settles.
   *
   * Single notification path (no double-renders):
   *   _doBroadcast
   *     → localStorage.setItem
   *     → realtimeSyncManager.broadcast
   *         → handleStateUpdate (local)
   *             → realtimeSyncManager.notifyListeners
   *                 → setupRealtimeSync callback
   *                     → this.notifyListeners  ← React components notified ONCE
   *         → channel.send  (remote clients follow the same path)
   *
   * We do NOT call this.notifyListeners directly here — doing so would
   * cause components to be notified twice per local broadcast.
   */
  private async _doBroadcast(type: StateType, data: any): Promise<void> {
    // 1. Persist to localStorage
    const key = this.getKeyFromStateType(type);
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }

    // 2. realtimeSyncManager handles both local notification and remote broadcast.
    //    It never throws — Supabase failure is non-fatal.
    try {
      await realtimeSyncManager.broadcast(type, data);
    } catch (e) {
      // Unexpected — fall back to direct local notification so UI still updates
      console.warn(`Unexpected broadcast error for "${type}", notifying locally:`, e);
      this.notifyListeners(type, data);
    }
  }

  /**
   * Subscribe to state changes for a specific type.
   * Immediately hydrates the listener with the current localStorage value so
   * components are never stale on mount — even with an empty/new database.
   * Returns an unsubscribe function for cleanup.
   */
  subscribe(type: StateType, listener: StateListener): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);

    // Hydrate immediately — component gets current state with no async wait
    const key = this.getKeyFromStateType(type);
    try {
      const stored = localStorage.getItem(key);
      if (stored) listener(JSON.parse(stored));
    } catch (e) {
      console.error('Failed to hydrate subscriber:', e);
    }

    return () => { this.listeners.get(type)?.delete(listener); };
  }

  /**
   * Broadcast a state update to all clients globally via Supabase Realtime.
   * Trailing debounce — rapid calls always fire with the latest value,
   * never silently discarded.
   */
  async broadcast(type: StateType, data: any): Promise<void> {
    this.pendingUpdates.set(type, data);

    const existing = this.debounceTimers.get(type);
    if (existing) clearTimeout(existing);

    this.debounceTimers.set(type, setTimeout(async () => {
      const latestData = this.pendingUpdates.get(type);
      this.pendingUpdates.delete(type);
      this.debounceTimers.delete(type);
      await this._doBroadcast(type, latestData!);
    }, this.updateDebounceTime));
  }

  /**
   * Broadcast all current localStorage state to other clients.
   */
  async broadcastAll(): Promise<void> {
    const types: StateType[] = ['person', 'senders', 'theme', 'polaroids'];
    await Promise.all(
      types.map(type => {
        const key = this.getKeyFromStateType(type);
        const raw = localStorage.getItem(key);
        if (!raw) return Promise.resolve();
        try {
          return this.broadcast(type, JSON.parse(raw));
        } catch (e) {
          console.error(`broadcastAll: failed for "${type}":`, e);
          return Promise.resolve();
        }
      })
    );
  }

  /**
   * FIX: Wrapped in try/catch as belt-and-suspenders.
   * The root cause (isConnected property/method name collision in realtimeSyncManager)
   * is fixed in realtimeSync.ts, but this guard ensures a bad call never
   * crashes the Admin component even if something else goes wrong.
   */
  isRealtimeConnected(): boolean {
    try {
      return realtimeSyncManager.isConnected();
    } catch (e) {
      console.warn('isRealtimeConnected check failed:', e);
      return false;
    }
  }

  destroy() {
    this.debounceTimers.forEach(t => clearTimeout(t));
    this.debounceTimers.clear();
    this.pendingUpdates.clear();
    this.listeners.clear();
    try { realtimeSyncManager.destroy(); } catch (_) { /* ignore */ }
  }
}

// Singleton instance — exported for use throughout the app
export const globalStateManager = new GlobalStateManager();
