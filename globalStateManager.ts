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
    // Subscribe to realtimeSyncManager so remote Supabase updates
    // (and local broadcast() calls) flow through here to React components.
    const types: StateType[] = ['person', 'senders', 'theme', 'polaroids'];
    types.forEach(type => {
      realtimeSyncManager.subscribe(type, (data) => {
        this.notifyListeners(type, data);
      });
    });
  }

  private setupStorageListener() {
    // Cross-tab fallback: picks up localStorage changes from other tabs
    // when Supabase is unavailable.
    window.addEventListener('storage', (event) => {
      if (!event.key) return;
      const stateType = this.getStateTypeFromKey(event.key);
      if (stateType && event.newValue) {
        try {
          const data = JSON.parse(event.newValue);
          this.notifyListeners(stateType, data);
        } catch (e) {
          console.error('Failed to parse storage event data:', e);
        }
      }
    });
  }

  private getStateTypeFromKey(key: string): StateType | null {
    const mapping: { [key: string]: StateType } = {
      'chaarYaarPerson': 'person',
      'chaarYaarSenders': 'senders',
      'chaarYaarTheme': 'theme',
      'chaarYaarPolaroids': 'polaroids'
    };
    return mapping[key] || null;
  }

  private getKeyFromStateType(type: StateType): string {
    const mapping: { [key in StateType]: string } = {
      'person': 'chaarYaarPerson',
      'senders': 'chaarYaarSenders',
      'theme': 'chaarYaarTheme',
      'polaroids': 'chaarYaarPolaroids'
    };
    return mapping[type];
  }

  private notifyListeners(type: StateType, data: any) {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.forEach(listener => {
        try {
          listener(data);
        } catch (e) {
          console.error('Error in state listener:', e);
        }
      });
    }
  }

  /**
   * Internal: performs the actual write + broadcast after debounce settles.
   *
   * Notification flow (single path, no duplicates):
   *   _doBroadcast
   *     → localStorage.setItem
   *     → realtimeSyncManager.broadcast
   *         → handleStateUpdate (local)
   *             → realtimeSyncManager.notifyListeners
   *                 → setupRealtimeSync callback
   *                     → this.notifyListeners  ← React components notified ONCE
   *         → channel.send  (remote clients follow the same path on their end)
   *
   * We do NOT call this.notifyListeners directly here to avoid a second
   * notification for every local broadcast.
   */
  private async _doBroadcast(type: StateType, data: any): Promise<void> {
    // 1. Persist to localStorage so other tabs and the storage-event fallback work
    const key = this.getKeyFromStateType(type);
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }

    // 2. Delegate to realtimeSyncManager which handles both local notification
    //    (via handleStateUpdate → notifyListeners → our setupRealtimeSync callback)
    //    and remote broadcast. Never throws.
    await realtimeSyncManager.broadcast(type, data);
  }

  /**
   * Subscribe to state changes for a specific type.
   * Immediately hydrates the listener with the current localStorage value so
   * late-subscribing components are never stale on mount.
   * Returns an unsubscribe function for cleanup.
   */
  subscribe(type: StateType, listener: StateListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);

    // Hydrate immediately with the current stored value
    const key = this.getKeyFromStateType(type);
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        listener(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to hydrate subscriber:', e);
      }
    }

    return () => {
      this.listeners.get(type)?.delete(listener);
    };
  }

  /**
   * Broadcast a state update to all clients globally via Supabase Realtime.
   * Uses trailing debounce — rapid calls always fire with the latest value,
   * never silently drop it (unlike a leading-check debounce).
   * Called by Admin Panel when changes are saved.
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
          console.error(`Failed to broadcast ${type}:`, e);
          return Promise.resolve();
        }
      })
    );
  }

  /**
   * Returns true if Supabase Realtime is actively connected.
   */
  isRealtimeConnected(): boolean {
    return realtimeSyncManager.isConnected();
  }

  /**
   * Clean up all resources on app destroy.
   */
  destroy() {
    this.debounceTimers.forEach(t => clearTimeout(t));
    this.debounceTimers.clear();
    this.pendingUpdates.clear();
    this.listeners.clear();
    realtimeSyncManager.destroy();
  }
}

// Singleton instance — exported for use throughout the app
export const globalStateManager = new GlobalStateManager();
