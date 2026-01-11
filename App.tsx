
import React, { useState, useCallback, useMemo } from 'react';
import { DesignState, Message } from './types';
import { INTERIOR_STYLES } from './constants';
import { ComparisonSlider } from './components/ComparisonSlider';
import { ChatInterface } from './components/ChatInterface';
import * as gemini from './services/geminiService';

const App: React.FC = () => {
  const [state, setState] = useState<DesignState>({
    originalImage: null,
    currentImage: null,
    history: [],
    messages: [],
    selectedStyleId: '',
    isProcessing: false,
    statusMessage: 'Upload a photo to begin your room transformation'
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setState(prev => ({
        ...prev,
        originalImage: base64,
        currentImage: null,
        history: [],
        messages: [],
        statusMessage: 'Select a style to reimagine your room'
      }));
    };
    reader.readAsDataURL(file);
  };

  const applyStyle = async (styleId: string) => {
    if (!state.originalImage) return;
    
    const style = INTERIOR_STYLES.find(s => s.id === styleId);
    if (!style) return;

    setState(prev => ({ 
      ...prev, 
      isProcessing: true, 
      selectedStyleId: styleId,
      statusMessage: `Reimagining in ${style.name}...`
    }));

    const result = await gemini.generateStyleMakeover(state.originalImage, style.prompt);
    
    if (result) {
      setState(prev => ({
        ...prev,
        currentImage: result,
        history: [...prev.history, result],
        isProcessing: false,
        statusMessage: `${style.name} design ready! Use the slider to compare.`
      }));
    } else {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        statusMessage: 'Failed to generate design. Please try again.'
      }));
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!state.currentImage) return;

    const userMessage: Message = { role: 'user', content: text, timestamp: Date.now() };
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isProcessing: true,
      statusMessage: 'Processing your request...'
    }));

    // Logic to decide if it's an edit or a question
    const isEditInstruction = /make|change|remove|add|paint|replace|put|room/i.test(text);

    if (isEditInstruction) {
      const result = await gemini.editImageWithPrompt(state.currentImage, text);
      if (result) {
        const assistantMessage: Message = { 
          role: 'assistant', 
          content: "I've updated the design for you! What do you think?", 
          isImageEdit: true, 
          timestamp: Date.now() 
        };
        setState(prev => ({
          ...prev,
          currentImage: result,
          history: [...prev.history, result],
          messages: [...prev.messages, assistantMessage],
          isProcessing: false,
          statusMessage: 'Design updated.'
        }));
      } else {
        setState(prev => ({
          ...prev,
          isProcessing: false,
          statusMessage: 'Could not apply changes. Try a simpler instruction.'
        }));
      }
    } else {
      const advice = await gemini.getExpertAdvice(state.currentImage, text, state.messages);
      const assistantMessage: Message = { 
        role: 'assistant', 
        content: advice.text, 
        timestamp: Date.now() 
      };
      
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        isProcessing: false,
        statusMessage: 'Advice received.'
      }));
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Sidebar - Style selection & Controls */}
      <div className="w-full lg:w-96 p-6 border-r border-slate-100 bg-white flex flex-col gap-8">
        <header className="space-y-1">
          <h1 className="serif text-3xl font-semibold tracking-tight">Lumina</h1>
          <p className="text-slate-400 text-sm">AI-Powered Interior Design</p>
        </header>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Your Space</h2>
            {state.originalImage && (
               <button 
                onClick={() => setState(prev => ({...prev, originalImage: null, currentImage: null}))}
                className="text-xs text-rose-500 hover:underline font-medium"
              >
                Clear
              </button>
            )}
          </div>
          
          {!state.originalImage ? (
            <label className="group flex flex-col items-center justify-center w-full aspect-square border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-all">
              <div className="p-4 bg-slate-100 rounded-full group-hover:bg-slate-200 transition-colors">
                <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              </div>
              <span className="mt-3 text-sm font-medium text-slate-600">Upload Room Photo</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>
          ) : (
            <div className="relative group rounded-2xl overflow-hidden aspect-video shadow-sm border border-slate-100">
              <img src={state.originalImage} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <label className="cursor-pointer bg-white text-slate-900 px-4 py-2 rounded-full text-xs font-bold shadow-lg">
                  Replace Photo
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4 flex-1">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Select Style</h2>
          <div className="grid grid-cols-2 gap-3 overflow-y-auto max-h-[40vh] pr-1">
            {INTERIOR_STYLES.map(style => (
              <button
                key={style.id}
                disabled={!state.originalImage || state.isProcessing}
                onClick={() => applyStyle(style.id)}
                className={`p-4 rounded-xl border text-left transition-all relative ${
                  state.selectedStyleId === style.id 
                    ? 'border-slate-900 bg-slate-900 text-white ring-4 ring-slate-900/5' 
                    : 'border-slate-200 hover:border-slate-400 bg-slate-50'
                } disabled:opacity-50 disabled:grayscale`}
              >
                <div className="text-2xl mb-2">{style.icon}</div>
                <div className="text-xs font-bold">{style.name}</div>
              </button>
            ))}
          </div>
        </section>

        <footer className="pt-4 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 leading-relaxed uppercase tracking-tighter">
            Powered by Gemini 3.0 & 2.5 • High Precision Vision • Generative Aesthetics
          </p>
        </footer>
      </div>

      {/* Main Preview Area */}
      <main className="flex-1 p-6 lg:p-10 flex flex-col gap-6 bg-[#fcfcfc] overflow-y-auto">
        <div className="max-w-5xl mx-auto w-full space-y-8">
          {/* Top Bar / Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${state.isProcessing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`}></div>
              <span className="text-sm font-medium text-slate-600">{state.statusMessage}</span>
            </div>
          </div>

          {/* Large Visualization */}
          <section className="relative min-h-[400px]">
            {state.originalImage && state.currentImage ? (
              <div className="animate-in fade-in zoom-in duration-700">
                <ComparisonSlider original={state.originalImage} reimagined={state.currentImage} />
              </div>
            ) : (
              <div className="w-full aspect-video rounded-3xl bg-slate-100/50 border-4 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-4">
                <div className="p-8 bg-white/50 rounded-full shadow-inner">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="font-medium">Transform your space with a single click</p>
              </div>
            )}
          </section>

          {/* Chat and Controls Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
             {/* Chat Box */}
             <div className="lg:col-span-8 h-[500px]">
              <ChatInterface 
                messages={state.messages} 
                onSendMessage={handleSendMessage} 
                isProcessing={state.isProcessing} 
              />
            </div>

            {/* Design Metadata / Mini Stats */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-900/10">
                <h3 className="text-xs font-bold uppercase tracking-widest opacity-50 mb-4">Design Intelligence</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-end border-b border-white/10 pb-2">
                    <span className="text-sm opacity-70">Style Fidelity</span>
                    <span className="text-lg font-medium">94%</span>
                  </div>
                  <div className="flex justify-between items-end border-b border-white/10 pb-2">
                    <span className="text-sm opacity-70">Structural Consistency</span>
                    <span className="text-lg font-medium">98%</span>
                  </div>
                  <div className="flex justify-between items-end pb-2">
                    <span className="text-sm opacity-70">Aesthetic Score</span>
                    <span className="text-lg font-medium italic serif">Exquisite</span>
                  </div>
                </div>
              </div>

              {state.currentImage && (
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                   <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Export Options</h3>
                   <div className="grid grid-cols-2 gap-3">
                     <button 
                        onClick={() => window.open(state.currentImage!, '_blank')}
                        className="flex items-center justify-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all text-xs font-semibold"
                      >
                       Full Resolution
                     </button>
                     <button 
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = state.currentImage!;
                          link.download = 'lumina-design.png';
                          link.click();
                        }}
                        className="flex items-center justify-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all text-xs font-semibold"
                      >
                       Download
                     </button>
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
