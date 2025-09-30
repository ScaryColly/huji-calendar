import { chromium } from "playwright";
import { createButton, downloadSection } from "./functions.js";

(async () => {
  const BTN_ID = "__uni_ics_export_btn";
  const PAGE_URL = "https://orbitlive.huji.ac.il/StudentScheduleList.aspx";
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    acceptDownloads: true,
    downloadsPath: "./downloads",
  });
  const page = await context.newPage();

  console.log("Opening site… Login manually, I’ll wait.");
  await page.goto(PAGE_URL, {
    waitUntil: "domcontentloaded",
  });

  await page.click("#pills-email-tab");

  const POST_LOGIN_SELECTOR = "#ContentPlaceHolder1_lnkMatrixPeriodSchedule";

  await page.waitForSelector(POST_LOGIN_SELECTOR, { timeout: 0 });
  console.log("Detected logged-in UI. Continuing automation…");

  await page.click(POST_LOGIN_SELECTOR);

  await page.click("#tvMainn6");

  await createButton(page);
  await downloadSection(page, BTN_ID);

  const NEXT_BUTTON =
    "#ContentPlaceHolder1_gvData > tbody > tr:nth-child(12) > td > table > tbody > tr > td:nth-child(3) > a";

  while (await page.$(NEXT_BUTTON)) {
    await Promise.all([page.waitForURL(PAGE_URL), page.click(NEXT_BUTTON)]);
    await page.reload({ waitUntil: "domcontentloaded" });

    await createButton(page);
    await downloadSection(page, BTN_ID);
  }
})();
