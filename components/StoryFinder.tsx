
import React, { useState } from 'react';
import { findViralStories, createStoryFromPrompt } from '../services/gemini';
import { Story, LayoutStyle } from '../types';
import { Button } from './Button';
import { 
  Search, Sparkles, AlertCircle, PenTool, Globe, BookOpen, Palette, LayoutGrid, 
  FileImage, Users, TrendingUp, ShoppingBag, MessageSquare, Flame, Heart, 
  Ghost, Smile, Newspaper, Smartphone
} from 'lucide-react';

interface StoryFinderProps {
  onSelectStory: (story: Story) => void;
}

type Mode = 'search' | 'create';
type InspirationTab = 'reddit' | 'social' | 'news' | 'niches';

const ART_STYLES = [
  "Pixar 3D Animation",
  "Disney 2D Cartoon",
  "Japanese Anime",
  "Watercolor Book",
  "Caricature",
  "Film Noir (B&W)",
  "Vintage Comic",
  "Claymation",
  "Pixel Art"
];

const TARGET_AUDIENCES = [
  "Toddlers (0-3 years)",
  "Children (4-8 years)",
  "Pre-Teens (9-12 years)",
  "Young Adults",
  "Adults",
  "Educational",
];

// --- DATA SOURCES ---

const REDDIT_CATEGORIES = [
  {
    title: "🌈 Best for Kids (Wholesome/Funny)",
    icon: <Smile className="w-4 h-4 text-pink-500" />,
    items: [
      { label: "r/AmItheButtface", query: "Family friendly funny stories from r/AmItheButtface" },
      { label: "r/KidsAreFuckingStupid", query: "Hilarious kid moments from r/KidsAreFuckingStupid" },
      { label: "r/TalesFromTheFrontDesk", query: "Funny stories from r/talesfromthefrontdesk" },
      { label: "r/TalesFromRetail", query: "Harmless retail stories from r/talesfromretail" },
      { label: "r/WholesomeMemes", query: "Wholesome stories from r/wholesomememes" },
      { label: "r/FeelGood", query: "Feel good uplifting stories from r/FeelGood" },
      { label: "r/Parenting", query: "Funny parenting stories from r/Parenting" },
    ]
  },
  {
    title: "🔥 Best for Adult Drama (Viral)",
    icon: <Flame className="w-4 h-4 text-orange-500" />,
    items: [
      { label: "r/AmItheAsshole", query: "Viral drama from r/AmItheAsshole" },
      { label: "r/TrueOffMyChest", query: "Emotional viral confessions from r/TrueOffMyChest" },
      { label: "r/Relationship_Advice", query: "Relationship drama and advice from r/relationship_advice" },
      { label: "r/EntitledParents", query: "Entitled parent drama from r/entitledparents" },
      { label: "r/TIFU", query: "Embarrassing Today I Fucked Up stories from r/tifu" },
      { label: "r/MaliciousCompliance", query: "Satisfying revenge stories from r/maliciouscompliance" },
      { label: "r/PettyRevenge", query: "Short revenge stories from r/pettyrevenge" },
      { label: "r/LetsNotMeet", query: "Creepy true stories from r/letsnotmeet" },
    ]
  },
  {
    title: "👻 Horror & Thriller",
    icon: <Ghost className="w-4 h-4 text-purple-600" />,
    items: [
      { label: "r/NoSleep", query: "Scary stories from r/NoSleep" },
      { label: "r/Paranormal", query: "Ghost stories from r/Paranormal" },
      { label: "r/Glitch_in_the_Matrix", query: "Unexplainable glitch stories" },
      { label: "r/TheTruthIsHere", query: "True scary stories" },
    ]
  }
];

const SOCIAL_CATEGORIES = [
  {
    title: "📱 Social Media Trends",
    icon: <Smartphone className="w-4 h-4 text-indigo-500" />,
    items: [
      { label: "TikTok 'Storytime'", query: "Viral 'Storytime' trends on TikTok" },
      { label: "IG Reels Drama", query: "Trending storytelling formats on Instagram Reels" },
      { label: "Twitter Threads", query: "Viral storytelling threads on Twitter/X" },
      { label: "YouTube Animation", query: "Viral animation storytime topics on YouTube" },
      { label: "YouTube True Crime", query: "Trending True Crime stories on YouTube" },
      { label: "Viral Challenges", query: "Viral internet challenge stories" },
    ]
  }
];

