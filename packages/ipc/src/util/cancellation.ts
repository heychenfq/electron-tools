import { CustomizePromise } from './promise';

export interface Cancellable {
  cancel(reason?: string): void;
}

interface CancelError extends Error {
  $isCancelError: true;
}

export class Cancellation implements Cancellable {
  #onCancel: (reason: string) => void;
  #cancelled: boolean = false;

  constructor(onCancel: (reason: string) => void) {
    this.#onCancel = onCancel;
  }

  static fromPromise<T>(promise: Promise<T>): Promise<T> & Cancellable {
    const customizePromise = new CustomizePromise<T>();
    const cancellablePromise = customizePromise.promise as Promise<T> & Cancellable;
    const cancellation = new Cancellation((reason) => {
      customizePromise.reject(Cancellation.createCancelError(reason));
    });
    cancellablePromise.cancel = (reason?: string) => {
      cancellation.cancel(reason);
    };
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
  }

  cancel(reason?: string): boolean {
    if (this.#cancelled) return false;
    this.#onCancel(reason || 'cancelled');
    return true;
  }
}
