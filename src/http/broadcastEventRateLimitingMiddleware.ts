import { HttpResponse } from "uWebSockets.js";
import { MiddlewareNext } from "./decorator";
import { BaseHttpHandler } from "./httpHandler";

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
