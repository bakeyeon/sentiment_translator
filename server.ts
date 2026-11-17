import dotenv from 'dotenv';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { EmojiSuggestion, SentimentScore, TranslationResponse } from './types.ts';

dotenv.config({ path: '.env.local' });
dotenv.config();

const MODEL_NAME = 'gemini-4-hydrogen';

const phraseScoreSchema = {
  type: Type.OBJECT,
  properties: {
    phrase: {
      type: Type.STRING,
      description: 'A meaningful word, particle, or short phrase from the text.',
    },
    sentiment: {
      type: Type.NUMBER,
      description: 'Sentiment score from -1.0 (very negative) to 1.0 (very positive), where 0.0 is neutral/curious.',
    },
    formality: {
      type: Type.NUMBER,
      description: 'Formality score from -1.0 (very informal) to 1.0 (very formal).',
    },
    friendliness: {
      type: Type.NUMBER,
      description: 'Friendliness score from -1.0 (unfriendly/hostile) to 1.0 (warm/friendly).',
    },
  },
  required: ['phrase', 'sentiment', 'formality', 'friendliness'],
};

const sentimentSchema = {
  type: Type.OBJECT,
  properties: {
    score: {
      type: Type.NUMBER,
      description: 'Overall sentiment score from -1.0 (very negative/hostile/sad) to 1.0 (very positive/joyful/warm), where 0.0 is neutral, factual, or mildly curious.',
    },
    intimacy: {
      type: Type.NUMBER,
      description: 'Overall intimacy/closeness score from 0 (distant/stranger) to 100 (deeply personal/affectionate), derived from friendliness and context (not casual grammar alone). Everyday friendly/curious questions are typically 35-55.',
    },
    formality: {
      type: Type.NUMBER,
      description: 'Overall formality score from 0 (very informal/casual speech) to 100 (very formal/honorific), mapped from the phrase formality scores (-1.0 -> 0, 0.0 -> 50, +1.0 -> 100).',
    },
  },
  required: ['score', 'intimacy', 'formality'],
};

let cachedAiClient: GoogleGenAI | null = null;

const getAiClient = () => {
  if (cachedAiClient) {
    return cachedAiClient;
  }
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error('Server API key is not configured.');
  }
  cachedAiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return cachedAiClient;
};

const getErrorStatusAndMessage = (error: unknown, fallbackMessage: string): { status: number; message: string } => {
  if (error && typeof error === 'object') {
    const errObj = error as { status?: number; message?: string };
    const status = typeof errObj.status === 'number' && errObj.status >= 400 && errObj.status < 600
      ? errObj.status
      : 500;
    const message = typeof errObj.message === 'string' && errObj.message.trim()
      ? errObj.message
      : fallbackMessage;
    return { status, message };
  }
  return { status: 500, message: fallbackMessage };
};

