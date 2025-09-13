export interface SentimentScore {
  score: number; // A value from -1.0 (negative) to 1.0 (positive)
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

export interface TranslationResponse {
  translation: string;
  sourceSentiment: SentimentScore;
  translatedSentiment: SentimentScore;
  nuance?: string;
}
