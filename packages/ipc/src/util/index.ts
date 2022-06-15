import { Observable } from 'rxjs';
import { Subscribable } from '../core/common';

export function throwError(error: any) {
  setTimeout(() => {
    throw error;
  });
}

export function fromSubscribable<T>(subscribable: Subscribable<T>): Observable<T> {
  return new Observable<T>((subscriber) => {
    return subscribable.subscribe((res) => subscriber.next(res));
  });
}
