import { ApiError } from "./errors";

export const AUTH_JSON_BODY_LIMIT_BYTES = 8 * 1024;

function payloadTooLarge(): ApiError {
  return new ApiError("PAYLOAD_TOO_LARGE", 413, "Payload too large");
}

async function cancelBody(body: ReadableStream<Uint8Array> | null): Promise<void> {
  if (!body) return;
  try {
    await body.cancel();
  } catch {
    // The peer may already have closed the stream.
  }
}

async function cancelReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // The peer may already have closed the stream.
  }
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim();
  if (contentType !== "application/json") {
    throw new ApiError("INVALID_REQUEST", 400, "Request validation failed", {
      body: "Content-Type must be application/json",
    });
  }

  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength !== null
    && /^\d+$/.test(declaredLength)
    && Number(declaredLength) > AUTH_JSON_BODY_LIMIT_BYTES
  ) {
    await cancelBody(request.body);
    throw payloadTooLarge();
  }

  if (!request.body) {
    throw new ApiError("INVALID_REQUEST", 400, "Request validation failed", {
      body: "Body must contain valid JSON",
    });
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > AUTH_JSON_BODY_LIMIT_BYTES) {
        await cancelReader(reader);
        throw payloadTooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError("INVALID_REQUEST", 400, "Request validation failed", {
      body: "Body must contain valid JSON",
    });
  }
}
