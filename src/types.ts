export type Mode = 'solo' | 'dual';

export interface Session {
  id: string;
  hostId: string;
  hostName?: string;
  guestId?: string;
  guestName?: string;
  status: 'waiting' | 'ready' | 'capturing' | 'finished';
  currentTurn: number; // 0 to 3
  photos: string[]; // base64 or URLs
  createdAt: number;
  expiresAt: number;
}

export interface PhotoFrame {
  id: string;
  name: string;
  color: string;
  textColor: string;
}

export const FRAMES: PhotoFrame[] = [
  { id: 'classic-white', name: 'Classic White', color: '#FFFFFF', textColor: '#000000' },
  { id: 'pastel-pink', name: 'Soft Pink', color: '#FFE4E1', textColor: '#D2691E' },
  { id: 'pastel-mint', name: 'Minty Fresh', color: '#E0FFF0', textColor: '#2E8B57' },
  { id: 'pastel-blue', name: 'Sky Blue', color: '#E0F7FA', textColor: '#006064' },
  { id: 'midnight', name: 'Midnight', color: '#1A1A1A', textColor: '#FFFFFF' },
];

export const FILTERS = [
  { id: 'none', name: 'Normal', filter: 'none' },
  { id: 'grayscale', name: 'B&W', filter: 'grayscale(100%)' },
  { id: 'sepia', name: 'Vintage', filter: 'sepia(100%)' },
  { id: 'warm', name: 'Warm', filter: 'sepia(30%) saturate(140%) brightness(110%)' },
  { id: 'cool', name: 'Cool', filter: 'saturate(80%) hue-rotate(10deg) brightness(110%)' },
];
