import { ZodError } from "zod";

export function notFoundHandler(req, res, next) {
  next(Object.assign(new Error(`Route not found: ${req.method} ${req.originalUrl}`), { status: 404 }));
}

export function errorHandler(error, req, res, next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: error.flatten(),
      requestId: req.requestId,
    });
  }

  const status = error.status || 500;
  const message = status >= 500 ? "Internal server error" : error.message;

  if (status >= 500) {
    console.error(error);
  }

  return res.status(status).json({
    error: message,
    details: error.details || null,
    requestId: req.requestId,
  });
}
