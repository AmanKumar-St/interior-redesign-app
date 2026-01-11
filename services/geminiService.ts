import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

/**
 * Helper to resize and compress images before sending to API.
 * This drastically reduces token usage and prevents 429 Rate Limit errors.
 */
const compressImage = (base64Str: string, maxWidth = 1024, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Scale down if width exceeds maxWidth
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white'; // Prevent transparent backgrounds turning black
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
      }
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      resolve(base64Str); // Fallback to original if compression fails
    };
  });
};

/**
 * Helper function to retry API calls with exponential backoff.
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  retries: number = 3,
  delay: number = 4000 // Increased to 4 seconds for better rate limit handling
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const isRateLimit = 
      error?.status === 429 || 
      error?.message?.includes('429') || 
      error?.message?.includes('Too Many Requests') ||
      error?.status === 503;

    if (retries > 0 && isRateLimit) {
      console.warn(`API Rate Limit hit. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(operation, retries - 1, delay * 2);
    }
    
    throw error;
  }
}

export const generateStyleMakeover = async (
  originalImageBase64: string,
  stylePrompt: string
): Promise<string | null> => {
  const ai = getAIClient();
  
  // Compress image to save tokens
  const compressedImage = await compressImage(originalImageBase64);
  const base64Data = compressedImage.split(',')[1];
  const mimeType = 'image/jpeg';

  try {
    const response: GenerateContentResponse = await retryWithBackoff(() => 
      ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: `Please reimagine this room in the following style: ${stylePrompt}. Maintain the room's layout and architecture but change the furniture, decor, and color palette to match the style perfectly. Output ONLY the image.`,
            },
          ],
        },
      })
    );

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Style Makeover Error:", error);
    return null;
  }
};

export const editImageWithPrompt = async (
  currentImageBase64: string,
  userPrompt: string
): Promise<string | null> => {
  const ai = getAIClient();
  
  const compressedImage = await compressImage(currentImageBase64);
  const base64Data = compressedImage.split(',')[1];
  const mimeType = 'image/jpeg';

  try {
    const response: GenerateContentResponse = await retryWithBackoff(() => 
      ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: `Edit this room design based on this instruction: ${userPrompt}. Keep as much of the existing design as possible, only changing what is requested.`,
            },
          ],
        },
      })
    );

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image Edit Error:", error);
    return null;
  }
};

export const getExpertAdvice = async (
  currentImageBase64: string,
  userQuestion: string,
  chatHistory: { role: 'user' | 'assistant', content: string }[]
) => {
  const ai = getAIClient();
  
  // Compress to smaller size for chat context to save tokens
  const compressedImage = await compressImage(currentImageBase64, 512, 0.6); 
  const base64Data = compressedImage.split(',')[1];

  const chat = ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction: 'You are an expert interior designer. Provide helpful advice, shopping tips, and design reasoning. Use Google Search grounding for shoppable links when asked about furniture or products. Be encouraging and sophisticated.',
      tools: [{ googleSearch: {} }]
    }
  });

  try {
    const response: GenerateContentResponse = await retryWithBackoff(() => 
      chat.sendMessage({ 
        message: `${userQuestion} (Reference the attached image: [Image Data embedded])` 
      })
    );

    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title,
      uri: chunk.web?.uri
    })).filter(s => s.title && s.uri) || [];

    return {
      text: response.text,
      sources: sources
    };
  } catch (error) {
    console.error("Chat Error:", error);
    return { text: "I'm sorry, I encountered an error while analyzing the design. Let's try again.", sources: [] };
  }
};