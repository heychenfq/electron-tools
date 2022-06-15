import { ipcRenderer, IpcRendererEvent } from 'electron';
import { fromEvent, map } from 'rxjs';
import { IPCMessage } from '../core/common';
import { IPCClient, IPCClientProtocol } from '../core/ipc.client';
import { CONNECT_CHANNEL, DISCONNECT_CHANNEL, MESSAGE_CHANNEL } from './common';

export class ElectronIPCRenderer<TContext = string> extends IPCClient<TContext> {
  private static createRendererProtocol(): IPCClientProtocol {
    return {
      send(message) {
        ipcRenderer.send(MESSAGE_CHANNEL, message);
      },
      onMessage: fromEvent<[IpcRendererEvent, IPCMessage]>(ipcRenderer, MESSAGE_CHANNEL).pipe(
        map(([, message]) => message),
      ),
      connect() {
        ipcRenderer.send(CONNECT_CHANNEL);
      },
      disconnect() {
        ipcRenderer.send(DISCONNECT_CHANNEL);
      },
    };
  }
  constructor(ctx: TContext) {
    super(ctx, ElectronIPCRenderer.createRendererProtocol());
  }
}
