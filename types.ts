export interface SentimentScore {
  score: number; // A value from -1.0 (negative) to 1.0 (positive)
  intimacy: number; // A value from 0 (distant) to 100 (intimate)
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
  intimate: string;
  negative: string;
  positive: string;
}

export interface TranslationResponse {
  translation: string;
  sourceSentiment: SentimentScore;
  translatedSentiment: SentimentScore;
  uiTranslations: UITranslations;
  nuance?: string;
}