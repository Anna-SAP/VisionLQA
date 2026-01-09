import React from 'react';
import { BulkProcessingState } from '../types';
import { Loader2, XCircle, CheckCircle2, AlertTriangle, Download, X, FileSpreadsheet, Archive } from 'lucide-react';
import { Button } from './Button';

interface BulkRunModalProps {
  isOpen: boolean;
  state: BulkProcessingState;
  onClose: () => void;
  onCancel: () => void;
  onStart: () => void;
  onDownloadCsv: () => void;
  onDownloadZip: () => void;
  pendingCount: number;
}

export const BulkRunModal: React.FC<BulkRunModalProps> = ({ 
  isOpen, 
  state, 
  onClose, 
  onCancel, 
  onStart, 
  onDownloadCsv,
  onDownloadZip,
  pendingCount 
}) => {
  if (!isOpen) return null;

  const percent = state.total > 0 ? Math.round((state.completed / state.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 text-lg flex items-center">
            {state.isProcessing ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin text-accent" />
            ) : (
              <div className="bg-accent p-1 rounded text-white mr-2">
                <Download className="w-4 h-4" />
              </div>
            )}
            Bulk QA Analysis
          </h3>
          {!state.isProcessing && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          
          {/* Initial State */}
          {!state.isProcessing && !state.isComplete && (
            <div className="space-y-4">
              <p className="text-slate-600 text-sm">
                Ready to process <strong>{pendingCount}</strong> pending screenshots. 
                This will generate QA reports for all unanalyzed items.
              </p>
              
              <div className="bg-yellow-50 p-3 rounded border border-yellow-100 text-xs text-yellow-800 flex items-start">
                <AlertTriangle className="w-4 h-4 mr-2 shrink-0 mt-0.5" />
                <div>
                   <span className="font-bold">Note:</span> Max 5 concurrent requests. Large batches may take a few minutes.
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={onStart} disabled={pendingCount === 0}>
                  Start Bulk Run ({pendingCount})
                </Button>
              </div>
            </div>
          )}

          {/* Processing State */}
          {(state.isProcessing || state.isComplete) && (
            <div className="space-y-6">
              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium text-slate-700">
                    {state.isComplete ? 'Analysis Complete' : `Processing... ${state.completed}/${state.total}`}
                  </span>
                  <span className="font-bold text-accent">{percent}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className={`h-2.5 rounded-full transition-all duration-300 ${state.isComplete ? 'bg-green-500' : 'bg-accent'}`} 
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>
              </div>

              {/* Counters */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-100 p-3 rounded text-center">
                  <div className="text-2xl font-bold text-green-600">{state.success}</div>
                  <div className="text-xs text-green-800 uppercase font-bold tracking-wider">Success</div>
                </div>
                <div className="bg-red-50 border border-red-100 p-3 rounded text-center">
                  <div className="text-2xl font-bold text-red-600">{state.failed}</div>
                  <div className="text-xs text-red-800 uppercase font-bold tracking-wider">Failed</div>
                </div>
              </div>

              {/* Error Log */}
              {state.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto border border-red-100 bg-red-50/30 rounded p-2 text-xs">
                  <p className="font-bold text-red-800 mb-1">Failures:</p>
                  <ul className="space-y-1">
                    {state.errors.map((err, idx) => (
                      <li key={idx} className="text-red-700 truncate">
                        • {err.fileName}: {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col space-y-2 pt-2 border-t border-slate-100">
                {state.isProcessing ? (
                   <Button variant="secondary" onClick={onCancel} className="w-full">
                     Cancel Operation
                   </Button>
                ) : (
                   <div className="grid grid-cols-2 gap-3">
                     <Button onClick={onDownloadZip} variant="outline" className="flex items-center justify-center">
                        <Archive className="w-4 h-4 mr-2" />
                        Download All (ZIP)
                     </Button>
                     <Button onClick={onDownloadCsv} className="flex items-center justify-center">
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Summary (CSV)
                     </Button>
                   </div>
                )}
                {state.isComplete && (
                  <button 
                    onClick={onClose} 
                    className="text-xs text-slate-400 hover:text-slate-600 text-center mt-2 underline"
                  >
                    Close Window
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};