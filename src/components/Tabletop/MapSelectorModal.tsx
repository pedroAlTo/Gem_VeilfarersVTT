import React, { useState } from 'react';
import type { MapData } from '../../types/vtt';
import { DEFAULT_MAPS } from '../../data/defaultMaps';
import { X, Upload, Check, Grid as GridIcon } from 'lucide-react';

interface MapSelectorModalProps {
  currentMap: MapData;
  onSelectMap: (map: MapData) => void;
  onClose: () => void;
}

export const MapSelectorModal: React.FC<MapSelectorModalProps> = ({
  currentMap,
  onSelectMap,
  onClose,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(currentMap.id);
  const [customUrl, setCustomUrl] = useState<string>(currentMap.imageUrl || '');
  const [customName, setCustomName] = useState<string>(currentMap.name);
  const [gridSize, setGridSize] = useState<number>(currentMap.grid.size);
  const [gridType, setGridType] = useState<'square' | 'hex'>(currentMap.grid.type);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(currentMap.grid.snapToGrid);
  const [gridColor, setGridColor] = useState<string>(currentMap.grid.color);
  const [gridOpacity, setGridOpacity] = useState<number>(currentMap.grid.opacity);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCustomUrl(event.target.result as string);
          setCustomName(file.name.replace(/\.[^/.]+$/, ''));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApply = () => {
    // If user chose a preset
    const preset = DEFAULT_MAPS.find((m) => m.id === selectedPresetId);
    let finalMap: MapData;

    if (customUrl) {
      finalMap = {
        id: 'custom-' + Date.now(),
        name: customName || 'Custom Battlemap',
        imageUrl: customUrl,
        width: 2400,
        height: 1800,
        grid: {
          enabled: true,
          type: gridType,
          size: gridSize,
          color: gridColor,
          opacity: gridOpacity,
          snapToGrid: snapToGrid,
          scaleUnit: '5 ft',
        },
      };
    } else if (preset) {
      finalMap = {
        ...preset,
        grid: {
          ...preset.grid,
          type: gridType,
          size: gridSize,
          color: gridColor,
          opacity: gridOpacity,
          snapToGrid: snapToGrid,
        },
      };
    } else {
      finalMap = currentMap;
    }

    onSelectMap(finalMap);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <h2 className="text-lg font-semibold text-slate-100 flex items-center space-x-2">
            <GridIcon className="w-5 h-5 text-indigo-400" />
            <span>Map & Grid Configuration</span>
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Preset Atmospheric Maps */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Atmospheric Battlemap Presets
            </label>
            <div className="grid grid-cols-2 gap-3">
              {DEFAULT_MAPS.map((m) => {
                const isSelected = selectedPresetId === m.id && !customUrl;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedPresetId(m.id);
                      setCustomUrl('');
                      setGridSize(m.grid.size);
                      setGridType(m.grid.type);
                    }}
                    className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-950/40 text-indigo-100 shadow-lg shadow-indigo-950/40'
                        : 'border-slate-800 bg-slate-800/40 text-slate-300 hover:border-slate-700 hover:bg-slate-800/80'
                    }`}
                  >
                    <div>
                      <div className="font-medium text-sm text-slate-100">{m.name}</div>
                      <div className="text-xs text-slate-400 capitalize">
                        {m.proceduralType?.replace('_', ' ')} • {m.width}x{m.height}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-indigo-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Map Upload / URL */}
          <div className="border-t border-slate-800 pt-5 space-y-3">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Or Load Custom Map
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Paste Image URL (e.g. https://...)"
                value={customUrl}
                onChange={(e) => {
                  setCustomUrl(e.target.value);
                  setSelectedPresetId('');
                }}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <label className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg cursor-pointer text-xs font-medium transition border border-slate-700">
                <Upload className="w-4 h-4" />
                <span>Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Grid Settings */}
          <div className="border-t border-slate-800 pt-5 space-y-4">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Tactical Grid Settings
            </label>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Grid Shape</label>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setGridType('square')}
                    className={`flex-1 py-1.5 text-xs rounded-lg font-medium border ${
                      gridType === 'square'
                        ? 'border-indigo-500 bg-indigo-950/40 text-indigo-200'
                        : 'border-slate-800 bg-slate-950 text-slate-400'
                    }`}
                  >
                    Square
                  </button>
                  <button
                    onClick={() => setGridType('hex')}
                    className={`flex-1 py-1.5 text-xs rounded-lg font-medium border ${
                      gridType === 'hex'
                        ? 'border-indigo-500 bg-indigo-950/40 text-indigo-200'
                        : 'border-slate-800 bg-slate-950 text-slate-400'
                    }`}
                  >
                    Hexagonal
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Cell Size: <span className="font-mono text-slate-200">{gridSize}px</span>
                </label>
                <input
                  type="range"
                  min="30"
                  max="120"
                  value={gridSize}
                  onChange={(e) => setGridSize(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 accent-indigo-500 cursor-pointer bg-slate-800 rounded-lg"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Grid Color & Opacity</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={gridColor}
                    onChange={(e) => setGridColor(e.target.value)}
                    className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <input
                    type="range"
                    min="0.1"
                    max="0.8"
                    step="0.05"
                    value={gridOpacity}
                    onChange={(e) => setGridOpacity(parseFloat(e.target.value))}
                    className="flex-1 h-1.5 accent-indigo-500 cursor-pointer bg-slate-800 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <span className="text-xs text-slate-300 font-medium">Snap Tokens to Grid</span>
                <input
                  type="checkbox"
                  checked={snapToGrid}
                  onChange={(e) => setSnapToGrid(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-800 bg-slate-950/60 space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-600/30 transition"
          >
            Apply Map Changes
          </button>
        </div>
      </div>
    </div>
  );
};
