import React from 'react';
import type { Sentiment, UITranslations, TextStyle } from '../types';
import { SentimentVisualizer } from './SentimentVisualizer';
import { LoadingSpinner } from './icons';

interface TextAreaWithSentimentProps {
  id: string;
  label: string;
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  readOnly?: boolean;
  placeholder: string;
  sentiment: Sentiment | null;
  comparisonSentiment?: Sentiment | null;
  uiTranslations?: UITranslations | null;
  isLoading?: boolean; // For the big overlay spinner (used for initial translation)
  isAnalyzing?: boolean; // For the small real-time analysis spinner
  textStyle?: TextStyle | null;
}

export const TextAreaWithSentiment: React.FC<TextAreaWithSentimentProps> = ({
  id,
  label,
  value,
  onChange,
  readOnly = false,
  placeholder,
  sentiment,
  comparisonSentiment,
  uiTranslations,
  isLoading,
  isAnalyzing,
  textStyle,
}) => {
  return (
    <div className="w-full">
      <label htmlFor={id} className="block mb-2 text-sm font-medium text-cyan-200">
        {label}
      </label>
      <div className="relative">
        <textarea
          id={id}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          placeholder={placeholder}
          className="w-full h-48 p-4 pr-20 text-lg text-gray-100 bg-white/5 border border-cyan-500/30 rounded-lg resize-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 focus:outline-none backdrop-blur-sm transition-colors"
        />
        {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 rounded-lg">
                <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-cyan-400"></div>
            </div>
        )}
        <div className="absolute bottom-3 right-3 flex items-center justify-center h-10 w-10">
            {isAnalyzing ? (
                 <LoadingSpinner className="w-6 h-6 animate-spin text-cyan-400"/>
            ) : sentiment && (
                 <SentimentVisualizer 
                    sentiment={sentiment} 
                    comparisonSentiment={comparisonSentiment} 
                    uiTranslations={uiTranslations}
                />
            )}
        </div>
      </div>
      {textStyle && uiTranslations && (uiTranslations.spoken || uiTranslations.written) && (
        <div className="mt-2 text-right">
          <span className="inline-block bg-gray-700 text-cyan-200 text-xs font-semibold px-2.5 py-1 rounded-full">
            {textStyle === 'SPOKEN' ? uiTranslations.spoken : uiTranslations.written}
          </span>
        </div>
      )}
    </div>
  );
};