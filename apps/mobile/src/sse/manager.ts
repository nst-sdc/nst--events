import EventSource from 'react-native-sse';

type SSECallback = (data: any) => void;

export class SSEManager {
  private url: string;
  private token: string;
  private eventSource: EventSource | null = null;
  private reconnectAttempt: number = 0;
  private lastEventId: string | null = null;
  private heartbeatTimeout: any = null;
  private listeners: Map<string, SSECallback[]> = new Map();

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  connect() {
    if (this.eventSource) return;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
    };

    if (this.lastEventId) {
      headers['Last-Event-ID'] = this.lastEventId;
    }

    this.eventSource = new EventSource(this.url, { headers });

    this.eventSource.addEventListener('open', () => {
      this.reconnectAttempt = 0;
      this.resetHeartbeatTimeout();
      this.listeners.get('open')?.forEach((cb) => cb({}));
    });

    this.eventSource.addEventListener('heartbeat' as any, () => {
      this.resetHeartbeatTimeout();
      this.listeners.get('heartbeat')?.forEach((cb) => cb({}));
    });

    this.eventSource.addEventListener('message', (e: any) => {
      if (e.lastEventId) {
        this.lastEventId = e.lastEventId;
      }
      this.resetHeartbeatTimeout();

      try {
        const parsed = typeof e.data === 'string' ? JSON.parse(e.data || '{}') : (e.data || {});
        // 1. Dispatch to general 'message' listeners
        this.listeners.get('message')?.forEach((cb) => cb(parsed));

        // 2. Dispatch to type-specific listeners (e.g. NOTIFICATION_CREATED, NOTIFICATION_READ, registration_count)
        if (parsed.type && this.listeners.has(parsed.type)) {
          this.listeners.get(parsed.type)?.forEach((cb) => cb(parsed));
        }
      } catch (err) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn('SSE message parse error:', err);
        }
      }
    });

    // Attach named event listeners for any pre-registered events
    for (const [eventName] of this.listeners.entries()) {
      if (eventName !== 'message' && eventName !== 'open' && eventName !== 'error' && eventName !== 'heartbeat') {
        this.eventSource.addEventListener(eventName as any, (e: any) => {
          if (e.lastEventId) this.lastEventId = e.lastEventId;
          this.resetHeartbeatTimeout();
          try {
            const parsed = typeof e.data === 'string' ? JSON.parse(e.data || '{}') : (e.data || {});
            this.listeners.get(eventName)?.forEach((cb) => cb(parsed));
          } catch (err) {
            if (typeof __DEV__ !== 'undefined' && __DEV__) {
              console.warn(`SSE ${eventName} parse error:`, err);
            }
          }
        });
      }
    }

    this.eventSource.addEventListener('error', (e: any) => {
      this.disconnect();
      this.scheduleReconnect();
    });
  }

  private resetHeartbeatTimeout() {
    if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
    this.heartbeatTimeout = setTimeout(() => {
      this.disconnect();
      this.scheduleReconnect();
    }, 65000); // 65 seconds
  }

  private scheduleReconnect() {
    // delay = min(2000 * (2^attempt), 30000) + jitter(0–1000ms)
    const baseDelay = Math.min(2000 * Math.pow(2, this.reconnectAttempt), 30000);
    const jitter = Math.floor(Math.random() * 1000);
    const totalDelay = baseDelay + jitter;

    this.reconnectAttempt++;

    setTimeout(() => {
      this.connect();
    }, totalDelay);
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.removeAllEventListeners();
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  on(event: string, callback: SSECallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
      if (this.eventSource && event !== 'message' && event !== 'open' && event !== 'error' && event !== 'heartbeat') {
        this.eventSource.addEventListener(event as any, (e: any) => {
          if (e.lastEventId) this.lastEventId = e.lastEventId;
          this.resetHeartbeatTimeout();
          try {
            const parsed = typeof e.data === 'string' ? JSON.parse(e.data || '{}') : (e.data || {});
            this.listeners.get(event)?.forEach((cb) => cb(parsed));
          } catch (err) {
            if (typeof __DEV__ !== 'undefined' && __DEV__) {
              console.warn(`SSE ${event} parse error:`, err);
            }
          }
        });
      }
    }
    this.listeners.get(event)?.push(callback);
  }

  off(event: string, callback?: SSECallback) {
    if (!this.listeners.has(event)) return;
    if (callback) {
      const filtered = this.listeners.get(event)!.filter((cb) => cb !== callback);
      if (filtered.length > 0) {
        this.listeners.set(event, filtered);
      } else {
        this.listeners.delete(event);
      }
    } else {
      this.listeners.delete(event);
    }
  }
}
