import { PresenceMember } from '../presence-member';
import { WebSocket } from 'uWebSockets.js';
import { Server } from '../server';

export interface JoinResponse {
    ws: WebSocket;
    success: boolean;
    channelConnections?: number;
    authError?: boolean;
    member?: PresenceMember;
    errorMessage?: string;
    errorCode?: number;
    type?: string;
}

export interface LeaveResponse {
    left: boolean;
    member?: PresenceMember;
}

export class PublicChannelManager {
    constructor(protected server: Server) {
        //
    }

    /**
     * Join the connection to the channel.
     */
    async join(ws: WebSocket, channel: string, message?: any): Promise<JoinResponse> {
        return {
            ws,
            success: true,
            channelConnections: await this.server.adapter.getNamespace(ws.app.id).addToChannel(ws, channel),
        };
    }

    /**
     * Mark the connection as closed and unsubscribe it.
     */
    async leave(ws: WebSocket, channel: string): Promise<LeaveResponse> {
        await this.server.adapter.getNamespace(ws.app.id).removeFromChannel(ws.id, channel);

        return { left: true };
    }
}
