/* eslint-disable quotes */
import { EventEmitter } from 'events';
import { fromEvent, map, Subject } from 'rxjs';
import { IPCClient, IPCServer, IPCClientProtocol, Protocol } from '.';

describe('connection', () => {
  it('should create a connection between client and server', async () => {
    const { clientProtocol, serverProtocol, onDidClientConnect } = createProtocol();
    const clientProtocolSpy = jest.spyOn(clientProtocol, 'send');
    const connectionSpy = jest.spyOn(clientProtocol, 'connect');
    const serverProtocolSpy = jest.spyOn(serverProtocol, 'send');
    new IPCServer(onDidClientConnect);
    new IPCClient('client', clientProtocol);
    // wait connection to be established.
    await delay(0);
    expect(connectionSpy).toMatchInlineSnapshot(`
      [MockFunction] {
        "calls": Array [
          Array [],
        ],
        "results": Array [
          Object {
            "type": "return",
            "value": undefined,
          },
        ],
      }
    `);
    expect(clientProtocolSpy).toMatchInlineSnapshot(`
      [MockFunction] {
        "calls": Array [
          Array [
            Object {
              "id": 0,
              "payload": Object {
                "ctx": "client",
              },
              "type": 100,
            },
          ],
          Array [
            Object {
              "id": 0,
              "payload": Object {
                "ctx": "client",
              },
              "type": 200,
            },
          ],
        ],
        "results": Array [
          Object {
            "type": "return",
            "value": undefined,
          },
          Object {
            "type": "return",
            "value": undefined,
          },
        ],
      }
    `);
    expect(serverProtocolSpy).toMatchInlineSnapshot(`
      [MockFunction] {
        "calls": Array [
          Array [
            Object {
              "id": 0,
              "payload": Object {
                "ctx": "client",
              },
              "type": 200,
            },
          ],
          Array [
            Object {
              "id": 0,
              "payload": Object {
                "ctx": "client",
              },
              "type": 100,
            },
          ],
        ],
        "results": Array [
          Object {
            "type": "return",
            "value": undefined,
          },
          Object {
            "type": "return",
            "value": undefined,
          },
        ],
      }
    `);
  });

  it('ipcClient should send disconnect message when destroyed', async () => {
    const { clientProtocol, onDidClientConnect, eventEmitter } = createProtocol();
    const serverProtocolSpy = jest.spyOn(clientProtocol, 'disconnect');
    new IPCServer(onDidClientConnect);
    const ipcClient = new IPCClient('client', clientProtocol);
    ipcClient.destroy();
    expect(serverProtocolSpy).toMatchInlineSnapshot(`
      [MockFunction] {
        "calls": Array [
          Array [],
        ],
        "results": Array [
          Object {
            "type": "return",
            "value": undefined,
          },
        ],
      }
    `);
    expect(eventEmitter.eventNames()).toEqual(['connection']);
  });
});

