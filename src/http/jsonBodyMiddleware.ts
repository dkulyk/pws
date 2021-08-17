import { BaseHttpHandler } from "./httpHandler";
import { HttpRequest, HttpResponse } from "uWebSockets.js";
import { MiddlewareNext } from "./decorator";

export async function jsonBodyMiddleware(this: BaseHttpHandler, response: HttpResponse, next: MiddlewareNext): Promise<void> {
    let buffer = new Buffer('');
    response.onData((ab, isLast) => {
        buffer = Buffer.concat([buffer, Buffer.from(ab)]);

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
