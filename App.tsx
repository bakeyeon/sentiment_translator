import React, { useState, useCallback, useEffect } from 'react';
import { TextAreaWithSentiment } from './components/TextAreaWithSentiment';
import { TranslateIcon, LoadingSpinner, LightbulbIcon } from './components/icons';
import { getTranslationAndSentiment, getSentiment, getEmojiSuggestions } from './services/geminiService';
import type { Sentiment, Language, EmojiSuggestion } from './types';
import { SUPPORTED_LANGUAGES } from './constants';
import { getEmojiForScore } from './emoji';
import { EmojiSuggestionBox } from './components/EmojiSuggestionBox';

const App: React.FC = () => {
  const [sourceLanguage, setSourceLanguage] = useState<Language>(SUPPORTED_LANGUAGES.find(l => l.code === 'th') || SUPPORTED_LANGUAGES[0]); // Default to Thai
  const [targetLanguage, setTargetLanguage] = useState<Language>(SUPPORTED_LANGUAGES[1]); // Default to Korean
  const [sourceText, setSourceText] = useState('ไปไหนมานะ'); // Default Thai example: "Where have you been? (softened)"
  
  const [translatedText, setTranslatedText] = useState('');
  const [sourceSentiment, setSourceSentiment] = useState<Sentiment | null>(null);
  const [translatedSentiment, setTranslatedSentiment] = useState<Sentiment | null>(null);
  const [emojiSuggestion, setEmojiSuggestion] = useState<EmojiSuggestion | null>(null);
  const [nuanceExplanation, setNuanceExplanation] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSourceAnalyzing, setIsSourceAnalyzing] = useState(false);
  const [isTranslatedAnalyzing, setIsTranslatedAnalyzing] = useState(false);
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
        setSourceSentiment({ score: 0, emoji: getEmojiForScore(0) });
    } finally {
        setIsSourceAnalyzing(false);
    }
  }, []);

  const analyzeTranslatedSentiment = useCallback(async (text: string) => {
    if (!text.trim()) {
      setTranslatedSentiment(null);
      return;
    }
    setIsTranslatedAnalyzing(true);
     try {
        const { score } = await getSentiment(text);
        setTranslatedSentiment({ score, emoji: getEmojiForScore(score) });
    } catch (e) {
        setTranslatedSentiment({ score: 0, emoji: getEmojiForScore(0) });
    } finally {
        setIsTranslatedAnalyzing(false);
    }
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const handler = setTimeout(() => {
        analyzeSourceSentiment(sourceText);
    }, 500);
    return () => clearTimeout(handler);
  }, [sourceText, analyzeSourceSentiment, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    analyzeTranslatedSentiment(translatedText);
  }, [translatedText, analyzeTranslatedSentiment, isLoading]);


  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim()) return;

    setIsLoading(true);
    setError(null);
    setTranslatedText('');
    setTranslatedSentiment(null);
    setEmojiSuggestion(null);
    setNuanceExplanation(null);

    try {
      const { translation, nuance, sourceSentiment: srcSentiment, translatedSentiment: transSentiment } = 
        await getTranslationAndSentiment(sourceText, sourceLanguage.code, targetLanguage.name);
      
      setSourceSentiment({ 
        score: srcSentiment.score, 
        emoji: getEmojiForScore(srcSentiment.score) 
      });
      setTranslatedText(translation);
      setTranslatedSentiment({
        score: transSentiment.score,
        emoji: getEmojiForScore(transSentiment.score)
      });
      
      if (nuance) {
          setNuanceExplanation(nuance);
      }

      const scoreDifference = Math.abs(srcSentiment.score - transSentiment.score);
      if (scoreDifference > 0.2) { // Threshold to avoid suggestions for tiny differences
        const suggestions = await getEmojiSuggestions(sourceText, translation, srcSentiment.score, transSentiment.score);
        setEmojiSuggestion(suggestions);
      }

    } catch (err) {
      setError('An error occurred. Please check your API key and try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [sourceText, sourceLanguage, targetLanguage]);

  const handleEmojiAdd = (emoji: string) => {
    setTranslatedText(prev => (prev.trim() + ' ' + emoji).trim());
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans p-4 sm:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-200">
            Sentiment Translator
          </h1>
          <p className="mt-2 text-lg text-gray-300">
            Preserving cultural and emotional nuance in translation.
          </p>
        </header>

        <main className="flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end p-4 bg-white/5 rounded-lg border border-cyan-500/30">
            <div className="w-full">
                <label htmlFor="source-language" className="block mb-1 text-sm font-medium text-cyan-200">Translate from</label>
                <select
                    id="source-language"
                    value={sourceLanguage.code}
                    onChange={(e) => {
                        const selectedLang = SUPPORTED_LANGUAGES.find(l => l.code === e.target.value);
                        if(selectedLang) setSourceLanguage(selectedLang);
                    }}
                    className="w-full p-2 text-white bg-gray-800 border border-gray-600 rounded-md focus:ring-2 focus:ring-cyan-400 focus:outline-none"
                    disabled={isLoading}
                >
                    {SUPPORTED_LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                </select>
            </div>
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
              className="w-full flex items-center justify-center gap-2 px-6 py-2 text-lg font-semibold text-gray-900 bg-cyan-400 rounded-md transition-all duration-300 ease-in-out hover:bg-cyan-300 disabled:bg-gray-600 disabled:cursor-not-allowed transform hover:scale-105 disabled:scale-100"
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

          <div className="flex flex-col gap-4">
            <TextAreaWithSentiment
              id="source-text"
              label={`Original Text (${sourceLanguage.name})`}
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Enter text to translate..."
              sentiment={sourceSentiment}
              isAnalyzing={isSourceAnalyzing}
            />

            {nuanceExplanation && !isLoading && (
              <div className="p-4 bg-yellow-900/30 border border-yellow-500/30 rounded-lg animate-fade-in">
                  <div className="flex items-center gap-2 mb-2">
                      <LightbulbIcon className="w-5 h-5 text-yellow-300" />
                      <h3 className="font-semibold text-yellow-200">Nuance Analysis</h3>
                  </div>
                  <p className="text-sm text-gray-200">{nuanceExplanation}</p>
              </div>
            )}

            {emojiSuggestion && !isLoading && (
                <EmojiSuggestionBox 
                    suggestion={emojiSuggestion}
                    onEmojiClick={handleEmojiAdd}
                />
            )}

            <TextAreaWithSentiment
              id="translated-text"
              label={`Translated Text (${targetLanguage.name})`}
              value={translatedText}
              readOnly
              placeholder="Translation will appear here..."
              sentiment={translatedSentiment}
              isLoading={isLoading && !translatedText}
              isAnalyzing={isTranslatedAnalyzing}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;