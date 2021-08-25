import { PresenceMember } from './presence-member';
import { WebSocket } from 'uWebSockets.js';
import { Log } from "./log";

export class Namespace {
    /**
     * The list of channel connections for the current app.
     */
    public channels: Map<string, Set<string>> = new Map();

    /**
     * The list of sockets connected to the namespace.
     */
    public sockets: Map<string, WebSocket> = new Map();

    /**
     * Initialize the namespace for an app.
     */
    constructor(protected appId: string) {
        //
    }

    /**
     * Get all sockets from this namespace.
     */
    async getSockets(): Promise<Map<string, WebSocket>> {
        return this.sockets;
    }

    /**
     * Add a new socket to the namespace.
     */
    async addSocket(ws: WebSocket): Promise<boolean> {
        this.sockets.set(ws.id, ws);

        return true;
    }

    /**
     * Remove a socket from the namespace.
     */
    async removeSocket(wsId: string): Promise<boolean> {
        for (let channel of this.channels.keys()) {
            await this.removeFromChannel(wsId, channel);
        }

        return this.sockets.delete(wsId);
    }

    /**
     * Add a socket ID to the channel identifier.
     * Return the total number of connections after the connection.
     */
    async addToChannel(ws: WebSocket, channel: string): Promise<number> {
        if (! this.channels.has(channel)) {
            this.channels.set(channel, new Set);
        }

        return this.channels.get(channel).add(ws.id).size;
    }

    /**
     * Remove a socket ID from the channel identifier.
     * Return the total number of connections remaining to the channel.
     */
    async removeFromChannel(wsId: string, channel: string): Promise<number> {

        if (this.channels.has(channel)) {
            this.channels.get(channel).delete(wsId);

            const size = this.channels.get(channel).size;

            if (size === 0) {
                this.channels.delete(channel);
            }

            return size;
        }

        return 0;
    }

    /**
     * Check if a socket ID is joined to the channel.
     */
    async isInChannel(wsId: string, channel: string): Promise<boolean> {
        if (! this.channels.has(channel)) {
            return false;
        }

        return this.channels.get(channel).has(wsId);
    }

    /**
     * Get the list of channels with the websocket IDs.
     */
    async getChannels(): Promise<Map<string, Set<string>>> {
        return this.channels;
    }

    /**
     * Get all the channel sockets associated with this namespace.
     */
    async getChannelSockets(channel: string): Promise<Map<string, WebSocket>> {
            if (! this.channels.has(channel)) {
                return new Map<string, WebSocket>();
            }

            let wsIds = this.channels.get(channel);

           return Array.from(wsIds).reduce((sockets, wsId) => {
                    if (! this.sockets.has(wsId)) {
                        return sockets;
                    }

                    return sockets.set(wsId, this.sockets.get(wsId));
                }, new Map<string, WebSocket>());
    }

    /**
     * Get a given presence channel's members.
     */
    getChannelMembers(channel: string): Promise<Map<string, PresenceMember>> {
        return this.getChannelSockets(channel).then(sockets => {
            return Array.from(sockets).reduce((members, [wsId, ws]) => {
                let member: PresenceMember = ws.presence.get(channel);

                if (member) {
                    members.set(member.user_id as string, member.user_info)
                }

                return members;
            }, new Map<string, PresenceMember>());
        });
    }
}
