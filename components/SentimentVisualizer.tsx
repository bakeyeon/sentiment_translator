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

const SentimentPoint: React.FC<{ point: Sentiment; isComparison?: boolean }> = ({ point, isComparison }) => {
    // Map score from -1 (red) to 1 (green) through yellow
    const pointColor = `hsl(${120 * (point.score * 0.5 + 0.5)}, 80%, 60%)`;
    
    return (
        <div
            className={`absolute w-3 h-3 rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out`}
            style={{ 
                bottom: `${point.intimacy}%`, 
                left: `${point.formality}%`,
                backgroundColor: isComparison ? 'transparent' : pointColor,
                border: isComparison ? `2px solid ${pointColor}` : 'none',
            }}
            title={`Sentiment: ${point.score.toFixed(2)}\nIntimacy: ${point.intimacy}\nFormality: ${point.formality}`}
        >
             <div className="absolute inset-0 rounded-full" style={{boxShadow: `0 0 8px 1px ${pointColor}`}}></div>
        </div>
    );
}


export const SentimentVisualizer: React.FC<SentimentVisualizerProps> = ({ sentiment, comparisonSentiment, uiTranslations }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const visualizerRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(visualizerRef, () => setIsExpanded(false));

  return (
    <div ref={visualizerRef} className="absolute bottom-0 right-0">
      <div className="relative flex items-center justify-center">
        {/* Sentiment Map */}
        <div
          className={`absolute bottom-full mb-3 right-0 lg:right-1/2 lg:translate-x-1/2 w-48 h-48 origin-bottom transition-all duration-300 ease-in-out p-4 bg-gray-900/70 backdrop-blur-md rounded-lg border border-white/20 shadow-2xl ${
            isExpanded ? 'scale-100 opacity-100' : 'scale-75 opacity-0 -z-10'
          }`}
          style={{ pointerEvents: isExpanded ? 'auto' : 'none' }}
        >
            <div className="relative w-full h-full">
                {/* Sentiment Legend */}
                <div className="absolute -top-2 left-0 right-0">
                    <div className="w-full h-1 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full"></div>
                    <div className="flex justify-between text-[9px] text-white/70 mt-0.5 px-0.5">
                        <span>{uiTranslations?.negative ?? 'Negative'}</span>
                        <span>{uiTranslations?.positive ?? 'Positive'}</span>
                    </div>
                </div>

                {/* Grid */}
                <div className="absolute inset-0 grid grid-cols-4 grid-rows-4">
                    {[...Array(16)].map((_, i) => (
                        <div key={i} className="border-r border-b border-white/10 last:border-r-0"></div>
                    ))}
                </div>

                {/* Plot Area */}
                <div className="absolute inset-0">
                    {comparisonSentiment && (
                         <svg className="absolute inset-0 w-full h-full overflow-visible" style={{transform: 'scaleY(-1) rotate(180deg)'}}>
                            <line
                                x1={`${100-comparisonSentiment.formality}%`}
                                y1={`${100-comparisonSentiment.intimacy}%`}
                                x2={`${100-sentiment.formality}%`}
                                y2={`${100-sentiment.intimacy}%`}
                                stroke="url(#line-gradient)"
                                strokeWidth="2"
                                strokeDasharray="3 3"
                            />
                             <defs>
                                <linearGradient id="line-gradient" x1={`${100-comparisonSentiment.formality}%`} y1={`${100-comparisonSentiment.intimacy}%`} x2={`${100-sentiment.formality}%`} y2={`${100-sentiment.intimacy}%`} gradientUnits="userSpaceOnUse">
                                    <stop stopColor={`hsl(${120 * (comparisonSentiment.score * 0.5 + 0.5)}, 80%, 60%)`} stopOpacity="0.8" />
                                    <stop offset="1" stopColor={`hsl(${120 * (sentiment.score * 0.5 + 0.5)}, 80%, 60%)`} stopOpacity="0.8" />
                                </linearGradient>
                            </defs>
                        </svg>
                    )}
                   
                    {comparisonSentiment && <SentimentPoint point={comparisonSentiment} isComparison />}
                    <SentimentPoint point={sentiment} />
                </div>

                {/* Axis Labels */}
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-white/50">{uiTranslations?.formal ?? 'Formal'} →</span>
                <span className="absolute top-1/2 -translate-y-1/2 -left-1.5 text-[10px] text-white/50 origin-center -rotate-90">{uiTranslations?.intimate ?? 'Intimate'} →</span>
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