
import React, { useState, useEffect } from 'react';
import { Story, Panel, AnalysisResult } from '../types';
import { generateScript, generatePanelImage, generateCoverImage, analyzeStoryPotential, refineStoryContent } from '../services/gemini';
import { Button } from './Button';
import { ImageEditor } from './ImageEditor';
import { ArrowLeft, Download, Wand2, Edit2, LayoutTemplate, Copy, Check, Bot, RefreshCw, Palette, FileText, ExternalLink, X } from 'lucide-react';

interface EbookCreatorProps {
  story: Story;
  onBack: () => void;
}

const chunkArray = <T extends unknown>(arr: T[], size: number): T[][] => {
  const results: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    results.push(arr.slice(i, i + size));
  }
  return results;
};

// Helper for robust base64 to blob conversion
const base64ToBlob = (base64: string): Blob => {
  try {
    const parts = base64.split(';base64,');
    const contentType = parts[0]?.split(':')[1] || 'image/png';
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);

    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  } catch (e) {
    console.error("Base64 conversion failed", e);
    throw new Error("Invalid image data");
  }
};

export const EbookCreator: React.FC<EbookCreatorProps> = ({ story, onBack }) => {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [isCoverGenerating, setIsCoverGenerating] = useState(true);
  const [loadingScript, setLoadingScript] = useState(true);
  const [copiedId, setCopiedId] = useState<string | number | null>(null);
  
  // Editable fields
  const [title, setTitle] = useState(story.title);
  const [author, setAuthor] = useState(`Source: ${story.source || 'Internet'}`);
  
  // Editing state
  const [editingImageId, setEditingImageId] = useState<number | 'cover' | null>(null);
  const [editingDescription, setEditingDescription] = useState<string>('');
  const [editingImageUrl, setEditingImageUrl] = useState<string>('');

  // Agent State
  const [showAgent, setShowAgent] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [fixingText, setFixingText] = useState(false);

  // Canva Modal
  const [showCanvaModal, setShowCanvaModal] = useState(false);

  useEffect(() => {
    initStory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story]);

  const initStory = async () => {
    setLoadingScript(true);
    try {
        const script = await generateScript(story);
        setPanels(script);
        setLoadingScript(false);
        
        // Start generations SEQUENTIALLY to avoid Rate Limits (429)
        await generateCover();
        
        // Then panels
        await generateImagesSequentially(script);
        
    } catch (e) {
        console.error("Failed to init script", e);
        setLoadingScript(false);
    }
  };

  const generateImagesSequentially = async (scriptPanels: Panel[]) => {
    for (const p of scriptPanels) {
      // Check if we already have an image (in case of re-init)
      if (!p.imageUrl && !p.isGenerating) {
        await generateImageForPanel(p.id, p.description);
        // INCREASED DELAY to 4 seconds to allow quota replenishment
        await new Promise(r => setTimeout(r, 4000)); 
      }
    }
  };

  const generateCover = async () => {
    setIsCoverGenerating(true);
    try {
      const url = await generateCoverImage(story.title, story.summary, story.visualStyle);
      setCoverImage(url);
    } catch (e) {
      console.error("Cover generation failed", e);
    } finally {
      setIsCoverGenerating(false);
    }
  };

  const generateImageForPanel = async (id: number, description: string) => {
    setPanels(prev => prev.map(p => p.id === id ? { ...p, isGenerating: true } : p));
    try {
      const imageUrl = await generatePanelImage(description);
      setPanels(prev => prev.map(p => p.id === id ? { ...p, imageUrl, isGenerating: false } : p));
    } catch (e) {
      console.error(`Failed to generate image for panel ${id}`, e);
      setPanels(prev => prev.map(p => p.id === id ? { ...p, isGenerating: false } : p));
    }
  };

  const openImageEditor = (id: number | 'cover', url: string, description: string) => {
    setEditingImageId(id);
    setEditingImageUrl(url);
    setEditingDescription(description);
  };

  const handleImageSave = (newUrl: string) => {
    if (editingImageId === 'cover') {
      setCoverImage(newUrl);
    } else if (typeof editingImageId === 'number') {
      setPanels(prev => prev.map(p => p.id === editingImageId ? { ...p, imageUrl: newUrl } : p));
    }
    setEditingImageId(null);
  };

  const updateCaption = (id: number, newCaption: string) => {
    setPanels(prev => prev.map(p => p.id === id ? { ...p, caption: newCaption } : p));
  };

  const copyToClipboard = async (id: string | number, url: string) => {
    try {
        const blob = base64ToBlob(url);
        
        if (!navigator.clipboard || !navigator.clipboard.write) {
            throw new Error("Clipboard API not available");
        }

        await navigator.clipboard.write([
            new ClipboardItem({ [blob.type]: blob })
        ]);
        
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
        console.error("Failed to copy image", err);
        alert("Copy failed. Your browser might block clipboard access. Try right-click > Copy Image.");
    }
  };

  const runAgentAnalysis = async () => {
    setShowAgent(true);
    setAnalyzing(true);
    setAnalysis(null);
    try {
        const captionsSample = panels.slice(0, 3).map(p => p.caption).join(" | ");
        const result = await analyzeStoryPotential(
            title,
            story.summary,
            story.targetAudience || "General",
            story.visualStyle || "Cartoon",
            coverImage || undefined,
            captionsSample
        );
        setAnalysis(result);
    } catch (e) {
        console.error("Agent failed", e);
    } finally {
        setAnalyzing(false);
    }
  };

  const handleFixText = async () => {
    if (!analysis) return;
    setFixingText(true);
    try {
      const refined = await refineStoryContent(
        title,
        story.summary,
        panels,
        analysis.critique + " " + analysis.textQuality,
        story.targetAudience || "General"
      );
      
      setTitle(refined.newTitle);
      setPanels(prev => prev.map(p => {
         const update = refined.refinedPanels.find(rp => rp.id === p.id);
         return update ? { ...p, caption: update.caption } : p;
      }));
      
      setAnalysis(prev => prev ? { ...prev, textQuality: "Optimized by Agent!", critique: "Text updated based on feedback." } : null);
      
    } catch (e) {
      console.error("Failed to fix text", e);
      alert("Could not auto-fix text. Try manually.");
    } finally {
      setFixingText(false);
    }
  };

  const handleRegenerateVisuals = () => {
     if(!analysis) return;
     const suggestionText = analysis.suggestions.join(", ");
     const enhancedStyle = `${story.visualStyle}. IMPROVEMENTS: ${suggestionText}`;
     setIsCoverGenerating(true);
     generateCoverImage(title, story.summary, enhancedStyle)
       .then(url => {
          setCoverImage(url);
          setIsCoverGenerating(false);
          setAnalysis(prev => prev ? { ...prev, visualQuality: "Cover regenerated with suggestions!" } : null);
       })
       .catch(() => setIsCoverGenerating(false));
  };

  const handleRetry = () => {
      setShowAgent(false);
      setAnalysis(null);
      initStory(); 
  }

  const handlePrint = () => {
    window.scrollTo(0, 0);
    window.print();
  };

  if (loadingScript) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-6 bg-slate-50">
        <div className="relative">
             <div className="absolute inset-0 bg-indigo-200 blur-xl opacity-50 rounded-full animate-pulse"></div>
             <LayoutTemplate className="relative z-10 w-16 h-16 text-indigo-600 animate-bounce" />
        </div>
        <h2 className="text-3xl font-bold text-slate-800">Writing Script...</h2>
        <p className="text-slate-500 text-lg">Designing {story.visualStyle} characters for {story.targetAudience}...</p>
      </div>
    );
  }

  const comicPages: Panel[][] | null = story.layoutStyle === 'COMIC_STRIP' ? chunkArray(panels, 4) : null;

  return (
    <div className="min-h-screen bg-slate-100 pb-20 font-sans print:bg-white print:pb-0">
      
      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
            <Button variant="secondary" onClick={onBack} size="sm" className="rounded-full">
               <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
                <h1 className="text-lg font-bold text-slate-800 truncate max-w-md">{title}</h1>
                <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
                    <span>{panels.length} Panels</span> • <span>{story.layoutStyle === 'COMIC_STRIP' ? 'Comic Grid' : 'Storybook'}</span>
                </div>
            </div>
        </div>
        <div className="flex gap-3">
            <Button variant="outline" onClick={runAgentAnalysis} className="hidden md:flex rounded-full border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                <Bot className="w-4 h-4 mr-2" />
                Viral Agent
            </Button>
            <Button variant="secondary" onClick={() => setShowCanvaModal(true)} className="rounded-full text-indigo-600 bg-indigo-50 border-indigo-100">
                <ExternalLink className="w-4 h-4 mr-2" />
                Export to Canva
            </Button>
            <Button variant="primary" onClick={handlePrint} className="rounded-full shadow-lg shadow-indigo-200">
                <Download className="w-4 h-4 mr-2" /> 
                Download PDF
            </Button>
        </div>
      </div>

      {/* Main Content Wrapper */}
      <div className="flex justify-center">
      <div id="ebook-content" className="max-w-5xl w-full p-8 space-y-12 print:p-0 print:space-y-0 print:w-full print:max-w-none print:m-0">
        
        {/* PAGE 1: COVER */}
        <div className="ebook-page bg-white mx-auto shadow-xl shadow-slate-200/60 border border-slate-100 aspect-[3/4] w-full max-w-[700px] flex flex-col relative overflow-hidden group rounded-sm print:shadow-none print:border-none print:aspect-auto print:h-[297mm] print:w-[210mm]">
          <div className="h-[75%] w-full relative bg-slate-100 overflow-hidden print:h-[70%]">
             {isCoverGenerating ? (
               <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                  <div className="text-center">
                    <Wand2 className="w-8 h-8 text-indigo-400 animate-spin-slow mx-auto mb-2" />
                    <span className="text-indigo-400 font-medium">Painting Cover...</span>
                  </div>
               </div>
             ) : coverImage ? (
                <>
                  <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                    <Button variant="secondary" onClick={() => copyToClipboard('cover', coverImage)} className="shadow-xl bg-white/90 backdrop-blur" title="Copy for Canva (Ctrl+V)">
                      {copiedId === 'cover' ? <Check className="w-4 h-4 text-green-600"/> : <Copy className="w-4 h-4" />}
                    </Button>
                    <Button variant="secondary" onClick={() => openImageEditor('cover', coverImage, `Cover art for ${title}`)} className="shadow-xl bg-white/90 backdrop-blur">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                </>
             ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">Cover generation failed</div>
             )}
          </div>
          <div className="flex-1 bg-white p-8 md:p-12 flex flex-col justify-center items-center text-center">
             <input
               value={title}
               onChange={(e) => setTitle(e.target.value)}
               className="w-full text-4xl md:text-5xl font-black text-slate-900 text-center outline-none border-b-2 border-transparent hover:border-indigo-100 focus:border-indigo-500 transition-all bg-transparent mb-4 placeholder-slate-300 uppercase tracking-tight leading-tight"
               placeholder="BOOK TITLE"
             />
             <input 
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full text-lg text-slate-500 font-medium text-center outline-none border-b border-transparent hover:border-indigo-100 focus:border-indigo-500 bg-transparent"
             />
          </div>
        </div>

        {/* CONTENT PAGES */}
        {story.layoutStyle === 'STORYBOOK' ? (
            /* STORYBOOK LAYOUT */
            panels.map((panel, idx) => (
               <div key={panel.id} className="ebook-page bg-white mx-auto shadow-xl shadow-slate-200/60 border border-slate-100 aspect-[3/4] w-full max-w-[700px] flex flex-col relative group rounded-sm print:shadow-none print:border-none print:aspect-auto print:h-[297mm] print:w-[210mm] print:break-after-page">
                  <div className="w-full h-[65%] bg-slate-50 relative overflow-hidden flex items-center justify-center border-b border-slate-50 print:h-[65%]">
                      {panel.isGenerating ? (
                        <div className="text-center">
                            <Wand2 className="w-8 h-8 text-indigo-400 animate-spin-slow mx-auto mb-2" />
                            <span className="text-slate-400 font-medium">Illustrating Page {idx + 1}...</span>
                        </div>
                      ) : panel.imageUrl ? (
                        <>
                            <img src={panel.imageUrl} alt={`Page ${idx+1}`} className="w-full h-full object-cover" />
                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                                <Button variant="secondary" onClick={() => copyToClipboard(panel.id, panel.imageUrl!)} className="shadow-xl bg-white/90 backdrop-blur" title="Copy for Canva (Ctrl+V)">
                                    {copiedId === panel.id ? <Check className="w-4 h-4 text-green-600"/> : <Copy className="w-4 h-4" />}
                                </Button>
                                <Button variant="secondary" onClick={() => openImageEditor(panel.id, panel.imageUrl!, panel.description)} className="shadow-xl bg-white/90 backdrop-blur">
                                    <Edit2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </>
                      ) : (
                        <span className="text-slate-300">Image failed</span>
                      )}
                  </div>
                  <div className="flex-1 p-8 md:p-12 flex flex-col justify-center items-center">
                      <textarea
                          value={panel.caption}
                          onChange={(e) => updateCaption(panel.id, e.target.value)}
                          className="w-full h-full text-xl md:text-2xl font-medium text-slate-700 bg-transparent resize-none outline-none border border-transparent hover:border-indigo-100 focus:border-indigo-400 rounded p-4 text-center leading-relaxed flex items-center justify-center font-comic"
                       />
                       <div className="text-slate-300 text-xs font-semibold mt-4 tracking-widest uppercase">Page {idx + 1}</div>
                  </div>
               </div>
            ))
        ) : (
            /* COMIC STRIP LAYOUT */
            comicPages?.map((pagePanels, pageIdx) => (
              <div key={pageIdx} className="ebook-page bg-white mx-auto shadow-xl shadow-slate-200/60 border border-slate-100 aspect-[3/4] w-full max-w-[700px] p-8 relative group flex flex-col rounded-sm print:shadow-none print:border-none print:aspect-auto print:h-[297mm] print:w-[210mm] print:break-after-page">
                  <div className="grid grid-cols-2 grid-rows-2 gap-4 flex-1 h-full">
                    {pagePanels.map((panel) => (
                      <div key={panel.id} className="flex flex-col border border-slate-200 bg-white shadow-sm rounded overflow-hidden relative group/panel print:border-slate-300">
                        <div className="flex-1 relative bg-slate-50 flex items-center justify-center overflow-hidden">
                           {panel.isGenerating ? (
                             <Wand2 className="w-6 h-6 text-indigo-400 animate-spin-slow" />
                           ) : panel.imageUrl ? (
                             <>
                                <img src={panel.imageUrl} className="w-full h-full object-cover" />
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/panel:opacity-100 transition-opacity print:hidden">
                                  <Button variant="secondary" size="sm" onClick={() => copyToClipboard(panel.id, panel.imageUrl!)} className="h-7 w-7 p-0 bg-white/90" title="Copy for Canva">
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                  <Button variant="secondary" size="sm" onClick={() => openImageEditor(panel.id, panel.imageUrl!, panel.description)} className="h-7 w-7 p-0 bg-white/90">
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                                </div>
                             </>
                           ) : (
                             <span className="text-xs text-slate-400">Failed</span>
                           )}
                        </div>
                        <div className="h-[35%] p-2 bg-white">
                           <textarea
                              value={panel.caption}
                              onChange={(e) => updateCaption(panel.id, e.target.value)}
                              className="w-full h-full text-xs font-medium text-slate-700 bg-transparent resize-none outline-none border border-transparent hover:border-indigo-100 focus:border-indigo-400 rounded p-1 text-center leading-snug font-comic"
                           />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-center mt-6 text-slate-300 text-xs font-semibold tracking-widest uppercase">Page {pageIdx + 1}</div>
              </div>
            ))
        )}
      </div>
      </div>

      {/* AGENT MODAL */}
      {showAgent && (
        <div className="fixed inset-0 z-50 flex justify-end print:hidden">
            <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setShowAgent(false)}></div>
            <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                    <div className="flex items-center gap-2">
                        <Bot className="w-6 h-6" />
                        <div>
                            <h3 className="font-bold text-lg">Viral Agent</h3>
                            <p className="text-indigo-200 text-xs">Gemini 3 Pro Analysis</p>
                        </div>
                    </div>
                    <button onClick={() => setShowAgent(false)} className="text-white/70 hover:text-white">
                        <ArrowLeft className="w-5 h-5 rotate-180" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {analyzing ? (
                        <div className="flex flex-col items-center justify-center h-64 space-y-4 text-center">
                            <div className="relative">
                                <div className="absolute inset-0 bg-indigo-500 blur opacity-20 rounded-full animate-ping"></div>
                                <Bot className="w-12 h-12 text-indigo-600 animate-bounce" />
                            </div>
                            <p className="text-slate-600 font-medium">Reviewing your masterpiece...</p>
                            <p className="text-slate-400 text-xs">Analyzing style coherence & viral hooks</p>
                        </div>
                    ) : analysis ? (
                        <div className="space-y-6">
                            {/* Score Card */}
                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 text-center relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"></div>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Marketability Score</div>
                                <div className="text-5xl font-black text-slate-800 mb-2">{analysis.score}<span className="text-xl text-slate-400 font-medium">/10</span></div>
                                <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                    analysis.score >= 8 ? 'bg-green-100 text-green-700' :
                                    analysis.score >= 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                }`}>
                                    {analysis.viralPotential} Potential
                                </div>
                            </div>

                            {/* Critique Section */}
                            <div className="space-y-4">
                                <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2 text-indigo-600 font-bold text-sm">
                                        <FileText className="w-4 h-4" /> Writing & SEO
                                    </div>
                                    <p className="text-sm text-slate-600 leading-relaxed mb-2">{analysis.critique}</p>
                                    <Button onClick={handleFixText} disabled={fixingText} variant="secondary" className="w-full text-xs h-8">
                                        {fixingText ? "Rewriting..." : "Fix Text & SEO"}
                                    </Button>
                                </div>

                                <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2 text-pink-600 font-bold text-sm">
                                        <Palette className="w-4 h-4" /> Visual Quality
                                    </div>
                                    <p className="text-sm text-slate-600 leading-relaxed mb-2">{analysis.visualQuality}</p>
                                </div>
                            </div>

                            {/* Suggestions */}
                            <div>
                                <h4 className="font-bold text-slate-800 mb-3 text-sm uppercase tracking-wider">Top Suggestions</h4>
                                <ul className="space-y-2 mb-4">
                                    {analysis.suggestions.map((s, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                                            <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                                            {s}
                                        </li>
                                    ))}
                                </ul>
                                <Button onClick={handleRegenerateVisuals} variant="secondary" className="w-full border-indigo-200 text-indigo-600">
                                    <Wand2 className="w-4 h-4 mr-2" />
                                    Apply Visual Suggestions (Regenerate Cover)
                                </Button>
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <Button onClick={handleRetry} variant="outline" className="w-full py-3 text-slate-500 hover:text-slate-700">
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Restart Project
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-slate-400 py-12">
                            Analysis failed. Please try again.
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* CANVA HELP MODAL */}
      {showCanvaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm print:hidden">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 relative">
                <button onClick={() => setShowCanvaModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                </button>
                
                <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-teal-400 rounded-xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
                        <ExternalLink className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">Export to Canva</h3>
                    <p className="text-slate-500 mt-2">Because Canva doesn't allow direct API uploads for free apps, follow these simple steps to edit your full ebook:</p>
                </div>

                <div className="space-y-4">
                    <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">1</div>
                        <div>
                            <h4 className="font-bold text-slate-800">Download as PDF</h4>
                            <p className="text-sm text-slate-600">Click the button below. In the print window, choose <strong>"Save as PDF"</strong>.</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">2</div>
                        <div>
                            <h4 className="font-bold text-slate-800">Upload to Canva</h4>
                            <p className="text-sm text-slate-600">Go to Canva, click <strong>"Upload"</strong>, and select your new PDF. It will magically become editable!</p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex flex-col gap-3">
                    <Button onClick={handlePrint} className="w-full justify-center py-3 text-lg">
                        <Download className="w-5 h-5 mr-2" />
                        Step 1: Save as PDF
                    </Button>
                    <a 
                        href="https://www.canva.com/" 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center justify-center w-full py-3 bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        Step 2: Open Canva <ExternalLink className="w-4 h-4 ml-2" />
                    </a>
                </div>
            </div>
        </div>
      )}

      {/* Image Editor Overlay */}
      {editingImageId !== null && (
        <ImageEditor 
          imageUrl={editingImageUrl} 
          panelDescription={editingDescription}
          onSave={handleImageSave}
          onClose={() => setEditingImageId(null)}
        />
      )}

      {/* Optimized Print Styles for PDF Export */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          
          /* Hide UI elements */
          .print\\:hidden {
            display: none !important;
          }
          
          body {
            background-color: white;
            color: black;
          }

          /* Reset Main Container */
          #ebook-content {
            width: 210mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: white !important;
          }

          /* Force Page Breaks */
          .ebook-page {
            width: 210mm !important;
            height: 297mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            display: flex !important;
            flex-direction: column !important;
          }
          
          /* Ensure textareas print correctly */
          textarea {
            border: none !important;
            resize: none !important;
          }

          /* Ensure graphics print with color */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
};
