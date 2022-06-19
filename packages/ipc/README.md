# @electron-tools/ipc

## Introduction

Inspired by VSCode IPC implement. A more simple and more powerful way to use Electron [IPC](https://www.electronjs.org/docs/latest/tutorial/ipc). Support Invoke/Acknowledgement mode and event Subscribe/Publish mode between main process and renderer process.

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

- API invoke with Invoke/Acknowledgement mode between main process and renderer process.

  ```ts
  // renderer process call main process
  const userInfo = await ipcClient.getChannel('user').invoke('getUserInfo', id);

  // main process call renderer process, because renderer process may have more than one, main process will receive all result response from each renderer process.
  const [userInfo] = await ipcServer.getChannel('main_window', 'user').invoke('getUserInfo', id);
  ```

- Event listen with Subscribe/Publish mode between main process and render process.

  ```ts
  // ...
  const subscription = ipcClient
    .getChannel('user')
    .event('statusChange')
    .subscribe((latestStatus) => {
      // do some action while status change
    });
  // unsubscribe event, after unsubscribed, callback passed above will not be call any more.
  subscription.unsubscribe();
  // ...
  ```

## Concept
