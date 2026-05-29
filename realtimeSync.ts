/**
 * Real-Time Sync Manager using Supabase Realtime
 * Handles instant global state synchronization across all clients
 * When admin saves changes, all active users receive updates without page refresh
 */

import { supabase } from './supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

type StateType = 'person' | 'senders' | 'theme' | 'polaroids';
type StateListener = (data: any) => void;

interface StateUpdate {
  type: StateType;
  data: any;
  timestamp: number;
  id: string;
}

class RealtimeSyncManager {
  private channel: RealtimeChannel | null = null;
  private listeners: Map<StateType, Set<StateListener>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private processedUpdateIds: Set<string> = new Set();
  private maxProcessedIds = 100;

  // ─── FIX #1 ────────────────────────────────────────────────────────────────
  // CRITICAL: Renamed from `isConnected` to `_connected`.
  // The original code had BOTH `private isConnected = false` (a property) AND
  // `isConnected(): boolean` (a public method) with the same name.
  // At runtime, `this.isConnected` resolves to the property value `false`, so
  // calling `realtimeSyncManager.isConnected()` was equivalent to calling
  // `false()` → "TypeError: wl.isConnected is not a function" → blank screen.
  // ───────────────────────────────────────────────────────────────────────────
  private _connected = false;

  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private monitorInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // ─── FIX #2 ──────────────────────────────────────────────────────────────
    // Guard against null supabase (missing env vars on first deploy).
    // The original code called supabase.channel() unconditionally, which would
    // throw a TypeError if supabase was null, crashing the module at load time.
    // ─────────────────────────────────────────────────────────────────────────
    if (!supabase) {
      console.warn(
        'RealtimeSyncManager: Supabase client unavailable — real-time disabled, using polling + localStorage only.'
      );
      this.setupPolling();
      return;
    }

