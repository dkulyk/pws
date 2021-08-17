import async from 'async';
import { HttpResponse } from "uWebSockets.js";
import { Log } from "../log";
import { BaseHttpHandler } from "./base-http-handler";

export type MiddlewareNext = (error: any, response: HttpResponse ) => void
export type MiddlewareDefinition = (HttpResponse, MiddlewareNext) => void;

export function Middlewares(middlewares: Array<MiddlewareDefinition>) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const original = descriptor.value;

        descriptor.value = function (this: BaseHttpHandler, response: HttpResponse):Promise<any> {
            return new Promise((resolve, reject) => {
                async.waterfall([
                    callback => {
                        response.onAborted(() => {
                            Log.warning({message: 'Aborted request.', response});
                            this.serverErrorResponse(response, 'Aborted request.');
                        });

                        callback(null, response);
                    },
                    ...middlewares.map(fn => fn.bind(this)),
                ], (error: any, response: HttpResponse) => {
                    try {
                        if (error) {
                            reject(error)
                        } else {
                            resolve(original.call(this, response))
                        }
                    } catch (error) {
                        Log.error(error);
                        this.serverErrorResponse(response, 'A server error has occurred.')

                        reject(error)
                    }
                });
            });
        }
    }
}

export async function appMiddleware(this: BaseHttpHandler, response: HttpResponse, next: MiddlewareNext): Promise<any> {
    const app = await this.server.appManager.findById(response.params.appId)

    if (!app) {
        return this.notFoundResponse(response, `The app ${response.params.appId} could not be found.`);
    }

    response.app = app;

    if (app.signingTokenFromRequest(response) === response.query.auth_signature) {
        return next(null, response);
    }

    return this.unauthorizedResponse(response, 'The secret authentication failed');
}

export async function broadcastEventRateLimitingMiddleware(this:BaseHttpHandler, response: HttpResponse, next: MiddlewareNext): Promise<void> {
    let channels = response.body.channels || [response.body.channel];

    const limiter = await this.server.rateLimiter.consumeBackendEventPoints(Math.max(channels.length, 1), response.app)
    if (limiter.canContinue) {
        for (let header in limiter.headers) {
            response.writeHeader(header, '' + limiter.headers[header]);
        }

        return next(null, response);
    }

    this.tooManyRequestsResponse(response);
}

export async function readRateLimitingMiddleware(this:BaseHttpHandler, response: HttpResponse, next: MiddlewareNext): Promise<void> {
    const limiter = await this.server.rateLimiter.consumeReadRequestsPoints(1, response.app)
    if (limiter.canContinue) {
        for (let header in limiter.headers) {
            response.writeHeader(header, '' + limiter.headers[header]);
        }

        return next(null, response);
    }

    this.tooManyRequestsResponse(response);
}

export function corsMiddleware(this:BaseHttpHandler, response: HttpResponse, next: MiddlewareNext): any {
    response.writeHeader('Access-Control-Allow-Origin', this.server.options.cors.origin.join(', '));
    response.writeHeader('Access-Control-Allow-Methods', this.server.options.cors.methods.join(', '));
    response.writeHeader('Access-Control-Allow-Headers', this.server.options.cors.allowedHeaders.join(', '));

    next(null, response);
}

export async function jsonBodyMiddleware(this: BaseHttpHandler, response: HttpResponse, next: MiddlewareNext): Promise<void> {
    let buffer;
    response.onData((ab, isLast) => {
        buffer = buffer ? Buffer.concat([buffer, Buffer.from(ab)]) : Buffer.from(ab);

        if (isLast) {
            try {
                // @ts-ignore
                response.body = JSON.parse(buffer);
                response.rawBody = buffer.toString();
                next(null, response);
            } catch (e) {
                this.badResponse(response, '');
                return;
            }
        }
    });

    response.onAborted(() => {
        return this.badResponse(response, 'The received data is incorrect.');
    });
}
