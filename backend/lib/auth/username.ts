const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;
const RESERVED = new Set(["admin", "api", "support", "geovibes", "root"]);

export function normalizeUsername(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (!USERNAME_PATTERN.test(normalized) || RESERVED.has(normalized)) {
    throw new Error("Invalid username");
  }

  return normalized;
}
