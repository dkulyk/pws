import { AdapterInterface } from './adapter-interface';
import { Namespace } from '../namespace';
import { PresenceMember } from '../presence-member';
import { Server } from '../server';
import { WebSocket } from 'uWebSockets.js';

export class LocalAdapter implements AdapterInterface {
    // TODO: Force disconnect a specific socket
    // TODO: Force disconnect all sockets from an app.

    /**
     * The app connections storage class to manage connections.
     */
    public namespaces: Map<string, Namespace> = new Map<string, Namespace>();

    /**
     * Initialize the adapter.
     */
    constructor(protected server: Server) {
        //
    }

    /**
     * Get the app namespace.
     */
    getNamespace(appId: string): Namespace {
        if (! this.namespaces.has(appId)) {
            this.namespaces.set(appId, new Namespace(appId));
        }

        return this.namespaces.get(appId);
    }

    /**
     * Get all namespaces.
     */
    getNamespaces(): Map<string, Namespace> {
        return this.namespaces;
    }

    /**
     * Get all sockets from the namespace.
     */
    getSockets(appId: string, onlyLocal = false): Promise<Map<string, WebSocket>> {
        return this.getNamespace(appId).getSockets();
    }

    /**
     * Get total sockets count.
     */
    getSocketsCount(appId: string, onlyLocal?: boolean): Promise<number> {
        return this.getNamespace(appId).getSockets().then(sockets => {
            return sockets.size;
        });
    }

    /**
     * Get all sockets from the namespace.
     */
    getChannels(appId: string, onlyLocal = false): Promise<Map<string, Set<string>>> {
        return this.getNamespace(appId).getChannels();
    }

    /**
     * Get all the channel sockets associated with a namespace.
     */
    getChannelSockets(appId: string, channel: string, onlyLocal = false): Promise<Map<string, WebSocket>> {
        return this.getNamespace(appId).getChannelSockets(channel);
    }

    /**
     * Get a given channel's total sockets count.
     */
    getChannelSocketsCount(appId: string, channel: string, onlyLocal?: boolean): Promise<number> {
        return this.getNamespace(appId).getChannelSockets(channel).then(sockets => {
            return sockets.size;
        });
    }

    /**
     * Get a given presence channel's members.
     */
    getChannelMembers(appId: string, channel: string, onlyLocal = false): Promise<Map<string, PresenceMember>> {
        return this.getNamespace(appId).getChannelMembers(channel);
    }

    /**
     * Get a given presence channel's members count
     */
    getChannelMembersCount(appId: string, channel: string, onlyLocal?: boolean): Promise<number> {
        return this.getNamespace(appId).getChannelMembers(channel).then(members => {
            return members.size;
        });
    }

    /**
     * Check if a given connection ID exists in a channel.
     */
    isInChannel(appId: string, channel: string, wsId: string, onlyLocal?: boolean): Promise<boolean> {
        return this.getNamespace(appId).isInChannel(wsId, channel);
    }

    /**
     * Send a message to a namespace and channel.
     */
    send(appId: string, channel: string, data: string, exceptingId?: string): any {
        let nsp = this.namespaces.get(appId);

        if (! nsp) {
            return;
        }

        nsp.getChannelSockets(channel).then(sockets => {
            sockets.forEach((ws) => {
                if (exceptingId && exceptingId === ws.id) {
                    return;
                }

                ws.send(data);

                this.server.metricsManager.markWsMessageSent(ws.app.id, data);
            });
        });
    }

    /**
     * Clear the local namespaces.
     */
    clear(namespaceId?: string): void {
        if (namespaceId) {
            this.namespaces.set(namespaceId, new Namespace(namespaceId));
        } else {
            this.namespaces = new Map<string, Namespace>();
        }
    }
}
