import React, { useState } from 'react';
import { editPanelImage } from '../services/gemini';
import { Button } from './Button';
import { X, Check, Wand2, RotateCcw } from 'lucide-react';

interface ImageEditorProps {
  imageUrl: string;
  panelDescription: string;
  onSave: (url: string) => void;
  onClose: () => void;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, panelDescription, onSave, onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [currentImage, setCurrentImage] = useState(imageUrl);
  const [originalImage] = useState(imageUrl); // Store original to revert
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEdit = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const edited = await editPanelImage(currentImage, prompt);
      setCurrentImage(edited);
      setPrompt(''); // Clear prompt after successful edit
    } catch (e) {
      setError("Failed to edit image. Try a simpler prompt.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col md:flex-row overflow-hidden max-h-[90vh]">
        
        {/* Preview Side */}
        <div className="w-full md:w-1/2 bg-slate-100 flex items-center justify-center p-6 relative">
             <img 
               src={currentImage} 
               alt="Editing preview" 
               className="max-w-full max-h-[60vh] object-contain rounded-lg border-2 border-slate-200 shadow-md"
             />
             {loading && (
               <div className="absolute inset-0 bg-white/50 flex items-center justify-center backdrop-blur-sm">
                 <Wand2 className="w-10 h-10 text-indigo-600 animate-spin-slow" />
               </div>
             )}
        </div>

        {/* Controls Side */}
        <div className="w-full md:w-1/2 p-6 flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-2xl font-bold text-slate-800">Edit Panel</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="mb-4">
             <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Original Context</h4>
             <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
               "{panelDescription}"
             </p>
          </div>

          <div className="flex-1 space-y-4">
             <div>
               <label className="block text-sm font-medium text-slate-700 mb-2">
                 How should we change this image?
               </label>
               <textarea
                 value={prompt}
                 onChange={(e) => setPrompt(e.target.value)}
                 placeholder="e.g. 'Make it look like a pencil sketch', 'Add a cat in the background', 'Turn the lighting to sunset'"
                 className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none h-24"
                 onKeyDown={(e) => {
                    if(e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleEdit();
                    }
                 }}
               />
             </div>
             
             {error && (
               <p className="text-red-500 text-sm">{error}</p>
             )}

             <div className="flex gap-2">
               <Button 
                 onClick={handleEdit} 
                 disabled={!prompt.trim()} 
                 isLoading={loading}
                 className="flex-1"
               >
                 <Wand2 className="w-4 h-4" /> Apply Edit
               </Button>
               <Button 
                 variant="secondary" 
                 onClick={() => setCurrentImage(originalImage)}
                 title="Revert to original"
                 disabled={currentImage === originalImage}
               >
                 <RotateCcw className="w-4 h-4" />
               </Button>
             </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSave(currentImage)}>
              <Check className="w-4 h-4" /> Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};