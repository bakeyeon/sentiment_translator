import { GoogleGenAI, Type } from "@google/genai";
import type { SentimentScore, EmojiSuggestion, TranslationResponse } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const sentimentSchema = {
  type: Type.OBJECT,
  properties: {
    score: {
      type: Type.NUMBER,
      description: "A score from -1.0 (most negative) to 1.0 (most positive) representing the sentiment.",
    },
    intimacy: {
      type: Type.NUMBER,
      description: "A score from 0 (very distant) to 100 (very intimate) representing the intimacy level.",
    },
    formality: {
      type: Type.NUMBER,
      description: "A score from 0 (very informal) to 100 (very formal) representing the formality level.",
    },
  },
  required: ["score", "intimacy", "formality"],
};

/**
 * Analyzes the sentiment of a given text.
 * @param text The text to analyze.
 * @returns A promise that resolves to a SentimentScore object.
 */
export const getSentiment = async (text: string): Promise<SentimentScore> => {
  if (!text.trim()) {
    return { score: 0, intimacy: 50, formality: 50 };
  }
  const prompt = `Analyze the sentiment of the following text. Provide:
1.  A sentiment score between -1.0 (very negative) and 1.0 (very positive).
2.  An intimacy score between 0 (distant) and 100 (intimate).
3.  A formality score between 0 (informal) and 100 (formal).
Text: "${text}"`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: sentimentSchema,
      },
    });

    return JSON.parse(response.text) as SentimentScore;
  } catch (error) {
    console.error("Error analyzing sentiment:", error);
    // Return a neutral score on error to avoid breaking the UI
    return { score: 0, intimacy: 50, formality: 50 };
  }
};

/**
 * Translates text, analyzes sentiment for both original and translated text,
 * and provides an explanation of any subtle nuance in the source text.
 * @param text The text to translate.
 * @param sourceLanguageCode The language code of the source text.
 * @param targetLanguageName The full name of the target language (e.g., 'Korean').
 * @returns A promise resolving to a TranslationResponse object.
 */
export const getTranslationAndSentiment = async (
  text: string,
  sourceLanguageCode: string,
  targetLanguageName: string
): Promise<TranslationResponse> => {
  const schema = {
    type: Type.OBJECT,
    properties: {
      translation: {
        type: Type.STRING,
        description: `The text translated into ${targetLanguageName}.`,
      },
      sourceSentiment: sentimentSchema,
      translatedSentiment: sentimentSchema,
      nuance: {
        type: Type.STRING,
        description: "A short explanation of any subtle nuance, cultural context, or ambiguity in the original text that might be lost in translation. This should be null or an empty string if no significant nuance is detected."
      },
    },
    required: ["translation", "sourceSentiment", "translatedSentiment"],
  };

  const prompt = `You are an expert linguist and cultural translator. Your task is to translate text while being highly sensitive to subtle meanings.
1. Provide a natural and direct translation of the following text into ${targetLanguageName}. The translation should sound like it was written by a native speaker.
2. Analyze the ORIGINAL text for any subtle nuances, culturally specific phrases, ambiguities, or emotional undertones that might be lost or altered in a direct translation. Provide a short, one-sentence explanation of this key nuance. For example, you might point out if a word has a double meaning, if the tone is sarcastic, or if a phrase is a specific cultural reference. If no significant nuance is found, return null for the nuance explanation.
3. For the ORIGINAL text, provide: a sentiment score (-1.0 to 1.0), an intimacy score (0-100), and a formality score (0-100).
4. For the TRANSLATION you generated, provide: a sentiment score (-1.0 to 1.0), an intimacy score (0-100), and a formality score (0-100).

Provide your response strictly as a JSON object that conforms to the provided schema. Do not include any extra text or formatting.
Original Text: "${text}"`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });
    
    const parsed = JSON.parse(response.text) as TranslationResponse;
    // Ensure nuance is undefined if it's a nullish value from the model
    if (!parsed.nuance) {
        parsed.nuance = undefined;
    }
    return parsed;

  } catch (error) {
    console.error("Error in translation and sentiment analysis:", error);
    throw new Error("Failed to translate text and analyze sentiment.");
  }
};


/**
 * Gets emoji suggestions to bridge the sentiment gap between two texts.
 * @param sourceText The original text.
 * @param translatedText The translated text.
 * @param sourceScore The sentiment score of the original text.
 * @param translatedScore The sentiment score of the translated text.
 * @returns A promise that resolves to an EmojiSuggestion object.
 */
export const getEmojiSuggestions = async (
    sourceText: string,
    translatedText: string,
    sourceScore: number,
    translatedScore: number
): Promise<EmojiSuggestion> => {
    const prompt = `The original text has a sentiment score of ${sourceScore.toFixed(2)} and the following translated text has a score of ${translatedScore.toFixed(2)}.
Original text: "${sourceText}"
Translation: "${translatedText}"

1. In one short sentence, explain the emotional nuance difference from the original to the translation. For example, "The original text felt slightly more playful."
2. Suggest exactly 3 emojis that could be added to the translation to better match the original sentiment.
Provide your response as a JSON object.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        explanation: {
                            type: Type.STRING,
                            description: "A short sentence explaining the sentiment difference."
                        },
                        emojis: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "An array of exactly 3 emoji characters."
                        }
                    },
                    required: ["explanation", "emojis"]
                }
            }
        });
        return JSON.parse(response.text) as EmojiSuggestion;
    } catch (error) {
        console.error("Error getting emoji suggestions:", error);
        throw new Error("Failed to get emoji suggestions.");
    }
};