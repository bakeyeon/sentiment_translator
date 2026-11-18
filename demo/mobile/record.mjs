// Records the app at phone size (light mode, touch) for the mobile demo, into demo/mobile/raw/.
// Logs every voice line, card, tap, map opening and translation result to demo/mobile/raw/events.json,
// which compose.py uses to lay out cards, captions, zoomed maps and audio.
// Needs the app running (npm run dev, or APP_URL) and demo/mobile/tts.py run first.
// Usage: node demo/mobile/record.mjs
import { chromium } from 'playwright';
import fs from 'fs';

const APP_URL = process.env.APP_URL || 'http://127.0.0.1:3000/';
const W = 390, H = 844, SCALE = 2;
const OUT = 'demo/mobile/raw';
const DUR = JSON.parse(fs.readFileSync('demo/mobile/voice/durations.json', 'utf8'));
fs.rmSync(OUT, { recursive: true, force: true });

// ---------- real API answers, fetched up front with retries ----------
// Gemini is sometimes overloaded (503). To keep the recording smooth, every API call the app makes is
// answered from real responses fetched before (or, if new, during) the recording, retried until they succeed.
const API = new URL(APP_URL).origin;
const CACHE_FILE = 'demo/mobile/api-cache.json';
const cache = new Map(fs.existsSync(CACHE_FILE) ? Object.entries(JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))) : []);
const saveCache = () => fs.writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(cache), null, 1));
const models = [];
const callApi = async (path, body) => {
  const key = path + body;
  if (cache.has(key)) return cache.get(key);
  for (let attempt = 1; attempt <= 12; attempt++) {
    const res = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    const text = await res.text();
    if (res.ok) {
      models.push(`${path.split('/').pop()}: ${res.headers.get('x-gemini-model')}`);
      cache.set(key, text);
      saveCache();
      return text;
    }
    console.log(`  ${path} ${res.status}, retry ${attempt}`);
    await new Promise(r => setTimeout(r, 15000));
  }
  throw new Error(`gave up on ${path}`);
};
for (const [text, src, tgt] of [['ไปไหนมานะ', 'th', 'English'], ['Komm doch mal vorbei!', 'de', 'English'], ['ちょっと待ってね', 'ja', 'English'], ['ちょっと待ってね', 'ja', 'Korean']]) {
  await callApi('/api/gemini/translate', JSON.stringify({ text, sourceLanguageCode: src, targetLanguageName: tgt }));
  console.log('prefetched', src, '→', tgt);
}

const browser = await chromium.launch({ args: ['--force-device-scale-factor=2'] });
const ctx = await browser.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true,
});
await ctx.addInitScript(() => { try { localStorage.setItem('theme', 'light'); } catch {} });
// answer API calls from the cache, with a short "thinking" delay so the spinner still shows
await ctx.route('**/api/gemini/**', async (route) => {
  const path = new URL(route.request().url()).pathname;
  const started = Date.now();
  const body = await callApi(path, route.request().postData() || '');
  const wait = 2200 - (Date.now() - started);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  await route.fulfill({ status: 200, contentType: 'application/json', body });
});
const page = await ctx.newPage();
// Chrome's screencast sends a frame whenever the screen changes, at full device-pixel resolution.
fs.mkdirSync(`${OUT}/frames`, { recursive: true });
const frames = [];
const cdp = await ctx.newCDPSession(page);
cdp.on('Page.screencastFrame', async (f) => {
  const file = `${OUT}/frames/${String(frames.length).padStart(6, '0')}.jpg`;
  frames.push({ file, ts: f.metadata.timestamp });
  fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
  try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W * SCALE, maxHeight: H * SCALE, everyNthFrame: 1 });
const t0 = Date.now();
const events = [];
const log = (type, extra = {}) => events.push({ type, t: (Date.now() - t0) / 1000, ...extra });
const sleep = (ms) => page.waitForTimeout(ms);

await page.goto(APP_URL);
await page.waitForSelector('#source-text');
await page.addStyleTag({ content: `
  .demo-tap { position: fixed; z-index: 100000; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; pointer-events: none;
    background: rgba(56,189,248,.28); border: 2px solid rgba(14,165,233,.55); animation: demo-tap .6s ease-out forwards; }
  @keyframes demo-tap { from { transform: scale(.4); opacity: 1; } to { transform: scale(1.5); opacity: 0; } }
  html { scroll-behavior: smooth; }
`});

