const { test, expect } = require('@playwright/test');
const { derive } = require('xrpl-accountlib');
const { createSite, trackedPage, generate, credentials, decodePNG, assertNoAPINetwork } = require('./helpers.cjs');

let site;
test.beforeAll(async () => { site = await createSite(); });
test.afterAll(async () => { await site?.close(); });

test('extracted local files generate offline and recover with independent library and QR decoder', async ({ browser }) => {
  const { context, page, requests } = await trackedPage(browser, { offline: true });
  try {
    await page.goto(site.file);
    await generate(page);
    const { address, seed } = await credentials(page);
    expect(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address), 'classic address format').toBe(true);
    expect(/^sEd[1-9A-HJ-NP-Za-km-z]+$/.test(seed), 'Ed25519 family seed format').toBe(true);
    const recovered = derive.familySeed(seed);
    const publicKey = await page.evaluate(value => xrpl.Wallet.fromSeed(value).publicKey, seed);
    expect(recovered.address === address, 'independent seed recovery matches address').toBe(true);
    expect(recovered.keypair.publicKey === publicKey, 'independent seed recovery matches public key').toBe(true);
    for (const [selector, expected] of [['#address-qr', address], ['#seed-qr', seed]]) {
      const svg = page.locator(`${selector} svg`);
      expect(await svg.count()).toBe(1);
      expect(decodePNG(await svg.screenshot()) === expected, 'displayed QR payload matches full credential').toBe(true);
      expect((await svg.boundingBox()).width).toBeGreaterThanOrEqual(160);
    }
    expect(await page.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
    expect(await page.locator('#result-heading').evaluate(element => element === document.activeElement)).toBe(true);
    expect(await page.evaluate(() => Object.keys(localStorage).length)).toBe(0);
    expect(await page.evaluate(() => Object.keys(sessionStorage).length)).toBe(0);
    await assertNoAPINetwork(page);
    expect(requests).toEqual([]);
  } finally { await context.close(); }
});

test('hosted load is same-origin and generation, replacement, and printing make no requests', async ({ browser }) => {
  const { context, page, requests } = await trackedPage(browser);
  try {
    await page.goto(site.url);
    await page.waitForLoadState('networkidle');
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every(url => new URL(url).origin === new URL(site.url).origin)).toBe(true);
    requests.length = 0;
    await generate(page);
    const first = await credentials(page);
    await generate(page);
    const second = await credentials(page);
    expect(first.address !== second.address && first.seed !== second.seed, 'regeneration creates a new complete wallet').toBe(true);
    for (const side of ['front', 'back']) {
      await page.locator(`button[data-print-side="${side}"]`).click();
      await expect.poll(() => page.evaluate(() => window.__prints.length)).toBe(side === 'front' ? 1 : 2);
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.printSide || '')).toBe('');
    }
    expect(await page.evaluate(() => window.__prints)).toEqual(['front', 'back']);
    expect((await credentials(page)).seed === second.seed, 'print cancellation retains the wallet').toBe(true);
    await assertNoAPINetwork(page);
    expect(requests).toEqual([]);
  } finally { await context.close(); }
});

test('confirmation explains risks and cancellation leaves the existing wallet unchanged', async ({ browser }) => {
  const { context, page } = await trackedPage(browser, { offline: true });
  try {
    await page.goto(site.file);
    let message = '';
    page.once('dialog', async dialog => { message = dialog.message(); await dialog.dismiss(); });
    await page.locator('#generate-paper-wallet').click();
    expect(/offline/i.test(message) && /seed|secret/i.test(message) && /backup|copies|back up/i.test(message)).toBe(true);
    await expect(page.locator('#wallet-result')).toBeHidden();
    await generate(page);
    const previous = await credentials(page);
    page.once('dialog', async dialog => { message = dialog.message(); await dialog.dismiss(); });
    await page.locator('#generate-paper-wallet').click();
    expect(/replac|previous|existing/i.test(message)).toBe(true);
    expect((await credentials(page)).seed === previous.seed, 'cancellation preserves displayed credentials').toBe(true);
    await expect(page.locator('#generation-error')).toBeHidden();
  } finally { await context.close(); }
});

