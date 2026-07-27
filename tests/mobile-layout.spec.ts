import { expect, test } from "@playwright/test";

const routes = [
  ["onboarding", "/onboarding"],
  ["home", "/"],
  ["categories", "/list"],
  ["profile", "/profile"],
  ["settings", "/settings"],
  ["search", "/search"],
  ...Array.from({ length: 5 }, (_, index) => [
    `category-${index + 1}`,
    `/category/${index + 1}`,
  ]),
  ...Array.from({ length: 14 }, (_, index) => [
    `space-${index + 1}`,
    `/space/${index + 1}`,
  ]),
  ["category-not-found", "/category/unknown"],
  ["space-not-found", "/space/unknown"],
] as const;

for (const [name, path] of routes) {
  test(`${name} fits a mobile viewport`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(path, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("body")).toBeVisible();

    const rootWidth = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(rootWidth.scrollWidth, "page has horizontal overflow").toBeLessThanOrEqual(
      rootWidth.clientWidth + 1,
    );
    expect(errors, "browser console errors").toEqual([]);

    await page.screenshot({
      animations: "disabled",
      path: testInfo.outputPath(`${name}.png`),
    });
  });
}
