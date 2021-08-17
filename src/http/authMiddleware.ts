import { HttpResponse } from "uWebSockets.js";
import { MiddlewareNext } from "./decorator";
import { BaseHttpHandler } from "./httpHandler";

export async function authMiddleware(this:BaseHttpHandler, response: HttpResponse, next: MiddlewareNext): Promise<any> {
    if (response.app.signingTokenFromRequest(response) === response.query.auth_signature) {
        return next(null, response);
    }

    return this.unauthorizedResponse(response, 'The secret authentication failed');
}
