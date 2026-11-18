import { pgListener } from './pg-listener';
import { buildEventChannel, buildUserNotificationChannel } from './sse.utils';

export interface ChannelListener {
  listen(channel: string): Promise<void>;
  unlisten(channel: string): Promise<void>;
}

export interface ChannelSubscription {
  readonly channel: string;
  readonly ready: Promise<void>;
  release: () => Promise<void>;
}

interface PendingSubscription {
  released: boolean;
}

interface ChannelState {
  refCount: number;
  listenPromise: Promise<void> | null;
  isListened: boolean;
  opChain: Promise<void>;
  pendingSubs: Set<PendingSubscription>;
}

export class SSEConnectionManager {
  private channels: Map<string, ChannelState> = new Map();
  private readonly listener: ChannelListener;

  constructor(listener: ChannelListener = pgListener) {
    this.listener = listener;
  }

  private decrementChannel(channel: string, targetState: ChannelState): Promise<void> {
    if (targetState.refCount <= 0) {
      return Promise.resolve();
    }

    targetState.refCount -= 1;

    // Keep channel active while other subscribers remain connected
    if (targetState.refCount > 0) {
      return Promise.resolve();
    }

    const teardownPromise = targetState.opChain.then(async () => {
      // Re-check refCount after prior ops settle: a new subscriber may have joined concurrently
      if (targetState.refCount > 0) {
        return;
      }

      if (targetState.isListened) {
        targetState.isListened = false;
        try {
          await this.listener.unlisten(channel);
        } finally {
          if (
            targetState.refCount === 0 &&
            !targetState.listenPromise &&
            this.channels.get(channel) === targetState
          ) {
            this.channels.delete(channel);
          }
        }
      } else if (
        targetState.refCount === 0 &&
        !targetState.listenPromise &&
        this.channels.get(channel) === targetState
      ) {
        this.channels.delete(channel);
      }
    });

    targetState.opChain = teardownPromise.then(
      () => undefined,
      () => undefined
    );

    return teardownPromise;
  }

  private acquireChannel(channel: string): ChannelSubscription {
    let state = this.channels.get(channel);
    if (!state) {
      state = {
        refCount: 0,
        listenPromise: null,
        isListened: false,
        opChain: Promise.resolve(),
        pendingSubs: new Set(),
      };
      this.channels.set(channel, state);
    }

    const targetState = state;
    const sub: PendingSubscription = { released: false };

    // Increment refCount synchronously BEFORE any await to prevent concurrent first-subscriber races
    targetState.refCount += 1;

    const release = (): Promise<void> => {
      if (sub.released) {
        return Promise.resolve();
      }
      sub.released = true;
      targetState.pendingSubs.delete(sub);
      return this.decrementChannel(channel, targetState);
    };

    if (targetState.isListened) {
      return { channel, ready: Promise.resolve(), release };
    }

    targetState.pendingSubs.add(sub);

    // Share one single-flight LISTEN initialization across concurrent first-time subscribers
    if (!targetState.listenPromise) {
      const initPromise = targetState.opChain
        .then(() => {
          // If all subscribers already disconnected before listen began, skip LISTEN
          if (targetState.refCount <= 0) {
            return;
          }
          return this.listener.listen(channel).then(() => {
            targetState.isListened = true;
          });
        })
        .finally(() => {
          if (targetState.listenPromise === initPromise) {
            targetState.listenPromise = null;
          }
        });

      targetState.listenPromise = initPromise;
      targetState.opChain = initPromise.then(
        () => undefined,
        () => undefined
      );
    }

    const ready = targetState.listenPromise.then(
      () => {
        targetState.pendingSubs.delete(sub);
      },
      (err) => {
        targetState.pendingSubs.delete(sub);
        // Only roll back refCount if this subscription was not already cancelled/released
        if (!sub.released) {
          sub.released = true;
          targetState.refCount = Math.max(0, targetState.refCount - 1);
          if (
            targetState.refCount === 0 &&
            !targetState.listenPromise &&
            !targetState.isListened &&
            this.channels.get(channel) === targetState
          ) {
            this.channels.delete(channel);
          }
        }
        throw err;
      }
    );

    return { channel, ready, release };
  }

  private async subscribeChannel(channel: string): Promise<void> {
    const { ready } = this.acquireChannel(channel);
    await ready;
  }

  private async unsubscribeChannel(channel: string): Promise<void> {
    const state = this.channels.get(channel);
    if (!state || state.refCount <= 0) {
      // Idempotent no-op for duplicate or stray unsubscribe calls
      return;
    }

    // If any subscriber is currently awaiting in-flight LISTEN, mark one pending entry released
    // so a subsequent LISTEN rejection will NOT double-decrement refCount.
    for (const pending of state.pendingSubs) {
      if (!pending.released) {
        pending.released = true;
        state.pendingSubs.delete(pending);
        break;
      }
    }

    await this.decrementChannel(channel, state);
  }

  acquireEventSubscription(eventId: string): ChannelSubscription {
    return this.acquireChannel(buildEventChannel(eventId));
  }

  acquireUserNotificationSubscription(userId: string): ChannelSubscription {
    return this.acquireChannel(buildUserNotificationChannel(userId));
  }

  async subscribe(eventId: string): Promise<void> {
    const channel = buildEventChannel(eventId);
    return this.subscribeChannel(channel);
  }

  async unsubscribe(eventId: string): Promise<void> {
    const channel = buildEventChannel(eventId);
    return this.unsubscribeChannel(channel);
  }

  async subscribeUserNotifications(userId: string): Promise<void> {
    const channel = buildUserNotificationChannel(userId);
    return this.subscribeChannel(channel);
  }

  async unsubscribeUserNotifications(userId: string): Promise<void> {
    const channel = buildUserNotificationChannel(userId);
    return this.unsubscribeChannel(channel);
  }

  getActiveSubscriberCount(channel: string): number {
    return this.channels.get(channel)?.refCount ?? 0;
  }

  getActiveChannelCount(): number {
    return this.channels.size;
  }
}

export const sseConnectionManager = new SSEConnectionManager();
