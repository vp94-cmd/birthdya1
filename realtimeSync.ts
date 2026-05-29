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
  // FIX #1: Renamed from `isConnected` to `_connected` to avoid collision with
  // the public `isConnected()` method. Previously, `this.isConnected()` would
  // throw "false is not a function" at runtime (and fail to compile in TS).
  private _connected = false;
  // FIX #7: Use ReturnType<typeof setInterval> instead of NodeJS.Timeout
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  // FIX #4: Store monitorConnection interval so destroy() can clear it
  private monitorInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // FIX #2: Guard against null supabase (env vars missing) before any channel call
    if (!supabase) {
      console.warn(
        'RealtimeSyncManager: Supabase client unavailable — real-time disabled, polling only.'
      );
      // Still start polling so state stays fresh via /api/config
      this.setupPolling();
      return;
    }
    this.initRealtimeChannel();
    // FIX #5: Storage listener REMOVED from here. globalStateManager already listens
    // to window.storage as its cross-tab fallback. Having both listen caused every
    // cross-tab storage event to fire the notification chain twice.
    this.setupPolling();
    this.monitorConnection();
  }

  private initRealtimeChannel() {
    if (!supabase) return;

    // FIX #3: Unsubscribe and discard the old channel before creating a new one.
    // Without this, every reconnect attempt stacked up additional live channels,
    // each independently firing duplicate events.
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }

    try {
      // FIX #8: self: false — we call handleStateUpdate() locally ourselves inside
      // broadcast(), so there's no need for Supabase to echo our own messages back.
      this.channel = supabase.channel('birthday_state_updates', {
        config: {
          broadcast: { self: false },
        },
      });

      this.channel
        .on('broadcast', { event: 'state_update' }, (payload) => {
          const update = payload.payload as StateUpdate;
          this.handleStateUpdate(update);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Supabase Real-time connected');
            this.reconnectAttempts = 0;
            this._connected = true;
            this.fetchLatestState();
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Channel error:', status);
            this.handleDisconnect();
          } else if (status === 'TIMED_OUT') {
            console.warn('Channel timed out');
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
    console.log('Real-time sync disconnected, attempting reconnect...');
    this.attemptReconnect();
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
      console.log(`Reconnecting in ${Math.round(delay)}ms... (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.initRealtimeChannel(), delay);
    } else {
      console.warn('Max reconnection attempts reached, relying on polling');
      // setupPolling() is already running from the constructor; calling it here
      // just resets its interval, which is harmless.
      this.setupPolling();
    }
  }

  private setupPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(() => {
      if (!this._connected) {
        this.fetchLatestState();
      }
    }, 3000);
  }

  private async fetchLatestState() {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        (['person', 'senders', 'theme', 'polaroids'] as StateType[]).forEach((type) => {
          if (data[type]) {
            this.handleStateUpdate({
              type,
              data: data[type],
              timestamp: Date.now(),
              id: `poll-${Date.now()}-${type}`,
            });
          }
        });
      }
    } catch (e) {
      console.error('Failed to fetch latest state:', e);
    }
  }

  private monitorConnection() {
    // FIX #4: Store the interval reference so destroy() can clear it
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

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
    // Prevent duplicate processing (guards against rapid poll results with same id)
    if (this.processedUpdateIds.has(update.id)) {
      return;
    }

    this.processedUpdateIds.add(update.id);

    // Keep processed ID set bounded
    if (this.processedUpdateIds.size > this.maxProcessedIds) {
      const idsArray = Array.from(this.processedUpdateIds);
      this.processedUpdateIds = new Set(idsArray.slice(-this.maxProcessedIds));
    }

    // Persist to localStorage
    const key = this.getKeyFromStateType(update.type);
    try {
      localStorage.setItem(key, JSON.stringify(update.data));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }

    // Notify all subscribers (globalStateManager's setupRealtimeSync callbacks live here)
    this.notifyListeners(update.type, update.data);
  }

  private notifyListeners(type: StateType, data: any) {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.forEach((listener) => {
        try {
          listener(data);
        } catch (e) {
          console.error('Error in state listener:', e);
        }
      });
    }
  }

  /**
   * Subscribe to state changes for a specific type.
   * Returns an unsubscribe function for cleanup.
   */
  subscribe(type: StateType, listener: StateListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);

    return () => {
      this.listeners.get(type)?.delete(listener);
    };
  }

  /**
   * Broadcast a state update to all connected clients via Supabase Realtime.
   * Always handles locally first so the sending tab's UI updates instantly,
   * then sends to remote clients. Never throws — Supabase failure is non-fatal.
   */
  async broadcast(type: StateType, data: any): Promise<void> {
    const update: StateUpdate = {
      type,
      data,
      timestamp: Date.now(),
      id: `${type}-${Date.now()}-${Math.random()}`,
    };

    // 1. Handle locally first — instant UI update regardless of Supabase latency
    this.handleStateUpdate(update);

    // 2. Broadcast to remote clients (best-effort, non-throwing)
    if (this.channel && this._connected) {
      try {
        await this.channel.send({
          type: 'broadcast',
          event: 'state_update',
          payload: update,
        });
      } catch (e) {
        // Non-fatal: local update already done, localStorage written, polling will sync
        console.warn('Failed to broadcast via Supabase:', e);
      }
    }
  }

  /**
   * Returns true if the Supabase channel is actively subscribed.
   * FIX #1: Uses `_connected` (private field) to avoid the name collision
   * with this method that caused a TypeScript compilation error.
   */
  isConnected(): boolean {
    return this._connected && this.channel?.state === 'SUBSCRIBED';
  }

  /**
   * Clean up all resources. Safe to call multiple times.
   */
  destroy() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    // FIX #4: Clear the monitor interval that was previously leaked
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this._connected = false;
    this.reconnectAttempts = 0;
    this.listeners.clear();
  }
}

// Singleton instance
export const realtimeSyncManager = new RealtimeSyncManager();