describe('invoke', () => {
  it('client should receive server returned value while invoke channel', async () => {
    const { clientProtocol, onDidClientConnect } = createProtocol();
    const result = { success: 0 };
    const testService = jest.fn(() => result);
    const ipcServer = new IPCServer(onDidClientConnect);
    const ipcClient = new IPCClient('client', clientProtocol);
    ipcServer.registerChannel('test', {
      invoke: testService,
    });
    const result2 = ipcClient.getChannel('test').invoke('test_command', 1, 2, 3);
    await expect(result2).resolves.toBe(result);
  });

  it('client should receive error while server execution has error', async () => {
    const { clientProtocol, onDidClientConnect } = createProtocol();
    const testService = jest.fn(() => {
      throw new Error('sss');
    });
    const ipcServer = new IPCServer(onDidClientConnect);
    ipcServer.registerChannel('test', {
      invoke: testService,
    });
    const ipcClient = new IPCClient('client', clientProtocol);
    const execution = ipcClient.getChannel('test').invoke('test_command', 1, 2, 3);
    await expect(execution).rejects.toThrowErrorMatchingInlineSnapshot(`"sss"`);
  });

  it('client should receive unknown channel error while channel not found', async () => {
    const { clientProtocol, onDidClientConnect } = createProtocol();
    new IPCServer(onDidClientConnect);
    const ipcClient = new IPCClient('client', clientProtocol);
    const execution = ipcClient.getChannel('test').invoke('test_command', 1, 2, 3);
    await expect(execution).rejects.toThrowErrorMatchingInlineSnapshot(`"unknown channel: test"`);
  });

  it('client should receive cancel error when server destroy', async () => {
    const { clientProtocol, onDidClientConnect } = createProtocol();
    const result = { success: 0 };
    const testService = jest.fn(async () => {
      await delay(200);
      return result;
    });
    const ipcServer = new IPCServer(onDidClientConnect);
    const ipcClient = new IPCClient('client', clientProtocol);
    ipcServer.registerChannel('test', {
      invoke: testService,
    });
    const execution = ipcClient.getChannel('test').invoke('test_command', 1, 2, 3);
    // invoke is a async operation.
    await delay(0);
    ipcServer.destroy();
    await expect(execution).rejects.toThrowErrorMatchingInlineSnapshot(`"server destroy."`);
  });

  it('server should not return cancel error while client cancel request manual.', async () => {
    const { clientProtocol, serverProtocol, onDidClientConnect } = createProtocol();
    const result = { success: 0 };
    const serverProtocolSpy = jest.spyOn(serverProtocol, 'send');
    const testService = jest.fn(async () => {
      await delay(200);
      return result;
    });
    const ipcServer = new IPCServer(onDidClientConnect);
    const ipcClient = new IPCClient('client', clientProtocol);
    ipcServer.registerChannel('test', {
      invoke: testService,
    });
    const execution = ipcClient.getChannel('test').invoke('test_command', 1, 2, 3);
    execution.cancel();
    await expect(execution).rejects.toThrowErrorMatchingInlineSnapshot(`"canceled"`);
    // one time connect, one time connect ack. no other message sended.
    expect(serverProtocolSpy).toBeCalledTimes(2);
  });

  it('server should return array result while invoke client', async () => {
    const { clientProtocol, onDidClientConnect } = createProtocol();
    const result = { success: 0 };
    const testService = jest.fn(async () => {
      await delay(200);
      return result;
    });
    const ipcServer = new IPCServer(onDidClientConnect);
    const ipcClient = new IPCClient('client', clientProtocol);
    ipcClient.registerChannel('test', {
      invoke: testService,
    });
    await delay(0);
    const execution = ipcServer.getChannel('client', 'test').invoke('test_command', 1, 2, 3);
    await expect(execution).resolves.toEqual([result]);
  });
});

