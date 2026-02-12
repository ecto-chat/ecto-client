export type CentralWsEventHandler = (event: string, data: unknown) => void;
export type CentralWsDisconnectHandler = (code: number, reason: string) => void;

export interface CentralReadyData {
  friends: unknown[];
  incoming_requests: unknown[];
  presences: unknown[];
  pending_dms: unknown[];
  dm_read_states: unknown[];
}

export class CentralWebSocket {
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatAckPending = false;

  onEvent: CentralWsEventHandler | null = null;
  onDisconnect: CentralWsDisconnectHandler | null = null;
  onReady: ((data: CentralReadyData) => void) | null = null;

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(url: string, token: string): Promise<CentralReadyData> {
    return new Promise((resolve, reject) => {
      this.cleanup();
      const wsUrl = url.replace(/^http/, 'ws') + '/ws';
      this.ws = new WebSocket(wsUrl);

      let identified = false;
      const timeout = setTimeout(() => {
        if (!identified) {
          this.cleanup();
          reject(new Error('Central WS connection timeout'));
        }
      }, 15000);

      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data as string) as { event: string; data: unknown };

        if (msg.event === 'system.hello') {
          const hello = msg.data as { heartbeat_interval?: number };
          this.startHeartbeat(hello.heartbeat_interval ?? 30000);
          this.send('system.identify', { token });
          return;
        }

        if (msg.event === 'system.ready') {
          identified = true;
          clearTimeout(timeout);
          const ready = msg.data as CentralReadyData;
          this.onReady?.(ready);
          resolve(ready);
          return;
        }

        if (msg.event === 'system.heartbeat_ack') {
          this.heartbeatAckPending = false;
          return;
        }

        // Dispatch events: friend.*, dm.*
        this.onEvent?.(msg.event, msg.data);
      };

      this.ws.onclose = (event) => {
        clearTimeout(timeout);
        this.stopHeartbeat();
        if (!identified) {
          reject(new Error(`Central WS closed: ${event.code}`));
        }
        this.onDisconnect?.(event.code, event.reason);
      };

      this.ws.onerror = () => {};
    });
  }

  send(event: string, data?: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data }));
    }
  }

  updatePresence(status: string, customText?: string) {
    this.send('presence.update', { status, custom_text: customText });
  }

  sendDmTyping(recipientId: string) {
    this.send('dm.typing', { recipient_id: recipientId });
  }

  disconnect() {
    this.cleanup();
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
