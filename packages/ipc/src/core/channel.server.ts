import {
  ConnectACKMessage,
  ConnectMessage,
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
  Subscription,
  UnsubscribeEventMessage,
} from './common';
import { Cancellable, Cancellation } from '../util/cancellation';
import { CustomizePromise } from '../util/customize-promise';
import { noop, Subscription as RxjsSubscription } from 'rxjs';

export interface ServerChannel<TContext = string> {
  invoke(ctx: TContext, command: string, ...args: any[]): any;
  event(ctx: TContext, event: string): SubscribableWithSubscription<any>;
}

interface ActiveInvokeRequest {
  type: RequestType.INVOKE;
  execution: Cancellable;
}

interface ActiveEventRequest {
  type: RequestType.EVENT;
  subscription: Subscription;
}

export class ChannelServer<TContext = string> {
  ctx: TContext | null = null;
  private readonly subscription = new RxjsSubscription();
  private readonly channels = new Map<string, ServerChannel<TContext>>();
  private readonly activeRequest = new Map<RequestID, ActiveInvokeRequest | ActiveEventRequest>();
  private readonly readyPromise = new CustomizePromise<void>();
  private readonly pendingRequest = new Set<{
    message: InvokeMessage | SubscribeEventMessage;
    execution: { cancel: (reason?: string) => void };
  }>();

  constructor(private readonly protocol: Protocol) {
    this.subscription.add(this.protocol.onMessage.subscribe(this.handleIncomingMessage.bind(this)));
  }

  registerChannel(channelName: string, serverChannel: ServerChannel<TContext>): void {
    this.channels.set(channelName, serverChannel);
    this.flushPendingRequest();
  }

  destroy() {
    this.channels.clear();
    this.activeRequest.forEach((item) => {
      if (item.type === RequestType.INVOKE) {
        item.execution.cancel('server destroy.');
      }
      if (item.type === RequestType.EVENT) {
        item.subscription.unsubscribe();
      }
    });
    this.pendingRequest.forEach((item) => {
      item.execution.cancel('server destroy.');
    });
    this.subscription.unsubscribe();
  }

  whenReady() {
    if (this.readyPromise.isSettled) return Promise.resolve();
    return this.readyPromise.promise;
  }

  private async handleIncomingMessage(message: IPCMessage) {
    const { type } = message;
    switch (type) {
      case MessageType.CONNECT:
        this.handleConnect(message);
        break;
      case MessageType.INVOKE:
        this.handleInvoke(message);
        break;
      case MessageType.INVOKE_CANCEL:
        this.handleInvokeCancel(message);
        break;
      case MessageType.SUBSCRIBE_EVENT:
        this.handleSubscribeEvent(message);
        break;
      case MessageType.UNSUBSCRIBE_EVENT:
        await this.whenReady();
        this.handleUnsubscribeEvent(message);
        break;
      default:
      // do nothing
    }
  }

  private handleConnect(message: ConnectMessage): void {
    this.ctx = message.payload.ctx;
    const response: ConnectACKMessage = {
      id: message.id,
      type: MessageType.CONNECT_ACK,
      payload: {
        ctx: this.ctx,
      },
    };
    this.protocol.send(response);
    this.readyPromise.resolve();
  }

