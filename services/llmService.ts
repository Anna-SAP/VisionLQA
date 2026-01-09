import { GoogleGenAI } from "@google/genai";
import { LlmRequestPayload, LlmResponse, ScreenshotReport } from '../types';
import { getAnalysisSystemPrompt } from '../constants';

interface ProcessedImage {
  mimeType: string;
  data: string;
}

// Helper to convert URL (Blob or Remote) to Base64 data and mime type
async function processImageUrl(url: string): Promise<ProcessedImage> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Format: "data:image/png;base64,iVBOR..."
        const match = base64String.match(/^data:(.+);base64,(.+)$/);
        
        if (match) {
          let mimeType = match[1];
          const data = match[2];

          // FIX: Gemini API rejects 'application/octet-stream' (error code 400).
          // Ensure we only send supported MIME types.
          const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];
          
          if (!allowedTypes.includes(mimeType)) {
              console.warn(`Detected unsupported MIME type: ${mimeType}. Applying fallback.`);
              // Fallback strategy: 
              // If the URL suggests PNG, use PNG, otherwise default to JPEG (safer for general photos/screenshots)
              if (url.toLowerCase().endsWith('.png')) {
                  mimeType = 'image/png';
              } else {
                  mimeType = 'image/jpeg';
              }
          }

          resolve({
            mimeType: mimeType,
            data: data
          });
        } else {
          reject(new Error("Invalid data URL format after conversion"));
        }
      };
      reader.onerror = () => reject(new Error("FileReader failed to read image blob"));
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Image processing failed for URL:", url, e);
    throw e;
  }
}

export async function callTranslationQaLLM(payload: LlmRequestPayload): Promise<LlmResponse> {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY is missing from process.env");
    throw new Error("API Key is missing. Please check your environment configuration.");
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    // 1. Prepare Images
    // Concurrent fetch and conversion with correct MIME type detection
    const [enImage, deImage] = await Promise.all([
      processImageUrl(payload.enImageBase64 || ''),
      processImageUrl(payload.deImageBase64 || '')
    ]);

    // 2. Prepare Prompt (Dynamic based on language)
    const systemPrompt = getAnalysisSystemPrompt(payload.targetLanguage);
    
    const userPrompt = `
      Project Context / Glossary:
      ${payload.glossaryText ? payload.glossaryText : "No specific glossary provided."}

      Task:
      Analyze the attached UI screenshots for Localization Quality Assurance (LQA).
      - Image 1: Source Language (en-US)
      - Image 2: Target Language (${payload.targetLanguage})

      Identify specific issues regarding:
      1. Layout (Truncation, Overlap, Misalignment)
      2. Translation Accuracy (Mistranslations, Untranslated text)
      3. Terminology Consistency
      4. Formatting (Dates, Numbers)
      
      Output the JSON report strictly adhering to the schema defined in the system instruction.
    `;

    // 3. Call Gemini API
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: enImage.mimeType, data: enImage.data } },
          { inlineData: { mimeType: deImage.mimeType, data: deImage.data } },
          { text: userPrompt }
        ]
      },
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        temperature: 0.4, 
      }
    });

    const responseText = response.text;
    
    if (!responseText) {
      throw new Error("Received empty response from Gemini API.");
    }

    // 4. Parse Response
    let parsedReport: ScreenshotReport;
    try {
      // Handle potential markdown wrapping (e.g., ```json ... ```)
      const cleanedText = responseText.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
      parsedReport = JSON.parse(cleanedText);
    } catch (e) {
      console.error("Failed to parse JSON response:", responseText);
      throw new Error("Invalid JSON response from model.");
    }

    // Ensure the ID matches the request for UI tracking
    parsedReport.screenshotId = payload.screenshotId;

    return {
      report: parsedReport
    };

  } catch (error) {
    console.error("Gemini LQA Analysis Failed:", error);
    throw error;
  }
}