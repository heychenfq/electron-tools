import {
  ConnectACKMessage,
  EventTriggerMessage,
  InvokeCancelMessage,
  InvokeFailMessage,
  InvokeMessage,
  InvokeSuccessMessage,
  IPCMessage,
  MessageType,
  Protocol,
  RequestID,
  RequestType,
  SubscribableWithSubscription,
  SubscribeEventMessage,
  UnsubscribeEventMessage,
} from './common';
import { CancellablePromise, Cancellation } from '../util/cancellation';
import { CustomizePromise } from '../util/customize-promise';
import { Observable, share, Subscription } from 'rxjs';

export interface ClientChannel {
  invoke<TArgs extends any[] = any[], TReturn = any>(command: string, ...args: TArgs): CancellablePromise<TReturn>;
  event<TData = any>(event: string): SubscribableWithSubscription<TData>;
}

interface ActiveInvokeRequest<TReturn = any> {
  type: RequestType.INVOKE;
  request: {
    customizePromise: CustomizePromise<TReturn>;
    cancelablePromise: CancellablePromise<TReturn>;
  };
}

interface ActiveEventRequest<TData = any> {
  type: RequestType.EVENT;
  request: {
    channel: string;
    event: string;
    subscribable: Observable<TData>;
    dispatch(data: TData): void;
  };
}

export class ChannelClient<TContext = string> {
  private readonly subscription = new Subscription();
  private requestId = 0;
  private readonly activeRequest: Map<RequestID, ActiveInvokeRequest | ActiveEventRequest> = new Map();

  private readonly readyPromise = new CustomizePromise<void>();

  constructor(private readonly ctx: TContext, private readonly protocol: Protocol) {
    this.subscription.add(this.protocol.onMessage.subscribe(this.handleIncomingMessage.bind(this)));
  }

  connect() {
    this.protocol.send({
      id: this.requestId++,
      type: MessageType.CONNECT,
      payload: {
        ctx: this.ctx,
      },
    });
  }

  getChannel(channel: string) {
    const clientChannel: ClientChannel = {
      invoke: <TArgs extends any[] = any[], TReturn = any>(command: string, ...args: TArgs) => {
        return this.invokeRemote<TArgs, TReturn>(channel, command, args);
      },
      event: <TData = any>(event: string) => {
        return this.subscribeRemote<TData>(channel, event);
      },
    };
    return clientChannel;
  }

  destroy() {
    this.activeRequest.forEach((item) => {
      if (item.type === RequestType.INVOKE) {
        item.request.cancelablePromise.cancel();
      }
    });
    this.subscription.unsubscribe();
  }

  whenReady() {
    if (this.readyPromise.isSettled) return Promise.resolve();
    return this.readyPromise.promise;
  }

  private async handleIncomingMessage(message: IPCMessage) {
    const { id, type } = message;
    if (type === MessageType.CONNECT_ACK) {
      return this.handleConnectACK(message);
    }
    if (!this.activeRequest.has(id)) return; // canceled or unsubscribed;
    switch (type) {
      case MessageType.INVOKE_SUCCESS:
      case MessageType.INVOKE_ERROR:
      case MessageType.INVOKE_CANCEL:
        await this.whenReady();
        this.handleInvokeReturned(message);
        break;
      case MessageType.EVENT_TRIGGER:
        await this.whenReady();
        this.handleEventTrigger(message);
        break;
      default:
      // do nothing
    }
  }

  private handleConnectACK(message: ConnectACKMessage) {
    if (message.payload.ctx === this.ctx) {
      this.readyPromise.resolve();
    }
  }

  private handleInvokeReturned(message: InvokeSuccessMessage | InvokeFailMessage | InvokeCancelMessage) {
    const { id, type } = message;
    const request = this.activeRequest.get(id)!;
    if (request.type !== RequestType.INVOKE) {
      throw new Error('invoke request type not match, expect is invoke, actual is event');
    }
    this.activeRequest.delete(message.id);
    switch (message.type) {
      case MessageType.INVOKE_SUCCESS:
        request.request.customizePromise.resolve(message.payload.result);
        break;
      case MessageType.INVOKE_ERROR:
        const error = new Error(message.payload.message);
        error.stack = message.payload.stack;
        request.request.customizePromise.reject(error);
        break;
      case MessageType.INVOKE_CANCEL:
        request.request.cancelablePromise.cancel(message.payload.reason);
        break;
      default:
        throw new Error(`unknown message type: ${type}`);
    }
  }

  private handleEventTrigger(message: EventTriggerMessage) {
    const { id } = message;
    const request = this.activeRequest.get(id)!;
    if (request.type !== RequestType.EVENT) {
      throw new Error('invoke request type not match, expect is event, actual is invoke');
    }
    request.request.dispatch(message.payload.data);
  }

  private invokeRemote<TArgs extends any[] = any[], TReturn = any>(
    channel: string,
    command: string,
    args: TArgs,
  ): CancellablePromise<TReturn> {
    const customizePromise = new CustomizePromise<TReturn>();
    const message: InvokeMessage = {
      id: this.requestId++,
      type: MessageType.INVOKE,
      payload: {
        channel,
        command,
        args,
      },
    };
    this.protocol.send(message);
    const cancelablePromise = Cancellation.fromPromise(customizePromise.promise, (error) => {
      if (this.activeRequest.has(message.id)) {
        this.activeRequest.delete(message.id);
        const cancelMessage: InvokeCancelMessage = {
          id: message.id,
          type: MessageType.INVOKE_CANCEL,
          payload: {
            reason: error.message,
          },
        };
        this.protocol.send(cancelMessage);
      }
    });
    this.activeRequest.set(message.id, {
      type: RequestType.INVOKE,
      request: {
        cancelablePromise,
        customizePromise,
      },
    });
    return cancelablePromise;
  }

  private subscribeRemote<TData = any>(channel: string, event: string) {
    for (const item of this.activeRequest.values()) {
      if (item.type === RequestType.EVENT && item.request.channel === channel && item.request.event === event) {
        return item.request.subscribable;
      }
    }
    const subscribable = new Observable<TData>((subscriber) => {
      const requestId = this.requestId++;
      const subscribeEventMessage: SubscribeEventMessage = {
        id: requestId,
        type: MessageType.SUBSCRIBE_EVENT,
        payload: {
          channel,
          event,
        },
      };
      this.protocol.send(subscribeEventMessage);
      this.activeRequest.set(requestId, {
        type: RequestType.EVENT,
        request: {
          channel,
          event,
          subscribable,
          dispatch: (data) => subscriber.next(data),
        },
      });
      return () => {
        const unsubscribeEventMessage: UnsubscribeEventMessage = {
          id: requestId,
          type: MessageType.UNSUBSCRIBE_EVENT,
        };
        this.protocol.send(unsubscribeEventMessage);
        this.activeRequest.delete(requestId);
      };
    }).pipe(share());
    return subscribable;
  }
}
