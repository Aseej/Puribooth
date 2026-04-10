/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Users, Download, Share2, ArrowLeft, Sparkles, Heart, Trash2, Link as LinkIcon, Copy, Check, RefreshCw } from 'lucide-react';
import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { CameraView, CameraViewHandle } from './components/CameraView';
import { FRAMES, FILTERS, PhotoFrame } from './types';
import { generatePhotostrip } from './lib/photostrip';
import { auth, db, doc, onSnapshot, setDoc, updateDoc, getDoc, collection, signInAnonymously, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, handleFirestoreError, OperationType, testConnection, firebaseConfig, firestoreDatabaseId } from './lib/firebase';
import confetti from 'canvas-confetti';

type AppState = 'home' | 'capturing' | 'preview';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<AppState>('home');
  const [photos, setPhotos] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [flash, setFlash] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState(FRAMES[0]);
  const [selectedFilter, setSelectedFilter] = useState(FILTERS[0]);
  const [finalStrip, setFinalStrip] = useState<string | null>(null);
  
  const cameraRef = useRef<CameraViewHandle>(null);

  const startSoloCapture = () => {
    setPhotos([]);
    setState('capturing');
    runCaptureSequence();
  };

  const runCaptureSequence = async () => {
    setIsCapturing(true);
    for (let i = 0; i < 4; i++) {
      for (let c = 3; c > 0; c--) {
        setCountdown(c);
        await new Promise(r => setTimeout(r, 1000));
      }
      setCountdown(null);
      
      // Capture effects
      setFlash(true);
      setIsShaking(true);
      if (cameraRef.current) cameraRef.current.takePhoto();
      
      await new Promise(r => setTimeout(r, 150));
      setFlash(false);
      setIsShaking(false);
      await new Promise(r => setTimeout(r, 1000));
    }
    setIsCapturing(false);
  };

  const handleCapture = (photo: string) => {
    setPhotos(prev => [...prev, photo]);
  };

  useEffect(() => {
    if (photos.length === 4 && state === 'capturing') {
      setState('preview');
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFB6C1', '#98FB98', '#87CEFA', '#FFFFE0']
      });
    }
  }, [photos, state]);

  useEffect(() => {
    if (state === 'preview' && photos.length === 4) {
      generatePhotostrip({ photos, frame: selectedFrame, filter: selectedFilter.filter })
        .then(setFinalStrip);
    }
  }, [state, photos, selectedFrame, selectedFilter]);

  const downloadStrip = () => {
    if (!finalStrip) return;
    const link = document.createElement('a');
    link.href = finalStrip;
    link.download = `puribooth-${Date.now()}.png`;
    link.click();
  };

  const shareStrip = async () => {
    if (!finalStrip) return;
    try {
      const blob = await (await fetch(finalStrip)).blob();
      const file = new File([blob], 'puribooth.png', { type: 'image/png' });
      if (navigator.share) {
        await navigator.share({ files: [file], title: 'My PuriBooth Photostrip', text: 'Check out my photostrip! 📸✨' });
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground p-4 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-md flex justify-between items-center mb-8">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setState('home'); navigate('/'); }}>
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg transform -rotate-6">
            <Camera className="text-white w-6 h-6" />
          </div>
          <h1 className="text-3xl font-heading font-bold tracking-tight text-primary">PuriBooth</h1>
        </div>
        {state !== 'home' && (
          <Button variant="ghost" size="icon" onClick={() => { setState('home'); navigate('/'); }} className="rounded-full">
            <ArrowLeft className="w-6 h-6" />
          </Button>
        )}
      </header>

      <main className="w-full max-w-md flex-1 flex flex-col items-center justify-center gap-8">
        <AnimatePresence mode="wait">
          {state === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full flex flex-col gap-4">
              <Card className="p-8 flex flex-col items-center text-center gap-6 bg-white/50 backdrop-blur-sm border-2 border-primary/20 shadow-xl rounded-[2.5rem]">
                <div className="relative">
                  <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 4 }} className="w-24 h-24 bg-accent rounded-3xl flex items-center justify-center shadow-inner">
                    <Sparkles className="w-12 h-12 text-accent-foreground" />
                  </motion.div>
                  <Heart className="absolute -top-2 -right-2 w-8 h-8 text-primary fill-current animate-pulse" />
                </div>
                <div>
                  <h2 className="text-2xl font-heading font-bold mb-2">Ready for a photo?</h2>
                  <p className="text-muted-foreground">Capture cute moments solo or with a friend!</p>
                </div>
                <div className="w-full flex flex-col gap-3">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} className="w-full">
                    <Button size="lg" className="w-full h-16 text-lg rounded-2xl shadow-lg" onClick={startSoloCapture}>
                      <Camera className="mr-2 w-6 h-6" /> Start Photo Booth 📸
                    </Button>
                  </motion.div>
                </div>
              </Card>
            </motion.div>
          )}

          {state === 'capturing' && (
            <motion.div 
              key="capturing" 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ 
                opacity: 1, 
                scale: 1,
                x: isShaking ? [0, -10, 10, -10, 10, 0] : 0
              }} 
              transition={{ 
                x: { duration: 0.15, repeat: 0 }
              }}
              exit={{ opacity: 0, scale: 1.1 }} 
              className="w-full flex flex-col gap-6"
            >
              <div className="relative">
                <CameraView ref={cameraRef} onCapture={handleCapture} isCapturing={isCapturing} countdown={countdown} flash={flash} filter={selectedFilter.filter} />
                
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={`w-3 h-3 rounded-full border-2 border-white shadow-sm transition-colors ${photos.length > i ? 'bg-primary' : 'bg-white/30'}`} />
                  ))}
                </div>
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-primary animate-pulse">
                  {photos.length < 4 ? `Taking photo ${photos.length + 1} of 4...` : 'Processing...'}
                </p>
              </div>
            </motion.div>
          )}

          {state === 'preview' && (
            <motion.div key="preview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full flex flex-col gap-6">
              <div className="flex flex-col md:flex-row gap-8 items-start justify-center">
                <div className="w-full md:w-64 flex flex-col gap-4">
                  <div className="bg-white p-2 shadow-2xl rounded-lg overflow-hidden border border-gray-100">
                    {finalStrip ? <img src={finalStrip} alt="Photostrip" className="w-full h-auto" /> : <div className="aspect-[1/3] bg-muted animate-pulse rounded flex items-center justify-center"><RefreshCw className="animate-spin text-muted-foreground" /></div>}
                  </div>
                </div>
                <div className="flex-1 w-full flex flex-col gap-6">
                  <Card className="p-6 rounded-[2rem] border-2 border-primary/10 shadow-lg bg-white/80 backdrop-blur-sm">
                    <h3 className="text-xl font-heading font-bold mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> Customize</h3>
                    <div className="space-y-6">
                      <div>
                        <label className="text-sm font-bold mb-2 block text-muted-foreground uppercase tracking-wider">Frame Color</label>
                        <div className="flex flex-wrap gap-3">
                          {FRAMES.map((f) => (
                            <motion.button 
                              key={f.id} 
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => setSelectedFrame(f)} 
                              className={`w-10 h-10 rounded-full border-4 transition-all ${selectedFrame.id === f.id ? 'border-primary scale-110 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'}`} 
                              style={{ backgroundColor: f.color }} 
                              title={f.name} 
                            />
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-bold mb-2 block text-muted-foreground uppercase tracking-wider">Filter</label>
                        <div className="grid grid-cols-3 gap-2">
                          {FILTERS.map((f) => (
                            <motion.div key={f.id} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                              <Button 
                                variant={selectedFilter.id === f.id ? 'default' : 'outline'} 
                                size="sm" 
                                onClick={() => setSelectedFilter(f)} 
                                className="w-full rounded-xl text-xs h-10"
                              >
                                {f.name}
                              </Button>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-3">
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} className="flex-1">
                        <Button onClick={downloadStrip} className="w-full h-14 rounded-2xl text-lg shadow-lg"><Download className="mr-2 w-5 h-5" /> Download</Button>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} className="flex-1">
                        <Button onClick={shareStrip} variant="secondary" className="w-full h-14 rounded-2xl text-lg shadow-md"><Share2 className="mr-2 w-5 h-5" /> Share</Button>
                      </motion.div>
                    </div>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} className="w-full">
                      <Button variant="ghost" onClick={() => { setState('home'); navigate('/'); }} className="w-full h-12 rounded-xl text-muted-foreground hover:text-destructive"><Trash2 className="mr-2 w-4 h-4" /> Start Over</Button>
                    </motion.div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <footer className="mt-12 text-center text-muted-foreground text-sm">
        <p className="flex items-center justify-center gap-1">Made with <Heart className="w-4 h-4 text-primary fill-current" /> for cute memories</p>
      </footer>

      {/* SVG Filters */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        {/* Add any global SVG filters here if needed */}
      </svg>

      {/* Global Flash Effect */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.05 }}
            className="fixed inset-0 bg-white z-[9999] pointer-events-none"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
