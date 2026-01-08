
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateStyleMakeover = async (
  originalImageBase64: string,
  stylePrompt: string
): Promise<string | null> => {
  const ai = getAIClient();
  const base64Data = originalImageBase64.split(',')[1];
  const mimeType = originalImageBase64.split(';')[0].split(':')[1];

  try {
    const response = await ai.models.generateContent({
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
            text: `Please reimagine this room in the following style: ${stylePrompt}. Maintain the room's layout and architecture but change the furniture, decor, and color palette to match the style perfectly.`,
          },
        ],
      },
    });

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
  const base64Data = currentImageBase64.split(',')[1];
  const mimeType = currentImageBase64.split(';')[0].split(':')[1];

  try {
    const response = await ai.models.generateContent({
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
    });

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
  const base64Data = currentImageBase64.split(',')[1];
  const mimeType = currentImageBase64.split(';')[0].split(':')[1];

  const chat = ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction: 'You are an expert interior designer. Provide helpful advice, shopping tips, and design reasoning. Use Google Search grounding for shoppable links when asked about furniture or products. Be encouraging and sophisticated.',
      tools: [{ googleSearch: {} }]
    }
  });

  // Inject current image state into the conversation
  const message = {
    parts: [
      { inlineData: { data: base64Data, mimeType: mimeType } },
      { text: userQuestion }
    ]
  };

  try {
    const response: GenerateContentResponse = await chat.sendMessage({ 
      message: `${userQuestion} (Reference the attached image of the room design we are working on)`
    });

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
