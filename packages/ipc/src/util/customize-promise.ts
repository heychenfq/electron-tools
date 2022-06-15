import { noop } from 'rxjs';

export class CustomizePromise<T = any> {
  promise: Promise<T>;
  // will be reassigned in constructor
  resolve: (result: T) => void = noop;
  // will be reassigned in constructor
  reject: (reason: any) => void = noop;
  isSettled = false;
  constructor() {
    this.promise = new Promise((_resolve, _reject) => {
      this.resolve = (result: T) => {
        if (!this.isSettled) {
          this.isSettled = true;
          _resolve(result);
        }
      };
      this.reject = (result: any) => {
        if (!this.isSettled) {
          this.isSettled = true;
          _reject(result);
        }
      };
    });
  }
}