let voiceEnd = 0;
const settle = async (gap = 350) => { const left = voiceEnd + gap - Date.now(); if (left > 0) await sleep(left); };
const say = async (id) => { await settle(); log('voice', { id }); voiceEnd = Date.now() + DUR[id] * 1000; };
const card = (id, extra = {}) => log('card', { id, ...extra });
const hold = async (ms) => { const until = Math.max(Date.now() + ms, voiceEnd + 300); await sleep(until - Date.now()); };
const ripple = (x, y) => page.evaluate(([x, y]) => {
  const d = document.createElement('div'); d.className = 'demo-tap'; d.style.left = x + 'px'; d.style.top = y + 'px';
  document.body.append(d); setTimeout(() => d.remove(), 700);
}, [x, y]);
const tap = async (loc, kind = 'tap') => {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await sleep(350);
  log(kind, { x, y });
  await ripple(x, y);
  await loc.tap();
};
const scrollTo = async (y) => { await page.evaluate(v => scrollTo(0, v), y); await sleep(900); };
const scrollToEl = async (sel, offset) => {
  await page.evaluate(([s, o]) => { const e = document.querySelector(s); scrollTo(0, e.getBoundingClientRect().top + scrollY - o); }, [sel, offset]);
  await sleep(900);
};
const pick = async (sel, value) => { await tap(page.locator(sel)); await sleep(250); await page.selectOption(sel, value); await sleep(600); };
const typeSource = async (text) => {
  await tap(page.locator('#source-text'));
  await page.keyboard.press('Control+A'); await page.keyboard.press('Delete'); await sleep(250);
  await page.keyboard.type(text, { delay: 95 });
  await sleep(400);
};
const translate = async () => {
  await tap(page.getByRole('button', { name: /^Translate$/ }), 'translate');
  await page.waitForFunction(() => !document.body.innerText.includes('Translating...'), null, { timeout: 90000 });
  await page.waitForFunction(() => document.querySelectorAll('button[aria-label="Show sentiment analysis map"]').length >= 2, null, { timeout: 30000 });
  log('result');
  await sleep(700);
};
const emoji = (i) => page.locator('button[aria-label="Show sentiment analysis map"]').nth(i);
const mapBox = async (i) => {
  const box = await emoji(i).locator('xpath=preceding-sibling::div[1]').boundingBox();
  return { x: box.x, y: box.y, w: box.width, h: box.height };
};
const openMap = async (i, cardId) => {
  await tap(emoji(i), 'map');
  await sleep(450);
  card(cardId, { rect: await mapBox(i), which: i === 0 ? 'original' : 'translation' });
};
// close an open map the way an outside touch would, without tapping anything on screen
const closeMap = async () => {
  log('close');
  await page.evaluate(() => document.body.dispatchEvent(new TouchEvent('touchstart', { bubbles: true })));
  await sleep(450);
};
const showMaps = async (voiceFirst, voiceAxes, voiceSecond) => {
  await scrollToEl('#source-text', 330);
  if (voiceFirst) await say(voiceFirst);
  await openMap(0, 'map-original');
  if (voiceAxes) await say(voiceAxes);
  await hold(2600);
  await closeMap();
  await scrollToEl('#translated-text', 330);
  await openMap(1, 'map-translation');
  if (voiceSecond) await say(voiceSecond);
  await hold(3000);
  await closeMap();
};
const example = async (n, from, to, label, voice, text, source, targetFirst) => {
  await scrollTo(0);
  card('example', { label: `${n} · ${from} → ${to}`, text });
  await say(voice);
  if (targetFirst) await pick('#target-language', targetFirst);
  if (source) await pick('#source-language', source);
  await typeSource(text);
  await settle(150);
  await translate();
  await scrollToEl('#source-text', 70);
};

// ---------- intro ----------
await sleep(700);
card('intro');
await say('intro1');
await hold(800);
await say('intro2');
await hold(600);

// ---------- 1. Thai ----------
await example(1, 'Thai', 'English', '', 'thai', 'ไปไหนมานะ', null, 'en');
card('nuance');
await say('nuance');
await hold(3200);
await showMaps('map1', 'axes', 'map2');

// ---------- 2. German ----------
await example(2, 'German', 'English', '', 'german', 'Komm doch mal vorbei!', 'de', null);
card('nuance');
await hold(3000);
await showMaps('mapb', null, null);

// ---------- 3. Japanese ----------
await example(3, 'Japanese', 'English', '', 'japanese', 'ちょっと待ってね', 'ja', null);
card('nuance');
await hold(3000);
await showMaps('mapc', null, null);

// ---------- 4. switch to Korean ----------
await scrollTo(0);
card('language');
await say('korean1');
await pick('#target-language', 'ko');
await settle(150);
await translate();
await scrollToEl('#source-text', 70);
await say('korean2');
await hold(3200);
await scrollToEl('#translated-text', 330);
await openMap(1, 'map-translation');
await hold(3000);
await closeMap();

// ---------- rubric + outro ----------
await scrollTo(0);
card('rubric');
await say('rubric');
await hold(1200);
card('outro');
await say('outro');
await hold(1800);
log('end');

await cdp.send('Page.stopScreencast');
await ctx.close();
// ffmpeg concat list: each frame lasts until the next one; times are relative to t0 like the events
const start = t0 / 1000, endT = events.at(-1).t;
const lines = [];
frames.forEach((f, i) => {
  const from = i === 0 ? 0 : f.ts - start;
  const to = i + 1 < frames.length ? frames[i + 1].ts - start : endT;
  if (to > from) lines.push(`file '${f.file.split('/').pop()}'`, `duration ${(to - from).toFixed(4)}`);
});
lines.push(lines.at(-2));
fs.writeFileSync(`${OUT}/frames/list.txt`, lines.join('\n'));
await browser.close();
fs.writeFileSync(`${OUT}/events.json`, JSON.stringify(events, null, 1));
console.log('frames:', frames.length);
console.log('end', events.at(-1).t.toFixed(1), '| voices', events.filter(e => e.type === 'voice').length, '| maps', events.filter(e => e.type === 'map').length);
console.log('answered by:', models.join(' | '));