  private async handleInvoke(message: InvokeMessage): Promise<void> {
    await this.whenReady();
    const {
      id,
      payload: { channel, command, args },
    } = message;
    const response = {
      id,
    } as InvokeSuccessMessage | InvokeFailMessage | InvokeCancelMessage;
    const serverChannel = this.channels.get(channel);
    if (!serverChannel) {
      const timeout = setTimeout(() => {
        const errorResponse = response as InvokeFailMessage;
        errorResponse.type = MessageType.INVOKE_ERROR;
        errorResponse.payload = {
          message: `unknown channel: ${channel}`,
          stack: '',
        };
        this.protocol.send(errorResponse);
        this.pendingRequest.delete(pendingRequest);
      }, 1000);
      const pendingRequest = {
        message,
        execution: {
          cancel: (reason?: string) => {
            if (reason) {
              const errorResponse = response as InvokeCancelMessage;
              errorResponse.type = MessageType.INVOKE_CANCEL;
              errorResponse.payload = {
                reason,
              };
              this.protocol.send(errorResponse);
            }
            clearTimeout(timeout);
            this.pendingRequest.delete(pendingRequest);
          },
        },
      };
      this.pendingRequest.add(pendingRequest);
      return;
    }
    try {
      const execution = Cancellation.fromPromise(Promise.resolve(serverChannel.invoke(this.ctx!, command, ...args)));
      this.activeRequest.set(id, {
        type: RequestType.INVOKE,
        execution,
      });
      const result = await execution;
      const successResponse = response as InvokeSuccessMessage;
      successResponse.type = MessageType.INVOKE_SUCCESS;
      successResponse.payload = {
        result,
      };
      this.protocol.send(response);
    } catch (e: any) {
      // canceled by server, should response to client
      if (Cancellation.isCancelError(e)) {
        if (this.activeRequest.has(id)) {
          const cancelResponse = response as InvokeCancelMessage;
          response.type = MessageType.INVOKE_CANCEL;
          response.payload = {
            reason: e.message,
          };
          this.protocol.send(cancelResponse);
        }
      } else {
        const errorResponse = response as InvokeFailMessage;
        errorResponse.type = MessageType.INVOKE_ERROR;
        errorResponse.payload = {
          message: e.message,
          stack: e.stack,
        };
        this.protocol.send(errorResponse);
      }
    } finally {
      this.activeRequest.delete(id);
    }
  }

  private async handleInvokeCancel(message: InvokeCancelMessage) {
    await this.whenReady();
    const { id } = message;
    const activeRequest = this.activeRequest.get(id);
    if (!activeRequest) {
      for (const item of this.pendingRequest) {
        if (item.message.id === id) {
          item.execution.cancel();
          return;
        }
      }
      return;
    }
    if (activeRequest.type === RequestType.EVENT) {
      throw new Error(`could not cancel execution(${id}) which is a subscription.`);
    }
    this.activeRequest.delete(id);
    activeRequest.execution.cancel();
  }

  private async handleSubscribeEvent(message: SubscribeEventMessage) {
    await this.whenReady();
    const {
      id,
      payload: { channel, event },
    } = message;
    const serverChannel = this.channels.get(channel);
    if (!serverChannel) {
      const timeout = setTimeout(() => {
        this.pendingRequest.delete(pendingRequest);
        throw new Error(`unknown channel: ${channel}`);
      }, 1000) as unknown as number;
      const pendingRequest = {
        message,
        execution: {
          cancel: () => {
            this.pendingRequest.delete(pendingRequest);
            clearTimeout(timeout);
          },
        },
      };
      this.pendingRequest.add(pendingRequest);
      return;
    }
    const subscription = serverChannel.event(this.ctx!, event).subscribe((data) => {
      this.protocol.send({
        id,
        type: MessageType.EVENT_TRIGGER,
        payload: {
          event,
          data,
        },
      });
    }) ?? { unsubscribe: noop };
    this.activeRequest.set(message.id, {
      type: RequestType.EVENT,
      subscription,
    });
  }

  private async handleUnsubscribeEvent(message: UnsubscribeEventMessage) {
    await this.whenReady();
    const { id } = message;
    const activeRequest = this.activeRequest.get(id);
    if (!activeRequest) {
      for (const item of this.pendingRequest) {
        if (item.message.id === id) {
          item.execution.cancel();
          return;
        }
      }
      throw new Error(`could not unsubscribe subscription(${id}) which is not exist.`);
    }
    if (activeRequest.type === RequestType.INVOKE) {
      throw new Error(`could not unsubscribe subscription(${id}) which is a execution.`);
    }
    this.activeRequest.delete(id);
    activeRequest.subscription.unsubscribe();
  }

  private flushPendingRequest() {
    for (const request of this.pendingRequest) {
      if (this.channels.has(request.message.payload.channel)) {
        request.execution.cancel();
        this.handleIncomingMessage(request.message);
      }
    }
  }
}
