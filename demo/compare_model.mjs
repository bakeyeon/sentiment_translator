// Scores sentences with the same rubric, prompt, seed and rounding as /api/gemini/sentiment, on a chosen Gemini model.
// The rubric is read from server.ts so both stay in sync. Reads the key from .env.local and never prints it.
// Usage: node demo/compare_model.mjs <model> "sentence" ["sentence" ...]    (DELAY_MS between calls, default 4500)
import fs from 'fs';
import { GoogleGenAI, Type } from '@google/genai';

const key = fs.readFileSync('.env.local', 'utf8').match(/^GEMINI_API_KEY=(.+)$/m)[1].trim();
const server = fs.readFileSync('server.ts', 'utf8');
const RUBRIC = server.match(/const RUBRIC = `([\s\S]*?)`;/)[1];
const SEED = Number(server.match(/const SEED = (\d+);/)[1]);
const ai = new GoogleGenAI({ apiKey: key });
const [model, ...texts] = process.argv.slice(2);

const phrase = {
  type: Type.OBJECT,
  properties: { phrase: { type: Type.STRING }, sentiment: { type: Type.NUMBER }, formality: { type: Type.NUMBER }, friendliness: { type: Type.NUMBER } },
  required: ['phrase', 'sentiment', 'formality', 'friendliness'],
};
const schema = {
  type: Type.OBJECT,
  properties: {
    phraseScores: { type: Type.ARRAY, items: phrase },
    score: { type: Type.NUMBER },
    friendliness: { type: Type.NUMBER },
    formality: { type: Type.NUMBER },
  },
  required: ['phraseScores', 'score', 'friendliness', 'formality'],
  propertyOrdering: ['phraseScores', 'score', 'friendliness', 'formality'],
};
const prompt = (text) => `First break down the following text into its key words, particles, or phrases and score each one on:
- sentiment (-1.0 negative to 1.0 positive, 0.0 neutral/curious)
- formality (-1.0 informal to 1.0 formal)
- friendliness (-1.0 unfriendly to 1.0 friendly)

Then, based on those phrase scores and the full sentence context (such as softening particles, greetings, or negation), compute the overall sentence metrics score, friendliness and formality.

${RUBRIC}

Text: "${text}"`;
const round = (v, step, lo, hi) => Math.min(hi, Math.max(lo, Math.round(v / step) * step));

for (const text of texts) {
  const t = Date.now();
  try {
    const r = await ai.models.generateContent({ model, contents: prompt(text), config: { responseMimeType: 'application/json', responseSchema: schema, seed: SEED } });
    const p = JSON.parse(r.text);
    console.log(`${model} | s=${+round(p.score, 0.05, -1, 1).toFixed(2)} i=${round(p.friendliness, 5, 0, 100)} f=${round(p.formality, 5, 0, 100)} | ${text} (${Date.now() - t} ms)`);
  } catch (e) {
    console.log(`${model} | failed: ${String(e.message).slice(0, 300)} | ${text}`);
  }
  // free tier allows 15 requests a minute
  await new Promise(r => setTimeout(r, Number(process.env.DELAY_MS || 4500)));
}
