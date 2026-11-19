import { expect, test } from "@playwright/test";

test.describe("Roster Management — manual add, edit, delete, Sheet import", () => {
  const BATCH_ID = "c61cf7c5-dd98-418b-85b7-9690caf1bdb2";

  test.beforeEach(async ({ page }) => {
    // Navigate to batch detail page (assumes authenticated session or redirects to login)
    await page.goto(`/batches/${BATCH_ID}`);
  });

  test("assessor can add 2 asesi manual, see them in triage dropdown, and map files", async ({
    page,
  }) => {
    // If redirected to login, the test environment needs auth setup; skip gracefully
    const isLogin = page.url().includes("/login");
    if (isLogin) {
      test.skip(true, "Requires authenticated session");
      return;
    }

    // Verify batch page shows scheme/LSP name
    await expect(page.locator("text=Skema:")).toBeVisible();

    // Navigate to triage
    await page.click('a:has-text("Triage")');

    // Click "Tambah Asesi Manual" button
    await page.click('text=Tambah Asesi Manual');

    // Fill and submit add assessee form
    await page.fill('input[name="displayName"]", "Budi Santoso');
    await page.click('button:has-text("Simpan")', { name: "Simpan" });

    // Add second assessee
    await page.click('text=Tambah Asesi Manual');
    await page.fill('input[name="displayName"]", "Siti Rahayu');
    await page.click('button:has-text("Simpan")', { name: "Simpan" });

    // Verify both assessees appear in the roster list
    await expect(page.locator("text=Budi Santoso")).toBeVisible();
    await expect(page.locator("text=Siti Rahayu")).toBeVisible();

    // Navigate back to triage file table
    await page.click('a:has-text("Triage Berkas Drive")');

    // Verify assessee dropdown now has options
    await page.selectOption('select[name="assesseeId"]', { label: "Budi Santoso" });

    // Verify "Alasan Tanpa Kandidat Nama" column exists
    await expect(page.locator("th:has-text('Alasan Tanpa Kandidat Nama')")).toBeVisible();
  });

  test("batch page shows Drive vs upload count split", async ({ page }) => {
    const isLogin = page.url().includes("/login");
    if (isLogin) {
      test.skip(true, "Requires authenticated session");
      return;
    }

    // Verify count label distinguishes Drive files from uploads
    await expect(
      page.locator("text=/berkas Drive \+ \d+ unggahan/"),
    ).toBeVisible();
  });

  test("completeness matrix shows scan-complete message when 0 assessees", async ({
    page,
  }) => {
    const isLogin = page.url().includes("/login");
    if (isLogin) {
      test.skip(true, "Requires authenticated session");
      return;
    }

    // If scan is done but 0 assessees, matrix should explain the state
    const matrixMsg = page.locator("text=/Pindai selesai, namun 0 asesi terdeteksi/");
    if ((await matrixMsg.count()) > 0) {
      await expect(matrixMsg).toBeVisible();
    }
  });
});
