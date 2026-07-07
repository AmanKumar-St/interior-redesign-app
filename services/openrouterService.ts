import { Message } from '../types';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const API_BASE = 'https://openrouter.ai/api/v1';

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string | { type: string; text?: string; image_url?: { url: string } }[];
};

let requestCount = 0;
let resetTime = Date.now() + 24 * 60 * 60 * 1000;

function canMakeRequest(): boolean {
  const now = Date.now();
  if (now > resetTime) {
    requestCount = 0;
    resetTime = now + 24 * 60 * 60 * 1000;
  }
  return requestCount < 45;
}

export async function getExpertAdvice(
  currentImageBase64: string,
  userQuestion: string,
  chatHistory: Message[]
): Promise<{ text: string; sources: { title: string; uri: string }[] }> {
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'sk-or-v1-your_openrouter_key_here') {
    return {
      text: "I'm an AI design consultant. To get started, add your OpenRouter API key to the .env.local file. For now, here's some general advice: consider the room's natural lighting, choose a cohesive color palette, and select furniture that fits both your style and the room's proportions.",
      sources: [],
    };
  }

  if (!canMakeRequest()) {
    return {
      text: "I've reached my daily message limit. Please try again tomorrow, or upgrade your OpenRouter plan for higher limits.",
      sources: [],
    };
  }

  requestCount++;

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are an expert interior designer. Provide helpful, encouraging advice about room design, color schemes, furniture placement, and decor. Be sophisticated, warm, and practical. Keep responses concise (under 200 words).',
    },
    ...chatHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: userQuestion,
        },
        {
          type: 'image_url',
          image_url: { url: currentImageBase64 },
        },
      ],
    },
  ];

  try {
    const response = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Lumina Interior AI',
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        messages,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      return {
        text: "I'm having trouble connecting to my knowledge base right now. Could you try asking again in a moment?",
        sources: [],
      };
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || 'No response generated.';

    return { text, sources: [] };
  } catch (error) {
    console.error('OpenRouter chat error:', error);
    return {
      text: "I encountered a connection issue. Please try your question again.",
      sources: [],
    };
  }
}
