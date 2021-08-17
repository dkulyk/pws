import { HttpResponse } from 'uWebSockets.js';
import { Utils } from './utils';
import { Log } from './log';
import {
    appMiddleware,
    BaseHttpHandler,
    broadcastEventRateLimitingMiddleware,
    corsMiddleware, jsonBodyMiddleware,
    Middlewares,
    readRateLimitingMiddleware
} from "./http";

const v8 = require('v8');

export interface ChannelResponse {
    subscription_count: number;
    user_count?: number;
    occupied: boolean;
}

export class HttpHandler extends BaseHttpHandler {
    @Middlewares([
        corsMiddleware
    ])
    healthCheck(res: HttpResponse) {
            res.writeStatus('200 OK').end('OK');
    }

    @Middlewares([
        corsMiddleware
    ])
    usage(res: HttpResponse) {
            let { rss, heapTotal, external, arrayBuffers } = process.memoryUsage();

            let totalSize = v8.getHeapStatistics().total_available_size;
            let usedSize = rss + heapTotal + external + arrayBuffers;
            let freeSize = totalSize - usedSize;
            let percentUsage = (usedSize / totalSize) * 100;

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
    metrics(res: HttpResponse) {
            let metricsResponse = metrics => {
                res.writeStatus('200 OK').end(res.query.json ? JSON.stringify(metrics) : metrics);
            };

            let handleError = err => {
                this.serverErrorResponse(res, 'A server error has occured.');
            }

            if (res.query.json) {
                this.server.metricsManager
                    .getMetricsAsJson()
                    .then(metricsResponse)
                    .catch(handleError);
            } else {
                this.server.metricsManager
                    .getMetricsAsPlaintext()
                    .then(metricsResponse)
                    .catch(handleError);
            }
    }

    @Middlewares([
        corsMiddleware,
        appMiddleware,
        readRateLimitingMiddleware
    ])
    channels(res: HttpResponse) {
            this.server.adapter.getChannels(res.params.appId).then(channels => {
                let response: { [channel: string]: ChannelResponse } = [...channels].reduce((channels, [channel, connections]) => {
                    if (connections.size === 0) {
                        return channels;
                    }

                    channels[channel] = {
                        subscription_count: connections.size,
                        occupied: true,
                    };

                    return channels;
                }, {});

                return response;
            }).catch(err => {
                Log.error(err);

                return this.serverErrorResponse(res, 'A server error has occured.');
            }).then(channels => {
                let broadcastMessage = { channels };

                this.server.metricsManager.markApiMessage(res.params.appId, {}, broadcastMessage);

                res.writeStatus('200 OK').end(JSON.stringify(broadcastMessage));
        });
    }

    @Middlewares([
        corsMiddleware,
        appMiddleware,
        readRateLimitingMiddleware,
    ])
    channel(res: HttpResponse) {
            let response: ChannelResponse;

            this.server.adapter.getChannelSocketsCount(res.params.appId, res.params.channel).then(socketsCount => {
                response = {
                    subscription_count: socketsCount,
                    occupied: socketsCount > 0,
                };

                // For presence channels, attach an user_count.
                // Avoid extra call to get channel members if there are no sockets.
                if (res.params.channel.startsWith('presence-')) {
                    response.user_count = 0;

                    if (response.subscription_count > 0) {
                        this.server.adapter.getChannelMembersCount(res.params.appId, res.params.channel).then(membersCount => {
                            let broadcastMessage = {
                                ...response,
                                ... {
                                    user_count: membersCount,
                                },
                            };

                            this.server.metricsManager.markApiMessage(res.params.appId, {}, broadcastMessage);

                            res.writeStatus('200 OK').end(JSON.stringify(broadcastMessage));
                        }).catch(err => {
                            Log.error(err);

                            return this.serverErrorResponse(res, 'A server error has occured.');
                        });

                        return;
                    }
                }

                this.server.metricsManager.markApiMessage(res.params.appId, {}, response);

                return res.writeStatus('200 OK').end(JSON.stringify(response));
            }).catch(err => {
                Log.error(err);

                return this.serverErrorResponse(res, 'A server error has occured.');
        });
    }

    @Middlewares([
        corsMiddleware,
        appMiddleware,
        readRateLimitingMiddleware,
    ])
    channelUsers(res: HttpResponse) {
            if (! res.params.channel.startsWith('presence-')) {
                return this.badResponse(res, 'The channel must be a presence channel.');
            }

            this.server.adapter.getChannelMembers(res.params.appId, res.params.channel).then(members => {
                let broadcastMessage = {
                    users: [...members].map(([user_id, user_info]) => ({ id: user_id })),
                };

                this.server.metricsManager.markApiMessage(res.params.appId, {}, broadcastMessage);

                res.writeStatus('200 OK').end(JSON.stringify(broadcastMessage));
        });
    }

    @Middlewares([
        jsonBodyMiddleware,
        corsMiddleware,
        appMiddleware,
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

            this.server.metricsManager.markApiMessage(res.params.appId, message, { ok: true });

            res.writeStatus('200 OK').end(JSON.stringify({
                ok: true,
            }));
    }
}
