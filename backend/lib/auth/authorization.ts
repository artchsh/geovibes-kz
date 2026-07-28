import { users } from "@/db/schema";
import { AppError } from "@/lib/result";

export type AuthenticatedUser = typeof users.$inferSelect;

const roleRank = { user: 0, editor: 1, admin: 2 } as const;

export function requireRole(
  user: AuthenticatedUser | null,
  minimum: keyof typeof roleRank,
): AuthenticatedUser {
  if (!user) throw new AppError("AUTH_REQUIRED", 401);
  if (roleRank[user.role] < roleRank[minimum]) {
    throw new AppError("FORBIDDEN", 403);
  }
  return user;
}