    this.initRealtimeChannel();
    // Storage listener lives in globalStateManager to avoid double-notifications.
    this.setupPolling();
    this.monitorConnection();
  }

  private initRealtimeChannel() {
    if (!supabase) return;

    // Clean up stale channel before reconnecting — otherwise every reconnect
    // stacks another live channel, producing duplicate events.
    if (this.channel) {
      try { this.channel.unsubscribe(); } catch (_) { /* ignore */ }
      this.channel = null;
    }

    try {
      // self: false — we call handleStateUpdate() locally in broadcast(), so
      // Supabase doesn't need to echo our own messages back.
      this.channel = supabase.channel('birthday_state_updates', {
        config: { broadcast: { self: false } },
      });

      this.channel
        .on('broadcast', { event: 'state_update' }, (payload) => {
          this.handleStateUpdate(payload.payload as StateUpdate);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Supabase Real-time connected');
            this.reconnectAttempts = 0;
            this._connected = true;
            this.fetchLatestState();
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Realtime channel error');
            this.handleDisconnect();
          } else if (status === 'TIMED_OUT') {
            console.warn('Realtime channel timed out');
            this.handleDisconnect();
          }
        });
    } catch (e) {
      console.error('Failed to initialize Supabase real-time:', e);
      this.handleDisconnect();
    }
  }

  private handleDisconnect() {
    this._connected = false;
    this.attemptReconnect();
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
      console.log(`Realtime reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.initRealtimeChannel(), delay);
    } else {
      console.warn('Max reconnection attempts reached — polling only');
      this.setupPolling();
    }
  }

  private setupPolling() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.pollingInterval = setInterval(() => {
      if (!this._connected) this.fetchLatestState();
    }, 3000);
  }

  // ─── FIX #3 ──────────────────────────────────────────────────────────────
  // fetchLatestState is fully wrapped in try/catch. For a brand-new Supabase
  // project with no tables, /api/config may return 404/500. We treat any
  // non-OK response as a soft failure — the app keeps running with whatever
  // is already in localStorage. Never throws.
  // ─────────────────────────────────────────────────────────────────────────
  private async fetchLatestState() {
    try {
      const response = await fetch('/api/config');
      if (!response.ok) {
        // Likely empty project / table not created yet — not a crash condition.
        console.warn(`fetchLatestState: /api/config returned ${response.status} — skipping`);
        return;
      }
      const data = await response.json();
      (['person', 'senders', 'theme', 'polaroids'] as StateType[]).forEach((type) => {
        if (data[type] !== undefined && data[type] !== null) {
          this.handleStateUpdate({
            type,
            data: data[type],
            timestamp: Date.now(),
            id: `poll-${Date.now()}-${type}`,
          });
        }
      });
    } catch (e) {
      // Network error, JSON parse error, or empty DB — swallow, keep running.
      console.warn('fetchLatestState: failed (empty DB or network error), continuing with localStorage:', e);
    }
  }

  private monitorConnection() {
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    this.monitorInterval = setInterval(() => {
      if (!this._connected && this.channel?.state === 'SUBSCRIBED') {
        this._connected = true;
        this.fetchLatestState();
      }
    }, 5000);
  }

  private getStateTypeFromKey(key: string): StateType | null {
    const mapping: { [key: string]: StateType } = {
      chaarYaarPerson: 'person',
      chaarYaarSenders: 'senders',
      chaarYaarTheme: 'theme',
      chaarYaarPolaroids: 'polaroids',
    };
    return mapping[key] || null;
  }

  private getKeyFromStateType(type: StateType): string {
    const mapping: { [key in StateType]: string } = {
      person: 'chaarYaarPerson',
      senders: 'chaarYaarSenders',
      theme: 'chaarYaarTheme',
      polaroids: 'chaarYaarPolaroids',
    };
    return mapping[type];
  }

  private handleStateUpdate(update: StateUpdate) {
    if (this.processedUpdateIds.has(update.id)) return;
    this.processedUpdateIds.add(update.id);

    if (this.processedUpdateIds.size > this.maxProcessedIds) {
      const arr = Array.from(this.processedUpdateIds);
      this.processedUpdateIds = new Set(arr.slice(-this.maxProcessedIds));
    }

    const key = this.getKeyFromStateType(update.type);
    try {
      localStorage.setItem(key, JSON.stringify(update.data));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }

    this.notifyListeners(update.type, update.data);
  }

  private notifyListeners(type: StateType, data: any) {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.forEach((listener) => {
        try { listener(data); } catch (e) {
          console.error('Error in state listener:', e);
        }
      });
    }
  }

  subscribe(type: StateType, listener: StateListener): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
    return () => { this.listeners.get(type)?.delete(listener); };
  }

  /**
   * Broadcast a state update to all connected clients.
   * Handles locally first (instant UI update), then sends to Supabase.
   * Never throws — Supabase failure is non-fatal.
   */
  async broadcast(type: StateType, data: any): Promise<void> {
    const update: StateUpdate = {
      type,
      data,
      timestamp: Date.now(),
      id: `${type}-${Date.now()}-${Math.random()}`,
    };

    // Local first — UI updates instantly regardless of network
    this.handleStateUpdate(update);

    // Remote — best-effort
    if (this.channel && this._connected) {
      try {
        await this.channel.send({
          type: 'broadcast',
          event: 'state_update',
          payload: update,
        });
      } catch (e) {
        console.warn('Supabase broadcast failed (non-fatal):', e);
      }
    }
  }

  /**
   * FIX #1: `_connected` (private field) is separate from this method.
   * Previously both had the same name `isConnected`, making the method
   * unreachable and causing "isConnected is not a function" at runtime.
   */
  isConnected(): boolean {
    try {
      return this._connected && this.channel?.state === 'SUBSCRIBED';
    } catch {
      return false;
    }
  }

  destroy() {
    if (this.channel) {
      try { this.channel.unsubscribe(); } catch (_) { /* ignore */ }
      this.channel = null;
    }
    if (this.pollingInterval) { clearInterval(this.pollingInterval); this.pollingInterval = null; }
    if (this.monitorInterval) { clearInterval(this.monitorInterval); this.monitorInterval = null; }
    this._connected = false;
    this.reconnectAttempts = 0;
    this.listeners.clear();
  }
}

export const realtimeSyncManager = new RealtimeSyncManager();
