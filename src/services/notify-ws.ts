export interface NotifyEvent {
  channel_id: string;
  ts: number;
  type: 'message' | 'mention';
}

export type NotifyEventHandler = (data: NotifyEvent) => void;
export type NotifyDisconnectHandler = (code: number, reason: string) => void;

export class NotifyWebSocket {
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatAckPending = false;

  onNotify: NotifyEventHandler | null = null;
  onDisconnect: NotifyDisconnectHandler | null = null;

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(url: string, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cleanup();
      const wsUrl = url.replace(/^http/, 'ws') + '/notify';
      this.ws = new WebSocket(wsUrl);

      let identified = false;
      const timeout = setTimeout(() => {
        if (!identified) {
          this.cleanup();
          reject(new Error('Notify WS connection timeout'));
        }
      }, 10000);

      this.ws.onopen = () => {
        this.send('system.identify', { token });
        identified = true;
        clearTimeout(timeout);
        resolve();
      };

      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data as string) as { event: string; data: unknown };

        if (msg.event === 'system.hello') {
          const hello = msg.data as { heartbeat_interval?: number };
          this.startHeartbeat(hello.heartbeat_interval ?? 30000);
          return;
        }

        if (msg.event === 'system.heartbeat_ack') {
          this.heartbeatAckPending = false;
          return;
        }

        if (msg.event === 'notify') {
          this.onNotify?.(msg.data as NotifyEvent);
        }
      };

      this.ws.onclose = (event) => {
        clearTimeout(timeout);
        this.stopHeartbeat();
        if (!identified) {
          reject(new Error(`Notify WS closed: ${event.code}`));
        }
        this.onDisconnect?.(event.code, event.reason);
      };

      this.ws.onerror = () => {};
    });
  }

  disconnect() {
    this.cleanup();
  }

  private send(event: string, data?: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data }));
    }
  }

  private startHeartbeat(interval: number) {
    this.stopHeartbeat();
    this.heartbeatAckPending = false;
    this.heartbeatTimer = setInterval(() => {
      if (this.heartbeatAckPending) {
        this.ws?.close(4009, 'Heartbeat timeout');
        return;
      }
      this.heartbeatAckPending = true;
      this.send('system.heartbeat');
    }, interval);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private cleanup() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }
}
