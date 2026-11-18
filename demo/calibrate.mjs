// Scores anchor sentences once each through the running app's /api/gemini/sentiment endpoint,
// to see what the model produces before fixing the rubric. Retries on 503 (busy model).
// Usage: node demo/calibrate.mjs   -> demo/calibration.json
import fs from 'fs';

const ANCHORS = [
  // [axis being anchored, draft value, sentence]
  ['sentiment', -0.9, 'I hate this.'],
  ['sentiment', -0.5, "That's disappointing."],
  ['sentiment', 0.0, 'The meeting is at 3.'],
  ['sentiment', 0.3, 'Sounds good.'],
  ['sentiment', 0.6, 'Thanks so much!'],
  ['formality', 10, 'ㅇㅋ'],
  ['formality', 25, 'Komm vorbei!'],
  ['formality', 50, 'Could you come by?'],
  ['formality', 75, 'Kommen Sie bitte vorbei.'],
  ['formality', 80, 'Würden Sie bitte vorbeikommen?'],
  ['formality', 95, '참석해 주시기 바랍니다.'],
  ['closeness', 10, 'Your request has been received. Please wait.'],
  ['closeness', 30, 'Nice to meet you.'],
  ['closeness', 50, 'Hey, want to grab lunch?'],
  ['closeness', 90, 'I love you, mom.'],
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const out = [];
for (const [axis, draft, text] of ANCHORS) {
  let r = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch('http://127.0.0.1:3000/api/gemini/sentiment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
    });
    const body = await res.json();
    if (res.ok) { r = body; break; }
    const msg = String(body.error || '');
    if (msg.includes('429')) { console.log('daily quota reached, stopping'); fs.writeFileSync('demo/calibration.json', JSON.stringify(out, null, 1)); process.exit(1); }
    console.log(`  ${text}: ${res.status}, retry ${attempt}`);
    await sleep(20000);
  }
  out.push({ axis, draft, text, ...(r || { error: true }) });
  console.log(axis.padEnd(10), String(draft).padStart(5), '|', r ? `s=${r.score} fr=${r.friendliness} f=${r.formality}` : 'failed', '|', text);
  await sleep(1500);
}
fs.writeFileSync('demo/calibration.json', JSON.stringify(out, null, 1));
