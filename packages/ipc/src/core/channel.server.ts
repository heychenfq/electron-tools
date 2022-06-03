import {
  ConnectMessage,
  ConnectACKMessage,
  InvokeMessage,
  InvokeSuccessMessage,
  InvokeFailMessage,
  SubscribeEventMessage,
  UnsubscribeEventMessage,
  EventTriggerMessage,
  MessageType,
  RequestID,
  ActiveEventRequest,
  ActiveInvokeRequest,
  RequestType,
  InvokeCancelMessage,
} from './channel.base';
import { Subscribable } from './common';
import { Cancellation } from '../util/cancellation';

export interface ServerChannel<T = string> {
  invoke<R>(ctx: T, command: string, ...args: any[]): Promise<R>;
  event<D>(ctx: T, event: string): Subscribable<D>;
}

type ChannelServerIncomingMessage =
  | ConnectMessage
  | InvokeMessage
  | InvokeCancelMessage
  | SubscribeEventMessage
  | UnsubscribeEventMessage;
type ChannelServerOutgoingMessage =
  | ConnectACKMessage
  | InvokeCancelMessage
  | InvokeSuccessMessage
  | InvokeFailMessage
  | EventTriggerMessage;

export interface ServerProtocol {
  send(message: ChannelServerOutgoingMessage): void;
  onMessage(receiver: (message: ChannelServerIncomingMessage) => void): void;
  destroy(): void;
}

export default class ChannelServer<T = string> {
  #channels: Map<string, ServerChannel<T>> = new Map();

  #ctx: T;

  #protocol: ServerProtocol;

  #activeRequest: Map<RequestID, ActiveInvokeRequest | ActiveEventRequest> = new Map();

  constructor(ctx: T, protocol: ServerProtocol) {
    this.#ctx = ctx;
    this.#protocol = protocol;
    this.#protocol.onMessage(this.#handleIncomingMessage.bind(this));
  }

  registerChannel(channelName: string, serverChannel: ServerChannel<T>): void {
    this.#channels.set(channelName, serverChannel);
  }

  destroy() {
    this.#channels.clear();
    this.#protocol.destroy();
    this.#activeRequest.forEach((item) => {
      if (item.type === RequestType.INVOKE) {
        item.request.execution.cancel();
      }
      if (item.type === RequestType.EVENT) {
        item.request.subscription.unsubscribe();
      }
    });
    this.#activeRequest.clear();
  }

  #handleIncomingMessage(message: ChannelServerIncomingMessage): void {
    switch (message.type) {
    case MessageType.CONNECT:
      this.#handleConnect(message);
      break;
    case MessageType.INVOKE:
      this.#handleInvoke(message);
      break;
    case MessageType.INVOKE_CANCEL:
      this.#handleInvokeCancel(message);
      break;
    case MessageType.SUBSCRIBE_EVENT:
      this.#handleSubscribeEvent(message);
      break;
    case MessageType.UNSUBSCRIBE_EVENT:
      this.#handleUnsubscribeEvent(message);
      break;
    default:
      throw new Error(`unknown message type: ${(message as any).type}`);
    }
  }

  #handleConnect(message: ConnectMessage): void {
    const response: ConnectACKMessage = {
      id: message.id,
      type: MessageType.CONNECT_ACK,
    };
    this.#protocol.send(response);
  }

  async #handleInvoke(message: InvokeMessage): Promise<void> {
    const {
      id,
      payload: { channel, command, args },
    } = message;
    const response = {
      id,
    } as InvokeSuccessMessage | InvokeFailMessage | InvokeCancelMessage;
    const serverChannel = this.#channels.get(channel);
    if (!serverChannel) {
      throw new Error(`unknown channel: ${channel}`);
    }
    const execution = Cancellation.fromPromise<any>(Promise.resolve(serverChannel.invoke(this.#ctx, command, args)));
    this.#activeRequest.set(id, {
      type: RequestType.INVOKE,
      request: {
        command,
        execution,
      },
    });
    execution
      .then((result) => {
        response.type = MessageType.INVOKE_SUCCESS;
        response.payload = {
          result,
        };
        this.#protocol.send(response);
      })
      .catch((e) => {
        // canceled by server, should response to client
        if (Cancellation.isCancelError(e) && this.#activeRequest.has(id)) {
          response.type = MessageType.INVOKE_CANCEL;
          response.payload = {
            command,
          };
          this.#protocol.send(response);
        } else {
          response.type = MessageType.INVOKE_ERROR;
          response.payload = {
            message: e.message,
            stack: e.stack,
          };
        }
      })
      .finally(() => {
        this.#activeRequest.delete(id);
      });
  }

  #handleInvokeCancel(message: InvokeCancelMessage): void {
    const {
      id,
      payload: { command },
    } = message;
    const activeRequest = this.#activeRequest.get(id);
    if (!activeRequest) {
      throw new Error(`could not cancel execution(${id}, ${command}), id: ${id}, ${command} which is not exist.`);
    }
    if (activeRequest.type === RequestType.EVENT) {
      throw new Error(`could not cancel execution(${id}, ${command}) which is a subscription.`);
    }
    if (activeRequest.request.command !== command) {
      throw new Error(
        `command not match when cancel execution(${id}, ${command}), command of execution expect to be ${command}, but actual is ${activeRequest.request.command}.`,
      );
    }
    this.#activeRequest.delete(id);
    activeRequest.request.execution.cancel();
  }

  #handleSubscribeEvent(message: SubscribeEventMessage): void {
    const {
      id,
      payload: { channel, event },
    } = message;
    const serverChannel = this.#channels.get(channel);
    if (!serverChannel) {
      throw new Error(`unknown channel: ${channel}`);
    }
    const subscription = serverChannel.event(this.#ctx, event).subscribe((data: any) => {
      this.#protocol.send({
        id,
        type: MessageType.EVENT_TRIGGER,
        payload: {
          event,
          data,
        },
      });
    });
    this.#activeRequest.set(message.id, {
      type: RequestType.EVENT,
      request: {
        event,
        subscription,
      },
    });
  }

  #handleUnsubscribeEvent(message: UnsubscribeEventMessage): void {
    const {
      id,
      payload: { event },
    } = message;
    const activeRequest = this.#activeRequest.get(id);
    if (!activeRequest) {
      throw new Error(`could not unsubscribe subscription(${id}, ${event}) which is not exist.`);
    }
    if (activeRequest.type === RequestType.INVOKE) {
      throw new Error(`could not unsubscribe subscription(${id}, ${event}) which is a execution. `);
    }
    if (activeRequest.request.event !== event) {
      throw new Error(
        `event name not match when unsubscribe subscription(${id}, ${event}), event expect to be ${event}, but actual is ${activeRequest.request.event}`,
      );
    }
    this.#activeRequest.delete(id);
    activeRequest.request.subscription.unsubscribe();
  }
}
