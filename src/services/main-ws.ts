export class MainWebSocket {
  private ws: WebSocket | null = null;

  connect(_url: string, _token: string) {
    // TODO: Connect, identify, handle events
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }

  send(_event: string, _data: unknown) {
    // TODO
  }
}
