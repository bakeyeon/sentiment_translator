export interface SentimentScore {
  score: number; // A value from -1.0 (negative) to 1.0 (positive)
  friendliness: number; // A value from 0 (cold/distant) to 100 (warm/close)
  formality: number; // A value from 0 (informal) to 100 (formal)
}

export interface Sentiment extends SentimentScore {
  emoji: string;
}

export interface Language {
  code: string;
  name: string;
}

export interface EmojiSuggestion {
  explanation: string;
  emojis: string[];
}

export interface UITranslations {
  formal: string;
  friendly: string;
  negative: string;
  positive: string;
  spoken: string;
  written: string;
}

export type TextStyle = 'SPOKEN' | 'WRITTEN';

export interface TranslationResponse {
  translation: string;
  sourceSentiment: SentimentScore;
  translatedSentiment: SentimentScore;
  uiTranslations: UITranslations;
  nuance?: string;
  sourceStyle: TextStyle;
  translatedStyle: TextStyle;
}