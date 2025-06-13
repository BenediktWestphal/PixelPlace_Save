import React from 'react';

const defaultColors = [
  "#FF0000", // Red
  "#00FF00", // Green
  "#0000FF", // Blue
  "#FFFF00", // Yellow
  "#FF00FF", // Magenta
  "#00FFFF", // Cyan
  "#FFA500", // Orange
  "#800080", // Purple
  "#008000", // Dark Green
  "#A52A2A", // Brown
  "#FFFFFF", // White
  "#000000", // Black
  "#808080", // Gray
  "#FFC0CB", // Pink
  "#ADD8E6", // Light Blue
  "#F0E68C", // Khaki
];

interface ColorPaletteProps {
  onSelectColor: (color: string) => void;
  colors?: string[];
}

const ColorPalette: React.FC<ColorPaletteProps> = ({ onSelectColor, colors = defaultColors }) => {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 gap-2">
      {colors.map(color => (
        <button
          key={color}
          style={{ backgroundColor: color }}
          className="w-full aspect-square rounded-md border-2 border-gray-600 hover:border-white focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all"
          onClick={() => onSelectColor(color)}
          aria-label={`Select color ${color}`}
          title={color}
        />
      ))}
    </div>
  );
};

export default ColorPalette;
