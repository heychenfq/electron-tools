import { first, merge, Subscription } from 'rxjs';
import { fromSubscribable } from '../util';
import { ChannelClient } from './channel.client';
import { ChannelServer, ServerChannel } from './channel.server';
import { Protocol, Subscribable, ClientSubscribable } from './common';

interface Connection<TContext = string> {
  channelServer: ChannelServer<TContext>;
  channelClient: ChannelClient<TContext>;
  ctx: TContext;
  destroy(): void;
}

export class IPCServer<TContext = string> {
  private readonly subscription: Subscription;
  private readonly connections = new Set<Connection<TContext>>();
  private readonly serverChannels = new Map<string, ServerChannel<TContext>>();
  constructor(onClientConnect: Subscribable<{ protocol: Protocol; onClientDisconnect: Subscribable<void> }>) {
    this.subscription = fromSubscribable(onClientConnect).subscribe(async ({ protocol, onClientDisconnect }) => {
      const channelServer = new ChannelServer<TContext>(protocol);
      // eslint-disable-next-line prefer-const
      let connection: Connection<TContext>;
      let isDestroyed = false;
      const clientSubscription = fromSubscribable(onClientDisconnect)
        .pipe(first())
        .subscribe(() => {
          isDestroyed = true;
          if (connection) {
            connection.destroy();
          } else {
            channelServer.destroy();
          }
        });
      await channelServer.whenReady();
      if (isDestroyed) return;
      const channelClient = new ChannelClient(channelServer.ctx!, protocol);
      channelClient.connect();
      connection = {
        channelServer,
        channelClient,
        ctx: channelServer.ctx!,
        destroy: () => {
          channelServer.destroy();
          channelClient.destroy();
          this.connections.delete(connection);
          this.subscription.remove(clientSubscription);
        },
      };

      this.subscription.add(clientSubscription);
      this.subscription.add(connection.destroy);
      this.connections.add(connection);
      this.serverChannels.forEach((serverChannel, channel) => {
        channelServer.registerChannel(channel, serverChannel);
      });
    });
  }

  registerChannel(channel: string, serverChannel: ServerChannel<TContext>) {
    this.connections.forEach((connection) => {
      connection.channelServer.registerChannel(channel, serverChannel);
    });
    this.serverChannels.set(channel, serverChannel);
  }

  getChannel(ctx: TContext, channel: string): IPCServerChannel {
    const connections = [...this.connections].filter((connection) => connection.ctx === ctx);
    if (!connections.length) {
      throw new Error(`could not find connect: ${ctx}`);
    }
    const channelClients = connections.map((connection) => connection.channelClient.getChannel(channel));
    return {
      invoke<TArgs extends any[] = any[], TReturn extends any[] = any>(command: string, ...args: TArgs) {
        return Promise.all(channelClients.map((client) => client.invoke<TArgs, ItemType<TReturn>>(command, ...args)));
      },
      event<TData>(event: string) {
        const observables = channelClients.map((client) => fromSubscribable(client.event<TData>(event)));
        return merge<TData[]>(...observables);
      },
    };
  }

  destroy() {
    this.connections.forEach((connection) => connection.destroy());
    this.connections.clear();
    this.serverChannels.clear();
  }
}

interface IPCServerChannel {
  invoke<TArgs extends any[] = any[], TReturn = any>(command: string, ...args: TArgs): Promise<TReturn[]>;
  event<TData>(event: string): ClientSubscribable<TData>;
}

type ItemType<T> = T extends Array<infer U> ? U : any;
