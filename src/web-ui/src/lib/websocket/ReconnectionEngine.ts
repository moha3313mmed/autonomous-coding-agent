/**
 * ReconnectionEngine implements exponential backoff reconnection logic.
 * Formula: delay = min(1000 * 2^attempt, 30000)
 */
export type ReconnectCallback = () => void;

export class ReconnectionEngine {
  private attempt: number = 0;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private running: boolean = false;
  private reconnectCallback: ReconnectCallback;

  constructor(reconnectCallback: ReconnectCallback) {
    this.reconnectCallback = reconnectCallback;
  }

  /**
   * Start the reconnection loop. Schedules the first reconnection attempt.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleNext();
  }

  /**
   * Stop the reconnection loop and cancel any pending timer.
   */
  stop(): void {
    this.running = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Reset the attempt counter back to 0 (called on successful reconnection).
   */
  reset(): void {
    this.attempt = 0;
    this.stop();
  }

  /**
   * Get the current attempt count.
   */
  getAttemptCount(): number {
    return this.attempt;
  }

  /**
   * Calculate the next delay using exponential backoff formula.
   * Formula: min(1000 * 2^attempt, 30000)
   */
  getNextDelay(): number {
    return Math.min(1000 * Math.pow(2, this.attempt), 30000);
  }

  private scheduleNext(): void {
    if (!this.running) return;

    const delay = this.getNextDelay();
    this.timerId = setTimeout(() => {
      if (!this.running) return;
      this.attempt++;
      this.reconnectCallback();
      // Schedule next attempt in case this one fails
      this.scheduleNext();
    }, delay);
  }
}
