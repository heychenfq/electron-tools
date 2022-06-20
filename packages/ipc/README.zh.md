# @electron-tools/ipc

> [English Version](./README.md)

## 介绍

受到 VSCode 的 IPC 实现启发，基于 Electron [IPC](https://www.electronjs.org/docs/latest/tutorial/ipc) 封装, 一套更简单，更强大的 Electron IPC 通讯方式。支持主进程和渲染进程之间的服务调用以及主进程和渲染进程之间事件发布订阅。

## 安装

```bash
# npm
npm install @electron-tools/ipc
# yarn
yarn add @electron-tools/ipc
# pnpm
pnpm add @electron-tools/ipc
```

## 特性

- 主进程/渲染进程之间的服务调用，异步 Promise 返回调用结果。

  ```ts
  // renderer process call main process
  const userInfo = await ipcClient.getChannel('user').invoke('getUserInfo', id);

  // main process call renderer process, renderer process may have more than one, main process will receive all result response from each renderer process.
  const [userInfo] = await ipcServer.getChannel('main_window', 'user').invoke('getUserInfo', id);
  ```

- 主进程/渲染进程间的事件发布订阅。

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

## 核心概念

### 请求调用

### 请求响应

### 事件订阅

### 事件发布
