import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { errorResponse, paginatedDataResponse } from "@/lib/api/response";
import { listPlaces } from "@/lib/catalog/queries";
import { SUPPORTED_LOCALES } from "@/lib/catalog/translation";

export const runtime = "nodejs";

const querySchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES).default("ru"),
  category: z.string().trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(128)
    .optional(),
  query: z.string().trim().min(1).max(200)
    .refine(
      (value) => !/[\u0000-\u001f\u007f]/.test(value),
      "Control characters are not allowed",
    )
    .optional(),
  cursor: z.string().min(1).max(2048).optional(),
  limit: z.string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(50))
    .default(20),
}).strict();

function queryInput(request: Request): z.infer<typeof querySchema> {
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

export async function GET(request: Request): Promise<Response> {
  try {
    return paginatedDataResponse(request, await listPlaces(queryInput(request)));
  } catch (error) {
    return errorResponse(request, error);
  }
}
