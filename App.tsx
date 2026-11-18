
import React, { useState, useCallback, useEffect } from 'react';
import { TextAreaWithSentiment } from './components/TextAreaWithSentiment';
import { TranslateIcon, LoadingSpinner, LightbulbIcon } from './components/icons';
import { getTranslationAndSentiment, getSentiment, getEmojiSuggestions } from './services/geminiService';
import type { Sentiment, Language, EmojiSuggestion, UITranslations, TextStyle } from './types';
import { SUPPORTED_LANGUAGES } from './constants';
import { getEmojiForScore } from './emoji';
import { EmojiSuggestionBox } from './components/EmojiSuggestionBox';
import { Wordmark } from './components/Logo';

// Light / dark switch: remembers the choice; the initial theme is set in index.html before React loads.
const ThemeToggle: React.FC = () => {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const flip = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch { /* storage unavailable */ }
    setDark(next);
  };
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className="fixed top-4 right-4 z-20 w-10 h-10 flex items-center justify-center rounded-full border border-white/80 bg-white/60 backdrop-blur-xl text-amber-500 shadow-[0_4px_16px_rgba(15,23,42,0.08)] transition hover:scale-110 dark:border-white/10 dark:bg-white/[0.06] dark:text-cyan-200"
    >
      {dark ? (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
};

const App: React.FC = () => {
  const [sourceLanguage, setSourceLanguage] = useState<Language>(SUPPORTED_LANGUAGES.find(l => l.code === 'th') || SUPPORTED_LANGUAGES[0]); // Default to Thai
  const [targetLanguage, setTargetLanguage] = useState<Language>(SUPPORTED_LANGUAGES[1]); // Default to Korean
  const [sourceText, setSourceText] = useState('ไปไหนมานะ'); // Default Thai example: "Where have you been? (softened)"
  
  const [translatedText, setTranslatedText] = useState('');
  const [sourceSentiment, setSourceSentiment] = useState<Sentiment | null>(null);
  const [translatedSentiment, setTranslatedSentiment] = useState<Sentiment | null>(null);
  const [emojiSuggestion, setEmojiSuggestion] = useState<EmojiSuggestion | null>(null);
  const [nuanceExplanation, setNuanceExplanation] = useState<string | null>(null);
  const [uiTranslations, setUiTranslations] = useState<UITranslations | null>(null);
  const [sourceStyle, setSourceStyle] = useState<TextStyle | null>(null);
  const [translatedStyle, setTranslatedStyle] = useState<TextStyle | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isTranslatedAnalyzing, setIsTranslatedAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeTranslatedSentiment = useCallback(async (text: string) => {
    if (!text.trim()) {
      setTranslatedSentiment(null);
      return;
    }
    setIsTranslatedAnalyzing(true);
     try {
        const { score, friendliness, formality } = await getSentiment(text);
        setTranslatedSentiment({ score, friendliness, formality, emoji: getEmojiForScore(score) });
    } catch (e) {
        setTranslatedSentiment({ score: 0, friendliness: 50, formality: 50, emoji: getEmojiForScore(0) });
    } finally {
        setIsTranslatedAnalyzing(false);
    }
  }, []);

  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim()) return;

    setIsLoading(true);
    setError(null);
    setTranslatedText('');
    setTranslatedSentiment(null);
    setEmojiSuggestion(null);
    setNuanceExplanation(null);
    setSourceSentiment(null);
    setUiTranslations(null);
    setSourceStyle(null);
    setTranslatedStyle(null);

    try {
      const { 
        translation, 
        nuance, 
        sourceSentiment: srcSentiment, 
        translatedSentiment: transSentiment, 
        uiTranslations: newUiTranslations,
        sourceStyle: newSourceStyle,
        translatedStyle: newTranslatedStyle,
       } = 
        await getTranslationAndSentiment(sourceText, sourceLanguage.code, targetLanguage.name);
      
      setSourceSentiment({ 
        ...srcSentiment, 
        emoji: getEmojiForScore(srcSentiment.score) 
      });
      setTranslatedText(translation);
      setTranslatedSentiment({
        ...transSentiment,
        emoji: getEmojiForScore(transSentiment.score)
      });
      
      setUiTranslations(newUiTranslations);
      setSourceStyle(newSourceStyle);
      setTranslatedStyle(newTranslatedStyle);

      if (nuance) {
          setNuanceExplanation(nuance);
      }

      setIsLoading(false);

      const scoreDifference = Math.abs(srcSentiment.score - transSentiment.score);
      if (scoreDifference > 0.2) { // Threshold to avoid suggestions for tiny differences
        getEmojiSuggestions(sourceText, translation, srcSentiment.score, transSentiment.score)
          .then((suggestions) => setEmojiSuggestion(suggestions))
          .catch((suggestionErr) => console.error('Emoji suggestion error:', suggestionErr));
      }

    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'An error occurred while translating. Please try again.';
      setError(message);
      console.error(err);
      setIsLoading(false);
    }
  }, [sourceText, sourceLanguage, targetLanguage]);

  const handleEmojiAdd = (emoji: string) => {
    const newText = (translatedText.trim() + ' ' + emoji).trim();
    setTranslatedText(newText);
    analyzeTranslatedSentiment(newText);
  };

  const handleSourceTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setSourceText(newText);
    // If user changes source text, the old translation is invalid.
    // Clear all derived state.
    if (translatedText) {
        setTranslatedText('');
        setSourceSentiment(null); 
        setTranslatedSentiment(null);
        setEmojiSuggestion(null);
        setNuanceExplanation(null);
        setUiTranslations(null);
        setError(null);
        setSourceStyle(null);
        setTranslatedStyle(null);
    }
  };

  return (
    <div className="min-h-screen text-slate-800 dark:text-white font-sans p-4 sm:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl mx-auto">
        <ThemeToggle />
        <header className="text-center mb-8 pt-8 sm:pt-0">
          <Wordmark />
          <p className="mt-3 text-lg text-slate-500 dark:text-gray-300">
            Preserving cultural and emotional nuance in translation.
          </p>
        </header>

        <main className="flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end p-4 bg-white/55 dark:bg-white/[0.04] backdrop-blur-xl border border-white/80 dark:border-white/10 shadow-[0_8px_32px_rgba(15,23,42,0.07)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)] rounded-2xl">
            <div className="w-full">
                <label htmlFor="source-language" className="block mb-1 text-sm font-medium text-cyan-700 dark:text-cyan-200">Translate from</label>
                <select
                    id="source-language"
                    value={sourceLanguage.code}
                    onChange={(e) => {
                        const selectedLang = SUPPORTED_LANGUAGES.find(l => l.code === e.target.value);
                        if(selectedLang) setSourceLanguage(selectedLang);
                    }}
                    className="w-full p-2 text-slate-800 dark:text-white bg-white/70 dark:bg-gray-900/60 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none"
                    disabled={isLoading}
                >
                    {SUPPORTED_LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                </select>
            </div>
            <div className="w-full">
                <label htmlFor="target-language" className="block mb-1 text-sm font-medium text-cyan-700 dark:text-cyan-200">Translate to</label>
                <select
                    id="target-language"
                    value={targetLanguage.code}
                    onChange={(e) => {
                        const selectedLang = SUPPORTED_LANGUAGES.find(l => l.code === e.target.value);
                        if(selectedLang) setTargetLanguage(selectedLang);
                    }}
                    className="w-full p-2 text-slate-800 dark:text-white bg-white/70 dark:bg-gray-900/60 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:outline-none"
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
              className="w-full flex items-center justify-center gap-2 px-6 py-2 text-lg font-semibold text-gray-900 bg-cyan-400 rounded-md transition-all duration-300 ease-in-out hover:bg-cyan-300 disabled:bg-slate-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transform hover:scale-105 disabled:scale-100"
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

          {error && <div className="p-4 text-center text-red-700 dark:text-red-300 bg-red-50/70 dark:bg-red-900/40 backdrop-blur-xl border border-red-300/60 dark:border-red-500/40 rounded-2xl">{error}</div>}

          <div className="flex flex-col gap-4">
            <TextAreaWithSentiment
              id="source-text"
              label={`Original Text (${sourceLanguage.name})`}
              value={sourceText}
              onChange={handleSourceTextChange}
              placeholder="Enter text to translate..."
              sentiment={sourceSentiment}
              uiTranslations={uiTranslations}
              textStyle={sourceStyle}
            />

            {nuanceExplanation && !isLoading && (
              <div className="p-4 bg-amber-50/60 dark:bg-yellow-900/20 backdrop-blur-xl border border-amber-200/70 dark:border-yellow-500/25 rounded-2xl shadow-[0_8px_32px_rgba(15,23,42,0.05)] animate-fade-in">
                  <div className="flex items-center gap-2 mb-2">
                      <LightbulbIcon className="w-5 h-5 text-amber-500 dark:text-yellow-300" />
                      <h3 className="font-semibold text-amber-700 dark:text-yellow-200">Nuance Analysis</h3>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-gray-200">{nuanceExplanation}</p>
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
              comparisonSentiment={sourceSentiment}
              uiTranslations={uiTranslations}
              isLoading={isLoading && !translatedText}
              isAnalyzing={isTranslatedAnalyzing}
              textStyle={translatedStyle}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;