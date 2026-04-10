export type Mode = 'solo';

export interface PhotoFrame {
  id: string;
  name: string;
  color: string;
  textColor: string;
  shape?: 'rect' | 'heart';
}

export const FRAMES: PhotoFrame[] = [
  { id: 'classic-white', name: 'Classic White', color: '#FFFFFF', textColor: '#000000', shape: 'rect' },
  { id: 'pastel-pink', name: 'Soft Pink', color: '#FFE4E1', textColor: '#D2691E', shape: 'rect' },
  { id: 'pastel-mint', name: 'Minty Fresh', color: '#E0FFF0', textColor: '#2E8B57', shape: 'rect' },
  { id: 'pastel-blue', name: 'Sky Blue', color: '#E0F7FA', textColor: '#006064', shape: 'rect' },
  { id: 'midnight', name: 'Midnight', color: '#1A1A1A', textColor: '#FFFFFF', shape: 'rect' },
];

export const FILTERS = [
  { id: 'none', name: 'Normal', filter: 'none' },
  { id: 'grayscale', name: 'B&W', filter: 'grayscale(100%)' },
  { id: 'sepia', name: 'Vintage', filter: 'sepia(100%)' },
  { id: 'warm', name: 'Warm', filter: 'sepia(30%) saturate(140%) brightness(110%)' },
  { id: 'cool', name: 'Cool', filter: 'saturate(80%) hue-rotate(10deg) brightness(110%)' },
  { id: 'blur', name: 'Soft', filter: 'blur(2px) saturate(120%)' },
];
