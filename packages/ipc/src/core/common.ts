export interface Subscription {
  unsubscribe(): void;
}

export interface Subscribable<D> {
  subscribe(receiver: (data: D) => void): Subscription;
}
