import { asc, and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ApiError } from "@/lib/api/errors";
import { savedPlaces } from "@/db/schema";
import {
  catalogReferenceValidation,
  requireValidUserId,
} from "./profile-service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validatePlaceId(placeId: string): void {
  if (!UUID_PATTERN.test(placeId)) {
    throw new ApiError("INVALID_REQUEST", 400, "Request validation failed", {
      placeId: "Must be a valid UUID",
    });
  }
}

export async function listSavedPlaces(userId: string): Promise<string[]> {
  requireValidUserId(userId);
  const rows = await db.select({ id: savedPlaces.placeId })
    .from(savedPlaces)
    .where(eq(savedPlaces.userId, userId))
    .orderBy(asc(savedPlaces.placeId));
  return rows.map(({ id }) => id);
}

export async function savePlace(
  userId: string,
  placeId: string,
): Promise<void> {
  requireValidUserId(userId);
  validatePlaceId(placeId);
  await db.transaction(async (transaction) => {
    await catalogReferenceValidation.lockUser(transaction, userId);
    await catalogReferenceValidation.assertPublicPlaces(transaction, [placeId]);
    await transaction.insert(savedPlaces).values({ userId, placeId })
      .onConflictDoNothing();
  });
}

export async function removeSavedPlace(
  userId: string,
  placeId: string,
): Promise<void> {
  requireValidUserId(userId);
  validatePlaceId(placeId);
  await db.delete(savedPlaces).where(and(
    eq(savedPlaces.userId, userId),
    eq(savedPlaces.placeId, placeId),
  ));
}
