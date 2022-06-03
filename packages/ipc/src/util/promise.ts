import { noop } from './function';

export class CustomizePromise<T> {
  promise: Promise<T>;
  // will be reassigned in constructor
  resolve: (result: T) => void = noop;
  // will be reassigned in constructor
  reject: (e: any) => void = noop;
  constructor() {
    this.promise = new Promise((_resolve, _reject) => {
      this.resolve = _resolve;
      this.reject = _reject;
    });
  }
}
