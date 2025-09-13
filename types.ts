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
