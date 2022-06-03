import { Subscribable } from './common';
import {
  ConnectACKMessage,
  ConnectMessage,
  EventTriggerMessage,
  InvokeCancelMessage,
  InvokeFailMessage,
  InvokeMessage,
  InvokeSuccessMessage,
  MessageType,
  SubscribeEventMessage,
  UnsubscribeEventMessage,
} from './channel.base';
import { Observable } from 'rxjs';
import { CustomizePromise } from '../util/promise';

export interface ClientChannel {
  invoke<R>(command: string, ...args: any[]): Promise<R>;
  event<D>(event: string): Subscribable<D>;
}

type ChannelClientIncomingMessage =
  | ConnectACKMessage
  | InvokeCancelMessage
  | InvokeSuccessMessage
  | InvokeFailMessage
  | EventTriggerMessage;
type ChannelClientOutgoingMessage =
  | ConnectMessage
  | InvokeMessage
  | InvokeCancelMessage
  | SubscribeEventMessage
  | UnsubscribeEventMessage;

export interface ClientProtocol {
  send(message: ChannelClientOutgoingMessage): void;
  onMessage(receiver: (message: ChannelClientIncomingMessage) => void): void;
  destroy(): void;
}

export default class ChannelClient {
  #requestId = 0;

  #protocol: ClientProtocol;

  constructor(protocol: ClientProtocol) {
    this.#protocol = protocol;
    this.#protocol.send({
      id: this.#requestId++,
      type: MessageType.CONNECT,
    });
  }

  getChannel(channel: string) {
    const clientChannel: ClientChannel = {
      invoke: <R = any>(command: string, ...args: any[]) => {
        return this.#invokeRemote<R>(channel, command, args);
      },
      event: <D = any>(event: string) => {
        return this.#subscribeRemote<D>(channel, event);
      },
    };
    return clientChannel;
  }

  destroy() {
    this.#protocol.destroy();
  }

  #invokeRemote<R = any>(channel: string, command: string, args: any[]): Promise<R> {
    const customizePromise = new CustomizePromise<R>();
    this.#protocol.send({
      id: this.#requestId++,
      type: MessageType.INVOKE,
      payload: {
        channel,
        command,
        args,
      },
    });
    return customizePromise.promise;
  }

  #subscribeRemote<D = any>(channel, event: string): Subscribable<D> {
    return new Observable<D>(() => {});
  }
}
