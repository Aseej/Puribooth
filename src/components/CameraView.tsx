import React, { useEffect, useImperativeHandle, forwardRef } from 'react';
import { useCamera } from '../hooks/useCamera';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Zap } from 'lucide-react';

interface CameraViewProps {
  onCapture: (photo: string) => void;
  isCapturing: boolean;
  countdown: number | null;
  flash: boolean;
}

export interface CameraViewHandle {
  takePhoto: () => string | null;
}

export const CameraView = forwardRef<CameraViewHandle, CameraViewProps>(({ onCapture, isCapturing, countdown, flash }, ref) => {
  const { videoRef, startCamera, stopCamera, takePhoto, stream, error } = useCamera();

  useImperativeHandle(ref, () => ({
    takePhoto: () => {
      const photo = takePhoto();
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
        <div className="absolute inset-0 flex items-center justify-center text-white p-4 text-center">
          <p>{error}</p>
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover scale-x-[-1]"
      />

      {/* Flash Effect */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white z-50"
          />
        )}
      </AnimatePresence>

      {/* Countdown Overlay */}
      <AnimatePresence>
        {countdown !== null && (
          <motion.div
            key={countdown}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center z-40"
          >
            <span className="text-8xl font-bold text-white drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]">
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
