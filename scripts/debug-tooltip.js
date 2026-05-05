const { chromium } = require('playwright');

(async () => {
  const url = process.env.DEBUG_TOOLTIP_URL || 'http://localhost:3000/creator';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1200);
    const iframe = await page.$('iframe');
    if (!iframe) {
      console.log('NO_IFRAME');
      await browser.close();
      return;
    }
    const box = await iframe.boundingBox();
    if (box) {
      // move mouse to center of iframe to trigger hover
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(600);
    }
    const tooltip = await page.$('[role="tooltip"]');
    if (!tooltip) {
      console.log('NO_TOOLTIP');
    } else {
      const text = (await tooltip.innerText()).trim();
      console.log('TOOLTIP_TEXT_START');
      console.log(text);
      console.log('TOOLTIP_TEXT_END');
    }
  } catch (err) {
    console.error('ERROR', err && err.message);
  } finally {
    await browser.close();
  }
})();
