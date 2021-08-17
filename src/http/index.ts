import exp from "constants";

export * from './httpHandler'
export * from './decorator';
export * from './corsMiddleware';
export * from './appMiddleware';
export * from './authMiddleware'
export * from './readRateLimitingMiddleware';
export * from './jsonBodyMiddleware';
export * from './broadcastEventRateLimitingMiddleware'

import { HttpResponse } from "uWebSockets.js";

// HttpResponse.prototype.badResponse = function(message: string) {
//     return this.writeStatus('400 Invalid Request').end(JSON.stringify({
//         error: message,
//         code: 400,
//     }));
// }
//
// protected badResponse(res: HttpResponse, message: string)
//
// protected notFoundResponse(res: HttpResponse, message: string) {
//     return res.writeStatus('404 Not Found').end(JSON.stringify({
//         error: message,
//         code: 404
//     }));
// }
//
// protected unauthorizedResponse(res: HttpResponse, message: string) {
//     return res.writeStatus('401 Unauthorized').end(JSON.stringify({
//         error: message,
//         code: 401,
//     }));
// }
//
// protected entityTooLargeResponse(res: HttpResponse, message: string) {
//     return res.writeStatus('413 Payload Too Large').end(JSON.stringify({
//         error: message,
//         code: 413,
//     }));
// }
//
// protected tooManyRequestsResponse(res: HttpResponse) {
//     return res.writeStatus('429 Too Many Requests').end(JSON.stringify({
//         error: 'Too many requests.',
//         code: 429,
//     }));
// }
//
// protected serverErrorResponse(res: HttpResponse, message: string) {
//     return res.writeStatus('500 Internal Server Error').end(JSON.stringify({
//         error: message,
//         code: 500,
//     }));
// }
