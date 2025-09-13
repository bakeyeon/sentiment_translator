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
 * Translates text and analyzes the sentiment of both the original and translated text,
 * with special handling for German modal particles and Thai relational particles.
 * @param text The text to translate.
 * @param sourceLanguageCode The language code of the source text (e.g., 'de', 'th').
 * @param targetLanguageName The full name of the target language (e.g., 'Korean').
 * @returns A promise resolving to a TranslationResponse object.
 */
export const getTranslationAndSentiment = async (
  text: string,
  sourceLanguageCode: string,
  targetLanguageName: string
): Promise<TranslationResponse> => {
  const isGermanSource = sourceLanguageCode === 'de';
  const isThaiSource = sourceLanguageCode === 'th';

  const baseProperties: any = {
    translation: {
      type: Type.STRING,
      description: `The text translated into ${targetLanguageName}.`,
    },
    sourceSentiment: sentimentSchema,
    translatedSentiment: sentimentSchema,
  };

  if (isGermanSource) {
    baseProperties.nuance = {
      type: Type.STRING,
      description: "A short explanation of the emotional nuance the German modal particle adds (e.g., 'resignation', 'emphasis'). If no modal particle is present, this should be an empty string or null."
    };
  } else if (isThaiSource) {
    baseProperties.nuance = {
        type: Type.STRING,
        description: "A short explanation of the interpersonal nuance the Thai particle adds (e.g., 'softens the request', 'adds friendly emphasis'). If no particle is present, this should be an empty string or null."
    };
  }

  const schema = {
    type: Type.OBJECT,
    properties: baseProperties,
    required: ["translation", "sourceSentiment", "translatedSentiment"],
  };

  const germanPrompt = `You are an expert translator specializing in German modal particles.
1. Analyze the following German text to identify any modal particles (e.g., 'halt', 'doch', 'eben').
2. Provide a short, one-sentence explanation of the emotional nuance the modal particle adds. If no modal particle is found, return null for the nuance.
3. Provide a natural and direct translation of the text into ${targetLanguageName}. The translation should sound like a typical native speaker. Avoid literal translations of the modal particle; its nuance is analyzed separately.
4. Analyze the sentiment of the ORIGINAL German text and provide a score from -1.0 to 1.0.
5. Analyze the sentiment of the TRANSLATION you just generated and provide a score from -1.0 to 1.0.
Provide your response as a JSON object.
Original German Text: "${text}"`;

  const thaiPrompt = `You are an expert linguist specializing in Thai particles. Thai particles (e.g., นะ na, สิ si, จัง jang, อ่ะ a, ดิ di) act as "relational calibrators", adding layers of softness, politeness, emphasis, or warmth.
1. Analyze the following Thai text to identify any such particles.
2. Provide a short, one-sentence explanation of the interpersonal nuance the particle adds (e.g., "softens the statement, making it more friendly" or "adds playful insistence"). If no particle is found, return null for the nuance.
3. Provide a natural and direct translation of the text into ${targetLanguageName}. The translation should be clean and not try to literally translate the particle's feel.
4. Analyze the sentiment of the ORIGINAL Thai text and provide a score from -1.0 to 1.0.
5. Analyze the sentiment of the TRANSLATION you just generated and provide a score from -1.0 to 1.0.
Provide your response as a JSON object.
Original Thai Text: "${text}"`;

  const standardPrompt = `1. Translate the following text into ${targetLanguageName}.
2. Analyze the sentiment of the ORIGINAL text and provide a score from -1.0 to 1.0.
3. Analyze the sentiment of the TRANSLATION you just generated and provide a score from -1.0 to 1.0.
Provide your response as a JSON object.
Original Text: "${text}"`;

  let prompt = standardPrompt;
  if (isGermanSource) {
    prompt = germanPrompt;
  } else if (isThaiSource) {
    prompt = thaiPrompt;
  }

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
    if ((isGermanSource || isThaiSource) && !parsed.nuance) {
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