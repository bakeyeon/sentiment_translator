// Data sourced from: https://kt.ijs.si/data/Emoji_sentiment_ranking/
// A curated list representing a range of sentiments.
export const EMOJI_SENTIMENT_LIST: { emoji: string; score: number }[] = [
  { emoji: '😡', score: -0.875 },
  { emoji: '😭', score: -0.803 },
  { emoji: '😩', score: -0.729 },
  { emoji: '😒', score: -0.583 },
  { emoji: '😕', score: -0.422 },
  { emoji: '😐', score: -0.106 },
  { emoji: '🤔', score: 0.042 },
  { emoji: '🙂', score: 0.312 },
  { emoji: '😊', score: 0.598 },
  { emoji: '😄', score: 0.762 },
  { emoji: '😍', score: 0.869 },
  { emoji: '💖', score: 0.958 },
].sort((a, b) => a.score - b.score);

/**
 * Finds the emoji that best matches a given sentiment score.
 * @param score A sentiment score from -1.0 to 1.0.
 * @returns The closest matching emoji character.
 */
export const getEmojiForScore = (score: number): string => {
  if (EMOJI_SENTIMENT_LIST.length === 0) {
    return '🤔'; // Default emoji if list is empty
  }

  // Find the emoji with the smallest absolute difference in score
  const closest = EMOJI_SENTIMENT_LIST.reduce((prev, curr) => {
    return (Math.abs(curr.score - score) < Math.abs(prev.score - score) ? curr : prev);
  });

  return closest.emoji;
};
