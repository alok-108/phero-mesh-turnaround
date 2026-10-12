// Web Locks API Master Shard Election Manager

export type LeaderChangeCallback = (isLeader: boolean) => void;

class LeaderLockManager {
  private isLeader = false;
  private releaseLock: (() => void) | null = null;
  private callbacks: Set<LeaderChangeCallback> = new Set();
  private abortController: AbortController | null = null;

  public subscribe(cb: LeaderChangeCallback): () => void {
    this.callbacks.add(cb);
    cb(this.isLeader);
    return () => this.callbacks.delete(cb);
  }

  public get isCurrentLeader(): boolean {
    return this.isLeader;
  }

  public startElection(): void {
    if (typeof navigator === 'undefined' || !navigator.locks) {
      console.warn('[LeaderLock] navigator.locks unavailable. Defaulting to local standalone leader.');
      this.setLeader(true);
      return;
    }

    this.abortController = new AbortController();

    // Request the exclusive master lock
    navigator.locks.request(
      'ramp_swarm_master',
      { signal: this.abortController.signal },
      async () => {
        // Acquired lock: this tab is now master
        this.setLeader(true);

        return new Promise<void>((resolve) => {
          this.releaseLock = () => {
            this.setLeader(false);
            resolve();
          };
        });
      }
    ).catch((err) => {
      if (err.name !== 'AbortError') {
        console.warn('[LeaderLock] Lock election error:', err);
      }
      this.setLeader(false);
    });
  }

  public stopElection(): void {
    if (this.releaseLock) {
      this.releaseLock();
      this.releaseLock = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.setLeader(false);
  }

  private setLeader(leader: boolean): void {
    if (this.isLeader !== leader) {
      this.isLeader = leader;
      this.callbacks.forEach((cb) => cb(leader));
    }
  }
}

export const leaderLockManager = new LeaderLockManager();