for (const failure of ['wallet-library', 'qr-library', 'randomness', 'rendering', 'commit']) {
  test(`${failure} failure preserves the complete previous wallet`, async ({ browser }) => {
    const { context, page } = await trackedPage(browser, { offline: true });
    try {
      await page.goto(site.file);
      await generate(page);
      const before = await page.locator('#wallet-result').innerHTML();
      await page.evaluate(kind => {
        if (kind === 'wallet-library') window.xrpl = undefined;
        if (kind === 'qr-library') window.qrcode = undefined;
        if (kind === 'randomness') Crypto.prototype.getRandomValues = () => { throw new Error('Injected RNG failure'); };
        if (kind === 'rendering') window.qrcode = () => { throw new Error('Injected QR failure'); };
        if (kind === 'commit') {
          // Fail after text and several QR nodes have changed to exercise rollback.
          const result = document.querySelector('#qrcode-secret');
          const replace = result.replaceChildren;
          result.replaceChildren = function (...args) {
            this.replaceChildren = replace;
            throw new Error('Injected DOM commit failure');
          };
        }
      }, failure);
      page.once('dialog', dialog => dialog.accept());
      await page.locator('#generate-paper-wallet').click();
      await expect(page.locator('#generation-error')).toBeVisible();
      expect(await page.locator('#wallet-result').innerHTML() === before, 'failure must not replace any wallet credential or QR code').toBe(true);
    } finally { await context.close(); }
  });
}

test('missing dependency at page load disables generation with an actionable error', async ({ browser }) => {
  const { context, page } = await trackedPage(browser);
  try {
    await context.route('**/vendor/xrpl/**', route => route.abort());
    await page.goto(site.url);
    await expect(page.locator('#generate-paper-wallet')).toBeDisabled();
    await expect(page.locator('#generation-error')).toBeVisible();
    await expect(page.locator('#wallet-result')).toBeHidden();
  } finally { await context.close(); }
});

test('unavailable browser randomness at startup fails closed', async ({ browser }) => {
  const { context, page } = await trackedPage(browser, { offline: true });
  try {
    await context.addInitScript(() => { Crypto.prototype.getRandomValues = undefined; });
    await page.goto(site.file);
    await expect(page.locator('#generate-paper-wallet')).toBeDisabled();
    await expect(page.locator('#generation-error')).toBeVisible();
    await expect(page.locator('#wallet-result')).toBeHidden();
  } finally { await context.close(); }
});

test('asynchronous print cancellation restores controls and focus without replacing credentials', async ({ browser }) => {
  const { context, page } = await trackedPage(browser, { offline: true });
  try {
    await page.goto(site.file);
    await generate(page);
    const before = await credentials(page);
    await page.evaluate(() => { window.print = () => { window.dispatchEvent(new Event('beforeprint')); }; });
    for (const side of ['front', 'back']) {
      const trigger = page.locator(`button[data-print-side="${side}"]`);
      await trigger.click();
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.printSide)).toBe(side);
      await expect(page.locator('#generate-paper-wallet')).toBeDisabled();
      await expect(trigger).toBeDisabled();
      await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
      await expect(page.locator('#generate-paper-wallet')).toBeEnabled();
      await expect(trigger).toBeEnabled();
      expect(await trigger.evaluate(element => element === document.activeElement)).toBe(true);
      expect((await credentials(page)).seed === before.seed).toBe(true);
    }
    await assertNoAPINetwork(page);
  } finally { await context.close(); }
});

test('print preparation failure restores the generator and reports an error', async ({ browser }) => {
  const { context, page } = await trackedPage(browser, { offline: true });
  try {
    await page.goto(site.file);
    await generate(page);
    await page.locator('#front-artwork').evaluate(image => { image.decode = () => Promise.reject(new Error('Injected artwork failure')); });
    await page.locator('button[data-print-side="front"]').click();
    await expect(page.locator('#print-error')).toBeVisible();
    await expect(page.locator('#generate-paper-wallet')).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.dataset.printSide || '')).toBe('');
    expect(await page.evaluate(() => window.__prints)).toEqual([]);
  } finally { await context.close(); }
});

