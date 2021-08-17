import async from 'async';
import { HttpResponse } from "uWebSockets.js";
import { Log } from "../log";
import { HttpHandler } from "../http-handler";

export type MiddlewareNext = (error: any, response: HttpResponse ) => void
export type MiddlewareDefinition = (HttpResponse, MiddlewareNext) => void;

export function Middlewares(middlewares: Array<MiddlewareDefinition>) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const original = descriptor.value;

        descriptor.value = function (this:HttpHandler, response: HttpResponse):Promise<any> {
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
                            throw error;
                        }
                        resolve(original.call(this, response))
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
