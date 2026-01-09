import React, { useState } from 'react';
import { UploadCloud, Loader2, FileArchive } from 'lucide-react';
import { ScreenshotPair, SupportedLocale } from '../types';
import JSZip from 'jszip';

interface UploadAreaProps {
  onPairsCreated: (pairs: ScreenshotPair[]) => void;
}

// Helper: Normalize filenames for pairing
// Removes extensions and common locale suffixes (e.g. _en, -fr, .de-DE)
const normalizeName = (fileName: string): string => {
  // 1. Remove extension
  const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
  
  // 2. Remove locale suffixes
  // Regex matches:
  // - Separator: . _ - (optional)
  // - Lang: en, de, fr
  // - Region: -US, -DE, -FR (optional)
  // - End of string
  return nameWithoutExt.replace(/[._-]?(en|de|fr)([-_]?[a-z]{2})?$/i, '').toLowerCase();
};

export const UploadArea: React.FC<UploadAreaProps> = ({ onPairsCreated }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const processFiles = async (files: File[]) => {
    try {
      const zips = files.filter(f => f.name.toLowerCase().endsWith('.zip'));
      const images = files.filter(f => f.type.startsWith('image/'));
      const newPairs: ScreenshotPair[] = [];

      // Helper to match pairs within map
      const createPairsFromMaps = (
        enImages: Map<string, Blob>, 
        targetImages: Map<string, Blob>, 
        lang: SupportedLocale
      ) => {
         const pairs: ScreenshotPair[] = [];
         
         // Build normalized lookup map for target images
         const targetLookup = new Map<string, Blob>();
         targetImages.forEach((blob, name) => {
            targetLookup.set(normalizeName(name), blob);
         });

         enImages.forEach((enBlob, enFileName) => {
            const normalizedEn = normalizeName(enFileName);
            
            // Try exact match first (with extension)
            let targetBlob = targetImages.get(enFileName);
            
            // If not found, try normalized match (ignoring extension and suffixes)
            if (!targetBlob) {
               targetBlob = targetLookup.get(normalizedEn);
            }

            if (targetBlob) {
              // Create a clean display name (capitalize first letter)
              const displayName = normalizedEn.charAt(0).toUpperCase() + normalizedEn.slice(1);
              
              pairs.push({
                id: Math.random().toString(36).substr(2, 9),
                fileName: displayName,
                enImageUrl: URL.createObjectURL(enBlob),
                deImageUrl: URL.createObjectURL(targetBlob),
                targetLanguage: lang,
                status: 'pending'
              });
            }
          });
          return pairs;
      };

      // 1. Handle ZIP Pairing
      // Looking for combinations: (en + de) OR (en + fr)
      if (zips.length >= 2) {
        // Heuristic: Find files containing 'en'/'us' vs 'de' vs 'fr'
        const enZipFile = zips.find(f => /en[-_]?us/i.test(f.name) || f.name.toLowerCase().startsWith('en') || f.name.includes('en.zip'));
        const deZipFile = zips.find(f => /de[-_]?de/i.test(f.name) || f.name.toLowerCase().startsWith('de') || f.name.includes('de.zip'));
        const frZipFile = zips.find(f => /fr[-_]?fr/i.test(f.name) || f.name.toLowerCase().startsWith('fr') || f.name.includes('fr.zip'));

        const loadZipImages = async (file: File) => {
            const zip = await JSZip.loadAsync(file);
            const imageMap = new Map<string, Blob>();
            
            const entries: Array<{path: string, obj: any}> = [];
            zip.forEach((path, obj) => entries.push({path, obj}));

            for (const {path, obj} of entries) {
               if (obj.dir) continue;
               if (path.includes('__MACOSX') || path.split('/').pop()?.startsWith('.')) continue;
               
               if (/\.(png|jpg|jpeg|webp)$/i.test(path)) {
                 const blob = await obj.async('blob');
                 const fileName = path.split('/').pop();
                 if (fileName) imageMap.set(fileName, blob);
               }
            }
            return imageMap;
        };

        if (enZipFile) {
            const enImages = await loadZipImages(enZipFile);
            
            if (deZipFile) {
                const deImages = await loadZipImages(deZipFile);
                newPairs.push(...createPairsFromMaps(enImages, deImages, 'de-DE'));
            }
            if (frZipFile) {
                const frImages = await loadZipImages(frZipFile);
                newPairs.push(...createPairsFromMaps(enImages, frImages, 'fr-FR'));
            }
        }
      }

      // 2. Handle Loose Image Pairing
      if (images.length > 0) {
        const enFiles = images.filter(f => /en|us/i.test(f.name));
        const deFiles = images.filter(f => /de/i.test(f.name));
        const frFiles = images.filter(f => /fr/i.test(f.name));

        // Attempt to pair EN with DE or FR using normalization
        enFiles.forEach(enFile => {
          const normEn = normalizeName(enFile.name);
          const displayName = normEn.charAt(0).toUpperCase() + normEn.slice(1);

          // Match DE
          const deMatch = deFiles.find(de => normalizeName(de.name) === normEn);
          if (deMatch) {
             newPairs.push({
               id: Math.random().toString(36).substr(2, 9),
               fileName: displayName,
               enImageUrl: URL.createObjectURL(enFile),
               deImageUrl: URL.createObjectURL(deMatch),
               targetLanguage: 'de-DE',
               status: 'pending'
             });
          }

          // Match FR
          const frMatch = frFiles.find(fr => normalizeName(fr.name) === normEn);
          if (frMatch) {
             newPairs.push({
               id: Math.random().toString(36).substr(2, 9),
               fileName: displayName,
               enImageUrl: URL.createObjectURL(enFile),
               deImageUrl: URL.createObjectURL(frMatch),
               targetLanguage: 'fr-FR',
               status: 'pending'
             });
          }
        });

        // Fallback: If strict matching failed but user uploaded exactly 2 images
        if (newPairs.length === 0 && images.length === 2 && enFiles.length === 1) {
           const targetFile = deFiles[0] || frFiles[0];
           if (targetFile) {
                const lang = deFiles.length > 0 ? 'de-DE' : 'fr-FR';
                const normName = normalizeName(enFiles[0].name);
                const displayName = normName.charAt(0).toUpperCase() + normName.slice(1);
                
                newPairs.push({
                    id: Math.random().toString(36).substr(2, 9),
                    fileName: displayName,
                    enImageUrl: URL.createObjectURL(enFiles[0]),
                    deImageUrl: URL.createObjectURL(targetFile),
                    targetLanguage: lang,
                    status: 'pending'
                });
           }
        }
      }

      if (newPairs.length > 0) {
        onPairsCreated(newPairs);
      } else {
        alert("No matching pairs found. Please check filenames (e.g. 'Home_en.png' vs 'Home_fr.png') or upload valid zip archives containing matching images.");
      }

    } catch (error) {
      console.error("File processing error:", error);
      alert("Error processing files. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsProcessing(true);
    setTimeout(() => {
      processFiles(Array.from(fileList));
    }, 100);
  };

  return (
    <div className="p-4 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-center cursor-pointer relative group h-40 flex items-center justify-center">
      <input 
        type="file" 
        multiple 
        accept="image/*,.zip"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={isProcessing}
      />
      
      {isProcessing ? (
        <div className="flex flex-col items-center justify-center text-accent">
          <Loader2 className="w-8 h-8 animate-spin mb-2" />
          <p className="text-sm font-medium">Processing files...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
          <div className="flex space-x-2 text-slate-400 group-hover:text-accent transition-colors">
             <UploadCloud className="w-8 h-8" />
             <FileArchive className="w-8 h-8" />
          </div>
          <p className="text-sm font-medium text-slate-600">
            Drag & drop images or ZIP archives
          </p>
          <div className="text-xs text-slate-400 max-w-[200px] leading-relaxed">
            <p>Supported: PNG, JPG</p>
            <p className="font-semibold text-slate-500 mt-1">
              Supports EN vs. DE / FR
            </p>
          </div>
        </div>
      )}
    </div>
  );
};