for (const width of [320, 390, 1440]) {
  test(`readable layout, focus, and controls at ${width}px`, async ({ browser }) => {
    const { context, page } = await trackedPage(browser, { offline: true, viewport: { width, height: 900 } });
    try {
      await page.goto(site.file);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(page.locator('#generate-paper-wallet')).toBeEnabled();
      await page.locator('#generate-paper-wallet').focus();
      page.once('dialog', dialog => dialog.accept());
      await page.keyboard.press('Enter');
      await expect(page.locator('#wallet-result')).toBeVisible();
      expect(await page.locator('#result-heading').evaluate(element => element === document.activeElement)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      for (const selector of ['#address-qr svg', '#seed-qr svg']) expect((await page.locator(selector).boundingBox()).width).toBeGreaterThanOrEqual(160);
      for (const selector of ['#generate-paper-wallet', 'button[data-print-side="front"]', 'button[data-print-side="back"]']) {
        const box = await page.locator(selector).boundingBox();
        expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
      }
      expect(await page.locator('#wallet-result').evaluate(element => parseFloat(getComputedStyle(element).animationDuration) || 0)).toBeLessThanOrEqual(0.001);
      if (width === 1440) {
        // 200% CSS zoom exercises reflow and text sizing; not a device test.
        await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      }
    } finally { await context.close(); }
  });
}

test('CSP blocks attempted connections and contains no remote runtime assets', async ({ browser }) => {
  const { context, page } = await trackedPage(browser, { offline: true });
  try {
    await page.goto(site.file);
    expect(await page.locator('[onclick], script[src^="http"], link[rel="stylesheet"][href^="http"], iframe').count()).toBe(0);
    expect(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')).toMatch(/connect-src\s+'none'/);
    const blocked = await page.evaluate(async () => {
      let violation = false;
      document.addEventListener('securitypolicyviolation', event => { if (event.violatedDirective === 'connect-src') violation = true; });
      try { await fetch('https://example.invalid/connection-probe'); } catch {}
      await new Promise(resolve => setTimeout(resolve, 30));
      return violation;
    });
    expect(blocked).toBe(true);
  } finally { await context.close(); }
});

test('utility text and controls meet AA contrast and expose keyboard focus', async ({ browser }) => {
  const { context, page } = await trackedPage(browser, { offline: true });
  try {
    await page.goto(site.file);
    await generate(page);
    const ratios = await page.evaluate(() => {
      const luminance = color => {
        const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
          const scaled = value / 255;
          return scaled <= .04045 ? scaled / 12.92 : ((scaled + .055) / 1.055) ** 2.4;
        });
        return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
      };
      const selectors = ['body', '.lead', '.notice', '.status', '.credential-copy p', '#wallet-address', '#wallet-seed', '#generate-paper-wallet', '#download-zip', 'button[data-print-side="front"]', 'button[data-print-side="back"]'];
      return selectors.map(selector => {
        const element = document.querySelector(selector);
        const style = getComputedStyle(element);
        let parent = element;
        let background;
        do {
          background = getComputedStyle(parent).backgroundColor;
          parent = parent.parentElement;
        } while (parent && /^(transparent|rgba\([^)]*,\s*0\))$/.test(background));
        const foreground = luminance(style.color);
        const surface = luminance(background);
        return { selector, ratio: (Math.max(foreground, surface) + .05) / (Math.min(foreground, surface) + .05) };
      });
    });
    for (const { selector, ratio } of ratios) expect(ratio, `${selector} text contrast`).toBeGreaterThanOrEqual(4.5);
    await page.locator('button[data-print-side="front"]').focus();
    // macOS WebKit uses Option-Tab for all controls when full keyboard
    // navigation is disabled in the platform defaults.
    const tabKey = browser.browserType().name() === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
    await page.keyboard.press(tabKey);
    const focus = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement);
      return { width: parseFloat(style.outlineWidth), style: style.outlineStyle, visible: document.activeElement.matches(':focus-visible') };
    });
    expect(focus.visible).toBe(true);
    expect(focus.width).toBeGreaterThanOrEqual(2);
    expect(focus.style).not.toBe('none');
    const { seed } = await credentials(page);
    const liveText = await page.locator('[role="status"], [role="alert"], [aria-live]').allTextContents();
    expect(liveText.every(text => !text.includes(seed)), 'live announcements must not speak the seed').toBe(true);
  } finally { await context.close(); }
});
