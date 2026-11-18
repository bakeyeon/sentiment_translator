// Records a scripted, narrated demo of the running app (npm run dev on :3000) into demo/raw/.
// Every caption, voice line, click, map opening and translation result is logged to demo/raw/events.json
// so demo/mix.py can lay the narration and sound effects on exactly. Run demo/tts.py first.
// Usage: node demo/record.mjs
import { chromium } from 'playwright';
import fs from 'fs';

const URL = 'http://127.0.0.1:3000/';
const W = 1280, H = 800;
const OUT = 'demo/raw';
const DUR = JSON.parse(fs.readFileSync('demo/voice/durations.json', 'utf8'));
fs.rmSync(OUT, { recursive: true, force: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: OUT, size: { width: W, height: H } } });
const t0 = Date.now();
const page = await ctx.newPage();
const events = [];
const log = (type, extra = {}) => events.push({ type, t: (Date.now() - t0) / 1000, ...extra });
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

await page.mouse.move(W / 2, H / 2);
let voiceEnd = 0;
// wait until the current voice line has finished, plus a breath
const settle = async (gap = 350) => { const left = voiceEnd + gap - Date.now(); if (left > 0) await sleep(left); };
// show a caption and (optionally) start a voice line with it
const cap = async (text, sub = '', voice = null) => {
  await settle();
  await page.evaluate(([t, s]) => {
    const c = document.getElementById('demo-cap');
    c.classList.remove('on');
    setTimeout(() => { c.innerHTML = (s ? `<small>${s}</small>` : '') + t; if (t) c.classList.add('on'); }, t && c.textContent ? 300 : 0);
  }, [text, sub]);
  if (voice) {
    await sleep(330);
    log('voice', { id: voice });
    voiceEnd = Date.now() + DUR[voice] * 1000;
    await sleep(120);
  } else {
    await sleep(450);
  }
};
// keep the scene for at least ms, and until the voice line is done
const hold = async (ms) => { const until = Math.max(Date.now() + ms, voiceEnd + 300); await sleep(until - Date.now()); };
const moveTo = async (loc) => {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 28 });
};
const click = async (loc, kind = 'click') => { await moveTo(loc); await sleep(250); log(kind); await page.mouse.down(); await sleep(90); await page.mouse.up(); };
const scrollTo = async (y) => { await page.evaluate(v => scrollTo(0, v), y); await sleep(900); };
const scrollToEl = async (sel, offset = 120) => {
  await page.evaluate(([s, o]) => { const e = document.querySelector(s); scrollTo(0, e.getBoundingClientRect().top + scrollY - o); }, [sel, offset]);
  await sleep(900);
};
const pick = async (sel, value) => { await click(page.locator(sel)); await page.selectOption(sel, value); await sleep(500); };
const typeSource = async (text) => {
  const ta = page.locator('#source-text');
  await click(ta);
  await page.keyboard.press('Control+A'); await page.keyboard.press('Delete'); await sleep(300);
  log('type_start');
  await page.keyboard.type(text, { delay: 85 });
  log('type_end');
  await sleep(500);
};
const translate = async () => {
  await click(page.getByRole('button', { name: /^Translate$/ }), 'translate');
  await page.waitForFunction(() => !document.body.innerText.includes('Translating...'), null, { timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('button[aria-label="Show sentiment analysis map"]').length >= 2, null, { timeout: 30000 });
  log('result');
  await sleep(900);
};
const emoji = (i) => page.locator('button[aria-label="Show sentiment analysis map"]').nth(i);
const showMaps = async (firstVoice, translatedVoice) => {
  await scrollToEl('#source-text', 260);
  await cap('Click the emoji in the corner to open the sentiment map', 'Sentiment · formality · intimacy', firstVoice);
  await click(emoji(0), 'map'); await hold(2600);
  await scrollToEl('#translated-text', 300);
  await click(emoji(1), 'map'); await sleep(800);
  await cap('The translation’s map: the dashed line shows how far the feeling moved', '', translatedVoice);
  await hold(3200);
  await page.mouse.move(80, 300, { steps: 20 }); log('click'); await page.mouse.down(); await page.mouse.up();
  await sleep(500);
};

// ---------- intro ----------
await sleep(600);
await cap('Sentiment Translator', 'A prototype from my research on modal particles and emoji', 'intro1');
await hold(3200);
await cap('It translates a sentence, and checks whether its feeling survived the trip', '', 'intro2');
await hold(2600);

// ---------- 1. Thai ----------
await cap('นะ (na) adds a soft, caring touch to a question', '1 · Thai → English', 'thai');
await pick('#target-language', 'en');
await typeSource('ไปไหนมานะ');
await settle(150);
await translate();
await scrollToEl('#source-text', 150);
await cap('Nuance Analysis explains what a literal translation would lose', '', 'nuance');
await hold(4200);
await showMaps('map1', 'map2');

// ---------- 2. German ----------
await scrollTo(0);
await cap('doch mal turns an invitation warm and casual', '2 · German → English', 'german');
await pick('#source-language', 'de');
await typeSource('Komm doch mal vorbei!');
await settle(150);
await translate();
await scrollToEl('#source-text', 150);
await hold(3600);
await showMaps('map1b', null);

// ---------- 3. Japanese ----------
await scrollTo(0);
await cap('ちょっと and ね (ne) soften a request into a friendly ask', '3 · Japanese → English', 'japanese');
await pick('#source-language', 'ja');
await typeSource('ちょっと待ってね');
await settle(150);
await translate();
await scrollToEl('#source-text', 150);
await hold(3600);
await showMaps('map1c', null);

// ---------- finale: switch to Korean ----------
await scrollTo(0);
await cap('Now switch the target language to Korean…', 'One more thing', 'korean1');
await hold(1000);
await pick('#target-language', 'ko');
await settle(150);
await translate();
await scrollToEl('#source-text', 150);
await cap('…and the whole analysis speaks Korean too', '', 'korean2');
await hold(4200);
await showMaps('map1d', null);

// ---------- outro ----------
await scrollTo(0); await sleep(700);
await cap('Built on “Modalpartikeln: Can Sentiments Survive Translation with Emojis?” and “How Much Sentiment Can Be Carried by Modal Particles?”', 'Kai Park · github.com/bakeyeon/sentiment_translator', 'outro');
await hold(5200);
await cap('');
await sleep(1200);
log('end');

const video = page.video();
await ctx.close();
await browser.close();
fs.writeFileSync('demo/raw/events.json', JSON.stringify(events, null, 1));
console.log('video:', await video.path());
console.log(events.filter(e => e.type === 'voice').map(e => `${e.id}@${e.t.toFixed(1)}`).join(' '));
console.log('end', events.at(-1).t.toFixed(1), 'clicks', events.filter(e => e.type === 'click').length, 'maps', events.filter(e => e.type === 'map').length);
