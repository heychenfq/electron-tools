import { Protocol } from './common';
import { ChannelClient } from './channel.client';
import { ChannelServer, ServerChannel } from './channel.server';

export interface IPCClientProtocol extends Protocol {
  connect(): void;
  disconnect(): void;
}

export class IPCClient<TContext = string> {
  private readonly protocol: IPCClientProtocol;
  private readonly channelServer: ChannelServer<TContext>;
  private readonly channelClient: ChannelClient<TContext>;

  constructor(ctx: TContext, protocol: IPCClientProtocol) {
    this.protocol = protocol;
    this.channelClient = new ChannelClient<TContext>(ctx, protocol);
    this.channelServer = new ChannelServer<TContext>(protocol);
    this.protocol.connect();
    this.channelClient.connect();
  }

  getChannel(channel: string) {
    return this.channelClient.getChannel(channel);
  }

  registerChannel(channel: string, serverChannel: ServerChannel<TContext>) {
    this.channelServer.registerChannel(channel, serverChannel);
  }

  destroy() {
    this.protocol.disconnect();
    this.channelClient.destroy();
    this.channelServer.destroy();
  }
}
