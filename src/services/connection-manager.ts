export class ConnectionManager {
  // TODO: Manage connections to multiple servers
  // Active server gets Main WS, background servers get Notify WS

  connectToServer(_address: string, _token: string) {
    // TODO
  }

  disconnectFromServer(_address: string) {
    // TODO
  }
}

export const connectionManager = new ConnectionManager();
