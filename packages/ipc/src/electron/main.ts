import { ipcMain, IpcMainEvent } from 'electron';
import { fromEvent, merge, map, filter, Subject } from 'rxjs';
import { IPCMessage, Protocol, Subscribable } from '../core/common';
import { IPCServer } from '../core/ipc.server';
import { CONNECT_CHANNEL, DISCONNECT_CHANNEL, MESSAGE_CHANNEL } from './common';

export class ElectronIPCMain extends IPCServer {
  private static clients = new Map<number, Subject<void>>();
  private static createOnDidClientConnect(): Subscribable<{
    protocol: Protocol;
    onClientDisconnect: Subscribable<void>;
  }> {
    return fromEvent<IpcMainEvent>(ipcMain, CONNECT_CHANNEL).pipe(
      map((connectEvent) => {
        const webContentsId = connectEvent.sender.id;
        const protocol: Protocol = {
          send(message: IPCMessage) {
            connectEvent.sender.send(MESSAGE_CHANNEL, message);
          },
          onMessage: fromEvent<[IpcMainEvent, IPCMessage]>(ipcMain, MESSAGE_CHANNEL).pipe(
            filter((messageEvent) => {
              return webContentsId === messageEvent[0].sender.id;
            }),
            map(([, message]) => message),
          ),
        };
        const onDisconnectMessage = fromEvent<IpcMainEvent>(ipcMain, DISCONNECT_CHANNEL).pipe(
          filter((disconnectEvent) => {
            return webContentsId === disconnectEvent.sender.id;
          }),
          map<IpcMainEvent, void>(() => void 0),
        );
        const reconnectSubject = new Subject<void>();
        if (this.clients.has(webContentsId)) {
          this.clients.get(webContentsId)!.next();
        }
        this.clients.set(webContentsId, reconnectSubject);
        return {
          protocol,
          onClientDisconnect: merge(onDisconnectMessage),
        };
      }),
    );
  }
  constructor() {
    super(ElectronIPCMain.createOnDidClientConnect());
  }
}
