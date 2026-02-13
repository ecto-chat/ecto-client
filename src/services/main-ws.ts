import { PROTOCOL_VERSION, HEARTBEAT_INTERVAL, WsCloseCode } from 'ecto-shared';
import type { WsMessage, SystemHelloPayload, SystemReadyPayload } from 'ecto-shared';

export type MainWsEventHandler = (event: string, data: unknown, seq: number) => void;
export type MainWsDisconnectHandler = (code: number, reason: string) => void;
export type MainWsReadyHandler = (data: SystemReadyPayload) => void;

export class MainWebSocket {
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatAckPending = false;
  private _lastSeq = 0;
  private _sessionId: string | null = null;
  private typingTimers = new Map<string, number>();

  onEvent: MainWsEventHandler | null = null;
  onDisconnect: MainWsDisconnectHandler | null = null;
  onReady: MainWsReadyHandler | null = null;

  get lastSeq() {
    return this._lastSeq;
  }
  get sessionId() {
    return this._sessionId;
  }
  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(url: string, token: string): Promise<SystemReadyPayload> {
    return new Promise((resolve, reject) => {
      this.cleanup();
      const wsUrl = url.replace(/^http/, 'ws') + '/ws';
      this.ws = new WebSocket(wsUrl);

      let identified = false;
      const timeout = setTimeout(() => {
        if (!identified) {
          this.cleanup();
          reject(new Error('Connection timeout'));
        }
      }, 15000);

      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data as string) as WsMessage<unknown>;

        if (msg.event === 'system.hello') {
          const hello = msg.data as SystemHelloPayload;
          this.startHeartbeat(hello.heartbeat_interval ?? HEARTBEAT_INTERVAL);
          this.send('system.identify', { token, protocol_version: PROTOCOL_VERSION });
          return;
        }

        if (msg.event === 'system.ready') {
          identified = true;
          clearTimeout(timeout);
          const ready = msg.data as SystemReadyPayload;
          this._sessionId = ready.session_id;
          this.onReady?.(ready);
          resolve(ready);
          return;
        }

        if (msg.event === 'system.heartbeat_ack') {
          this.heartbeatAckPending = false;
          return;
        }

        if (msg.event === 'system.resumed') {
          identified = true;
          clearTimeout(timeout);
          return;
        }

        if (msg.event === 'system.error') {
          const errData = msg.data as { code: number; message: string };
          if (!identified) {
            clearTimeout(timeout);
            this.cleanup();
            reject(new Error(`WS error ${errData.code}: ${errData.message}`));
          }
          return;
        }

        // Dispatch events have seq numbers
        if (msg.seq !== undefined) {
          this._lastSeq = msg.seq;
        }
        this.onEvent?.(msg.event, msg.data, msg.seq ?? 0);
      };

      this.ws.onclose = (event) => {
        clearTimeout(timeout);
        this.stopHeartbeat();
        if (!identified) {
          reject(new Error(`Connection closed: ${event.code} ${event.reason}`));
        }
        this.onDisconnect?.(event.code, event.reason);
      };

      this.ws.onerror = () => {
        // onclose will fire after this
      };
    });
  }

  resume(url: string, token: string, lastSeq: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cleanup();
      const wsUrl = url.replace(/^http/, 'ws') + '/ws';
      this.ws = new WebSocket(wsUrl);

      let resumed = false;
      const timeout = setTimeout(() => {
        if (!resumed) {
          this.cleanup();
          reject(new Error('Resume timeout'));
        }
      }, 15000);

      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data as string) as WsMessage<unknown>;

        if (msg.event === 'system.hello') {
          const hello = msg.data as SystemHelloPayload;
          this.startHeartbeat(hello.heartbeat_interval ?? HEARTBEAT_INTERVAL);
          this.send('system.resume', { token, last_seq: lastSeq });
          return;
        }

        if (msg.event === 'system.resumed') {
          resumed = true;
          clearTimeout(timeout);
          resolve();
          return;
        }

        if (msg.event === 'system.heartbeat_ack') {
          this.heartbeatAckPending = false;
          return;
        }

        if (msg.event === 'system.error') {
          const errData = msg.data as { code: number; message: string };
          if (!resumed) {
            clearTimeout(timeout);
            this.cleanup();
            reject(new Error(`Resume error ${errData.code}: ${errData.message}`));
          }
          return;
        }

        // Replayed dispatch events
        if (msg.seq !== undefined) {
          this._lastSeq = msg.seq;
        }
        this.onEvent?.(msg.event, msg.data, msg.seq ?? 0);
      };

      this.ws.onclose = (event) => {
        clearTimeout(timeout);
        this.stopHeartbeat();
        if (!resumed) {
          reject(new Error(`Resume closed: ${event.code}`));
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

  subscribe(channelId: string) {
    this.send('subscribe', { channel_id: channelId });
  }

  unsubscribe(channelId: string) {
    this.send('unsubscribe', { channel_id: channelId });
  }

  sendTyping(channelId: string) {
    const now = Date.now();
    const last = this.typingTimers.get(channelId) ?? 0;
    if (now - last < 5000) return;
    this.typingTimers.set(channelId, now);
    this.send('typing.start', { channel_id: channelId });
  }

  updatePresence(status: string, customText?: string) {
    this.send('presence.update', { status, custom_text: customText });
  }

  voiceJoin(channelId: string) {
    this.send('voice.join', { channel_id: channelId });
  }

  voiceLeave(channelId: string) {
    this.send('voice.leave', { channel_id: channelId });
  }

  voiceMute(selfMute: boolean, selfDeaf: boolean) {
    this.send('voice.mute', { self_mute: selfMute, self_deaf: selfDeaf });
  }

  voiceCapabilities(rtpCapabilities: unknown) {
    this.send('voice.capabilities', { rtp_capabilities: rtpCapabilities });
  }

  voiceConnectTransport(transportId: string, dtlsParameters: unknown) {
    this.send('voice.connect_transport', { transport_id: transportId, dtls_parameters: dtlsParameters });
  }

  voiceProduce(transportId: string, kind: 'audio' | 'video', rtpParameters: unknown, source?: string) {
    this.send('voice.produce', { transport_id: transportId, kind, rtp_parameters: rtpParameters, source });
  }

  voiceProducerPause(producerId: string) {
    this.send('voice.producer_pause', { producer_id: producerId });
  }

  voiceProducerResume(producerId: string) {
    this.send('voice.producer_resume', { producer_id: producerId });
  }

  voiceConsumerResume(consumerId: string) {
    this.send('voice.consumer_resume', { consumer_id: consumerId });
  }

  voiceProduceStop(producerId: string) {
    this.send('voice.produce_stop', { producer_id: producerId });
  }

  disconnect() {
    this.cleanup();
  }

  isAuthFailure(code: number): boolean {
    return code === WsCloseCode.NOT_AUTHENTICATED || code === WsCloseCode.AUTHENTICATION_FAILED;
  }

  isSessionExpired(code: number): boolean {
    return code === WsCloseCode.SESSION_EXPIRED;
  }

  isServerShutdown(code: number): boolean {
    return code === WsCloseCode.SERVER_SHUTTING_DOWN;
  }

  isInvalidSequence(code: number): boolean {
    return code === WsCloseCode.INVALID_SEQUENCE;
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
    this.typingTimers.clear();
  }
}
