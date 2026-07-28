import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { dataResponse, errorResponse } from "@/lib/api/response";
import { listCategories } from "@/lib/catalog/queries";
import { SUPPORTED_LOCALES } from "@/lib/catalog/translation";

export const runtime = "nodejs";

const querySchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES).default("ru"),
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
    return dataResponse(request, await listCategories(queryInput(request)));
  } catch (error) {
    return errorResponse(request, error);
  }
}
