import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { savedPlaces, userInterests } from "@/db/schema";
import {
  mergeGuestState,
  setInterests,
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

describe("guest profile merge", () => {
  it("unions saves and replaces interests only when explicitly supplied", async () => {
    const user = await userFixture();
    const [placeA, placeB] = await Promise.all([placeFixture(), placeFixture()]);
    const [categoryA, categoryB] = await Promise.all([
      categoryFixture(),
      categoryFixture(),
    ]);
    await savePlace(user.id, placeA.id);
    await setInterests(user.id, [categoryA.id]);

    const merged = await mergeGuestState(user.id, {
      savedPlaceIds: [placeA.id, placeB.id],
      interestCategoryIds: [categoryB.id],
    });

    expect(merged).toEqual({
      savedPlaceIds: [placeA.id, placeB.id].sort(),
      interestCategoryIds: [categoryB.id],
    });
    await mergeGuestState(user.id, { savedPlaceIds: [placeA.id] });
    expect((await mergeGuestState(user.id, { savedPlaceIds: [] })).interestCategoryIds)
      .toEqual([categoryB.id]);
  });

  it("is idempotent under concurrent duplicate merges", async () => {
    const user = await userFixture();
    const place = await placeFixture();
    const category = await categoryFixture();

    await Promise.all(Array.from({ length: 5 }, () =>
      mergeGuestState(user.id, {
        savedPlaceIds: [place.id],
        interestCategoryIds: [category.id],
      })));

    expect(await listSavedPlaces(user.id)).toEqual([place.id]);
    expect((await mergeGuestState(user.id, { savedPlaceIds: [] })).interestCategoryIds)
      .toEqual([category.id]);
  });

  it("rolls back every change if any incoming reference is not public", async () => {
    const user = await userFixture();
    const validPlace = await placeFixture();
    const invalidPlace = await placeFixture({ status: "archived" });
    const originalCategory = await categoryFixture();
    const invalidCategory = await categoryFixture({ status: "draft" });
    await setInterests(user.id, [originalCategory.id]);

    await expect(mergeGuestState(user.id, {
      savedPlaceIds: [validPlace.id, invalidPlace.id],
      interestCategoryIds: [invalidCategory.id],
    })).rejects.toMatchObject({ code: "INVALID_CATALOG_REFERENCE" });

    expect(await listSavedPlaces(user.id)).toEqual([]);
    expect(await db.select({ id: userInterests.categoryId }).from(userInterests)
      .where(eq(userInterests.userId, user.id)))
      .toEqual([{ id: originalCategory.id }]);
  });

  it.each([
    ["draft", () => placeFixture({ status: "draft" })],
    ["archived", () => placeFixture({ status: "archived" })],
    ["bad pointer", () => placeFixture({ corrupt: "pointer" })],
    ["missing translation", () => placeFixture({ corrupt: "translation" })],
    ["missing active cover", () => placeFixture({ corrupt: "cover" })],
    ["invalid coordinates", () => placeFixture({ corrupt: "coordinates" })],
  ])("rejects a %s place as a new save", async (_name, makePlace) => {
    const user = await userFixture();
    const place = await makePlace();
    await expect(savePlace(user.id, place.id))
      .rejects.toMatchObject({ code: "PLACE_NOT_PUBLIC" });
  });

  it.each([
    ["draft", () => categoryFixture({ status: "draft" })],
    ["archived", () => categoryFixture({ status: "archived" })],
    ["bad pointer", () => categoryFixture({ corrupt: "pointer" })],
    ["missing translation", () => categoryFixture({ corrupt: "translation" })],
    ["missing active cover", () => categoryFixture({ corrupt: "cover" })],
  ])("rejects a %s category as a new interest", async (_name, makeCategory) => {
    const user = await userFixture();
    const category = await makeCategory();
    await expect(setInterests(user.id, [category.id]))
      .rejects.toMatchObject({ code: "CATEGORY_NOT_PUBLIC" });
  });

  it("does not let one user remove another user's save", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);
    const place = await placeFixture();
    await savePlace(owner.id, place.id);

    await removeSavedPlace(other.id, place.id);

    expect(await db.select().from(savedPlaces).orderBy(
      asc(savedPlaces.userId),
      asc(savedPlaces.placeId),
    )).toEqual([expect.objectContaining({ userId: owner.id, placeId: place.id })]);
  });

  it("returns stable validation errors for malformed direct save references", async () => {
    const user = await userFixture();
    await expect(savePlace(user.id, "not-a-uuid"))
      .rejects.toMatchObject({ code: "INVALID_REQUEST", status: 400 });
    await expect(removeSavedPlace(user.id, "not-a-uuid"))
      .rejects.toMatchObject({ code: "INVALID_REQUEST", status: 400 });
  });
});

afterAll(() => db.$client.end());
