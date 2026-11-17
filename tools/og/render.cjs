// 사용: python3 -m http.server 8765 를 띄운 뒤  node tools/og/render.cjs
// playwright는 ../app/node_modules 의 것을 씀
const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../../../app/node_modules/playwright'));
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    await page.goto('http://localhost:8765/tools/og/og.html');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.resolve(__dirname, '../../resources/images/og-image.png') });
    await browser.close();
})();
