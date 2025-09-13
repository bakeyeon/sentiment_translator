import React from 'react';
import type { EmojiSuggestion } from '../types';
import { SparklesIcon } from './icons';

interface EmojiSuggestionBoxProps {
  suggestion: EmojiSuggestion;
  onEmojiClick: (emoji: string) => void;
}

export const EmojiSuggestionBox: React.FC<EmojiSuggestionBoxProps> = ({ suggestion, onEmojiClick }) => {
  return (
    <div className="p-4 bg-teal-900/40 border border-teal-500/30 rounded-lg animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <SparklesIcon className="w-5 h-5 text-teal-300" />
        <h3 className="font-semibold text-teal-200">Nuance Suggestion</h3>
      </div>
      <p className="text-sm text-gray-300 mb-3">{suggestion.explanation}</p>
      <div className="flex items-center gap-2">
        <p className="text-sm text-gray-400">Try adding:</p>
        {suggestion.emojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onEmojiClick(emoji)}
            className="text-2xl rounded-full p-1 transition-transform duration-200 ease-in-out hover:scale-125 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-teal-400"
            aria-label={`Add ${emoji} emoji`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

// Add a simple fade-in animation to tailwind config or a style tag if needed
// For simplicity here, we'll assume a global style or a setup that can handle this.
// In a real project, this might go into index.css or be configured in tailwind.config.js
if (typeof window !== 'undefined') {
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes fade-in {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
            animation: fade-in 0.5s ease-out forwards;
        }
    `;
    document.head.appendChild(style);
}
