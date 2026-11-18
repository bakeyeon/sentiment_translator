import React, { useState, useRef, useEffect } from 'react';
import type { Sentiment, UITranslations } from '../types';

interface SentimentVisualizerProps {
  sentiment: Sentiment;
  comparisonSentiment?: Sentiment | null;
  uiTranslations?: UITranslations | null;
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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const SentimentPoint: React.FC<{ point: Sentiment; isComparison?: boolean }> = ({ point, isComparison }) => {
    const score = clamp(point.score, -1, 1);
    const friendliness = clamp(point.friendliness, 0, 100);
    const formality = clamp(point.formality, 0, 100);
    // Map score from -1 (red) to 1 (green) through yellow
    const pointColor = `hsl(${120 * (score * 0.5 + 0.5)}, 80%, 60%)`;
    
    return (
        <div
            className={`absolute w-3 h-3 rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out`}
            style={{ 
                top: `${100 - friendliness}%`, 
                left: `${formality}%`,
                backgroundColor: isComparison ? 'transparent' : pointColor,
                border: isComparison ? `2px solid ${pointColor}` : 'none',
            }}
            title={`Sentiment: ${score.toFixed(2)}\nFriendliness: ${friendliness}\nFormality: ${formality}`}
        >
             <div className="absolute inset-0 rounded-full" style={{boxShadow: `0 0 8px 1px ${pointColor}`}}></div>
        </div>
    );
}


export const SentimentVisualizer: React.FC<SentimentVisualizerProps> = ({ sentiment, comparisonSentiment, uiTranslations }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const visualizerRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(visualizerRef, () => setIsExpanded(false));

  const score = clamp(sentiment.score, -1, 1);
  const friendliness = clamp(sentiment.friendliness, 0, 100);
  const formality = clamp(sentiment.formality, 0, 100);

  return (
    <div ref={visualizerRef} className="absolute bottom-0 right-0">
      <div className="relative flex items-center justify-center">
        {/* Sentiment Map */}
        <div
          className={`absolute bottom-full mb-3 right-0 lg:right-1/2 lg:translate-x-1/2 w-56 origin-bottom transition-all duration-300 ease-in-out p-3.5 bg-white/75 dark:bg-gray-900/75 backdrop-blur-xl rounded-2xl border border-white/80 dark:border-white/15 shadow-2xl ${
            isExpanded ? 'scale-100 opacity-100' : 'scale-75 opacity-0 -z-10'
          }`}
          style={{ pointerEvents: isExpanded ? 'auto' : 'none' }}
        >
            {/* Color = Sentiment Legend (separate from X/Y grid axes) */}
            <div className="mb-3 pb-2 border-b border-slate-200 dark:border-white/10">
                <div className="w-full h-1.5 bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 rounded-full"></div>
                <div className="flex justify-between text-[9px] text-slate-600 dark:text-white/70 mt-1">
                    <span>{uiTranslations?.negative ?? 'Negative'}</span>
                    <span className="text-slate-400 dark:text-white/50">●</span>
                    <span>{uiTranslations?.positive ?? 'Positive'}</span>
                </div>
            </div>

            {/* 2D Plot Area (X: Formality, Y: Friendliness) */}
            <div className="relative w-full h-36 pl-4 pb-4">
                <div className="relative w-full h-full">
                    {/* Grid */}
                    <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 border border-slate-200 dark:border-white/10">
                        {[...Array(16)].map((_, i) => (
                            <div key={i} className="border-r border-b border-slate-200 dark:border-white/10 last:border-r-0"></div>
                        ))}
                    </div>

                    {/* Plot Area */}
                    <div className="absolute inset-0">
                        {comparisonSentiment && (
                             <svg className="absolute inset-0 w-full h-full overflow-visible" style={{transform: 'scaleY(-1) rotate(180deg)'}}>
                                <line
                                    x1={`${100 - clamp(comparisonSentiment.formality, 0, 100)}%`}
                                    y1={`${100 - clamp(comparisonSentiment.friendliness, 0, 100)}%`}
                                    x2={`${100 - formality}%`}
                                    y2={`${100 - friendliness}%`}
                                    stroke="url(#line-gradient)"
                                    strokeWidth="2"
                                    strokeDasharray="3 3"
                                />
                                 <defs>
                                    <linearGradient id="line-gradient" x1={`${100 - clamp(comparisonSentiment.formality, 0, 100)}%`} y1={`${100 - clamp(comparisonSentiment.friendliness, 0, 100)}%`} x2={`${100 - formality}%`} y2={`${100 - friendliness}%`} gradientUnits="userSpaceOnUse">
                                        <stop stopColor={`hsl(${120 * (clamp(comparisonSentiment.score, -1, 1) * 0.5 + 0.5)}, 80%, 60%)`} stopOpacity="0.8" />
                                        <stop offset="1" stopColor={`hsl(${120 * (score * 0.5 + 0.5)}, 80%, 60%)`} stopOpacity="0.8" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        )}
                       
                        {comparisonSentiment && <SentimentPoint point={comparisonSentiment} isComparison />}
                        <SentimentPoint point={sentiment} />
                    </div>
                </div>

                {/* Axis Labels */}
                <span className="absolute bottom-0 right-0 text-[10px] text-slate-500 dark:text-white/60">{uiTranslations?.formal ?? 'Formal'} →</span>
                <span className="absolute top-1/2 -translate-y-1/2 -left-4 text-[10px] text-slate-500 dark:text-white/60 origin-center -rotate-90 whitespace-nowrap">{uiTranslations?.friendly ?? 'Friendly'} →</span>
            </div>

            {/* Numeric Readout */}
            <div className="mt-2 pt-1.5 border-t border-slate-200 dark:border-white/10 flex justify-between text-[10px] text-slate-600 dark:text-white/70 tabular-nums">
                <span>{score >= 0 ? `+${score.toFixed(2)}` : score.toFixed(2)}</span>
                <span>{uiTranslations?.friendly ?? 'Friendly'}: {Math.round(friendliness)}</span>
                <span>{uiTranslations?.formal ?? 'Formal'}: {Math.round(formality)}</span>
            </div>
        </div>
        
        {/* Emoji Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`text-2xl transition-transform duration-300 ease-in-out hover:scale-125 focus:outline-none z-10 ${
            isExpanded ? 'scale-150' : 'scale-100'
          }`}
          aria-label="Show sentiment analysis map"
        >
          {sentiment.emoji}
        </button>
      </div>
    </div>
  );
};