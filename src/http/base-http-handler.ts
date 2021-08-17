import { Server } from "../server";
import { HttpResponse, RecognizedString } from "uWebSockets.js";

export abstract class BaseHttpHandler {
    constructor(protected server: Server) {
        //
    }

    protected badResponse(res: HttpResponse, error: string) {
        return this.sendJson(res, {error, code: 400}, '400 Invalid Request')
    }

    protected notFoundResponse(res: HttpResponse, error: string) {
        return this.sendJson(res, {error, code: 404}, '404 Not Found')
    }

    protected unauthorizedResponse(res: HttpResponse, error: string) {
        return this.sendJson(res, {error, code: 401}, '401 Unauthorized')
    }

    protected entityTooLargeResponse(res: HttpResponse, error: string) {
        return this.sendJson(res, {error, code: 413}, '413 Payload Too Large');
    }

    protected tooManyRequestsResponse(res: HttpResponse) {
        return this.sendJson(res, {error: 'Too many requests.', code: 429}, '429 Too Many Requests');
    }

    protected serverErrorResponse(res: HttpResponse, error: string) {
        return this.sendJson(res, {error, code: 500}, '500 Internal Server Error');
    }

    protected sendJson(res: HttpResponse, data: any, status: RecognizedString = '200 OK') {
        return res.writeStatus(status)
            .writeHeader('Content-Type', 'application/json')
            // @ts-ignore Remove after uWS 19.4 release
            .end(JSON.stringify(data), true);
    }

    protected send(res: HttpResponse, data: RecognizedString, status: RecognizedString = '200 OK') {
        return res.writeStatus(status)
            // @ts-ignore Remove after uWS 19.4 release
            .end(data, true)
    }
}
