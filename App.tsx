import React, { useState, useCallback, useEffect } from 'react';
import { TextAreaWithSentiment } from './components/TextAreaWithSentiment';
import { TranslateIcon, LoadingSpinner } from './components/icons';
import { getTranslationAndSentiment, getSentiment } from './services/geminiService';
import type { Sentiment, Language } from './types';
import { SUPPORTED_LANGUAGES } from './constants';
import { getEmojiForScore } from './emoji';

const App: React.FC = () => {
  const [sourceText, setSourceText] = useState('This new café has a wonderful ambiance and the coffee is absolutely divine!');
  const [translatedText, setTranslatedText] = useState('');
  const [targetLanguage, setTargetLanguage] = useState<Language>(SUPPORTED_LANGUAGES[1]); // Default to Korean
  
  const [sourceSentiment, setSourceSentiment] = useState<Sentiment | null>(null);
  const [translatedSentiment, setTranslatedSentiment] = useState<Sentiment | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSourceAnalyzing, setIsSourceAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeSourceSentiment = useCallback(async (text: string) => {
    if (!text.trim()) {
        setSourceSentiment(null);
        return;
    }
    setIsSourceAnalyzing(true);
    try {
        const { score } = await getSentiment(text);
        setSourceSentiment({ score, emoji: getEmojiForScore(score) });
    } catch (e) {
        // Error is logged in the service, set a neutral sentiment
        setSourceSentiment({ score: 0, emoji: getEmojiForScore(0) });
    } finally {
        setIsSourceAnalyzing(false);
    }
  }, []);

  // Analyze source text sentiment in real-time with debouncing
  useEffect(() => {
    // Don't analyze while a full translation is in progress
    if (isLoading) return;

    const handler = setTimeout(() => {
        analyzeSourceSentiment(sourceText);
    }, 500); // 500ms delay

    return () => {
        clearTimeout(handler);
    };
  }, [sourceText, analyzeSourceSentiment, isLoading]);


  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim()) return;

    setIsLoading(true);
    setError(null);
    setTranslatedText('');
    setTranslatedSentiment(null);

    try {
      const { translation, sentiment: srcSentimentScore } = await getTranslationAndSentiment(sourceText, targetLanguage.name);
      
      setSourceSentiment({ 
        score: srcSentimentScore.score, 
        emoji: getEmojiForScore(srcSentimentScore.score) 
      });
      setTranslatedText(translation);

      // Now analyze the sentiment of the translated text
      const { score: transScore } = await getSentiment(translation);
      setTranslatedSentiment({ 
        score: transScore, 
        emoji: getEmojiForScore(transScore) 
      });

    } catch (err) {
      setError('An error occurred. Please check your API key and try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [sourceText, targetLanguage]);

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans p-4 sm:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-200">
            Sentiment Translator
          </h1>
          <p className="mt-2 text-lg text-gray-300">
            Translate text and visualize its emotional nuance.
          </p>
        </header>

        <main className="flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center p-4 bg-white/5 rounded-lg border border-cyan-500/30">
            <div className="w-full">
                <label htmlFor="target-language" className="block mb-1 text-sm font-medium text-cyan-200">Translate to</label>
                <select
                    id="target-language"
                    value={targetLanguage.code}
                    onChange={(e) => {
                        const selectedLang = SUPPORTED_LANGUAGES.find(l => l.code === e.target.value);
                        if(selectedLang) setTargetLanguage(selectedLang);
                    }}
                    className="w-full p-2 text-white bg-gray-800 border border-gray-600 rounded-md focus:ring-2 focus:ring-cyan-400 focus:outline-none"
                    disabled={isLoading}
                >
                    {SUPPORTED_LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                </select>
            </div>
            <button
              onClick={handleTranslate}
              disabled={isLoading || !sourceText.trim()}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 text-lg font-semibold text-gray-900 bg-cyan-400 rounded-md transition-all duration-300 ease-in-out hover:bg-cyan-300 disabled:bg-gray-600 disabled:cursor-not-allowed transform hover:scale-105 disabled:scale-100"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner className="w-6 h-6 animate-spin" />
                  Translating...
                </>
              ) : (
                <>
                  <TranslateIcon className="w-6 h-6" />
                  Translate
                </>
              )}
            </button>
          </div>

          {error && <div className="p-4 text-center text-red-300 bg-red-900/50 border border-red-500/50 rounded-lg">{error}</div>}

          <div className="flex flex-col gap-8">
            <TextAreaWithSentiment
              id="source-text"
              label="Original Text"
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Enter text to translate..."
              sentiment={sourceSentiment}
              isAnalyzing={isSourceAnalyzing}
            />
            <TextAreaWithSentiment
              id="translated-text"
              label="Translated Text"
              value={translatedText}
              readOnly
              placeholder="Translation will appear here..."
              sentiment={translatedSentiment}
              isLoading={isLoading && !translatedText}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
