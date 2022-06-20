# @electron-tools/ipc

## Introduction

Inspired by VSCode IPC implement. A more simple and more powerful way to use Electron [IPC](https://www.electronjs.org/docs/latest/tutorial/ipc 'IPC'). Support service Invoke/Acknowledgement mode and event Subscribe/Publish mode between main process and renderer process.

## Installation

```bash
# npm
npm install @electron-tools/ipc
# yarn
yarn add @electron-tools/ipc
# pnpm
pnpm add @electron-tools/ipc
```

## Features

### Invoke service with acknowledgement between main process and renderer process

Before using @electron-tools/ipc，we have to use `event.sender.send` to response to renderer and use try catch to notice client current invoke operation has error, it is not clear.

```typescript
// main process
import { ipcMain } from 'electron';

ipcMain.on('getUserById', async (event, id) => {
  try {
    const userInfo = await userService.getUserById(id);
    event.sender.send('getUserById:response', userInfo);
  } catch (e) {
    event.sender.send('getUserById:error', e.message);
  }
});
```

```typescript
// renderer process
import { ipcRenderer } from 'electron';

function getUserById(id) {
  return new Promise((resolve, reject) => {
    ipcRenderer.on('getUserById:response', (event, userInfo) => {
      resolve(userInfo);
    });
    ipcRenderer.on('getUserById:error', (event, errorMessage) => {
      resolve(new Error(errorMessage));
    });
    ipcRenderer.send('getUserById', id);
  });
}
```

After using @electron-tools/ipc

```typescript
// main process
import { ElectronIPCMain } from '@electron-tools/ipc';

const electronIPCMain = new ElectronIPCMain();
// register user ServerChannel to handle client request.
electronIPCMain.registerChannel('user', {
  invoke(ctx, command, ...args) {
    switch (command) {
      case 'getUserById':
        // the only thing you need to do is invoke the service method.
        // if userService#getUserById throw a error,
        // error message will auto response to client.
        return userService.getUserById(args[0]);
    }
  },
});
```

```typescript
// renderer process
import { ElectronIPCRenderer } from '@electron-tools/ipc';

const ipcRenderer = new ElectronIPCRenderer('main_window');
function getUserById(id) {
  // get user channel and invoke with command getUserById.
  // invoke returns type will be Promise<UserInfo>.
  // if server throw a error in execution,
  // invoke will reject with a error.
  return ipcRenderer.getChannel('user').invoke('getUserById', id);
}
```

Since Electron\@7, we can use `ipcMain.handle` with `ipcRenderer.invoke`to do something like above show. Actually, `@electron-tools/ipc` use `ipcRender.send` and `ipcMain.on` under the hood. in this example, we make a invoke request from main process to renderer process, but we can use the same way to make a invoke request from renderer process to main process, let's do it.

```typescript
// main process
import { ElectronIPCMain } from '@electron-tools/ipc';

const electronIPCMain = new ElectronIPCMain();

async function getUserById(id) {
  // we should set the target client by the first argument of getChannel which mean the client ctx.
  // because the renderer process with ctx 'main_window' may be more than one,
  // invoke returns with type Promise<Array<UserInfo>>
  const [user] = await electronIPCMain.getChannel('main_window', 'user').invoke('getUserById', id);
  return user;
}
```

```typescript
// renderer process
import { ElectronIPCRenderer } from '@electron-tools/ipc';

const ipcRenderer = new ElectronIPCRenderer('main_window');
ipcRenderer.registerChannel('user', {
  invoke(ctx, command, ...args) {
    switch (command) {
      case 'getUserById':
        return userService.getUserById(args[0]);
    }
  },
});
```

Sometimes a server execution will take a long time, we may want to cancel the execution because it is outdated. `Channel#invoke` method returns type will have a `cancel` properties. which can cannel the invoke manually. for example:

```typescript
// renderer process
import { ElectronIPCRenderer } from '@electron-tools/ipc';

const ipcRenderer = new ElectronIPCRenderer('main_window');
function getUserById(id) {
  return ipcRenderer.getChannel('user').invoke('getUserById', id);
}

const userPromise = getUserById('xxx');
userPromise.cancel();
```

### Subscribe event which will be published later

Publish/Subscribe design pattern is widely used in daily development. `@electron-tools/ipc` also support it. Renderer process can subscribe main process event which will be published later and vice versa.

```typescript
// main process
import { ElectronIPCMain } from '@electron-tools/ipc';
import { EventEmitter } from 'events';

const eventBus = new EventEmitter();

setInterval(() => {
  eventBus.emit('userStatusChange', 'user login');
}, 1000);

const electronIPCMain = new ElectronIPCMain();
electronIPCMain.registerChannel('user', {
  event(ctx, event) {
    switch (event) {
      case 'userStatusChange':
        return {
          subscribe(cb) {
            eventBus.on('userStatusChange', cb);
            return () => eventBus.off('userStatusChange', cb);
          },
        };
    }
  },
});
```

```typescript
// renderer process
import { ElectronIPCRenderer } from '@electron-tools/ipc';

const ipcClient = new ElectronIPCRenderer('main_window');
// subscription has a unscribe method to stop listen userStatusChange event.
const subscription = ipcClient
  .getChannel('user')
  .event('userStatusChange')
  .subscribe((latestStatus) => {
    console.log(latestStatus);
  });
setTimeout(() => {
  // after subscribe, main process will auto remove userStatusChange listener.
  // and will never send and ipc message except userStatusChange event been subscripted again.
  subscription.unsubscribe();
}, 5000);

// user login
// user login
// user login
// user login
```

`@electron-tools/ipc` use `rxjs` subscribe/publish pattern under the hood. so it really simple when working with `rxjs`.

```typescript
// main process
import { ElectronIPCMain } from '@electron-tools/ipc';
import { Subject } from 'rxjs';

const userStatusSubject = new Subject();

setInterval(() => {
  userStatusSubject.next('user login');
}, 1000);

const electronIPCMain = new ElectronIPCMain();
electronIPCMain.registerChannel('user', {
  event(ctx, event) {
    switch (event) {
      case 'userStatusChange':
        return userStatusSubject;
    }
  },
});
```

## Concept

### Connection

Represent connection between main process(`ElectronIPCMain`) and renderer process(`ElectronIPCRenderer`). `ElectronIPCMain` maintains a group of connection. `ElectronIPCRenderer` maintains only one connection with `ElectronIPCMain`.&#x20;

### ServerChannel

`ServerChannel` has two method, `invoke` and `event`, connect with `ClientChannel` by connection. Represent a group of service and subscribable, service can be invoked and subscribable can be subscribe through `ClientChannel`.

### ClientChannel

`ClientChannel` is a proxy channel of `ServiceChannel`, also contains `invoke` and `event` method.

## API Reference

```typescript
interface Subscription {
  unsubscribe(): void;
}

interface Subscribable<TData = any> {
  subscribe(receiver: (data: TData) => void): Subscription | void;
}

interface ClientSubscribable<TData = any> {
  subscribe(receiver: (data: TData) => void): Subscription;
}

interface ServerChannel<TContext = string> {
  invoke?(ctx: TContext, command: string, ...args: any[]): any;
  event?(ctx: TContext, event: string): Subscribable<any>;
}

interface Cancellable {
  cancel(reason?: string): void;
}

type CancellablePromise<T = any> = Promise<T> & Cancellable;

interface ClientChannel {
  invoke<TArgs extends any[] = any[], TReturn = any>(command: string, ...args: TArgs): CancellablePromise<TReturn>;
  event<TData = any>(event: string): ClientSubscribable<TData>;
}

interface ElectronIPCMain<TContext = string> {
  registerChannel(channel: string, serverChannel: ServerChannel): void;
  getChannel(ctx: TContext, channel: string): ClientChannel;
  // destroy will disconect all connections.
  destroy(): void;
}

interface ElectronIPCRenderer {
  registerChannel(channel: string, serverChannel: ServerChannel): void;
  getChannel(ctx: TContext, channel: string): ClientChannel;
  // destroy will disconect current connection.
  destroy(): void;
}
```

### Something you should keep in mind

1.  `ElectronIPCMain` and `ElectronIPCRenderer` should be initialized only once, or says it should be a singleton instance. You can initialize in one place and exports the instance, all other source want to use should import the instance.
