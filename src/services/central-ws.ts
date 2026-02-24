export type CentralWsEventHandler = (event: string, data: unknown) => void;
export type CentralWsDisconnectHandler = (code: number, reason: string) => void;

export interface CentralReadyData {
  friends: unknown[];
  incoming_requests: unknown[];
  outgoing_requests: unknown[];
  presences: unknown[];
  pending_dms: unknown[];
  dm_read_states: unknown[];
  active_call: { call_id: string; peer: unknown; media_types: ('audio' | 'video')[] } | null;
  activity_unread_notifications?: number;
  activity_unread_server_dms?: number;
}

export class CentralWebSocket {
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatAckPending = false;
  private visibilityHandler: (() => void) | null = null;

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

        if (msg.event === 'system.error') {
          console.error('[central-ws:client] ← system.error from server:', JSON.stringify(msg.data));
        }

        // Dispatch events: friend.*, dm.*, call.*
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

  // Call helpers
  callInvite(targetUserId: string, mediaTypes: ('audio' | 'video')[]) {
    this.send('call.invite', { target_user_id: targetUserId, media_types: mediaTypes });
  }

  callAnswer(callId: string) {
    this.send('call.answer', { call_id: callId });
  }

  callReject(callId: string) {
    this.send('call.reject', { call_id: callId });
  }

  callEnd(callId: string) {
    this.send('call.end', { call_id: callId });
  }

  callConnectTransport(callId: string, transportId: string, dtlsParameters: unknown) {
    this.send('call.connect_transport', { call_id: callId, transport_id: transportId, dtls_parameters: dtlsParameters });
  }

  callProduce(callId: string, transportId: string, kind: 'audio' | 'video', rtpParameters: unknown, rtpCapabilities?: unknown) {
    this.send('call.produce', { call_id: callId, transport_id: transportId, kind, rtp_parameters: rtpParameters, rtpCapabilities });
  }

  callProduceStop(callId: string, producerId: string) {
    this.send('call.produce_stop', { call_id: callId, producer_id: producerId });
  }

  callProducerPause(callId: string, producerId: string) {
    this.send('call.producer_pause', { call_id: callId, producer_id: producerId });
  }

  callProducerResume(callId: string, producerId: string) {
    this.send('call.producer_resume', { call_id: callId, producer_id: producerId });
  }

  callConsumerResume(callId: string, consumerId: string) {
    this.send('call.consumer_resume', { call_id: callId, consumer_id: consumerId });
  }

  callMuteUpdate(callId: string, selfMute: boolean, selfDeaf: boolean, videoEnabled: boolean) {
    this.send('call.mute_update', { call_id: callId, self_mute: selfMute, self_deaf: selfDeaf, video_enabled: videoEnabled });
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

    this.visibilityHandler = () => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.heartbeatAckPending = false;
        this.send('system.heartbeat');
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
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
