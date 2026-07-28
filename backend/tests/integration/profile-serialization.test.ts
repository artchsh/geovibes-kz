import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { places } from "@/db/schema";
import {
  getProfile,
  mergeGuestState,
  setInterests,
  updateProfile,
} from "@/lib/users/profile-service";
import {
  listSavedPlaces,
  removeSavedPlace,
  savePlace,
} from "@/lib/users/saved-place-service";
import { resetTestDatabase } from "@/tests/setup/database";
import {
  categoryFixture,
  placeFixture,
  userFixture,
} from "@/tests/setup/user-catalog-fixtures";

beforeEach(resetTestDatabase);

type OperationOutcome = {
  early: "blocked" | "settled";
  result: { ok: boolean; error?: unknown };
};

async function archiveWhileReferenceValidationWaits(
  table: "places" | "categories",
  id: string,
  operation: () => Promise<unknown>,
): Promise<OperationOutcome> {
  const client = await db.$client.connect();
  try {
    await client.query("begin");
    await client.query(`select id from ${table} where id = $1 for update`, [id]);
    const observed = operation().then(
      () => ({ ok: true }),
      (error: unknown) => ({ ok: false, error }),
    );
    const early = await Promise.race([
      observed.then(() => "settled" as const),
      new Promise<"blocked">((resolve) =>
        setTimeout(() => resolve("blocked"), 100)),
    ]);
    await client.query(
      `update ${table} set status = 'archived' where id = $1`,
      [id],
    );
    await client.query("commit");
    return { early, result: await observed };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

describe("profile and catalog reference serialization", () => {
  it.each([
    ["savePlace", async (userId: string, placeId: string) =>
      savePlace(userId, placeId)],
    ["mergeGuestState", async (userId: string, placeId: string) =>
      mergeGuestState(userId, { savedPlaceIds: [placeId] })],
  ])("rechecks a place after waiting for lifecycle update in %s", async (
    _name,
    operation,
  ) => {
    const user = await userFixture();
    const place = await placeFixture();
    const outcome = await archiveWhileReferenceValidationWaits(
      "places",
      place.id,
      () => operation(user.id, place.id),
    );

    expect(outcome.early).toBe("blocked");
    expect(outcome.result).toMatchObject({
      ok: false,
      error: {
        code: expect.stringMatching(
          /PLACE_NOT_PUBLIC|INVALID_CATALOG_REFERENCE/,
        ),
      },
    });
    expect(await listSavedPlaces(user.id)).toEqual([]);
  });

  it.each([
    ["setInterests", async (userId: string, categoryId: string) =>
      setInterests(userId, [categoryId])],
    ["updateProfile", async (userId: string, categoryId: string) =>
      updateProfile(userId, { interestCategoryIds: [categoryId] })],
  ])("rechecks a category after waiting for lifecycle update in %s", async (
    _name,
    operation,
  ) => {
    const user = await userFixture();
    const category = await categoryFixture();
    const outcome = await archiveWhileReferenceValidationWaits(
      "categories",
      category.id,
      () => operation(user.id, category.id),
    );

    expect(outcome.early).toBe("blocked");
    expect(outcome.result).toMatchObject({
      ok: false,
      error: { code: "CATEGORY_NOT_PUBLIC" },
    });
    expect((await getProfile(user.id)).interestCategoryIds).toEqual([]);
  });

  it("retains a save when archival linearizes after the save commits", async () => {
    const user = await userFixture();
    const place = await placeFixture();

    await savePlace(user.id, place.id);
    await db.update(places).set({ status: "archived" })
      .where(eq(places.id, place.id));

    expect(await listSavedPlaces(user.id)).toEqual([place.id]);
  });

  it("rejects malformed user IDs at every exported service boundary", async () => {
    const place = await placeFixture();
    const probes = [
      () => getProfile("not-a-uuid"),
      () => setInterests("not-a-uuid", []),
      () => updateProfile("not-a-uuid", { preferredLocale: "en" }),
      () => mergeGuestState("not-a-uuid", { savedPlaceIds: [] }),
      () => listSavedPlaces("not-a-uuid"),
      () => savePlace("not-a-uuid", place.id),
      () => removeSavedPlace("not-a-uuid", place.id),
    ];

    for (const probe of probes) {
      await expect(probe()).rejects.toMatchObject({
        code: "INVALID_REQUEST",
        status: 400,
      });
    }
  });

  it("reads a profile in a repeatable-read read-only snapshot", async () => {
    const user = await userFixture();
    const transactionSpy = vi.spyOn(db, "transaction");
    try {
      await getProfile(user.id);
      expect(transactionSpy).toHaveBeenCalledWith(
        expect.any(Function),
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    } finally {
      transactionSpy.mockRestore();
    }
  });
});

afterAll(() => db.$client.end());

