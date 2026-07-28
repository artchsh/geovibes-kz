import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { assertTrustedWriteOrigin, isTrustedOrigin } from "@/lib/api/origin";
import { readJsonBody, requireRequestSession } from "@/lib/api/request";
import {
  dataResponse,
  emptyResponse,
  errorResponse,
} from "@/lib/api/response";
import {
  getProfile,
  profileLimits,
  updateProfile,
} from "@/lib/users/profile-service";

export const runtime = "nodejs";

const idArray = z.array(z.string().uuid()).max(profileLimits.maxInterests)
  .refine((values) => new Set(values).size === values.length, {
    message: "Must not contain duplicate IDs",
  });

const updateSchema = z.object({
  username: z.string().min(1).max(64).optional(),
  preferredLocale: z.enum(["ru", "kk", "en"]).optional(),
  onboardingCompleted: z.boolean().optional(),
  interestCategoryIds: idArray.optional(),
}).strict().refine((input) => Object.keys(input).length > 0, {
  message: "At least one profile field is required",
});

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireRequestSession(request);
    return dataResponse(request, await getProfile(session.user.id));
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    assertTrustedWriteOrigin(request);
    const session = await requireRequestSession(request);
    const input = updateSchema.parse(await readJsonBody(request));
    return dataResponse(
      request,
      await updateProfile(session.user.id, input),
    );
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function OPTIONS(request: Request): Promise<Response> {
  try {
    if (!isTrustedOrigin(request.headers.get("origin"))) {
      throw new ApiError("UNTRUSTED_ORIGIN", 403, "Untrusted request origin");
    }
    return emptyResponse(request, 204, {
      "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
    });
  } catch (error) {
    return errorResponse(request, error);
  }
}
