import { expect, test } from "@playwright/test";

test.describe("Round 14 — Per-Scheme Form Registry & Versioned .docx Blanko Upload (D17/D21)", () => {
  test("unauthenticated visitors fail-closed to /login?next=%2Fsettings%2Fschemes", async ({
    page,
  }) => {
    const res = await page.goto("/settings/schemes");
    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(/\/login\?next=%2Fsettings%2Fschemes/);
  });

  test("health endpoint and public auth routes render without horizontal overflow or console errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    const health = await page.request.get("/api/health");
    expect(health.status()).toBe(200);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/login");
    const overflowDesktop = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflowDesktop).toBe(false);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    const overflowMobile = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflowMobile).toBe(false);
    expect(errors).toEqual([]);
  });
});
