import { expect, test } from "@playwright/test";
import {
  clickFindRoute,
  closeAutocomplete,
  expectOption,
  fillFrom,
  fromInput,
  optionByText,
  prepareApp,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await prepareApp(page);
});

test.describe("autocomplete and language behavior", () => {
  test("one-character input does not show suggestions", async ({ page }) => {
    await fillFrom(page, "נ");

    await expect(page.getByRole("option")).toHaveCount(0);
  });

  test("Hebrew and English street prefixes show matching municipality street options", async ({ page }) => {
    await fillFrom(page, "נמי");
    await expectOption(page, "נמיר מרדכי");

    await fillFrom(page, "nami");
    await expectOption(page, "NAMIR");
  });

  test("Hebrew local results are not filled with English external suggestions", async ({ page }) => {
    await page.unroute("https://nominatim.openstreetmap.org/**");
    await page.route("https://nominatim.openstreetmap.org/**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify([
          {
            lat: "32.064",
            lon: "34.856",
            display_name:
              "Ne'omi Shemer, Shchunat HaAcademaim, Or Yehuda, Tel Aviv District, Israel",
          },
          {
            lat: "32.087",
            lon: "34.789",
            display_name: "NAMIR, Tel Aviv, Israel",
          },
        ]),
      });
    });

    await fillFrom(page, "נמי");
    await expectOption(page, "נמיר מרדכי");
    await expect(page.getByRole("option").filter({ hasText: "Ne'omi" })).toHaveCount(0);
    await expect(page.getByRole("option").filter({ hasText: "NAMIR" })).toHaveCount(0);
  });

  test("multi-word streets appear in Hebrew and English", async ({ page }) => {
    const cases = [
      ["אבן", "אבן גבירול"],
      ["שאו", "שאול המלך"],
      ["יהו", "יהודה הלוי"],
      ["roka", "ROKACH YISRA'EL"],
      ["name", "NAMEL TEL AVIV"],
    ];

    for (const [query, expected] of cases) {
      await fillFrom(page, query);
      await expectOption(page, expected);
    }
  });

  test("Hebrew quote variants and English apostrophe variants work", async ({ page }) => {
    await fillFrom(page, "אדם");
    await expectOption(page, 'אד"ם הכהן');

    await fillFrom(page, "אד״ם");
    await expectOption(page, 'אד"ם הכהן');

    await fillFrom(page, "yiga");
    await expectOption(page, "YIG'AL ALLON");
  });

  test("fuzzy typo correction suggests close street matches", async ({ page }) => {
    await fillFrom(page, "נמירר");
    await expectOption(page, "נמיר מרדכי");

    await fillFrom(page, "namr");
    await expectOption(page, "NAMIR");
  });

  test("school prefix shows school results before same-name street behavior", async ({ page }) => {
    await fillFrom(page, "בית ספר אהבת ציון");
    await expectOption(page, "בית ספר אהבת ציון, כהנשטם 16");

    await fillFrom(page, "בה״ס אהבת ציון");
    await expectOption(page, "בית ספר אהבת ציון, כהנשטם 16");
  });

  test("street-only input is not routable without a building number even when geocoder returns a street", async ({ page }) => {
    await page.unroute("https://nominatim.openstreetmap.org/**");
    await page.route("https://nominatim.openstreetmap.org/**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify([
          {
            lat: "32.0879",
            lon: "34.7892",
            display_name: "נמיר מרדכי, Tel Aviv, Israel",
          },
        ]),
      });
    });

    await fillFrom(page, "נמיר מרדכי");
    await expect(page.getByText("Enter building number")).toBeVisible();

    await fillFrom(page, "נמיר מרדכי 10");
    await expect(page.getByText("Enter building number")).toHaveCount(0);

    await fillFrom(page, "Namir");
    await expect(page.getByText("Enter building number")).toBeVisible();

    await fillFrom(page, "נמיר מרדכי");
    await page.getByPlaceholder("Example: Tel Aviv Port").fill("Tel Aviv Port");
    await closeAutocomplete(page);
    await clickFindRoute(page);

    await expect(page.getByText("Please enter a full address with building number for נמיר מרדכי.")).toBeVisible();
  });

  test("known regression searches remain visible", async ({ page }) => {
    await fillFrom(page, "אד״ם");
    await expectOption(page, 'אד"ם הכהן');

    await fillFrom(page, "משה שרת 80");
    await expectOption(page, "שרת משה 80");

    await fillFrom(page, "בן יהודה");
    await expectOption(page, "בן יהודה");
  });

  test("selecting an autocomplete option fills the address field", async ({ page }) => {
    await fillFrom(page, "נמי");
    await optionByText(page, "נמיר מרדכי").first().click();

    await expect(fromInput(page)).toHaveValue("נמיר מרדכי");
  });

  test("keyboard navigation selects autocomplete options", async ({ page }) => {
    await fillFrom(page, "נמי");
    await expectOption(page, "נמיר מרדכי");

    await fromInput(page).press("ArrowDown");
    await expect(optionByText(page, "נמיר מרדכי").first()).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await fromInput(page).press("Enter");
    await expect(fromInput(page)).toHaveValue("נמיר מרדכי");
    await expect(page.getByRole("option")).toHaveCount(0);
  });

  test("escape closes autocomplete suggestions", async ({ page }) => {
    await fillFrom(page, "נמי");
    await expectOption(page, "נמיר מרדכי");

    await fromInput(page).press("Escape");
    await expect(page.getByRole("option")).toHaveCount(0);
  });
});
