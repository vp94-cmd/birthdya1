import { supabase } from '../supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

type StateType = 'person' | 'senders' | 'theme' | 'polaroids';
type StateListener = (data: any) => void;

interface StateUpdate {
  type: StateType;
  data: any;
  timestamp: number;
  id: string;
}

// The singleton row that holds all config in the DB
const CONFIG_ROW_ID = 1;

class RealtimeSyncManager {
  private channel: RealtimeChannel | null = null;
  private listeners: Map<StateType, Set<StateListener>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private processedUpdateIds: Set<string> = new Set();
  private maxProcessedIds = 100;
  private _connected = false;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private monitorInterval: ReturnType<typeof setInterval> | null = null;
  private resetIntroListeners: Set<() => void> = new Set();

  constructor() {
    if (!supabase) {
      console.warn('RealtimeSyncManager: Supabase unavailable — polling only.');
      this.setupPolling();
      return;
    }
    this.initRealtimeChannel();
    this.setupPolling();
    this.monitorConnection();
  }

  private initRealtimeChannel() {
    if (!supabase) return;
    if (this.channel) {
      try { this.channel.unsubscribe(); } catch (_) {}
      this.channel = null;
    }
    try {
      this.channel = supabase.channel('birthday_state_updates', {
        config: { broadcast: { self: false } },
      });
      this.channel
        .on('broadcast', { event: 'state_update' }, (payload) => {
          this.handleStateUpdate(payload.payload as StateUpdate);
        })
        .on('broadcast', { event: 'reset_intro' }, () => {
          this.notifyResetIntroListeners();
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Supabase Real-time connected');
            this.reconnectAttempts = 0;
            this._connected = true;
            this.fetchLatestState();
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Channel error');
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

  /**
   * FIX #2: Reads from the Supabase `site_config` table (row id=1).
   * The original code called fetch('/api/config') which doesn't exist on
   * Netlify (static hosting), causing a silent 404 on every poll.
   */
  private async fetchLatestState() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('site_config')
        .select('person, senders, theme, polaroids')
        .eq('id', CONFIG_ROW_ID)
        .single();

      if (error) {
        // PGRST116 = "no rows found" — DB is empty, not a real error
        if (error.code !== 'PGRST116') {
          console.warn('fetchLatestState: Supabase query failed:', error.message);
        }
        return;
      }
      if (!data) return;

      (['person', 'senders', 'theme', 'polaroids'] as StateType[]).forEach((type) => {
        const raw = data[type as keyof typeof data];
        if (raw === undefined || raw === null) return;
        try {
          // DB stores JSON as TEXT — parse it.
          // If the column were jsonb it would already be an object; handle both.
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          this.handleStateUpdate({
            type,
            data: parsed,
            timestamp: Date.now(),
            id: `db-fetch-${Date.now()}-${type}`,
          });
        } catch (e) {
          // JSON.parse fails for plain strings like theme: 'classic' (stored without JSON.stringify).
          // Fall back to the raw value so theme is applied instead of being silently dropped.
          console.warn(`fetchLatestState: "${type}" is not valid JSON — using raw value.`, e);
          this.handleStateUpdate({
            type,
            data: raw,
            timestamp: Date.now(),
            id: `db-fetch-fallback-${Date.now()}-${type}`,
          });
        }
      });
    } catch (e) {
      console.warn('fetchLatestState: unexpected error:', e);
    }
  }

  /**
   * FIX #3: Persist the full config object to the Supabase `site_config`
   * table in a single atomic UPDATE.
   *
   * Previously there was NO database write anywhere — only localStorage +
   * ephemeral Realtime broadcast — so data was lost on every page refresh.
   *
   * Called by globalStateManager.saveConfig() from AdminPanel's handleSave.
   */
  async saveToDatabase(config: {
    person: any;
    senders: any;
    theme: string;
    polaroids: any;
  }): Promise<void> {
    if (!supabase) {
      console.warn('saveToDatabase: Supabase unavailable — DB write skipped.');
      return;
    }

    const { error } = await supabase
      .from('site_config')
      .update({
        person:   JSON.stringify(config.person),
        senders:  JSON.stringify(config.senders),
        theme:    config.theme,
        polaroids: JSON.stringify(config.polaroids),
      })
      .eq('id', CONFIG_ROW_ID);

    if (error) {
      console.error('saveToDatabase failed:', error.message);
      throw new Error(`DB save failed: ${error.message}`);
    }

    console.log('✅ Config saved to Supabase database');
  }

  private monitorConnection() {
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    this.monitorInterval = setInterval(() => {
      // FIX #1 (partial): Only use this._connected — do NOT check channel.state here.
      if (!this._connected && this.channel) {
        this.fetchLatestState();
      }
    }, 5000);
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

  private getKeyFromStateType(type: StateType): string {
    const mapping: { [key in StateType]: string } = {
      person:   'chaarYaarPerson',
      senders:  'chaarYaarSenders',
      theme:    'chaarYaarTheme',
      polaroids: 'chaarYaarPolaroids',
    };
    return mapping[type];
  }

  subscribe(type: StateType, listener: StateListener): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
    return () => { this.listeners.get(type)?.delete(listener); };
  }

  async broadcast(type: StateType, data: any): Promise<void> {
    const update: StateUpdate = {
      type,
      data,
      timestamp: Date.now(),
      id: `${type}-${Date.now()}-${Math.random()}`,
    };
    this.handleStateUpdate(update);
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
   * Subscribe to reset_intro commands from admin.
   * Called by App.tsx so all clients react when admin clicks Reset Intro.
   */
  subscribeResetIntro(callback: () => void): () => void {
    this.resetIntroListeners.add(callback);
    return () => { this.resetIntroListeners.delete(callback); };
  }

  private notifyResetIntroListeners() {
    this.resetIntroListeners.forEach(cb => {
      try { cb(); } catch (e) { console.error('Error in resetIntro listener:', e); }
    });
  }

  /**
   * Broadcast reset_intro command to all connected clients.
   * Called by admin when they click "Reset Intro".
   */
  async broadcastResetIntro(): Promise<void> {
    if (this.channel && this._connected) {
      try {
        await this.channel.send({
          type: 'broadcast',
          event: 'reset_intro',
          payload: { timestamp: Date.now() },
        });
        console.log('✅ Reset intro broadcast sent to all clients');
      } catch (e) {
        console.warn('broadcastResetIntro failed (non-fatal):', e);
      }
    } else {
      console.warn('broadcastResetIntro: not connected, only local reset applied');
    }
  }

  /**
   * FIX #1: Removed `&& this.channel?.state === 'SUBSCRIBED'`
   *
   * Root cause of "Offline Mode" always showing:
   * `channel.state` is a Phoenix internal property with values like 'joined',
   * 'joining', 'leaving', 'closed' — NOT the Supabase status string 'SUBSCRIBED'.
   * The second condition was ALWAYS false, making isConnected() always return
   * false even when fully connected. Fix: rely solely on this._connected, which
   * is set correctly in the subscribe() callback above.
   */
  isConnected(): boolean {
    return this._connected;
  }

  destroy() {
    if (this.channel) {
      try { this.channel.unsubscribe(); } catch (_) {}
      this.channel = null;
    }
    if (this.pollingInterval) { clearInterval(this.pollingInterval); this.pollingInterval = null; }
    if (this.monitorInterval) { clearInterval(this.monitorInterval); this.monitorInterval = null; }
    this._connected = false;
    this.reconnectAttempts = 0;
    this.listeners.clear();
    this.resetIntroListeners.clear();
  }
}

export const realtimeSyncManager = new RealtimeSyncManager();
