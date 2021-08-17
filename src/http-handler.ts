import { HttpResponse } from 'uWebSockets.js';
import { Utils } from './utils';
import {
    appMiddleware,
    authMiddleware,
    BaseHttpHandler,
    broadcastEventRateLimitingMiddleware,
    corsMiddleware,
    jsonBodyMiddleware,
    Middlewares,
    readRateLimitingMiddleware
} from './http'

const v8 = require('v8');

export interface ChannelResponse {
    subscription_count: number;
    user_count?: number;
    occupied: boolean;
}

export class HttpHandler extends BaseHttpHandler{
    @Middlewares([
        corsMiddleware
    ])
    healthCheck(res: HttpResponse) {
        console.log(res, res.constructor.name)
        res.writeStatus('200 OK').end('OK');
    }

    @Middlewares([
        corsMiddleware
    ])
    usage(res: HttpResponse) {
        const {rss, heapTotal, external, arrayBuffers} = process.memoryUsage();

        const totalSize = v8.getHeapStatistics().total_available_size;
        const usedSize = rss + heapTotal + external + arrayBuffers;
        const freeSize = totalSize - usedSize;
        const percentUsage = (usedSize / totalSize) * 100;

        return res.writeStatus('200 OK').end(JSON.stringify({
            memory: {
                free: freeSize,
                used: usedSize,
                total: totalSize,
                percent: percentUsage,
            },
        }));
    }

    @Middlewares([
        corsMiddleware
    ])
    async metrics(res: HttpResponse) {
        const metrics = res.query.json
            ? JSON.stringify(await this.server.metricsManager.getMetricsAsJson())
            : await this.server.metricsManager.getMetricsAsPlaintext();

        res.writeStatus('200 OK').end(metrics);
    }

    @Middlewares([
        corsMiddleware,
        appMiddleware,
        authMiddleware,
        readRateLimitingMiddleware,
    ])
    async channels(res: HttpResponse) {
        const response = [...await this.server.adapter.getChannels(res.app.id)].reduce((channels, [channel, connections]) => {
            if (connections.size === 0) {
                return channels;
            }

            channels[channel] = {
                subscription_count: connections.size,
                occupied: true,
            };

            return channels;
        }, <{ [channel: string]: ChannelResponse }> {});

        const broadcastMessage = {response};

        this.server.metricsManager.markApiMessage(res.params.appId, {}, broadcastMessage);

        res.writeStatus('200 OK').end(JSON.stringify(broadcastMessage));
    }

    @Middlewares([
        corsMiddleware,
        appMiddleware,
        authMiddleware,
        readRateLimitingMiddleware,
    ])
    async channel(res: HttpResponse) {
        const socketsCount = await this.server.adapter.getChannelSocketsCount(res.params.appId, res.params.channel);

        const response: { [name: string]: any } = {
            subscription_count: socketsCount,
            occupied: socketsCount > 0,
        };

        // For presence channels, attach an user_count.
        // Avoid extra call to get channel members if there are no sockets.
        if (res.params.channel.startsWith('presence-')) {
            response.user_count = socketsCount > 0 ? await this.server.adapter.getChannelMembersCount(res.params.appId, res.params.channel) : 0;
        }

        this.server.metricsManager.markApiMessage(res.params.appId, {}, response);

        return res.writeStatus('200 OK').end(JSON.stringify(response));
    }

    @Middlewares([
        corsMiddleware,
        appMiddleware,
        authMiddleware,
        readRateLimitingMiddleware,
    ])
    async channelUsers(res: HttpResponse) {
        if (!res.params.channel.startsWith('presence-')) {
            return this.badResponse(res, 'The channel must be a presence channel.');
        }

        const broadcastMessage = {
            users: [...await this.server.adapter.getChannelMembers(res.params.appId, res.params.channel)].map(([user_id, user_info]) => ({id: user_id})),
        };

        this.server.metricsManager.markApiMessage(res.params.appId, {}, broadcastMessage);

        res.writeStatus('200 OK').end(JSON.stringify(broadcastMessage));
    }

    @Middlewares([
        jsonBodyMiddleware,
        corsMiddleware,
        appMiddleware,
        authMiddleware,
        broadcastEventRateLimitingMiddleware,
    ])
    events(res: HttpResponse) {

        let message = res.body;

        if (
            (! message.channels && ! message.channel) ||
            ! message.name ||
            ! message.data
        ) {
            return this.badResponse(res, 'The received data is incorrect');
        }

        let channels: string[] = message.channels || [message.channel];

        // Make sure the channels length is not too big.
        if (channels.length > this.server.options.eventLimits.maxChannelsAtOnce) {
            return this.badResponse(res, `Cannot broadcast to more than ${this.server.options.eventLimits.maxChannelsAtOnce} channels at once`);
        }

        // Make sure the event name length is not too big.
        if (message.name.length > this.server.options.eventLimits.maxNameLength) {
            return this.badResponse(res, `Event name is too long. Maximum allowed size is ${this.server.options.eventLimits.maxNameLength}.`);
        }

        let payloadSizeInKb = Utils.dataToKilobytes(message.data);

        // Make sure the total payload of the message body is not too big.
        if (payloadSizeInKb > parseFloat(this.server.options.eventLimits.maxPayloadInKb as string)) {
            return this.badResponse(res, `The event data should be less than ${this.server.options.eventLimits.maxPayloadInKb} KB.`);
        }

        channels.forEach(channel => {
            this.server.adapter.send(res.params.appId, channel, JSON.stringify({
                event: message.name,
                channel,
                data: message.data,
            }), message.socket_id);
        });

        this.server.metricsManager.markApiMessage(res.params.appId, message, {ok: true});

        res.writeStatus('200 OK').end(JSON.stringify({
            ok: true,
        }));
    }
}
