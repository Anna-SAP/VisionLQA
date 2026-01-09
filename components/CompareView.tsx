import React, { useState } from 'react';
import { ScreenshotPair } from '../types';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface CompareViewProps {
  pair: ScreenshotPair | null;
}

export const CompareView: React.FC<CompareViewProps> = ({ pair }) => {
  const [zoom, setZoom] = useState(1);

  if (!pair) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400">
        <Maximize className="w-16 h-16 mb-4 opacity-20" />
        <p className="text-lg font-medium">Select a screenshot pair to compare</p>
      </div>
    );
  }

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  
  const targetLabel = pair.targetLanguage; // e.g. 'de-DE' or 'fr-FR'

  return (
    <div className="h-full flex flex-col bg-slate-200 relative overflow-hidden">
      {/* Top Header Bar */}
      <div className="h-16 bg-slate-50 border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
        
        {/* Source Badge (Left) */}
        <div className="bg-slate-600 text-white px-4 py-1.5 rounded shadow-sm text-sm font-bold tracking-wide flex items-center">
          <span className="opacity-75 mr-2 text-xs font-normal uppercase">Source</span>
          <span>en-US</span>
        </div>

        {/* Zoom Controls (Center) */}
        <div className="bg-white border border-slate-300 shadow-sm rounded-full px-4 py-1.5 flex items-center space-x-4">
          <button 
            onClick={handleZoomOut} 
            className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono w-10 text-center font-medium text-slate-700">
            {(zoom * 100).toFixed(0)}%
          </span>
          <button 
            onClick={handleZoomIn} 
            className="p-1 hover:bg-slate-100 rounded text-slate-600 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Target Badge (Right - Purple Highlight) */}
        <div className="bg-purple-500 text-white px-4 py-1.5 rounded shadow-sm text-sm font-bold tracking-wide flex items-center">
          <span className="opacity-75 mr-2 text-xs font-normal uppercase">Target</span>
          <span>{targetLabel}</span>
        </div>
      </div>

      {/* Viewing Area */}
      <div className="flex-1 flex overflow-auto p-8 space-x-8 justify-center bg-slate-200/50">
        {/* EN-US */}
        <div 
          className="flex-1 flex flex-col min-w-[300px] max-w-2xl transition-transform duration-200 ease-out origin-top" 
          style={{ transform: `scale(${zoom})` }}
        >
          <div className="relative bg-white shadow-xl rounded-lg overflow-hidden group border border-slate-200">
            <img src={pair.enImageUrl} alt="en-US" className="w-full h-auto block" />
            {/* Hover border effect */}
            <div className="absolute inset-0 border-2 border-transparent group-hover:border-slate-400 pointer-events-none transition-colors"></div>
          </div>
        </div>

        {/* Target Language */}
        <div 
          className="flex-1 flex flex-col min-w-[300px] max-w-2xl transition-transform duration-200 ease-out origin-top" 
          style={{ transform: `scale(${zoom})` }}
        >
          <div className="relative bg-white shadow-xl rounded-lg overflow-hidden group border border-slate-200">
            <img src={pair.deImageUrl} alt={targetLabel} className="w-full h-auto block" />
            {/* Hover border effect */}
            <div className="absolute inset-0 border-2 border-transparent group-hover:border-purple-400 pointer-events-none transition-colors"></div>
            
            {/* Overlay bounding boxes if report exists */}
            {pair.report?.issues.map(issue => (
              issue.boundingBox && (
                <div 
                  key={issue.id}
                  className={`absolute border-2 ${issue.severity === 'Critical' ? 'border-red-500 bg-red-500/10' : 'border-orange-400 bg-orange-400/10'}`}
                  style={{
                    left: `${issue.boundingBox.x * 100}%`,
                    top: `${issue.boundingBox.y * 100}%`,
                    width: `${issue.boundingBox.width * 100}%`,
                    height: `${issue.boundingBox.height * 100}%`
                  }}
                  title={issue.descriptionZh}
                >
                  <span className="absolute -top-5 left-0 text-[10px] bg-red-600 text-white px-1 rounded shadow-sm whitespace-nowrap z-10 font-mono">
                    {issue.id}
                  </span>
                </div>
              )
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};