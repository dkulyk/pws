import { HttpResponse } from "uWebSockets.js";
import { MiddlewareNext } from "./decorator";
import { BaseHttpHandler } from "./httpHandler";

export async function appMiddleware(this:BaseHttpHandler, response: HttpResponse, next: MiddlewareNext): Promise<any> {
    const app = await this.server.appManager.findById(response.params.appId)

    if (!app) {
        return this.notFoundResponse(response, `The app ${response.params.appId} could not be found.`);
    }

    response.app = app;

    next(null, response);
}
