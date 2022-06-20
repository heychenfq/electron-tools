export interface Subscription {
  unsubscribe(): void;
}

export interface Subscribable<TData = any> {
  subscribe(receiver: (data: TData) => void): Subscription | void;
}

export interface ClientSubscribable<TData = any> {
  subscribe(receiver: (data: TData) => void): Subscription;
}

export interface Protocol {
  send(message: IPCMessage): void;
  onMessage: Subscribable<IPCMessage>;
}

export type RequestID = number;

export enum RequestType {
  INVOKE = 100,
  EVENT = 200,
}

export enum MessageType {
  CONNECT = 100,
  CONNECT_ACK = 200,
  INVOKE = 300,
  INVOKE_CANCEL = 400,
  INVOKE_SUCCESS = 500,
  INVOKE_ERROR = 600,
  SUBSCRIBE_EVENT = 700,
  UNSUBSCRIBE_EVENT = 800,
  EVENT_TRIGGER = 900,
}

interface BaseMessage {
  id: RequestID;
}

export interface ConnectMessage<TContext = any> extends BaseMessage {
  type: MessageType.CONNECT;
  payload: {
    ctx: TContext;
  };
}

export interface ConnectACKMessage<TContext = any> extends BaseMessage {
  type: MessageType.CONNECT_ACK;
  payload: {
    ctx: TContext;
  };
}

export interface InvokeMessage<TArgs extends any[] = any[]> extends BaseMessage {
  type: MessageType.INVOKE;
  payload: {
    channel: string;
    command: string;
    args: TArgs;
  };
}

export interface InvokeSuccessMessage<TReturn = any> extends BaseMessage {
  type: MessageType.INVOKE_SUCCESS;
  payload: {
    result: TReturn;
  };
}

export interface InvokeFailMessage extends BaseMessage {
  type: MessageType.INVOKE_ERROR;
  payload: {
    message: string;
    stack: string;
  };
}

export interface InvokeCancelMessage extends BaseMessage {
  type: MessageType.INVOKE_CANCEL;
  payload: {
    reason: string;
  };
}

export interface SubscribeEventMessage extends BaseMessage {
  type: MessageType.SUBSCRIBE_EVENT;
  payload: {
    channel: string;
    event: string;
  };
}

export interface UnsubscribeEventMessage extends BaseMessage {
  type: MessageType.UNSUBSCRIBE_EVENT;
}

export interface EventTriggerMessage<TData = any> extends BaseMessage {
  type: MessageType.EVENT_TRIGGER;
  payload: {
    event: string;
    data: TData;
  };
}

export type IPCMessage =
  | ConnectACKMessage
  | InvokeCancelMessage
  | InvokeSuccessMessage
  | InvokeFailMessage
  | EventTriggerMessage
  | ConnectMessage
  | InvokeMessage
  | InvokeCancelMessage
  | SubscribeEventMessage
  | UnsubscribeEventMessage;