describe('subscribe', () => {
  it('subscribe message should not send before been subscribed.', async () => {
    const { clientProtocol, onDidClientConnect } = createProtocol();
    const ipcServer = new IPCServer(onDidClientConnect);
    const ipcClient = new IPCClient('client', clientProtocol);
    const subject = new Subject();
    const serverEvent = jest.fn(() => {
      return subject;
    });
    ipcServer.registerChannel('test', {
      event: serverEvent,
    });
    const clientEvent = ipcClient.getChannel('test').event('test');
    expect(serverEvent).not.toBeCalled();
    const cb = jest.fn();
    clientEvent.subscribe(cb);
    await delay(0);
    expect(serverEvent).toBeCalledTimes(1);
  });

  it('client should receive event from server after subscribe.', async () => {
    const { clientProtocol, onDidClientConnect } = createProtocol();
    const ipcServer = new IPCServer(onDidClientConnect);
    const ipcClient = new IPCClient('client', clientProtocol);
    const subject = new Subject();
    const serverEvent = jest.fn(() => {
      return subject;
    });
    ipcServer.registerChannel('test', {
      event: serverEvent,
    });
    const clientEvent = ipcClient.getChannel('test').event('test');
    const cb = jest.fn();
    clientEvent.subscribe(cb);
    await delay(0);
    const eventData = { code: 0 };
    subject.next(eventData);
    await delay(0);
    expect(cb).toBeCalledTimes(1);
    expect(cb).toHaveBeenNthCalledWith(1, eventData);
    subject.next(eventData);
    await delay(0);
    expect(cb).toBeCalledTimes(2);
    expect(cb).toHaveBeenNthCalledWith(2, eventData);
  });

  it('server should receive event from client after subscribe.', async () => {
    const { clientProtocol, onDidClientConnect } = createProtocol();
    const ipcServer = new IPCServer(onDidClientConnect);
    const ipcClient = new IPCClient('client', clientProtocol);
    const subject = new Subject();
    const clientEvent = jest.fn(() => {
      return subject;
    });
    ipcClient.registerChannel('test', {
      event: clientEvent,
    });
    await delay(0);
    const serverEvent = ipcServer.getChannel('client', 'test').event('test');
    await delay(0);
    const cb = jest.fn();
    serverEvent.subscribe(cb);
    await delay(0);
    expect(clientEvent).toBeCalledTimes(1);
    const eventData = { code: 0 };
    subject.next(eventData);
    await delay(0);
    expect(cb).toBeCalledTimes(1);
    expect(cb).toHaveBeenNthCalledWith(1, eventData);
    subject.next(eventData);
    await delay(0);
    expect(cb).toBeCalledTimes(2);
    expect(cb).toHaveBeenNthCalledWith(2, eventData);
  });

  it('subscribe message should not be send in the second subscribe request.', async () => {
    const { clientProtocol, onDidClientConnect } = createProtocol();
    const ipcServer = new IPCServer(onDidClientConnect);
    const ipcClient = new IPCClient('client', clientProtocol);
    const subject = new Subject();
    const serverEvent = jest.fn(() => {
      return subject;
    });
    ipcServer.registerChannel('test', {
      event: serverEvent,
    });
    const clientEvent = ipcClient.getChannel('test').event('test');
    expect(serverEvent).not.toBeCalled();
    clientEvent.subscribe(jest.fn());
    await delay(0);
    expect(serverEvent).toBeCalledTimes(1);
    clientEvent.subscribe(jest.fn());
    await delay(0);
    expect(serverEvent).toBeCalledTimes(1);
  });
  it('client should not receive event server emitted after unsubscribe.', async () => {
    const { clientProtocol, onDidClientConnect } = createProtocol();
    const ipcServer = new IPCServer(onDidClientConnect);
    const ipcClient = new IPCClient('client', clientProtocol);
    const subject = new Subject();
    const serverEvent = jest.fn(() => {
      return subject;
    });
    ipcServer.registerChannel('test', {
      event: serverEvent,
    });
    const clientEvent = ipcClient.getChannel('test').event('test');
    expect(serverEvent).not.toBeCalled();
    const cb = jest.fn();
    const subscription = clientEvent.subscribe(cb);
    await delay(0);
    const eventData = { code: 0 };
    subject.next(eventData);
    await delay(0);
    expect(cb).toBeCalledTimes(1);
    expect(cb).toHaveBeenNthCalledWith(1, eventData);
    subscription.unsubscribe();
    subject.next(eventData);
    await delay(0);
    expect(cb).toBeCalledTimes(1);
  });
});

function createProtocol() {
  const eventEmitter = new EventEmitter();
  const clientProtocol: IPCClientProtocol = {
    send(message) {
      eventEmitter.emit('client-message', message);
    },
    onMessage: {
      subscribe(cb) {
        eventEmitter.addListener('server-message', cb);
        return {
          unsubscribe() {
            eventEmitter.removeListener('server-message', cb);
          },
        };
      },
    },
    connect() {
      eventEmitter.emit('connection');
    },
    disconnect() {
      eventEmitter.emit('disconnect');
    },
  };
  const serverProtocol: Protocol = {
    send(message) {
      eventEmitter.emit('server-message', message);
    },
    onMessage: {
      subscribe(cb) {
        eventEmitter.addListener('client-message', cb);
        return {
          unsubscribe() {
            eventEmitter.removeListener('client-message', cb);
          },
        };
      },
    },
  };
  const onDidClientConnect = fromEvent(eventEmitter, 'connection').pipe(
    map(() => {
      return {
        protocol: serverProtocol,
        onClientDisconnect: fromEvent<void>(eventEmitter, 'disconnect'),
      };
    }),
  );
  return {
    clientProtocol,
    serverProtocol,
    eventEmitter,
    onDidClientConnect,
  };
}

function delay(timeout: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, timeout);
  });
}