const NEWS_CATEGORIES = [
  {
    title: "📰 Viral News",
    icon: <Newspaper className="w-4 h-4 text-blue-500" />,
    items: [
      { label: "Uplifting News", query: "Viral uplifting news stories from UpliftingNews" },
      { label: "Weird News", query: "Strange and weird news stories from Oddity Central" },
      { label: "Tech Drama", query: "Viral technology industry drama and stories" },
      { label: "Florida Man", query: "Funny Florida Man news headlines and stories" },
      { label: "Good News Network", query: "Inspiring stories from Good News Network" },
      { label: "Viral Science", query: "Viral science discoveries and stories" },
    ]
  }
];

const NICHE_CATEGORIES = [
  {
    title: "📈 Bestselling KDP Niches",
    icon: <TrendingUp className="w-4 h-4 text-green-600" />,
    items: [
      { label: "Wholesome Animal Friendship", query: "Wholesome animal friendship stories for ebooks" },
      { label: "Emotional Intelligence (Kids)", query: "Stories about dealing with emotions for kids" },
      { label: "Sci-Fi Adventure", query: "Exciting sci-fi adventure stories" },
      { label: "Bedtime Moral Stories", query: "Soothing bedtime stories with a moral lesson" },
      { label: "Historical Facts", query: "Fun historical fact stories for kids" },
      { label: "Mystery & Detective", query: "Short mystery detective stories" },
      { label: "Fantasy Quest", query: "Magical fantasy quest stories" },
      { label: "Underdog Sports", query: "Inspirational sports underdog stories" }
    ]
  }
];

