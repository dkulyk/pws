import { HttpResponse, HttpRequest } from "uWebSockets.js";
import { MiddlewareNext } from "./decorator";
import { BaseHttpHandler } from "./httpHandler";

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
