import React, { useState, useRef, useEffect } from 'react';
import type { Sentiment } from '../types';

interface SentimentVisualizerProps {
  sentiment: Sentiment;
}

const useOnClickOutside = <T extends HTMLElement,>(
  ref: React.RefObject<T>,
  handler: (event: MouseEvent | TouchEvent) => void
) => {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler(event);
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
};

export const SentimentVisualizer: React.FC<SentimentVisualizerProps> = ({ sentiment }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const visualizerRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(visualizerRef, () => setIsExpanded(false));

  const rotation = sentiment.score * 90; // Map score from -1 to 1 => -90deg to 90deg

  return (
    <div ref={visualizerRef} className="absolute bottom-0 right-0">
      <div className="relative flex items-center justify-center">
        {/* Fan Background (Semicircle) */}
        <div
          className={`absolute bottom-0 w-48 h-24 origin-bottom transition-all duration-300 ease-in-out pointer-events-none ${
            isExpanded ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
          }`}
          style={{
            transform: 'translateY(-20px)',
            borderTopLeftRadius: '96px',
            borderTopRightRadius: '96px',
            background: 'conic-gradient(from 180deg at 50% 100%, #ef4444, #f59e0b, #facc15, #a3e635, #4ade80)',
          }}
        ></div>

        {/* Emoji Indicator on the fan */}
        <div
          className={`absolute bottom-0 origin-bottom w-px h-24 transition-transform duration-500 ease-out pointer-events-none ${
            isExpanded ? 'opacity-100 delay-200' : 'opacity-0'
          }`}
          style={{
            transform: `translateY(-20px) rotate(${rotation}deg)`,
          }}
        >
          <div className="absolute top-[2px] left-1/2 -translate-x-1/2 bg-gray-800/50 backdrop-blur-sm rounded-full p-0.5 shadow-lg border border-white/20">
            <span className="text-base">{sentiment.emoji}</span>
          </div>
        </div>

        {/* Emoji Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`text-2xl transition-transform duration-300 ease-in-out hover:scale-125 focus:outline-none z-10 ${
            isExpanded ? 'scale-150' : 'scale-100'
          }`}
          aria-label="Show sentiment analysis"
        >
          {sentiment.emoji}
        </button>
      </div>
    </div>
  );
};
