export interface HiddenInputResult {
  outcome: "reading" | "submitted" | "cancelled";
  value: string;
}

export function consumeHiddenInputChunk(
  initialValue: string,
  chunk: string,
): HiddenInputResult {
  let value = initialValue;
  for (const character of chunk) {
    if (character === "\u0003") return { outcome: "cancelled", value };
    if (character === "\r" || character === "\n") {
      return { outcome: "submitted", value };
    }
    if (character === "\u0008" || character === "\u007f") {
      value = Array.from(value).slice(0, -1).join("");
      continue;
    }
    value += character;
  }
  return { outcome: "reading", value };
}
