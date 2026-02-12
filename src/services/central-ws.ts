export class CentralWebSocket {
  private ws: WebSocket | null = null;

  connect(_url: string, _token: string) {
    // TODO: Connect to central WS for friend presence + DM delivery
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}

export const centralWs = new CentralWebSocket();
