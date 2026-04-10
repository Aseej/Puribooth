import React, { useEffect, useImperativeHandle, forwardRef } from 'react';
import { useCamera } from '../hooks/useCamera';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Zap } from 'lucide-react';

interface CameraViewProps {
  onCapture: (photo: string) => void;
  isCapturing: boolean;
  countdown: number | null;
  flash: boolean;
  filter?: string;
}

export interface CameraViewHandle {
  takePhoto: () => string | null;
}

export const CameraView = forwardRef<CameraViewHandle, CameraViewProps>(({ onCapture, isCapturing, countdown, flash, filter = 'none' }, ref) => {
  const { videoRef, startCamera, stopCamera, takePhoto, stream, error } = useCamera();

  useImperativeHandle(ref, () => ({
    takePhoto: () => {
      const photo = takePhoto(filter);
      if (photo) onCapture(photo);
      return photo;
    }
  }));

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  return (
    <div className="relative w-full aspect-[4/3] bg-black rounded-3xl overflow-hidden shadow-2xl border-8 border-white">
      {!stream && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <RefreshCw className="w-8 h-8 animate-spin opacity-50" />
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center bg-black/80 backdrop-blur-sm z-50">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-lg font-bold mb-2">Camera Error</p>
          <p className="text-sm opacity-80 mb-6">{error}</p>
          <button 
            onClick={() => { startCamera(); }}
            className="px-6 py-2 bg-white text-black rounded-full font-bold hover:bg-gray-200 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ filter }}
        className="w-full h-full object-cover scale-x-[-1]"
      />

      {/* Countdown Overlay */}
      <AnimatePresence mode="wait">
        {countdown !== null && (
          <motion.div
            key={countdown}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.2, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center z-40 bg-black/10"
          >
            <span className="text-9xl font-black text-white drop-shadow-[0_0_30px_rgba(0,0,0,0.8)] select-none">
              {countdown}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Capture Indicator */}
      {isCapturing && countdown === null && (
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full animate-pulse">
          <Zap className="w-4 h-4 fill-current" />
          <span className="text-xs font-bold uppercase tracking-wider">Capturing</span>
        </div>
      )}
    </div>
  );
});

CameraView.displayName = 'CameraView';
