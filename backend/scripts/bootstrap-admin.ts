import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { passwordCredentials, sessions, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { normalizeUsername } from "@/lib/auth/username";
import { consumeHiddenInputChunk } from "./hidden-input";

export { consumeHiddenInputChunk } from "./hidden-input";

export function parseBootstrapArgs(args: string[]): { username: string } {
  if (args.some((argument) =>
    /^(?:--password(?:=|$)|-p(?:=|$))/i.test(argument))) {
    throw new Error("Plaintext password arguments are not allowed");
  }

  let username: string | undefined;
  if (args.length === 2 && args[0] === "--username") {
    username = args[1];
  } else if (args.length === 1 && args[0].startsWith("--username=")) {
    username = args[0].slice("--username=".length);
  }
  if (!username) {
    throw new Error("Usage: admin:bootstrap -- --username <username>");
  }
  return { username };
}

async function promptForHiddenPassword(): Promise<string> {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    throw new Error("An interactive terminal is required for password entry");
  }

  process.stderr.write("Password: ");
  input.setEncoding("utf8");
  input.resume();
  input.setRawMode(true);

  return new Promise((resolve, reject) => {
    let password = "";
    const cleanup = () => {
      input.off("data", onData);
      input.setRawMode(false);
      input.pause();
      process.stderr.write("\n");
    };
    const onData = (chunk: string) => {
      const result = consumeHiddenInputChunk(password, chunk);
      password = result.value;
      if (result.outcome === "reading") return;
      cleanup();
      if (result.outcome === "cancelled") {
        reject(new Error("Bootstrap cancelled"));
        return;
      }
      resolve(password);
    };
    input.on("data", onData);
  });
}

export async function bootstrapAdmin(
  displayUsername: string,
  password: string,
): Promise<{ id: string; username: string }> {
  const normalizedUsername = normalizeUsername(displayUsername);
  const trimmedDisplayUsername = displayUsername.trim();
  const passwordHash = await hashPassword(password);

  return db.transaction(async (transaction) => {
    const [existing] = await transaction.select().from(users)
      .where(eq(users.normalizedUsername, normalizedUsername))
      .limit(1);

    if (existing) {
      const [promoted] = await transaction.update(users).set({
        displayUsername: trimmedDisplayUsername,
        role: "admin",
        status: "active",
        updatedAt: new Date(),
      }).where(eq(users.id, existing.id)).returning();
      await transaction.insert(passwordCredentials).values({
        userId: existing.id,
        passwordHash,
      }).onConflictDoUpdate({
        target: passwordCredentials.userId,
        set: { passwordHash, updatedAt: new Date() },
      });
      await transaction.update(sessions).set({ revokedAt: new Date() })
        .where(eq(sessions.userId, existing.id));
      return { id: promoted.id, username: promoted.displayUsername };
    }

    const [created] = await transaction.insert(users).values({
      normalizedUsername,
      displayUsername: trimmedDisplayUsername,
      role: "admin",
      status: "active",
    }).returning();
    await transaction.insert(passwordCredentials).values({
      userId: created.id,
      passwordHash,
    });
    return { id: created.id, username: created.displayUsername };
  });
}

async function main(): Promise<void> {
  const { username } = parseBootstrapArgs(process.argv.slice(2));
  const password = await promptForHiddenPassword();
  const result = await bootstrapAdmin(username, password);
  process.stdout.write(`id=${result.id}\nusername=${result.username}\n`);
}

const isEntryPoint = process.argv[1] !== undefined
  && fileURLToPath(import.meta.url) === process.argv[1];

if (isEntryPoint) {
  void main()
    .catch((error: unknown) => {
      const safeMessages = new Set([
        "Plaintext password arguments are not allowed",
        "Usage: admin:bootstrap -- --username <username>",
        "An interactive terminal is required for password entry",
        "Bootstrap cancelled",
        "Invalid username",
        "Password must contain at least 10 characters and at most 256 bytes",
      ]);
      const message = error instanceof Error && safeMessages.has(error.message)
        ? error.message
        : "Bootstrap failed";
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    })
    .finally(() => db.$client.end());
}
