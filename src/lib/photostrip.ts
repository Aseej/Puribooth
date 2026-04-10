import { PhotoFrame } from '../types';

interface PhotostripProps {
  photos: string[];
  frame: PhotoFrame;
  filter: string;
}

export async function generatePhotostrip({ photos, frame, filter }: PhotostripProps): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  const photoWidth = 600;
  const photoHeight = 450;
  const padding = 40;
  const gap = 20;
  const headerHeight = 100;
  const footerHeight = 120;

  canvas.width = photoWidth + padding * 2;
  canvas.height = (photoHeight * photos.length) + (gap * (photos.length - 1)) + padding * 2 + headerHeight + footerHeight;

  // Background
  ctx.fillStyle = frame.color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Load photos
  const loadedPhotos = await Promise.all(
    photos.map((src) => {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    })
  );

  // Draw photos
  loadedPhotos.forEach((img, index) => {
    const y = padding + headerHeight + index * (photoHeight + gap);
    
    ctx.save();
    
    if (frame.shape === 'heart') {
      // Create heart clipping path
      const centerX = padding + photoWidth / 2;
      const centerY = y + photoHeight / 2;
      const size = Math.min(photoWidth, photoHeight) * 0.8;
      
      ctx.beginPath();
      ctx.moveTo(centerX, centerY + size / 4);
      // Left side of heart
      ctx.bezierCurveTo(
        centerX - size / 2, centerY - size / 2, 
        centerX - size, centerY + size / 4, 
        centerX, centerY + size
      );
      // Right side of heart
      ctx.bezierCurveTo(
        centerX + size, centerY + size / 4, 
        centerX + size / 2, centerY - size / 2, 
        centerX, centerY + size / 4
      );
      ctx.closePath();
    } else {
      // Create rounded clipping path for each photo
      const radius = 20;
      ctx.beginPath();
      ctx.moveTo(padding + radius, y);
      ctx.lineTo(padding + photoWidth - radius, y);
      ctx.quadraticCurveTo(padding + photoWidth, y, padding + photoWidth, y + radius);
      ctx.lineTo(padding + photoWidth, y + photoHeight - radius);
      ctx.quadraticCurveTo(padding + photoWidth, y + photoHeight, padding + photoWidth - radius, y + photoHeight);
      ctx.lineTo(padding + radius, y + photoHeight);
      ctx.quadraticCurveTo(padding, y + photoHeight, padding, y + photoHeight - radius);
      ctx.lineTo(padding, y + radius);
      ctx.quadraticCurveTo(padding, y, padding + radius, y);
      ctx.closePath();
    }
    
    ctx.clip();

    // Apply filter
    ctx.filter = filter;
    ctx.drawImage(img, padding, y, photoWidth, photoHeight);
    
    ctx.restore();

    // Subtle border
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 4;
    ctx.stroke();
  });

  // Header/Footer Text
  ctx.fillStyle = frame.textColor;
  ctx.textAlign = 'center';
  
  // Header
  ctx.font = 'bold 40px Quicksand, sans-serif';
  ctx.fillText('PuriBooth', canvas.width / 2, padding + 50);

  // Footer
  const date = new Date().toLocaleDateString();
  ctx.font = '30px Quicksand, sans-serif';
  ctx.fillText(date, canvas.width / 2, canvas.height - padding - 40);
  
  ctx.font = 'italic 24px Quicksand, sans-serif';
  ctx.fillText('made with love ♡', canvas.width / 2, canvas.height - padding - 10);

  return canvas.toDataURL('image/png');
}
