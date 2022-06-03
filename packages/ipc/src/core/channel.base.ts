import { Cancellable } from '../util/cancellation';
import { Subscription } from './common';

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

export interface ConnectMessage extends BaseMessage {
  type: MessageType.CONNECT;
}

export interface ConnectACKMessage extends BaseMessage {
  type: MessageType.CONNECT_ACK;
}

export interface InvokeMessage extends BaseMessage {
  type: MessageType.INVOKE;
  payload: {
    channel: string;
    command: string;
    args: any[];
  };
}

export interface InvokeSuccessMessage extends BaseMessage {
  type: MessageType.INVOKE_SUCCESS;
  payload: {
    result: string;
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
    command: string;
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
  payload: {
    event: string;
  };
}

export interface EventTriggerMessage extends BaseMessage {
  type: MessageType.EVENT_TRIGGER;
  payload: {
    event: string;
    data: any;
  };
}

export interface ActiveInvokeRequest {
  type: RequestType.INVOKE;
  request: {
    command: string;
    execution: Cancellable;
  };
}

export interface ActiveEventRequest {
  type: RequestType.EVENT;
  request: {
    event: string;
    subscription: Subscription;
  };
}
