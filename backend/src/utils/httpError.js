export class HttpError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function notFound(message = "Resource not found") {
  return new HttpError(404, message);
}

export function badRequest(message, details = null) {
  return new HttpError(400, message, details);
}

export function forbidden(message = "Forbidden") {
  return new HttpError(403, message);
}

export function unauthorized(message = "Unauthorized") {
  return new HttpError(401, message);
}

export function conflict(message, details = null) {
  return new HttpError(409, message, details);
}
