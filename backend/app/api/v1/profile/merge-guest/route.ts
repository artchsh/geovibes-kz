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
  mergeGuestState,
  profileLimits,
} from "@/lib/users/profile-service";

export const runtime = "nodejs";

function uniqueIds(maximum: number) {
  return z.array(z.string().uuid()).max(maximum)
    .refine((values) => new Set(values).size === values.length, {
      message: "Must not contain duplicate IDs",
    });
}

const mergeSchema = z.object({
  savedPlaceIds: uniqueIds(profileLimits.maxSavedPlacesPerMerge),
  interestCategoryIds: uniqueIds(profileLimits.maxInterests).optional(),
}).strict();

export async function POST(request: Request): Promise<Response> {
  try {
    assertTrustedWriteOrigin(request);
    const session = await requireRequestSession(request);
    const input = mergeSchema.parse(await readJsonBody(request));
    return dataResponse(
      request,
      await mergeGuestState(session.user.id, input),
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
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    });
  } catch (error) {
    return errorResponse(request, error);
  }
}
