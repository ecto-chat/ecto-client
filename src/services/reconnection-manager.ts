export class ReconnectionManager {
  private reconnectAttempts = new Map<string, number>();
  private retryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  scheduleReconnect(key: string, reconnectFn: () => Promise<void>) {
    const attempts = this.reconnectAttempts.get(key) ?? 0;
    const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
    this.reconnectAttempts.set(key, attempts + 1);
    setTimeout(() => reconnectFn(), delay);
  }

  resetAttempts(key: string) {
    this.reconnectAttempts.delete(key);
  }

  getAttempts(key: string): number {
    return this.reconnectAttempts.get(key) ?? 0;
  }

  startServerRetry(
    address: string,
    probeFn: () => Promise<void>,
  ): void {
    if (this.retryTimers.has(address)) return;

    const intervalId = setInterval(() => {
      probeFn().catch(() => {});
    }, 5000);

    this.retryTimers.set(address, intervalId);
  }

  stopServerRetry(address: string): void {
    const timer = this.retryTimers.get(address);
    if (timer) {
      clearInterval(timer);
      this.retryTimers.delete(address);
    }
  }

  stopAllRetries(): void {
    for (const timer of this.retryTimers.values()) {
      clearInterval(timer);
    }
    this.retryTimers.clear();
  }
}
