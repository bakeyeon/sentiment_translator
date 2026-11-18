import type { SentimentScore, EmojiSuggestion, TranslationResponse } from '../types';

async function postJson<T>(url: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

/**
 * Analyzes the sentiment of a given text via the server API.
 * @param text The text to analyze.
 * @returns A promise that resolves to a SentimentScore object.
 */
export const getSentiment = async (text: string): Promise<SentimentScore> => {
  if (!text.trim()) {
    return { score: 0, friendliness: 50, formality: 50 };
  }
  return postJson<SentimentScore>('/api/gemini/sentiment', { text });
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
  return postJson<TranslationResponse>('/api/gemini/translate', {
    text,
    sourceLanguageCode,
    targetLanguageName,
  });
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
  return postJson<EmojiSuggestion>('/api/gemini/emoji-suggestions', {
    sourceText,
    translatedText,
    sourceScore,
    translatedScore,
  });
};