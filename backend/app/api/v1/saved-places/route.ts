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
  listSavedPlaces,
  removeSavedPlace,
  savePlace,
} from "@/lib/users/saved-place-service";

export const runtime = "nodejs";

const savedPlaceSchema = z.object({
  placeId: z.string().uuid(),
}).strict();

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireRequestSession(request);
    return dataResponse(request, {
      savedPlaceIds: await listSavedPlaces(session.user.id),
    });
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    assertTrustedWriteOrigin(request);
    const session = await requireRequestSession(request);
    const { placeId } = savedPlaceSchema.parse(await readJsonBody(request));
    await savePlace(session.user.id, placeId);
    return emptyResponse(request);
  } catch (error) {
    return errorResponse(request, error);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    assertTrustedWriteOrigin(request);
    const session = await requireRequestSession(request);
    const { placeId } = savedPlaceSchema.parse(await readJsonBody(request));
    await removeSavedPlace(session.user.id, placeId);
    return emptyResponse(request);
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
      "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
    });
  } catch (error) {
    return errorResponse(request, error);
  }
}