export const StoryFinder: React.FC<StoryFinderProps> = ({ onSelectStory }) => {
  const [mode, setMode] = useState<Mode>('search');
  const [topic, setTopic] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [panelCount, setPanelCount] = useState(8);
  const [visualStyle, setVisualStyle] = useState(ART_STYLES[0]);
  const [customStyle, setCustomStyle] = useState('');
  const [layoutStyle, setLayoutStyle] = useState<LayoutStyle>('STORYBOOK');
  const [targetAudience, setTargetAudience] = useState(TARGET_AUDIENCES[1]); // Default to Children
  const [inspirationTab, setInspirationTab] = useState<InspirationTab>('reddit');
  
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getFinalStyle = () => {
    return customStyle.trim() ? customStyle : visualStyle;
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const results = await findViralStories(topic, targetAudience);
      const resultsWithConfig = results.map(s => ({ 
        ...s, 
        panelCount: panelCount,
        visualStyle: getFinalStyle(),
        layoutStyle: layoutStyle,
        targetAudience: targetAudience
      }));
      setStories(resultsWithConfig);
    } catch (err) {
      setError("Failed to find stories. Please check your API key.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustom = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!customPrompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const story = await createStoryFromPrompt(customPrompt, panelCount, targetAudience);
      story.visualStyle = getFinalStyle();
      story.layoutStyle = layoutStyle;
      story.targetAudience = targetAudience;
      onSelectStory(story);
    } catch (err) {
      setError("Failed to create story.");
    } finally {
      setLoading(false);
    }
  };

  const applyInspiration = (query: string) => {
    if (mode === 'search') {
      setTopic(query);
    } else {
      setCustomPrompt(prev => prev ? `${prev}. ${query}` : query);
    }
  };

  // Helper to render category lists
  const renderCategories = (categories: typeof REDDIT_CATEGORIES) => (
    <div className="space-y-6">
      {categories.map((category, idx) => (
        <div key={idx} className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700 border-b border-slate-200 pb-2">
            {category.icon} {category.title}
          </div>
          <div className="flex flex-wrap gap-2">
            {category.items.map(item => (
              <button
                key={item.label}
                onClick={() => applyInspiration(item.query)}
                className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-full hover:border-indigo-400 hover:text-indigo-600 hover:shadow-sm transition-all text-slate-600"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6 lg:p-10 h-screen flex flex-col lg:flex-row gap-8 overflow-hidden">
      
      {/* SIDEBAR - PROJECT SETTINGS */}
      <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-6 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 h-full overflow-y-auto custom-scrollbar">
        <div className="pb-4 border-b border-slate-100">
           <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
             <LayoutGrid className="w-5 h-5 text-indigo-600" />
             Project Settings
           </h2>
           <p className="text-xs text-slate-400 mt-1">Configure your ebook parameters</p>
        </div>

        {/* 1. Audience */}
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
               <Users className="w-3 h-3" /> Target Audience
            </div>
            <div className="grid grid-cols-1 gap-1">
              {TARGET_AUDIENCES.map(aud => (
                <button
                  key={aud}
                  onClick={() => setTargetAudience(aud)}
                  className={`text-sm px-3 py-2 rounded-lg text-left transition-all ${
                    targetAudience === aud
                      ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200'
                      : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  {aud}
                </button>
              ))}
            </div>
        </div>

        {/* 2. Layout */}
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
               <BookOpen className="w-3 h-3" /> Layout Style
            </div>
            <div className="flex flex-col gap-2">
               <button 
                 onClick={() => setLayoutStyle('STORYBOOK')}
                 className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                   layoutStyle === 'STORYBOOK' 
                   ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500' 
                   : 'border-slate-200 hover:border-slate-300'
                 }`}
               >
                 <div className={`p-2 rounded-lg ${layoutStyle === 'STORYBOOK' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <FileImage className="w-4 h-4" />
                 </div>
                 <div>
                    <div className="text-sm font-bold text-slate-800">Storybook</div>
                    <div className="text-xs text-slate-400">1 large image per page</div>
                 </div>
               </button>

               <button 
                 onClick={() => setLayoutStyle('COMIC_STRIP')}
                 className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                   layoutStyle === 'COMIC_STRIP' 
                   ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500' 
                   : 'border-slate-200 hover:border-slate-300'
                 }`}
               >
                 <div className={`p-2 rounded-lg ${layoutStyle === 'COMIC_STRIP' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <LayoutGrid className="w-4 h-4" />
                 </div>
                 <div>
                    <div className="text-sm font-bold text-slate-800">Comic Strip</div>
                    <div className="text-xs text-slate-400">4 panels per page</div>
                 </div>
               </button>
            </div>
        </div>

        {/* 3. Length */}
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
               <BookOpen className="w-3 h-3" /> Story Length
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-2xl font-bold text-slate-700">{panelCount}</span>
                  <span className="text-xs font-medium text-slate-400 mb-1">Pages/Panels</span>
                </div>
                <input 
                  type="range" 
                  min="4" 
                  max="12" 
                  step="4"
                  value={panelCount}
                  onChange={(e) => setPanelCount(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
            </div>
        </div>

        {/* 4. Style */}
        <div className="space-y-3">
             <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <Palette className="w-3 h-3" /> Visual Style
             </div>
             <div className="grid grid-cols-2 gap-2">
               {ART_STYLES.map(style => (
                 <button
                   key={style}
                   onClick={() => { setVisualStyle(style); setCustomStyle(''); }}
                   className={`text-xs px-2 py-2 rounded border transition-colors text-left truncate ${
                     visualStyle === style && !customStyle
                       ? 'bg-slate-800 text-white border-slate-800'
                       : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                   }`}
                 >
                   {style}
                 </button>
               ))}
             </div>
             <input 
               type="text"
               placeholder="Or type custom style..."
               value={customStyle}
               onChange={(e) => setCustomStyle(e.target.value)}
               className="w-full text-xs p-3 border border-slate-200 rounded-lg outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
             />
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-white rounded-2xl shadow-sm border border-slate-100">
        
        {/* Header / Title */}
        <div className="p-8 pb-4">
           <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            RedditToon <span className="text-indigo-600">Studio</span>
          </h1>
          <p className="text-slate-500">Create viral ebooks fueled by Gemini AI.</p>
        </div>

        {/* Tabs */}
        <div className="px-8 flex border-b border-slate-100">
          <button
            onClick={() => setMode('search')}
            className={`px-6 py-4 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${
              mode === 'search' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Globe className="w-4 h-4" />
            Viral Search
          </button>
          <button
            onClick={() => setMode('create')}
            className={`px-6 py-4 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${
              mode === 'create' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <PenTool className="w-4 h-4" />
            Custom Story
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
          
          {mode === 'search' ? (
            <div className="max-w-4xl mx-auto space-y-8">
               {/* Search Bar */}
               <form onSubmit={handleSearch} className="relative group">
                  <div className="relative flex gap-3">
                    <div className="flex-1 relative">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                       <input
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="Search topic (e.g. 'scary', 'revenge', 'wholesome')..."
                        className="w-full pl-12 pr-4 py-4 text-lg bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                    <Button type="submit" isLoading={loading} className="rounded-xl px-8 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 border-0">
                      <Globe className="w-5 h-5 mr-2" />
                      Search Viral Sources
                    </Button>
                  </div>
               </form>
              
               {/* Inspiration Sources */}
               <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Viral Inspiration Sources</h3>
                  </div>
                  
                  {/* Category Tabs */}
                  <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                     <button onClick={() => setInspirationTab('reddit')} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-2 ${inspirationTab === 'reddit' ? 'bg-orange-100 text-orange-700' : 'bg-white border border-slate-200 text-slate-500'}`}>
                        <MessageSquare className="w-3 h-3" /> Reddit (Best Of)
                     </button>
                     <button onClick={() => setInspirationTab('social')} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-2 ${inspirationTab === 'social' ? 'bg-blue-100 text-blue-700' : 'bg-white border border-slate-200 text-slate-500'}`}>
                        <Smartphone className="w-3 h-3" /> Social (IG/TikTok/YT)
                     </button>
                     <button onClick={() => setInspirationTab('news')} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-2 ${inspirationTab === 'news' ? 'bg-purple-100 text-purple-700' : 'bg-white border border-slate-200 text-slate-500'}`}>
                        <Newspaper className="w-3 h-3" /> News & Trends
                     </button>
                     <button onClick={() => setInspirationTab('niches')} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-2 ${inspirationTab === 'niches' ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-slate-200 text-slate-500'}`}>
                        <TrendingUp className="w-3 h-3" /> Etsy/KDP Bestsellers
                     </button>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                     {inspirationTab === 'reddit' && renderCategories(REDDIT_CATEGORIES)}
                     {inspirationTab === 'social' && renderCategories(SOCIAL_CATEGORIES)}
                     {inspirationTab === 'news' && renderCategories(NEWS_CATEGORIES)}
                     {inspirationTab === 'niches' && renderCategories(NICHE_CATEGORIES)}
                  </div>
               </div>

               {/* Results */}
               <div className="space-y-4">
                  {stories.map((story) => (
                    <div 
                      key={story.id} 
                      onClick={() => onSelectStory(story)}
                      className="group cursor-pointer bg-white border border-slate-200 p-6 rounded-2xl hover:border-indigo-500 hover:ring-4 hover:ring-indigo-50 transition-all relative"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="inline-block px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider rounded mb-2">
                            {story.source}
                          </span>
                          <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-indigo-600">{story.title}</h3>
                          <p className="text-slate-600 leading-relaxed text-sm">{story.summary}</p>
                        </div>
                        <div className="bg-indigo-50 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                           <Sparkles className="w-5 h-5 text-indigo-600" />
                        </div>
                      </div>
                    </div>
                  ))}
               </div>

            </div>
          ) : (
            <div className="max-w-2xl mx-auto flex flex-col items-center justify-center h-full">
               <div className="w-full space-y-6">
                  <div className="text-center space-y-2">
                     <h3 className="text-2xl font-bold text-slate-800">Write Your Story</h3>
                     <p className="text-slate-500">Describe your idea and the AI will structure it for you.</p>
                  </div>
                  <div className="relative">
                    <div className="absolute -top-3 left-4 px-2 bg-white text-xs font-bold text-indigo-600">
                       Story Prompt
                    </div>
                    <textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder={`Example: A lonely robot finds a flower on Mars and tries to protect it from a storm. Audience: ${targetAudience}...`}
                      className="w-full p-6 h-64 border-2 border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none resize-none text-lg text-slate-700 leading-relaxed transition-all"
                    />
                  </div>
                  <Button 
                    onClick={handleCreateCustom} 
                    isLoading={loading} 
                    disabled={!customPrompt.trim()} 
                    className="w-full py-4 text-lg rounded-xl shadow-lg shadow-indigo-200 hover:shadow-indigo-300"
                  >
                    <Sparkles className="w-5 h-5" />
                    Generate Storyboard
                  </Button>
               </div>
            </div>
          )}

          {error && (
            <div className="max-w-3xl mx-auto p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 border border-red-100">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
