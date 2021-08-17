import { HttpResponse } from "uWebSockets.js";
import { MiddlewareNext } from "./decorator";
import { BaseHttpHandler } from "./httpHandler";

export function corsMiddleware(this:BaseHttpHandler, response: HttpResponse, next: MiddlewareNext): any {
    response.writeHeader('Access-Control-Allow-Origin', this.server.options.cors.origin.join(', '));
    response.writeHeader('Access-Control-Allow-Methods', this.server.options.cors.methods.join(', '));
    response.writeHeader('Access-Control-Allow-Headers', this.server.options.cors.allowedHeaders.join(', '));

    next(null, response);
}
