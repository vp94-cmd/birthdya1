/**
 * Global State Manager for Cross-Tab Communication
 * Integrates Supabase Realtime for instant global state synchronization
 * Ensures all users see admin changes without page refresh
 */

import { realtimeSyncManager } from './realtimeSync';

type StateListener = (data: any) => void;
type StateType = 'person' | 'senders' | 'theme' | 'polaroids' | 'court';

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
    const types: StateType[] = ['person', 'senders', 'theme', 'polaroids', 'court'];
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
      'chaarYaarPerson':   'person',
      'chaarYaarSenders':  'senders',
      'chaarYaarTheme':    'theme',
      'chaarYaarPolaroids': 'polaroids',
      'chaarYaarCourt': 'court',
    };
    return mapping[key] || null;
  }

  private getKeyFromStateType(type: StateType): string {
    const mapping: { [key in StateType]: string } = {
      'person':   'chaarYaarPerson',
      'senders':  'chaarYaarSenders',
      'theme':    'chaarYaarTheme',
      'polaroids': 'chaarYaarPolaroids',
      'court': 'chaarYaarCourt',
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

  private async _doBroadcast(type: StateType, data: any): Promise<void> {
    const key = this.getKeyFromStateType(type);
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
    try {
      await realtimeSyncManager.broadcast(type, data);
    } catch (e) {
      console.warn(`Unexpected broadcast error for "${type}", notifying locally:`, e);
      this.notifyListeners(type, data);
    }
  }

  subscribe(type: StateType, listener: StateListener): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);

    const key = this.getKeyFromStateType(type);
    try {
      const stored = localStorage.getItem(key);
      if (stored) listener(JSON.parse(stored));
    } catch (e) {
      console.error('Failed to hydrate subscriber:', e);
    }

    return () => { this.listeners.get(type)?.delete(listener); };
  }

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
   * FIX #3: New method — saves all config to Supabase DB in one atomic call,
   * then broadcasts to all connected clients via Realtime.
   *
   * AdminPanel's handleSave should call this instead of 4 separate broadcast()
   * calls, so data actually persists across page refreshes.
   *
   * The old broadcast()-only approach only wrote to localStorage (single browser)
   * and sent an ephemeral Realtime message — nothing was ever written to the DB.
   */
  async saveConfig(config: {
    person: any;
    senders: any;
    theme: string;
    polaroids: any;
  }): Promise<void> {
    // 1. Save to localStorage immediately (instant local update)
    localStorage.setItem('chaarYaarPerson',   JSON.stringify(config.person));
    localStorage.setItem('chaarYaarSenders',  JSON.stringify(config.senders));
    localStorage.setItem('chaarYaarTheme',    config.theme);
    localStorage.setItem('chaarYaarPolaroids', JSON.stringify(config.polaroids));

    // 2. Persist to Supabase DB (survives refresh, visible to all users)
    await realtimeSyncManager.saveToDatabase(config);

    // 3. Broadcast live update to all connected browser tabs/clients
    await Promise.all([
      realtimeSyncManager.broadcast('person',   config.person),
      realtimeSyncManager.broadcast('senders',  config.senders),
      realtimeSyncManager.broadcast('theme',    config.theme),
      realtimeSyncManager.broadcast('polaroids', config.polaroids),
    ]);

    // 4. Notify local listeners directly (same tab, no round-trip needed)
    this.notifyListeners('person',   config.person);
    this.notifyListeners('senders',  config.senders);
    this.notifyListeners('theme',    config.theme);
    this.notifyListeners('polaroids', config.polaroids);
  }

  async broadcastAll(): Promise<void> {
    const types: StateType[] = ['person', 'senders', 'theme', 'polaroids', 'court'];
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
   * Resets the intro sequence for ALL connected clients.
   * Admin calls this — it clears their own localStorage flag AND broadcasts
   * a reset_intro event so every other browser also clears their flag.
   */
  async resetIntro(): Promise<void> {
    // Clear locally first (admin's own browser)
    try {
      localStorage.removeItem('chaarYaarSequenceDone');
    } catch (e) {
      console.warn('resetIntro: could not clear localStorage:', e);
    }
    // Broadcast to all other connected clients
    await realtimeSyncManager.broadcastResetIntro();
  }

  /**
   * Subscribe to reset_intro commands from admin.
   * Used by App.tsx to listen for global intro resets.
   * Returns unsubscribe function.
   */
  subscribeResetIntro(callback: () => void): () => void {
    return realtimeSyncManager.subscribeResetIntro(callback);
  }

  onConnectionChange(cb: (connected: boolean) => void): () => void {
    return realtimeSyncManager.onConnectionChange(cb);
  }

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

export const globalStateManager = new GlobalStateManager();
