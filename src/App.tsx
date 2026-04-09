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
import { FRAMES, FILTERS, PhotoFrame, Session } from './types';
import { generatePhotostrip } from './lib/photostrip';
import { auth, db, doc, onSnapshot, setDoc, updateDoc, getDoc, collection, signInAnonymously, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, handleFirestoreError, OperationType, testConnection } from './lib/firebase';
import confetti from 'canvas-confetti';

type AppState = 'home' | 'capturing' | 'preview' | 'dual-setup' | 'dual-waiting' | 'dual-capturing';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<AppState>('home');
  const [photos, setPhotos] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [flash, setFlash] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState(FRAMES[0]);
  const [selectedFilter, setSelectedFilter] = useState(FILTERS[0]);
  const [finalStrip, setFinalStrip] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [previewSession, setPreviewSession] = useState<Session | null>(null);
  
  const cameraRef = useRef<CameraViewHandle>(null);

  // Initialize Firebase & Auth
  useEffect(() => {
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        setAuthError(null);
        console.log('User state changed: signed in', user.uid);
      } else {
        setUserId(null);
        console.log('User state changed: signed out');
        
        // Try anonymous login silently if no user
        signInAnonymously(auth).catch((authErr: any) => {
          if (authErr.code === 'auth/admin-restricted-operation') {
            console.info('Anonymous auth is disabled in console. Dual mode will require Google Login.');
            setAuthError('anonymous-disabled');
          } else {
            console.warn('Anonymous auth failed:', authErr.message);
            setAuthError(authErr.message);
          }
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      setUserId(result.user.uid);
      setAuthError(null);
      console.log('Google login success:', result.user.uid);
    } catch (err: any) {
      console.error('Google login error:', err);
      alert('Login failed: ' + err.message);
    }
  };

  // Handle Joining from URL
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/join/') && userId) {
      const sessionId = path.split('/join/')[1];
      if (session?.id !== sessionId) {
        joinSession(sessionId);
      }
    }
  }, [location.pathname, userId, session?.id]);

  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const createSession = async () => {
    console.log('Attempting to create session...', { userId, authError });
    if (!userId) {
      if (authError === 'anonymous-disabled') {
        alert('Anonymous login is disabled in this project. Please click the "Login with Google" button to continue!');
      } else {
        alert('Firebase is still initializing. Please check your internet connection and try again in a few seconds.');
      }
      return;
    }
    
    setIsCreatingSession(true);
    try {
      const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const now = Date.now();
      const newSession: Session = {
        id: sessionId,
        hostId: userId,
        hostName: auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Friend',
        status: 'waiting',
        currentTurn: 0,
        photos: ['', '', '', ''] as any, // Initialize slots
        createdAt: now,
        expiresAt: now + 10 * 60 * 1000, // 10 minutes
      };
      await setDoc(doc(db, 'sessions', sessionId), newSession);
      setSession(newSession);
      setState('dual-waiting');
      navigate(`/join/${sessionId}`);
    } catch (err) {
      console.error('CRITICAL: Failed to create session document:', err);
      handleFirestoreError(err, OperationType.WRITE, 'sessions');
    } finally {
      setIsCreatingSession(false);
    }
  };

  const joinSession = async (sessionId: string) => {
    if (!userId) {
      console.log('joinSession: No userId yet, skipping');
      return;
    }

    console.log('joinSession: Searching for session', sessionId);
    try {
      const sessionDoc = await getDoc(doc(db, 'sessions', sessionId));
      if (sessionDoc.exists()) {
        const data = sessionDoc.data() as Session;
        console.log('joinSession: Session found', data);
        
        // Check expiry
        if (Date.now() > data.expiresAt) {
          alert('This session has expired.');
          setPreviewSession(null);
          return;
        }

        // If I am the host, just go to waiting screen
        if (data.hostId === userId) {
          console.log('joinSession: User is host, skipping preview');
          setSession(data);
          setState('dual-waiting');
          setPreviewSession(null);
          return;
        }

        if (data.guestId && data.guestId !== userId) {
          alert('Session is already full.');
          setPreviewSession(null);
          return;
        }

        // If I am already the guest, go to waiting screen
        if (data.guestId === userId) {
          console.log('joinSession: User is already guest, skipping preview');
          setSession(data);
          setState('dual-waiting');
          setPreviewSession(null);
          return;
        }

        setPreviewSession(data);
      } else {
        alert('Session not found.');
        setPreviewSession(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `sessions/${sessionId}`);
    }
  };

  const confirmJoinSession = async () => {
    if (!previewSession || !userId) return;
    setIsJoining(true);
    console.log('confirmJoinSession: Joining session', previewSession.id);
    try {
      const guestName = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Friend';
      await updateDoc(doc(db, 'sessions', previewSession.id), {
        guestId: userId,
        guestName: guestName,
        status: 'ready'
      });
      
      const updatedSession = { ...previewSession, guestId: userId, guestName, status: 'ready' as const };
      setSession(updatedSession);
      setPreviewSession(null);
      setState('dual-waiting');
      navigate(`/join/${previewSession.id}`);
      console.log('confirmJoinSession: Success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `sessions/${previewSession.id}`);
    } finally {
      setIsJoining(false);
    }
  };

  const handleJoinWithCode = async () => {
    if (!joinCode.trim()) return;
    setIsJoining(true);
    await joinSession(joinCode.trim().toUpperCase());
    setIsJoining(false);
  };

  // Sync Session & Timer
  useEffect(() => {
    if (session) {
      const unsub = onSnapshot(doc(db, 'sessions', session.id), (doc) => {
        const data = doc.data() as Session;
        if (!data) return;
        
        setSession(data);
        
        // Check expiry
        if (Date.now() > data.expiresAt && data.status !== 'finished') {
          alert('Session expired!');
          setState('home');
          setSession(null);
          return;
        }

        if (data.status === 'capturing') {
          setState('dual-capturing');
        } else if (data.status === 'finished') {
          setPhotos(data.photos.filter(Boolean));
          setState('preview');
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `sessions/${session.id}`);
      });

      const timer = setInterval(() => {
        const remaining = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining === 0 && state !== 'preview') {
          clearInterval(timer);
        }
      }, 1000);

      return () => {
        unsub();
        clearInterval(timer);
      };
    }
  }, [session?.id, state]);

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
      setFlash(true);
      if (cameraRef.current) cameraRef.current.takePhoto();
      await new Promise(r => setTimeout(r, 100));
      setFlash(false);
      await new Promise(r => setTimeout(r, 1000));
    }
    setIsCapturing(false);
  };

  const runDualCaptureSequence = async () => {
    if (!session || !userId) return;
    setIsCapturing(true);

    for (let i = 0; i < 4; i++) {
      // Check expiry
      if (Date.now() > session.expiresAt) {
        alert('Session expired!');
        setState('home');
        setIsCapturing(false);
        return;
      }

      // Turn logic from snippet: currentTurn % 2 === (userId === sessionData.creator ? 0 : 1)
      const isMyTurn = i % 2 === (userId === session.hostId ? 0 : 1);

      // Update turn in Firestore (only host manages the turn counter to avoid sync issues)
      if (session.hostId === userId) {
        try {
          await updateDoc(doc(db, 'sessions', session.id), { currentTurn: i });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `sessions/${session.id}`);
        }
      }

      if (isMyTurn) {
        // Countdown
        for (let c = 3; c > 0; c--) {
          setCountdown(c);
          await new Promise(r => setTimeout(r, 1000));
        }
        setCountdown(null);

        // Flash & Capture
        setFlash(true);
        if (cameraRef.current) {
          const photo = cameraRef.current.takePhoto();
          if (photo) {
            const updatedPhotos = [...session.photos];
            updatedPhotos[i] = photo; // Update specific slot
            
            try {
              await updateDoc(doc(db, 'sessions', session.id), { 
                photos: updatedPhotos,
                status: i === 3 ? 'finished' : 'capturing'
              });
            } catch (err) {
              handleFirestoreError(err, OperationType.UPDATE, `sessions/${session.id}`);
            }
          }
        }
        await new Promise(r => setTimeout(r, 100));
        setFlash(false);
      } else {
        // Waiting for partner
        setCountdown(null);
        // Wait until session.photos[i] is filled or status changes
        await new Promise<void>((resolve) => {
          const unsub = onSnapshot(doc(db, 'sessions', session.id), (doc) => {
            const data = doc.data() as Session;
            if ((data.photos[i] && data.photos[i] !== '') || data.status === 'finished') {
              unsub();
              resolve();
            }
          }, (err) => {
            handleFirestoreError(err, OperationType.GET, `sessions/${session.id}`);
          });
        });
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    setIsCapturing(false);
  };

  useEffect(() => {
    if (state === 'dual-capturing' && !isCapturing) {
      runDualCaptureSequence();
    }
  }, [state]);

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

  const copyLink = () => {
    const url = window.location.origin + window.location.pathname;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
                  <Button size="lg" className="w-full h-16 text-lg rounded-2xl shadow-lg hover:scale-[1.02] transition-transform" onClick={startSoloCapture}>
                    <Camera className="mr-2 w-6 h-6" /> Just Me 📸
                  </Button>
                  <Button size="lg" variant="secondary" className="w-full h-16 text-lg rounded-2xl shadow-md hover:scale-[1.02] transition-transform" onClick={() => setState('dual-setup')}>
                    <Users className="mr-2 w-6 h-6" /> With Someone 💌
                  </Button>
                </div>
                
                {authError === 'anonymous-disabled' && !userId && (
                  <div className="mt-4 p-4 bg-accent/30 rounded-2xl border border-accent/50 text-sm">
                    <p className="mb-3 text-accent-foreground font-medium">Anonymous login is disabled. Please login with Google to use Dual Mode!</p>
                    <Button onClick={handleGoogleLogin} className="w-full bg-white text-black hover:bg-gray-100 border border-gray-200 shadow-sm">
                      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4 mr-2" referrerPolicy="no-referrer" />
                      Login with Google
                    </Button>
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {state === 'dual-setup' && (
            <motion.div key="dual-setup" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
              <Card className="p-8 flex flex-col items-center text-center gap-6 bg-white/50 backdrop-blur-sm border-2 border-primary/20 shadow-xl rounded-[2.5rem]">
                <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center shadow-inner">
                  <Users className="w-10 h-10 text-secondary-foreground" />
                </div>
                <div>
                  <h2 className="text-2xl font-heading font-bold mb-2">Dual Mode</h2>
                  <p className="text-muted-foreground">Create a session or join with a code!</p>
                </div>
                
                <div className="w-full space-y-4">
                  <Button 
                    className="w-full h-14 rounded-2xl text-lg" 
                    onClick={createSession} 
                    disabled={isCreatingSession}
                  >
                    {isCreatingSession ? (
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin" /> Creating...
                      </span>
                    ) : (
                      'Create Session'
                    )}
                  </Button>

                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-muted-foreground/20" /></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground font-bold">OR</span></div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {!previewSession ? (
                      <div className="flex flex-col gap-3 w-full">
                        <input 
                          type="text" 
                          placeholder="ENTER 6-DIGIT CODE" 
                          className="w-full h-16 rounded-2xl border-2 border-primary/10 bg-white/50 px-4 text-center font-mono text-2xl tracking-[0.5em] focus:border-primary outline-none transition-all shadow-inner"
                          value={joinCode}
                          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                          maxLength={6}
                        />
                        <Button 
                          className="w-full h-14 rounded-2xl text-lg font-bold shadow-md"
                          onClick={handleJoinWithCode}
                          disabled={isJoining || joinCode.length < 6}
                        >
                          {isJoining ? <RefreshCw className="w-5 h-5 animate-spin mr-2" /> : <LinkIcon className="w-5 h-5 mr-2" />}
                          Connect to Session
                        </Button>
                      </div>
                    ) : (
                      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-primary/5 p-4 rounded-2xl border border-primary/20 flex flex-col items-center gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <Users className="w-5 h-5 text-primary" />
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Partner Found</p>
                            <p className="text-lg font-bold text-primary">{previewSession.hostName}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 w-full">
                          <Button variant="ghost" className="flex-1 h-12 rounded-xl" onClick={() => setPreviewSession(null)}>Cancel</Button>
                          <Button className="flex-[2] h-12 rounded-xl shadow-md" onClick={confirmJoinSession} disabled={isJoining}>
                            {isJoining ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Heart className="w-4 h-4 mr-2 fill-current" />}
                            Connect
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>

                {authError === 'anonymous-disabled' && !userId && (
                  <Button onClick={handleGoogleLogin} className="w-full bg-white text-black hover:bg-gray-100 border border-gray-200 shadow-sm rounded-2xl h-14">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4 mr-2" referrerPolicy="no-referrer" />
                    Login with Google
                  </Button>
                )}

                <Button variant="ghost" onClick={() => setState('home')}>Back to Home</Button>
              </Card>
            </motion.div>
          )}

          {state === 'dual-waiting' && session && (
            <motion.div key="dual-waiting" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
              <Card className="p-8 flex flex-col items-center text-center gap-6 bg-white/50 backdrop-blur-sm border-2 border-primary/20 shadow-xl rounded-[2.5rem]">
                <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center shadow-inner relative">
                  <Users className="w-10 h-10 text-accent-foreground" />
                  {session.guestId && <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white" />}
                </div>
                <div>
                  <h2 className="text-2xl font-heading font-bold mb-2">
                    {session.guestId ? 'Connected!' : 'Waiting for partner...'}
                  </h2>
                  <div className="flex items-center justify-center gap-4 mt-2">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center border-2 border-primary/20">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <span className="text-xs font-bold text-primary">{session.hostName}</span>
                    </div>
                    <div className="w-8 h-[2px] bg-muted-foreground/20" />
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${session.guestId ? 'bg-accent/10 border-accent/20' : 'bg-muted border-dashed border-muted-foreground/30'}`}>
                        <Users className={`w-6 h-6 ${session.guestId ? 'text-accent' : 'text-muted-foreground/50'}`} />
                      </div>
                      <span className="text-xs font-bold text-muted-foreground">{session.guestName || '???'}</span>
                    </div>
                  </div>
                </div>
                
                {!session.guestId && (
                  <div className="w-full space-y-4">
                    <div className="bg-primary/5 p-6 rounded-3xl border-2 border-dashed border-primary/20 flex flex-col items-center gap-2">
                      <span className="text-xs font-bold text-primary uppercase tracking-widest">Session Code</span>
                      <span className="text-5xl font-mono font-black tracking-[0.2em] text-primary">{session.id}</span>
                    </div>
                    
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground font-medium">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Expires in {timeLeft ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}` : '--:--'}
                    </div>

                    <Button variant="outline" onClick={copyLink} className="w-full h-12 rounded-xl gap-2">
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copied!' : 'Copy Invitation Link'}
                    </Button>
                  </div>
                )}

                {session.hostId === userId && (
                  <Button 
                    className="w-full h-16 rounded-2xl text-lg shadow-lg" 
                    disabled={!session.guestId}
                    onClick={() => updateDoc(doc(db, 'sessions', session.id), { status: 'capturing' })}
                  >
                    Start Capture 📸
                  </Button>
                )}
                
                {session.guestId === userId && !session.status.includes('capturing') && (
                  <div className="w-full p-4 bg-primary/5 rounded-2xl border border-primary/10">
                    <p className="text-sm text-primary animate-pulse font-medium">Waiting for host to start...</p>
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {(state === 'capturing' || state === 'dual-capturing') && (
            <motion.div key="capturing" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }} className="w-full flex flex-col gap-6">
              <div className="relative">
                <CameraView ref={cameraRef} onCapture={handleCapture} isCapturing={isCapturing} countdown={countdown} flash={flash} />
                
                {state === 'dual-capturing' && session && (
                  <div className="absolute top-4 left-4 z-30">
                    <Badge variant="secondary" className="bg-white/80 backdrop-blur-sm text-primary border-2 border-primary/20 px-4 py-2 rounded-2xl shadow-lg">
                      {((session.currentTurn === 0 || session.currentTurn === 2) && session.hostId === userId) ||
                       ((session.currentTurn === 1 || session.currentTurn === 3) && session.guestId === userId) ? (
                        <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> Your Turn!</span>
                      ) : (
                        <span className="flex items-center gap-2 opacity-70"><RefreshCw className="w-4 h-4 animate-spin" /> Waiting for partner...</span>
                      )}
                    </Badge>
                  </div>
                )}

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
                            <button key={f.id} onClick={() => setSelectedFrame(f)} className={`w-10 h-10 rounded-full border-4 transition-all ${selectedFrame.id === f.id ? 'border-primary scale-110 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'}`} style={{ backgroundColor: f.color }} title={f.name} />
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-bold mb-2 block text-muted-foreground uppercase tracking-wider">Filter</label>
                        <div className="grid grid-cols-3 gap-2">
                          {FILTERS.map((f) => (
                            <Button key={f.id} variant={selectedFilter.id === f.id ? 'default' : 'outline'} size="sm" onClick={() => setSelectedFilter(f)} className="rounded-xl text-xs h-10">{f.name}</Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-3">
                      <Button onClick={downloadStrip} className="flex-1 h-14 rounded-2xl text-lg shadow-lg"><Download className="mr-2 w-5 h-5" /> Download</Button>
                      <Button onClick={shareStrip} variant="secondary" className="flex-1 h-14 rounded-2xl text-lg shadow-md"><Share2 className="mr-2 w-5 h-5" /> Share</Button>
                    </div>
                    <Button variant="ghost" onClick={() => { setState('home'); navigate('/'); }} className="h-12 rounded-xl text-muted-foreground hover:text-destructive"><Trash2 className="mr-2 w-4 h-4" /> Start Over</Button>
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
    </div>
  );
}
