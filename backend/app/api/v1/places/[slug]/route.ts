import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { dataResponse, errorResponse } from "@/lib/api/response";
import { getPlaceBySlug } from "@/lib/catalog/queries";
import { SUPPORTED_LOCALES } from "@/lib/catalog/translation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

const paramsSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(128),
}).strict();

const querySchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES).default("ru"),
}).strict();

function localeInput(request: Request): z.infer<typeof querySchema> {
  const params = new URL(request.url).searchParams;
  const input: Record<string, string> = {};
  for (const key of params.keys()) {
    if (params.getAll(key).length !== 1) {
      throw new ApiError("INVALID_REQUEST", 400, "Request validation failed", {
        [key]: "Query parameter must be provided once",
      });
    }
    input[key] = params.get(key) as string;
  }
  return querySchema.parse(input);
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const { slug } = paramsSchema.parse(await context.params);
    const { locale } = localeInput(request);
    const place = await getPlaceBySlug({ slug, locale });
    if (!place) throw new ApiError("PLACE_NOT_FOUND", 404, "Place not found");
    return dataResponse(request, place);
  } catch (error) {
    return errorResponse(request, error);
  }
}
