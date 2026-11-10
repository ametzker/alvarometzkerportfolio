import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({viewport:{width,height:960}});
    const errors=[];
    page.on('pageerror', error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
    await page.locator('[data-enter-site]').click();
    await page.locator('[data-entry-gate]').waitFor({state:'detached'});
    await page.locator('[data-scroll-target="photography"]').click();
    const photos=page.locator('.photography__open img');
    await expect(photos).toHaveCount(9);
    for (const photo of await photos.all()) {
      await photo.scrollIntoViewIfNeeded();
      await expect.poll(()=>photo.evaluate(img=>img.complete && img.naturalWidth>0)).toBe(true);
      await expect.poll(()=>photo.evaluate(img=>Math.abs(img.clientWidth/img.clientHeight-img.naturalWidth/img.naturalHeight)<0.03)).toBe(true);
    }
    await page.locator('#photography').scrollIntoViewIfNeeded();
    await page.screenshot({path:`/tmp/photography-${width}.png`});
    await page.locator('[data-photo="0"]').click();
    await expect(page.locator('.photo-viewer')).toBeVisible();
    await expect(page.locator('[data-photo-count]')).toHaveText('01 / 09');
    await page.locator('[data-photo-step="1"]').click();
    await expect(page.locator('[data-photo-count]')).toHaveText('02 / 09');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-photo-count]')).toHaveText('01 / 09');
    await page.keyboard.press('Escape');
    await expect(page.locator('.photo-viewer')).not.toBeVisible();
    await expect(page.locator('[data-photo="0"]')).toBeFocused();
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    if(errors.length) throw new Error(errors.join('\n'));
    console.log(`Gallery images, proportions, viewer, keyboard and layout passed at ${width}px.`);
    await page.close();
  }
} finally {await browser.close();}
