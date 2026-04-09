import { useEffect, useRef, useState } from 'react';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', aspectRatio: 4 / 3 },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Could not access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const takePhoto = (): string | null => {
    if (!videoRef.current) return null;

    const vw = videoRef.current.videoWidth;
    const vh = videoRef.current.videoHeight;
    const targetRatio = 4 / 3;
    
    let sw, sh, sx, sy;
    const currentRatio = vw / vh;

    if (currentRatio > targetRatio) {
      sh = vh;
      sw = vh * targetRatio;
      sx = (vw - sw) / 2;
      sy = 0;
    } else {
      sw = vw;
      sh = vw / targetRatio;
      sx = 0;
      sy = (vh - sh) / 2;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 800; // Higher resolution for better quality
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Mirror the photo
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    
    ctx.drawImage(
      videoRef.current,
      sx, sy, sw, sh,
      0, 0, canvas.width, canvas.height
    );

    return canvas.toDataURL('image/jpeg', 0.9);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return { videoRef, startCamera, stopCamera, takePhoto, stream, error };
}
