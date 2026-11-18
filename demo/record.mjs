// Records a scripted demo of the running app (npm run dev on :5174) into demo/raw/.
// Usage: node demo/record.mjs
import { chromium } from 'playwright';
import fs from 'fs';

const URL = 'http://127.0.0.1:3000/';
const W = 1280, H = 800;
const OUT = 'demo/raw';
fs.rmSync(OUT, { recursive: true, force: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: OUT, size: { width: W, height: H } } });
const page = await ctx.newPage();
const t0 = Date.now();
const marks = [];
const mark = (name) => marks.push([name, (Date.now() - t0) / 1000]);
const sleep = (ms) => page.waitForTimeout(ms);

await page.goto(URL);
await page.waitForSelector('#source-text');

// overlays: a soft caption bar and a visible cursor
await page.addStyleTag({ content: `
  #demo-cap { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%) translateY(12px); z-index: 99999; max-width: 980px;
    padding: 12px 24px; border-radius: 14px; background: rgba(8,12,20,.82); color: #f1f5f9; font: 500 21px/1.4 "Segoe UI", system-ui, sans-serif;
    text-align: center; box-shadow: 0 8px 30px rgba(0,0,0,.45); border: 1px solid rgba(103,232,249,.25); opacity: 0; transition: opacity .35s, transform .35s; pointer-events: none; }
  #demo-cap.on { opacity: 1; transform: translateX(-50%) translateY(0); }
  #demo-cap small { display: block; font-size: 15px; color: #67e8f9; letter-spacing: .04em; margin-bottom: 2px; }
  #demo-cur { position: fixed; z-index: 100000; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; pointer-events: none;
    background: rgba(255,255,255,.9); box-shadow: 0 0 0 2px rgba(15,23,42,.6), 0 2px 8px rgba(0,0,0,.5); transition: transform .12s; left: -40px; top: -40px; }
  #demo-cur.down { transform: scale(.7); background: #67e8f9; }
  html { scroll-behavior: smooth; }
`});
await page.evaluate(() => {
  const c = document.createElement('div'); c.id = 'demo-cap'; document.body.append(c);
  const k = document.createElement('div'); k.id = 'demo-cur'; document.body.append(k);
  addEventListener('mousemove', e => { k.style.left = e.clientX + 'px'; k.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', () => k.classList.add('down'), true);
  addEventListener('mouseup', () => k.classList.remove('down'), true);
});

let mx = W / 2, my = H / 2;
await page.mouse.move(mx, my);
const cap = async (text, sub = '') => {
  await page.evaluate(([t, s]) => {
    const c = document.getElementById('demo-cap');
    c.classList.remove('on');
    setTimeout(() => { c.innerHTML = (s ? `<small>${s}</small>` : '') + t; if (t) c.classList.add('on'); }, t && c.textContent ? 300 : 0);
  }, [text, sub]);
  await sleep(450);
};
const moveTo = async (loc, dx = 0, dy = 0) => {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  const x = b.x + b.width / 2 + dx, y = b.y + b.height / 2 + dy;
  await page.mouse.move(x, y, { steps: 28 });
  mx = x; my = y;
};
const click = async (loc) => { await moveTo(loc); await sleep(250); await page.mouse.down(); await sleep(90); await page.mouse.up(); };
const scrollTo = async (y) => { await page.evaluate(v => scrollTo(0, v), y); await sleep(800); };
const scrollToEl = async (sel, offset = 120) => {
  await page.evaluate(([s, o]) => { const e = document.querySelector(s); scrollTo(0, e.getBoundingClientRect().top + scrollY - o); }, [sel, offset]);
  await sleep(900);
};
const pick = async (sel, value) => { await click(page.locator(sel)); await page.selectOption(sel, value); await sleep(500); };
const typeSource = async (text) => {
  const ta = page.locator('#source-text');
  await click(ta);
  await page.keyboard.press('Control+A'); await page.keyboard.press('Delete'); await sleep(300);
  await page.keyboard.type(text, { delay: 85 });
  await sleep(500);
};
const translate = async () => {
  await click(page.getByRole('button', { name: /^Translate$/ }));
  await page.waitForFunction(() => !document.body.innerText.includes('Translating...'), null, { timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('button[aria-label="Show sentiment analysis map"]').length >= 2, null, { timeout: 30000 });
  await sleep(900);
};
const emoji = (i) => page.locator('button[aria-label="Show sentiment analysis map"]').nth(i);
const showMaps = async () => {
  await scrollToEl('#source-text', 260);
  await cap('Click the emoji in the corner to open the sentiment map', 'Sentiment · formality · intimacy');
  await click(emoji(0)); await sleep(2600);
  await scrollToEl('#translated-text', 300);
  await click(emoji(1)); await sleep(800);
  await cap('The translation’s map: the dashed line shows how far the feeling moved');
  await sleep(3200);
  await page.mouse.move(80, 300, { steps: 20 }); await page.mouse.down(); await page.mouse.up();
  await sleep(500);
};

// ---------- intro ----------
mark('intro');
await sleep(600);
await cap('Sentiment Translator', 'A prototype from my research on modal particles and emoji');
await sleep(3200);
await cap('It translates a sentence, and checks whether its feeling survived the trip');
await sleep(3000);

// ---------- 1. Thai ----------
mark('thai');
await cap('นะ (na) adds a soft, caring touch to a question', '1 · Thai → English');
await pick('#target-language', 'en');
await typeSource('ไปไหนมานะ');
await translate();
await scrollToEl('#source-text', 150);
await cap('Nuance Analysis explains what a literal translation would lose');
await sleep(4200);
await showMaps();

// ---------- 2. German ----------
mark('german');
await scrollTo(0);
await cap('doch mal turns an invitation warm and casual', '2 · German → English');
await pick('#source-language', 'de');
await typeSource('Komm doch mal vorbei!');
await translate();
await scrollToEl('#source-text', 150);
await sleep(4000);
const sug = page.locator('button[aria-label^="Add "]');
if (await sug.count()) {
  mark('suggest');
  await scrollToEl('button[aria-label^="Add "]', 420);
  await cap('If feeling got lost, it suggests an emoji to carry it back');
  await sleep(2000);
  await click(sug.first()); await sleep(2600);
}
await showMaps();

// ---------- 3. Japanese ----------
mark('japanese');
await scrollTo(0);
await cap('ちょっと and ね (ne) soften a request into a friendly ask', '3 · Japanese → English');
await pick('#source-language', 'ja');
await typeSource('ちょっと待ってね');
await translate();
await scrollToEl('#source-text', 150);
await sleep(4000);
await showMaps();

// ---------- finale: switch to Korean ----------
mark('korean');
await scrollTo(0);
await cap('Now switch the target language to Korean…', 'One more thing');
await sleep(1200);
await pick('#target-language', 'ko');
await translate();
await scrollToEl('#source-text', 150);
await cap('…and the whole analysis speaks Korean too');
await sleep(4500);
await showMaps();

// ---------- outro ----------
mark('outro');
await scrollTo(0); await sleep(700);
await cap('Built on “Modalpartikeln: Can Sentiments Survive Translation with Emojis?” and “How Much Sentiment Can Be Carried by Modal Particles?”', 'Kai Park · github.com/bakeyeon/sentiment_translator');
await sleep(5000);
await cap('');
await sleep(800);
mark('end');

const video = page.video();
await ctx.close();
await browser.close();
fs.writeFileSync('demo/raw/marks.json', JSON.stringify(marks));
console.log('video:', await video.path());
console.log(marks.map(([n, t]) => `${n} ${t.toFixed(1)}s`).join(' | '));
