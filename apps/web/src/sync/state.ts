export type UiSyncState =
  | 'Tersinkron'
  | `Menunggu sinkron (${number})`
  | 'Server tidak terjangkau (Tailscale aktif?)'
  | 'Jam perangkat tidak akurat (>5 menit)';

export type SyncErrorCode = 'SERVER_UNREACHABLE' | 'CLOCK_SKEW' | 'UNAUTHORIZED' | null;

export class SyncStateMachine {
  private state: UiSyncState = 'Tersinkron';
  private error: SyncErrorCode = null;
  private pendingCount = 0;
  private listeners: Array<(state: UiSyncState) => void> = [];

  constructor(initialPending = 0) {
    this.update(initialPending);
  }

  public getState(): UiSyncState {
    return this.state;
  }

  public getPendingCount(): number {
    return this.pendingCount;
  }

  public getError(): SyncErrorCode {
    return this.error;
  }

  public setError(error: 'SERVER_UNREACHABLE' | 'CLOCK_SKEW' | 'UNAUTHORIZED'): void {
    this.error = error;
    if (error === 'SERVER_UNREACHABLE') {
      this.transition('Server tidak terjangkau (Tailscale aktif?)');
    } else if (error === 'CLOCK_SKEW') {
      this.transition('Jam perangkat tidak akurat (>5 menit)');
    } else {
      this.update(this.pendingCount);
    }
  }

  public clearError(): void {
    this.error = null;
    this.update(this.pendingCount);
  }

  public update(pendingCount: number): void {
    this.pendingCount = pendingCount;
    if (this.error === 'SERVER_UNREACHABLE') {
      this.transition('Server tidak terjangkau (Tailscale aktif?)');
    } else if (this.error === 'CLOCK_SKEW') {
      this.transition('Jam perangkat tidak akurat (>5 menit)');
    } else if (pendingCount > 0) {
      this.transition(`Menunggu sinkron (${pendingCount})`);
    } else {
      this.transition('Tersinkron');
    }
  }

  public subscribe(listener: (state: UiSyncState) => void): () => void {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private transition(newState: UiSyncState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.notify();
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
