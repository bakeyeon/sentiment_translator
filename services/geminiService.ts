import { GoogleGenAI, Type } from "@google/genai";
import type { SentimentScore } from '../types';

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
  },
  required: ["score"],
};

/**
 * Analyzes the sentiment of a given text.
 * @param text The text to analyze.
 * @returns A promise that resolves to a SentimentScore object.
 */
export const getSentiment = async (text: string): Promise<SentimentScore> => {
  if (!text.trim()) {
    return { score: 0 };
  }
  const prompt = `Analyze the sentiment of the following text and provide a score between -1.0 (very negative) and 1.0 (very positive). Text: "${text}"`;

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
    return { score: 0 };
  }
};

/**
 * Translates text and analyzes the sentiment of the *original* text in a single call.
 * @param text The text to translate.
 * @param targetLanguage The language to translate the text into.
 * @returns A promise that resolves to an object containing the translation and the original text's sentiment score.
 */
export const getTranslationAndSentiment = async (
  text: string,
  targetLanguage: string
): Promise<{ translation: string; sentiment: SentimentScore }> => {
  const prompt = `First, analyze the sentiment of the original text, providing a score between -1.0 (very negative) and 1.0 (very positive). Second, translate the original text into ${targetLanguage}. Provide your response as a JSON object. Original text: "${text}"`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            translation: {
              type: Type.STRING,
              description: `The text translated into ${targetLanguage}.`,
            },
            sentiment: sentimentSchema,
          },
          required: ["translation", "sentiment"],
        },
      },
    });
    return JSON.parse(response.text) as { translation: string; sentiment: SentimentScore };
  } catch (error) {
    console.error("Error in translation and sentiment analysis:", error);
    throw new Error("Failed to translate text and analyze sentiment.");
  }
};
