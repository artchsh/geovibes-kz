import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { assertTrustedWriteOrigin, isTrustedOrigin } from "@/lib/api/origin";
import {
  isNativeClient,
  readJsonBody,
  readRequestSession,
  requestContext,
  requireRequestSession,
} from "@/lib/api/request";
import {
  clearedSessionCookie,
  dataResponse,
  emptyResponse,
  errorResponse,
  sessionCookie,
} from "@/lib/api/response";
import {
  changePassword,
  getCurrentUser,
  signIn,
  signOut,
  signUp,
  type AuthenticationResult,
} from "@/lib/users/auth-service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ action: string }> };

const credentialsSchema = z.object({
  username: z.string().trim().min(3).max(30),
  password: z.string().min(10).max(256),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(10).max(256),
});

function authResponse(
  request: Request,
  result: AuthenticationResult,
  status: number,
): Response {
  if (isNativeClient(request)) {
    return dataResponse(request, {
      user: result.user,
      token: result.token,
    }, status);
  }
  return dataResponse(
    request,
    { user: result.user },
    status,
    { "Set-Cookie": sessionCookie(result.token) },
  );
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const { action } = await context.params;
    if (action !== "me") {
      throw new ApiError("NOT_FOUND", 404, "Not found");
    }
    const { token } = await requireRequestSession(request);
    const user = await getCurrentUser(token);
    if (!user) {
      throw new ApiError("AUTH_REQUIRED", 401, "Authentication required");
    }
    return dataResponse(request, { user });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const { action } = await context.params;
    if (!["sign-up", "sign-in", "sign-out", "change-password"].includes(action)) {
      throw new ApiError("NOT_FOUND", 404, "Not found");
    }

    const isNativeCredentialExchange = isNativeClient(request)
      && (action === "sign-up" || action === "sign-in");
    if (!isNativeCredentialExchange) assertTrustedWriteOrigin(request);

    if (action === "sign-up" || action === "sign-in") {
      const input = credentialsSchema.parse(await readJsonBody(request));
      const result = action === "sign-up"
        ? await signUp(input, requestContext(request))
        : await signIn(input, requestContext(request));
      return authResponse(request, result, action === "sign-up" ? 201 : 200);
    }

    if (action === "sign-out") {
      const { token } = await readRequestSession(request);
      if (token) await signOut(token);
      return emptyResponse(
        request,
        204,
        { "Set-Cookie": clearedSessionCookie() },
      );
    }

    const session = await requireRequestSession(request);
    const input = changePasswordSchema.parse(await readJsonBody(request));
    await changePassword(session.user.id, input);
    return emptyResponse(
      request,
      204,
      { "Set-Cookie": clearedSessionCookie() },
    );
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function OPTIONS(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const { action } = await context.params;
    if (!["sign-up", "sign-in", "sign-out", "change-password", "me"].includes(action)) {
      throw new ApiError("NOT_FOUND", 404, "Not found");
    }
    if (!isTrustedOrigin(request.headers.get("origin"))) {
      throw new ApiError("UNTRUSTED_ORIGIN", 403, "Untrusted request origin");
    }
    return emptyResponse(request);
  } catch (error) {
    return errorResponse(request, error);
  }
}
