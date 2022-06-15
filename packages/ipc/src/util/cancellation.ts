import { CustomizePromise } from './customize-promise';

export interface Cancellable {
  cancel(reason?: string): void;
}

export type CancellablePromise<T = any> = Promise<T> & Cancellable;

interface CancelError extends Error {
  $isCancelError: true;
}

export class Cancellation implements Cancellable {
  cancelled: boolean = false;

  constructor(private readonly onCancel: (error: CancelError) => void) {}

  static fromPromise<T>(promise: Promise<T>, onCancel?: (error: CancelError) => void): CancellablePromise<T> {
    const customizePromise = new CustomizePromise<T>();
    const cancellablePromise = customizePromise.promise as CancellablePromise<T>;
    const cancellation = new Cancellation((error) => {
      if (!customizePromise.isSettled) {
        onCancel?.(error);
        customizePromise.reject(error);
      }
    });
    cancellablePromise.cancel = cancellation.cancel.bind(cancellation);
    promise.then(customizePromise.resolve, customizePromise.reject);
    return cancellablePromise;
  }

  static isCancelError(error: any): error is CancelError {
    return !!(error && error.$isCancelError);
  }

  static createCancelError(reason: string) {
    const error = new Error(reason) as CancelError;
    error.$isCancelError = true;
    const stack = error.stack?.split('\n') || [];
    stack.shift();
    error.stack = stack.join('\n');
    return error;
  }

  cancel(reason: string = 'canceled'): boolean {
    if (this.cancelled) return false;
    this.cancelled = true;
    this.onCancel(Cancellation.createCancelError(reason));
    return true;
  }
}
