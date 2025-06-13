import React from 'react';
import type { Pixel } from '../App'; // Changed to type-only import

interface CanvasProps {
  pixels: Pixel[];
  onPixelClick: (x: number, y: number) => void;
  width: number;
  height: number;
  pixelSize: number;
  disabled?: boolean; // Add disabled prop
}

const Canvas: React.FC<CanvasProps> = ({ pixels, onPixelClick, width, height, pixelSize, disabled }) => {
  const pixelMap = new Map<string, string>();
  pixels.forEach(p => {
    pixelMap.set(`${p.x}-${p.y}`, p.color);
  });

  return (
    <div
      className="grid border border-gray-600 shadow-2xl"
      style={{
        gridTemplateColumns: `repeat(${width}, ${pixelSize}px)`,
        gridTemplateRows: `repeat(${height}, ${pixelSize}px)`,
        width: `${width * pixelSize}px`,
        height: `${height * pixelSize}px`,
        backgroundColor: '#374151', // gray-700
        cursor: disabled ? 'not-allowed' : 'pointer', // Change cursor when disabled
      }}
    >
      {Array.from({ length: width * height }).map((_, index) => {
        const x = index % width;
        const y = Math.floor(index / width);
        const color = pixelMap.get(`${x}-${y}`) || '#FFFFFF00'; // Default to transparent white if no color

        return (
          <div
            key={index}
            className={`hover:opacity-80 ${disabled ? '' : 'cursor-pointer'}`}
            style={{
              backgroundColor: color === '#FFFFFF00' ? 'rgba(255,255,255,0.05)' : color, // Show subtle grid for empty cells
              width: `${pixelSize}px`,
              height: `${pixelSize}px`,
            }}
            onClick={() => !disabled && onPixelClick(x, y)}
            title={disabled ? "Cooldown active or processing" : `(${x}, ${y}) - ${pixelMap.get(`${x}-${y}`) || 'Empty'}`}
          />
        );
      })}
    </div>
  );
};
export default Canvas;
