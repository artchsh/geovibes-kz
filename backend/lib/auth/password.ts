import { hash, verify } from "@node-rs/argon2";

const MIN_PASSWORD_CHARACTERS = 10;
const MAX_PASSWORD_BYTES = 256;

function assertValidPassword(password: string): void {
  if (
    Array.from(password).length < MIN_PASSWORD_CHARACTERS
    || Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES
  ) {
    throw new Error("Password must contain at least 10 characters and at most 256 bytes");
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertValidPassword(password);

  return hash(password, {
    algorithm: 2,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(hashValue: string, password: string): Promise<boolean> {
  return verify(hashValue, password);
}