async function startServer() {
  const app = express();
  app.use(express.json());

  app.post('/api/gemini/sentiment', async (req: Request, res: Response) => {
    const { text } = req.body as { text?: unknown };
    if (typeof text !== 'string') {
      res.status(400).json({ error: 'Invalid request: text must be a string.' });
      return;
    }

    if (!text.trim()) {
      res.json({ score: 0, intimacy: 50, formality: 50 } satisfies SentimentScore);
      return;
    }

    const prompt = `First break down the following text into its key words, particles, or phrases and score each one on:
- sentiment (-1.0 negative to 1.0 positive, 0.0 neutral/curious)
- formality (-1.0 informal to 1.0 formal)
- friendliness (-1.0 unfriendly to 1.0 friendly)

Then, based on those phrase scores and the full sentence context (such as softening particles, greetings, or negation), compute the overall sentence metrics:
- score (-1.0 to 1.0): 0.0 is neutral, factual, or simple curiosity. Do NOT score everyday questions or casual check-ins as negative unless there are explicit negative/hostile cues.
- intimacy (0 to 100): Relationship closeness/warmth, separate from informality. 0-25 = distant, 30-55 = casual acquaintance/everyday curiosity, 60-80 = close friend, 85-100 = deeply personal/family/romantic.
- formality (0 to 100): Map overall formality from -1.0..1.0 onto 0..100.

Text: "${text}"`;

    try {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              phraseScores: {
                type: Type.ARRAY,
                items: phraseScoreSchema,
              },
              score: sentimentSchema.properties.score,
              intimacy: sentimentSchema.properties.intimacy,
              formality: sentimentSchema.properties.formality,
            },
            required: ['phraseScores', 'score', 'intimacy', 'formality'],
            propertyOrdering: ['phraseScores', 'score', 'intimacy', 'formality'],
          },
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const parsed = JSON.parse(response.text ?? '{}') as SentimentScore & { phraseScores?: unknown };
      res.json({
        score: parsed.score,
        intimacy: parsed.intimacy,
        formality: parsed.formality,
      } satisfies SentimentScore);
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      const { status, message } = getErrorStatusAndMessage(error, 'Failed to analyze sentiment.');
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/gemini/translate', async (req: Request, res: Response) => {
    const { text, sourceLanguageCode, targetLanguageName } = req.body as {
      text?: unknown;
      sourceLanguageCode?: unknown;
      targetLanguageName?: unknown;
    };

    if (
      typeof text !== 'string' ||
      !text.trim() ||
      typeof sourceLanguageCode !== 'string' ||
      typeof targetLanguageName !== 'string' ||
      !targetLanguageName.trim()
    ) {
      res.status(400).json({ error: 'Invalid translation request parameters.' });
      return;
    }

    const schema = {
      type: Type.OBJECT,
      properties: {
        translation: {
          type: Type.STRING,
          description: `The text translated into ${targetLanguageName}.`,
        },
        sourcePhraseScores: {
          type: Type.ARRAY,
          items: phraseScoreSchema,
          description: 'Word/phrase-level scores for the original text.',
        },
        translatedPhraseScores: {
          type: Type.ARRAY,
          items: phraseScoreSchema,
          description: 'Word/phrase-level scores for the translated text.',
        },
        sourceStyle: {
          type: Type.STRING,
          description: "The style of the original text. Either 'SPOKEN' or 'WRITTEN'.",
        },
        translatedStyle: {
          type: Type.STRING,
          description: "The style of the generated translation. Either 'SPOKEN' or 'WRITTEN'.",
        },
        sourceSentiment: sentimentSchema,
        translatedSentiment: sentimentSchema,
        nuance: {
          type: Type.STRING,
          description: `A short explanation in ${targetLanguageName} of any subtle nuance, cultural context, or ambiguity in the original text that might be lost in translation. This should be null or an empty string if no significant nuance is detected.`,
        },
        uiTranslations: {
          type: Type.OBJECT,
          properties: {
            formal: { type: Type.STRING, description: `The word for 'Formal' translated into ${targetLanguageName}.` },
            intimate: { type: Type.STRING, description: `The word for 'Intimate' translated into ${targetLanguageName}.` },
            negative: { type: Type.STRING, description: `The word for 'Negative' translated into ${targetLanguageName}.` },
            positive: { type: Type.STRING, description: `The word for 'Positive' translated into ${targetLanguageName}.` },
            spoken: { type: Type.STRING, description: `The word for 'Spoken' translated into ${targetLanguageName}.` },
            written: { type: Type.STRING, description: `The word for 'Written' translated into ${targetLanguageName}.` },
          },
          required: ['formal', 'intimate', 'negative', 'positive', 'spoken', 'written'],
        },
      },
      required: [
        'translation',
        'sourcePhraseScores',
        'translatedPhraseScores',
        'sourceStyle',
        'translatedStyle',
        'sourceSentiment',
        'translatedSentiment',
        'uiTranslations',
      ],
      propertyOrdering: [
        'translation',
        'sourcePhraseScores',
        'translatedPhraseScores',
        'sourceStyle',
        'translatedStyle',
        'sourceSentiment',
        'translatedSentiment',
        'nuance',
        'uiTranslations',
      ],
    };

    const prompt = `You are an expert linguist and cultural translator. Your task is to translate text while being highly sensitive to subtle meanings.
1. Provide a natural and direct translation of the following text into ${targetLanguageName}. The translation should sound like it was written by a native speaker.
2. First, break BOTH the original text (language code: ${sourceLanguageCode}) and your translation into their meaningful words, particles, or short phrases, and score each one on:
   - sentiment (-1.0 negative to 1.0 positive, 0.0 neutral/curious)
   - formality (-1.0 informal to 1.0 formal)
   - friendliness (-1.0 unfriendly to 1.0 friendly)
3. Next, using those word/phrase scores together with whole-sentence context (such as softening particles like 'นะ', greetings, or negation), derive the overall metrics for BOTH the original text and the translation:
   - score (-1.0 to 1.0): 0.0 is neutral, factual, or simple curiosity. Everyday questions, greetings, or softened check-ins (e.g., asking where someone went out of casual curiosity) should be neutral to slightly positive (around 0.0 to 0.2), NOT negative, unless there are explicit hostile/upset cues.
   - intimacy (0 to 100): Relationship closeness/emotional intimacy, independent of casual grammar. Casual or softened speech alone does NOT mean high intimacy. 0-25 = distant/stranger, 30-55 = casual acquaintance / friendly everyday chat / mild curiosity, 60-80 = close friend, 85-100 = deeply personal/affectionate/family.
   - formality (0 to 100): Map overall formality from -1.0..1.0 onto 0..100 (0 = very casual, 50 = standard polite, 100 = formal/honorific).
   - style: either 'SPOKEN' or 'WRITTEN'.
4. Analyze the ORIGINAL text for any subtle nuances, culturally specific phrases, ambiguities, or emotional undertones that might be lost or altered in a direct translation. Provide a short, one-sentence explanation of this key nuance IN ${targetLanguageName}. If no significant nuance is found, return null for the nuance explanation.
5. Translate the following UI labels into ${targetLanguageName}: 'Formal', 'Intimate', 'Negative', 'Positive', 'Spoken', 'Written'.

Provide your response strictly as a JSON object that conforms to the provided schema. Do not include any extra text or formatting.
Original Text: "${text}"`;

    try {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const parsed = JSON.parse(response.text ?? '{}') as TranslationResponse & {
        sourcePhraseScores?: unknown;
        translatedPhraseScores?: unknown;
      };
      res.json({
        translation: parsed.translation,
        sourceStyle: parsed.sourceStyle,
        translatedStyle: parsed.translatedStyle,
        sourceSentiment: parsed.sourceSentiment,
        translatedSentiment: parsed.translatedSentiment,
        uiTranslations: parsed.uiTranslations,
        nuance: parsed.nuance || undefined,
      } satisfies TranslationResponse);
    } catch (error) {
      console.error('Error in translation and sentiment analysis:', error);
      const { status, message } = getErrorStatusAndMessage(error, 'Failed to translate text and analyze sentiment.');
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/gemini/emoji-suggestions', async (req: Request, res: Response) => {
    const { sourceText, translatedText, sourceScore, translatedScore } = req.body as {
      sourceText?: unknown;
      translatedText?: unknown;
      sourceScore?: unknown;
      translatedScore?: unknown;
    };

    if (
      typeof sourceText !== 'string' ||
      typeof translatedText !== 'string' ||
      typeof sourceScore !== 'number' ||
      typeof translatedScore !== 'number'
    ) {
      res.status(400).json({ error: 'Invalid emoji suggestion request parameters.' });
      return;
    }

    const prompt = `The original text has a sentiment score of ${sourceScore.toFixed(2)} and the following translated text has a score of ${translatedScore.toFixed(2)}.
Original text: "${sourceText}"
Translation: "${translatedText}"

1. In one short sentence, explain the emotional nuance difference from the original to the translation. For example, "The original text felt slightly more playful."
2. Suggest exactly 3 emojis that could be added to the translation to better match the original sentiment.
Provide your response as a JSON object.`;

    try {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              explanation: {
                type: Type.STRING,
                description: 'A short sentence explaining the sentiment difference.',
              },
              emojis: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'An array of exactly 3 emoji characters.',
              },
            },
            required: ['explanation', 'emojis'],
          },
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const parsed = JSON.parse(response.text ?? '{}') as EmojiSuggestion;
      res.json(parsed);
    } catch (error) {
      console.error('Error getting emoji suggestions:', error);
      const { status, message } = getErrorStatusAndMessage(error, 'Failed to get emoji suggestions.');
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
