import { ZodError } from "zod";
import { AppError as DomainAppError } from "@/lib/result";

export class ApiError extends DomainAppError {
  constructor(
    code: string,
    status: number,
    public readonly clientMessage: string,
    public readonly fields?: Record<string, string>,
    public readonly responseHeaders?: Record<string, string>,
  ) {
    super(code, status);
    this.message = clientMessage;
    this.name = "ApiError";
  }
}

export function validationError(error: ZodError): ApiError {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? issue.path.join(".") : "body";
    fields[field] ??= issue.message;
  }
  return new ApiError(
    "INVALID_REQUEST",
    400,
    "Request validation failed",
    fields,
  );
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ZodError) return validationError(error);
  if (error instanceof DomainAppError) {
    const messages: Record<string, string> = {
      AUTH_REQUIRED: "Authentication required",
      FORBIDDEN: "Forbidden",
    };
    return new ApiError(
      error.code,
      error.status,
      messages[error.code] ?? "Request failed",
    );
  }
  return new ApiError("INTERNAL_ERROR", 500, "Internal server error");
}
