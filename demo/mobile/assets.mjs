// Renders the stage graphics for the mobile demo as PNGs (background, phone frame, cards, captions)
// into demo/mobile/build/, plus build/timeline.json for compose.py.
// Usage: node demo/mobile/assets.mjs   (after record.mjs)
import { chromium } from 'playwright';
import fs from 'fs';

const OUT = 'demo/mobile/build';
fs.mkdirSync(OUT, { recursive: true });
const events = JSON.parse(fs.readFileSync('demo/mobile/raw/events.json', 'utf8'));
const script = JSON.parse(fs.readFileSync('demo/mobile/script.json', 'utf8'));
const DUR = JSON.parse(fs.readFileSync('demo/mobile/voice/durations.json', 'utf8'));
const END = events.at(-1).t;

// ---------- layout (1920x1080) ----------
export const L = {
  W: 1920, H: 1080,
  screen: { x: 304, y: 92, w: 416, h: 900 },        // phone video area (780x1688 scaled)
  bezel: 16,
  card: { x: 870, y: 178, w: 900, h: 600 },
  zoom: { x: 40, y: 92, w: 448, h: 480 },           // inside the card
  caption: { x: 870, y: 818, w: 900 },
};

const LOGO = `<svg viewBox="0 0 48 48"><defs><linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset=".55" stop-color="#38bdf8"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient><linearGradient id="b" x1="0" x2="1"><stop offset="0" stop-color="#f87171"/><stop offset=".5" stop-color="#facc15"/><stop offset="1" stop-color="#4ade80"/></linearGradient></defs><rect x="2" y="2" width="44" height="44" rx="13" fill="url(#t)"/><rect x="10" y="10.5" width="28" height="3.6" rx="1.8" fill="url(#b)"/><path d="M15.5 34 L31 23.5" stroke="#fff" stroke-width="2" stroke-dasharray="2.6 2.6" stroke-linecap="round"/><circle cx="15.5" cy="34" r="4" fill="none" stroke="#fff" stroke-width="2.2"/><circle cx="31" cy="23.5" r="4.6" fill="#fff"/></svg>`;

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;600;700&family=Inter:wght@400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; }
  body { font-family: Inter, 'Segoe UI', system-ui, sans-serif; color: #1e293b; background: transparent; }
  .sora { font-family: Sora, Inter, sans-serif; }
  .grad { background: linear-gradient(90deg, #06b6d4, #0ea5e9, #8b5cf6); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .card { width: ${L.card.w}px; height: ${L.card.h}px; padding: 40px 44px; border-radius: 32px;
    background: rgba(255,255,255,.72); border: 1.5px solid rgba(255,255,255,.9);
    box-shadow: 0 24px 60px rgba(15,23,42,.10), 0 2px 6px rgba(15,23,42,.04); backdrop-filter: blur(24px); position: relative; }
  .chip { display: inline-block; padding: 8px 18px; border-radius: 999px; font: 600 22px Inter, sans-serif; color: #0e7490; background: rgba(207,250,254,.9); border: 1px solid rgba(103,232,249,.6); }
  h2 { font: 700 46px/1.15 Sora, sans-serif; letter-spacing: -.01em; margin: 18px 0 14px; }
  p { font-size: 28px; line-height: 1.45; color: #475569; }
  .row { display: flex; align-items: center; gap: 16px; font-size: 26px; color: #334155; margin: 14px 0; }
  .ico { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; background: rgba(241,245,249,.9); font-size: 24px; flex: none; }
  .bar { width: 44px; height: 10px; border-radius: 5px; background: linear-gradient(90deg,#ef4444,#facc15,#22c55e); }
  .slot { position: absolute; left: ${L.zoom.x}px; top: ${L.zoom.y}px; width: ${L.zoom.w}px; height: ${L.zoom.h}px; border-radius: 22px;
    box-shadow: 0 0 0 1.5px rgba(148,163,184,.35), 0 12px 30px rgba(15,23,42,.10); background: transparent; }
  .side { position: absolute; left: ${L.zoom.x + L.zoom.w + 36}px; right: 40px; top: 92px; }
  code { font: 500 24px 'Cascadia Code', Consolas, monospace; background: rgba(241,245,249,.95); padding: 4px 10px; border-radius: 8px; color: #0f172a; }
  .cap { width: ${L.caption.w}px; padding: 22px 32px; border-radius: 24px; background: rgba(15,23,42,.86); color: #f8fafc;
    font: 500 30px/1.4 Inter, sans-serif; text-align: center; box-shadow: 0 16px 40px rgba(15,23,42,.18); }
`;

const cards = {
  intro: () => `<div class="card"><div style="display:flex;align-items:center;gap:22px;margin-top:40px">
      <div style="width:110px;height:110px">${LOGO}</div>
      <div class="sora" style="font-size:62px;line-height:1"><span class="grad" style="font-weight:700">Sentiment</span> <span style="font-weight:300;color:#334155">Translator</span></div></div>
      <p style="margin-top:44px;font-size:34px;color:#334155">Does the feeling survive translation?</p>
      <p style="margin-top:14px">A prototype that translates a sentence and maps its <b>sentiment</b>, <b>formality</b> and <b>friendliness</b>, before and after.</p>
      <div style="margin-top:38px;display:flex;gap:12px"><span class="chip">Thai</span><span class="chip">German</span><span class="chip">Japanese</span><span class="chip">Korean</span></div></div>`,
  example: (e) => {
    const focus = { 1: 'นะ (na) softens a question', 2: '<i>doch mal</i> makes an invitation warm and casual', 3: 'ちょっと and ね (ne) soften a request' }[e.label[0]];
    return `<div class="card"><span class="chip">${e.label}</span>
      <h2 style="font-size:64px;margin-top:70px">${e.text}</h2>
      <p style="margin-top:28px;font-size:32px"><span style="color:#0891b2">●</span> ${focus}</p></div>`;
  },
  nuance: () => `<div class="card"><span class="chip" style="color:#b45309;background:rgba(254,243,199,.9);border-color:rgba(252,211,77,.7)">💡 Nuance Analysis</span>
      <h2>What a literal translation would lose</h2>
      <p>The app names the particle or cue behind the feeling, and explains its effect, in the target language.</p>
      <p style="margin-top:22px">Thai <b>นะ</b> · German <b>doch / mal</b> · Japanese <b>ね</b></p></div>`,
  'map-original': () => `<div class="card"><span class="chip">Sentiment map · original</span><div class="slot"></div>
      <div class="side">
        <div class="row"><span class="ico"><span class="bar"></span></span><span><b>Colour</b>: sentiment, red − to green +</span></div>
        <div class="row"><span class="ico">↑</span><span><b>Higher</b>: friendlier</span></div>
        <div class="row"><span class="ico">→</span><span><b>Right</b>: more formal</span></div>
        <div class="row"><span class="ico">🙂</span><span><b>Emoji</b>: closest sentiment match</span></div></div></div>`,
  'map-translation': () => `<div class="card"><span class="chip">Sentiment map · translation</span><div class="slot"></div>
      <div class="side">
        <div class="row"><span class="ico"><svg width="22" height="22"><circle cx="11" cy="11" r="8" fill="none" stroke="#84cc16" stroke-width="3"/></svg></span><span><b>Ring</b>: original</span></div>
        <div class="row"><span class="ico"><svg width="22" height="22"><circle cx="11" cy="11" r="9" fill="#84cc16"/></svg></span><span><b>Dot</b>: translation</span></div>
        <div class="row"><span class="ico">┅</span><span><b>Dashed line</b>: how far the feeling moved</span></div></div></div>`,
  language: () => `<div class="card"><span class="chip">🌐 Target language → Korean</span>
      <h2>The analysis follows the target language</h2>
      <p>Switch the target language, and the translation, the Nuance Analysis and even the map labels change with it.</p>
      <p style="margin-top:22px">Formal → <b>격식</b> · Friendly → <b>친근함</b></p></div>`,
  rubric: () => `<div class="card"><span class="chip">📐 SFF rubric</span>
      <h2>Sentiment · Formality · Friendliness</h2>
      <p>Every score is anchored to shared example sentences in several languages, with a fixed seed for consistent results.</p>
      <p style="margin-top:18px">e.g. German <i>Kommen Sie bitte vorbei</i> → formality <b>55</b>: everyday polite, not high formality.</p>
      <p style="margin-top:22px">Read it in the repo: <code>docs/scoring-rubric.md</code></p></div>`,
  outro: () => `<div class="card"><div style="display:flex;align-items:center;gap:18px;margin-top:10px"><div style="width:72px;height:72px">${LOGO}</div>
      <div class="sora" style="font-size:44px"><span class="grad" style="font-weight:700">Sentiment</span> <span style="font-weight:300;color:#334155">Translator</span></div></div>
      <p style="margin-top:30px;font-size:30px"><code style="font-size:28px">github.com/bakeyeon/sentiment_translator</code></p>
      <p style="margin-top:28px;font-size:24px">Built on <i>Modalpartikeln: Can Sentiments Survive Translation with Emojis?</i> and <i>How Much Sentiment Can Be Carried by Modal Particles?</i></p>
      <p style="margin-top:16px;font-size:24px">SFF concept: <i>The Grue Divide</i> (PANDORA @ EMNLP 2026)</p></div>`,
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: L.W, height: L.H }, deviceScaleFactor: 1 });
const render = async (html, file, sel, transparent = true) => {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.locator(sel).first().screenshot({ path: `${OUT}/${file}`, omitBackground: transparent });
};

// background: the app's colour wash, plus a small brand line
await render(`<div id="bg" style="width:${L.W}px;height:${L.H}px;position:relative;background:
    radial-gradient(1200px 700px at 10% -5%, rgba(103,232,249,.45), transparent 62%),
    radial-gradient(1000px 650px at 105% 5%, rgba(196,181,253,.45), transparent 60%),
    radial-gradient(1200px 700px at 55% 115%, rgba(153,246,228,.45), transparent 62%), #f6f8fb;">
    <div style="position:absolute;left:${L.card.x}px;top:92px;display:flex;align-items:center;gap:14px">
      <div style="width:44px;height:44px">${LOGO}</div>
      <div class="sora" style="font-size:30px"><span class="grad" style="font-weight:700">Sentiment</span> <span style="font-weight:300;color:#334155">Translator</span></div>
      <span style="margin-left:10px;font-size:20px;color:#64748b">v2 demo</span></div></div>`, 'bg.png', '#bg', false);

// phone frame: dark bezel with a transparent, rounded screen
const S = L.screen, B = L.bezel;
await render(`<div id="ph" style="width:${S.w + 2 * B}px;height:${S.h + 2 * B}px;position:relative">
    <svg width="${S.w + 2 * B}" height="${S.h + 2 * B}" style="position:absolute;inset:0;filter:drop-shadow(0 30px 50px rgba(15,23,42,.28))">
      <defs><mask id="m"><rect width="100%" height="100%" fill="#fff"/><rect x="${B}" y="${B}" width="${S.w}" height="${S.h}" rx="40" fill="#000"/></mask></defs>
      <rect width="100%" height="100%" rx="${40 + B}" fill="#0f172a" mask="url(#m)"/>
      <rect x="1" y="1" width="${S.w + 2 * B - 2}" height="${S.h + 2 * B - 2}" rx="${39 + B}" fill="none" stroke="#475569" stroke-width="2" mask="url(#m)"/>
      <rect x="${B + S.w / 2 - 60}" y="${B + 10}" width="120" height="30" rx="15" fill="#0f172a"/>
    </svg></div>`, 'frame.png', '#ph');

// ---------- timeline ----------
const cardEvents = events.filter(e => e.type === 'card');
const taps = events.filter(e => e.type === 'tap');
const items = [];
cardEvents.forEach((e, i) => {
  let end = i + 1 < cardEvents.length ? cardEvents[i + 1].t : END;
  if (e.id.startsWith('map-')) {               // a map card ends when the map closes
    const close = events.find(c => c.type === 'close' && c.t > e.t);
    if (close && close.t < end) end = close.t + 0.2;
  }
  items.push({ kind: 'card', n: i, id: e.id, start: e.t, end, rect: e.rect || null });
});
// no empty card area: each card comes in as the previous one leaves (a map's zoom still waits for its map)
const cardItems = items.filter(i => i.kind === 'card');
for (let i = 1; i < cardItems.length; i++) {
  const prev = cardItems[i - 1], it = cardItems[i];
  if (it.start > prev.end + 0.05) { if (it.rect) it.zoomStart = it.start; it.start = prev.end; }
}
const voices = events.filter(e => e.type === 'voice');
voices.forEach((v, i) => {
  const next = i + 1 < voices.length ? voices[i + 1].t : END;
  items.push({ kind: 'caption', n: i, id: v.id, start: v.t, end: Math.min(next - 0.05, v.t + DUR[v.id] + 0.9) });
});

for (const it of items) {
  if (it.kind === 'card') {
    const e = cardEvents[it.n];
    await render(cards[e.id](e), `card_${it.n}.png`, '.card');
    it.file = `card_${it.n}.png`;
  } else {
    await render(`<div class="cap">${script.lines[it.id].cap}</div>`, `cap_${it.n}.png`, '.cap');
    it.file = `cap_${it.n}.png`;
  }
}
const START = Math.max(0, cardItems[0].start - 0.6);   // skip the app loading at the very start
fs.writeFileSync(`${OUT}/timeline.json`, JSON.stringify({ L, start: START, end: END, items, events }, null, 1));
await browser.close();
console.log('cards', items.filter(i => i.kind === 'card').length, 'captions', items.filter(i => i.kind === 'caption').length);
