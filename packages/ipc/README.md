# @electron-tools/ipc

> Working in progress.
> [中文文档](./README.zh.md)

## Introduction

Inspired by VSCode IPC implement. A more simple and more powerful way to use Electron [IPC](https://www.electronjs.org/docs/latest/tutorial/ipc). Support service Invoke/Acknowledgement mode and event Subscribe/Publish mode between main process and renderer process.

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

### Service invoke with acknowledgement between main process and renderer process

```ts
// renderer process invoke main process.
const userInfo = await electronIPCClient.getChannel('user').invoke('getUserInfo', id);

// main process invoke renderer process, because renderer process may have more than one, main process will receive all result response from each renderer process.
const [userInfo] = await electronIPCServer.getChannel('main_window', 'user').invoke('getUserInfo', id);
```

### Subscribe event which will be published later

```ts
// renderer process subscribe main process event.
// subscribe method will return a subscription
// which has a unsubscribe method to stop listen event.
const subscription = ipcClient
  .getChannel('user')
  .event('statusChange')
  .subscribe((latestStatus) => {
    // do some action while status change
  });
// unsubscribe event
// after unsubscribed, callback passed above will not be call any more.
subscription.unsubscribe();

// main process subscribe renderer process event.
const subscription = ipcServer
  .getChannel('route')
  .event('routeChange')
  .subscription((newRoute) => {
    setRouteInfo(newRoute).
  });
// unsubscribe event.
subscription.unsubscribe();
```

## Example

In this example, we will create a simple lifecycleService example step by step. the lifecycleService will:

1. provide programing api to quit app.
2. before app quit, renderer process can do some action to clean resources or prevent app quit.
3. renderer process will render main view once app is ready.
4. relaunch app after user logout.

Let's getting started!

1. assume we have a

1. Initialize ElectronIPCMain in the main process. once ElectronIPCMain is created. it will listen to the client connect request in the whole app lifecycle.

   ```ts
   // src/node/ipc-server.ts
   import { ElectronIPCMain } from '@electron-tools/ipc';

   const electronIPCMain = new ElectronIPCMain();
   ```

1. implement lifecycleService in the main progress.

   ```ts
   // src/node/lifecycle.service.ts
   import { app } from 'electron';

   class LifecycleService {
     constructor() {
       this.registerServerChannel;
     }
     quit() {
       app.quit();
     }
   }
   ```

1. Initialize ElectronIPCMain in the main process.

   ```ts

   ```

1. Create a serverChannel in the main process.

   ```ts
   const userServerChannel = {
     /**
      * @params ctx client identity. passed as the first argument in the ElectronIPCClient constructor
     * @params command which command client invoked.
     * @params ...args arguments passwd in the client side.
     */
     invoke(ctx: string, command: string, ...args: any[]) {
       switch(command) {
         case 'getUserInfo':
           // userService#getUserInfo returns Promise<UserInfo>.
           return userService.getUserInfo();
         default:
           throw new Error('unknown command.')
       }
     }
     /**
      *
     */
     event(ctx: string, event: string) {
       switch(event) {
         case 'userStatusChange':
           return {
             subscribe(cb) {
               userEvents.on('statusChange', (status) => {
                 cb(status);
               });
               return {
                 unsubscribe() {
                   userEvents.off('statusChange');
                 };
               }
             },
           };
         default:
           throw new Error('unknown event.');
       }
     }
   }
   ```

In the renderer process, create a ElectronIPCRenderer intance.

```ts
import { ElectronIPCRenderer } from '@electron-tools/ipc';
// should pass a identify ctx value to ElectronIPCRenderer constructor. the ctx is important for main process to identify client.
const electronIPCRenderer = new ElectronIPCRenderer('main_window');
```

### Renderer process invoke main process service

1. ·Register serviceChannel in the main process. serviceChannel represent a group of services and events.

   ```ts
   electronIPCMain.registerService;
   ```

### Main process invoke main process service

### Renderer process subscribe main process event

### main process subscribe renderer process event

## Concept
