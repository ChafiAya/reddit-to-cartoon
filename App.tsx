
import React, { useState, useEffect } from 'react';
import { StoryFinder } from './components/StoryFinder';
import { EbookCreator } from './components/EbookCreator';
import { Story, AppState } from './types';
import { Button } from './components/Button';
import { KeyRound, Sparkles } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.DISCOVER);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(true);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    try {
      // Check if window.aistudio exists and if a key is selected
      if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
        setHasApiKey(true);
      }
    } catch (e) {
      console.error("Error checking API key:", e);
    } finally {
      setIsCheckingKey(false);
    }
  };

  const handleConnectApiKey = async () => {
    try {
      if (window.aistudio) {
        await window.aistudio.openSelectKey();
        // Assume success if user completes flow, update state to unlock app
        setHasApiKey(true);
      } else {
        alert("AI Studio environment not detected.");
      }
    } catch (e) {
      console.error("Error selecting API key:", e);
    }
  };

  const handleSelectStory = (story: Story) => {
    setSelectedStory(story);
    setAppState(AppState.BUILDING);
  };

  const handleBackToDiscover = () => {
    setAppState(AppState.DISCOVER);
    setSelectedStory(null);
  };

  if (isCheckingKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // LANDING PAGE: Force API Key Selection
  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-slate-900 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-lg border border-white/20 p-10 rounded-3xl shadow-2xl">
           <div className="w-20 h-20 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/50">
              <Sparkles className="w-10 h-10 text-white" />
           </div>
           <h1 className="text-3xl font-extrabold text-white mb-2">RedditToon Studio</h1>
           <p className="text-indigo-200 mb-8 leading-relaxed">
             Create viral ebook stories from Reddit trends using Gemini 2.5 & 3 Pro.
           </p>
           
           <div className="bg-white/5 rounded-xl p-4 mb-8 text-sm text-indigo-100 border border-white/10">
              This app requires a Gemini API Key to access high-quality image generation and analysis features.
           </div>

           <Button 
             onClick={handleConnectApiKey} 
             size="lg" 
             className="w-full bg-white text-indigo-900 hover:bg-indigo-50 border-0 font-bold"
           >
             <KeyRound className="w-5 h-5 mr-2" />
             Connect Gemini API Key
           </Button>
           
           <p className="mt-6 text-xs text-slate-400">
             <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-white transition-colors">
               Billing information
             </a>
           </p>
        </div>
      </div>
    );
  }

  // MAIN APP
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Decorative background elements */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-purple-200/20 rounded-full blur-3xl"></div>
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-indigo-200/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10">
        {appState === AppState.DISCOVER && (
          <div className="flex items-center justify-center min-h-screen py-12">
            <StoryFinder onSelectStory={handleSelectStory} />
          </div>
        )}

        {appState === AppState.BUILDING && selectedStory && (
          <div className="min-h-screen py-8">
            <EbookCreator 
              story={selectedStory} 
              onBack={handleBackToDiscover} 
            />
          </div>
        )}
      </div>
      
      {/* Footer */}
      <footer className="py-6 text-center text-slate-400 text-sm relative z-10">
        <p>Powered by Gemini 2.5 Flash & Flash Image</p>
      </footer>
    </div>
  );
};

export default App;
