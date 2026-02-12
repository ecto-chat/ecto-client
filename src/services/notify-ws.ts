export class NotifyWebSocket {
  private ws: WebSocket | null = null;

  connect(_url: string, _token: string) {
    // TODO: Connect, identify, receive lightweight notifications
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}
