import { HfInference } from '@huggingface/inference';

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY || '';

const MODELS = {
  IMG2IMG: 'stabilityai/stable-diffusion-xl-base-1.0',
  TXT2IMG_PRIMARY: 'black-forest-labs/FLUX.1-schnell',
  TXT2IMG_FALLBACK: 'runwayml/stable-diffusion-v1-5',
};

let generationCount = 0;
const MAX_GENERATIONS = 5;
const RESET_INTERVAL = 5 * 60 * 1000;
setInterval(() => { generationCount = 0; }, RESET_INTERVAL);

let hf: HfInference | null = null;
function getClient(): HfInference | null {
  if (!HF_API_KEY || HF_API_KEY === 'hf_your_huggingface_token_here') return null;
  if (!hf) hf = new HfInference(HF_API_KEY);
  return hf;
}

const compressImage = (base64Str: string, maxWidth = 256, quality = 0.3): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
      }
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
  });
};

function base64ToBlob(base64: string): Blob {
  const byteString = atob(base64.split(',')[1]);
  const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  return new Blob([ab], { type: mimeString });
}

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  retries = 3,
  delay = 10000
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const isRetryable =
      error?.status === 429 ||
      error?.message?.includes('429') ||
      error?.message?.includes('Too Many Requests') ||
      error?.status === 503 ||
      error?.status === 500;

    if (retries > 0 && isRetryable) {
      console.warn(`HF API error. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(r => setTimeout(r, delay));
      return retryWithBackoff(operation, retries - 1, delay * 1.5);
    }
    throw error;
  }
}

async function tryImg2Img(
  imageBase64: string,
  prompt: string
): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const imageBlob = base64ToBlob(imageBase64);
    const result = await retryWithBackoff(() =>
      client.imageToImage({
        model: MODELS.IMG2IMG,
        inputs: imageBlob,
        parameters: {
          prompt,
          negative_prompt: 'low quality, blurry, distorted, ugly',
          guidance_scale: 7.5,
          strength: 0.85,
        },
      })
    );

    const url = URL.createObjectURL(result);
    const response = await fetch(url);
    const blob = await response.blob();
    URL.revokeObjectURL(url);

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('img2img failed, falling back to text-to-image:', error);
    return null;
  }
}

async function tryTextToImage(prompt: string, model?: string): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const result = await retryWithBackoff(() =>
      client.textToImage({
        model: model || MODELS.TXT2IMG_PRIMARY,
        inputs: prompt,
        parameters: model === MODELS.TXT2IMG_PRIMARY
          ? { num_inference_steps: 4 }
          : { negative_prompt: 'low quality, blurry', guidance_scale: 7.5 },
      })
    );

    const url = URL.createObjectURL(result);
    const response = await fetch(url);
    const blob = await response.blob();
    URL.revokeObjectURL(url);

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('text-to-image failed:', error);
    return null;
  }
}

export async function generateStyleMakeover(
  originalImageBase64: string,
  stylePrompt: string
): Promise<string | null> {
  if (generationCount >= MAX_GENERATIONS) {
    console.warn('Generation limit reached for this session');
    return null;
  }
  generationCount++;

  const compressed = await compressImage(originalImageBase64);

  const roomContextPrompt = `Interior design of a room in ${stylePrompt}. Professional photography, well-lit, beautiful composition, high quality, 4K.`;
  const roomEditPrompt = `Redesign this room in ${stylePrompt}. Keep the same room layout and architecture. Professional interior design photography, well-lit, high quality.`;

  const img2img = await tryImg2Img(compressed, roomEditPrompt);
  if (img2img) return img2img;

  return await tryTextToImage(roomContextPrompt);
}

export async function editImageWithPrompt(
  currentImageBase64: string,
  userPrompt: string
): Promise<string | null> {
  if (generationCount >= MAX_GENERATIONS) {
    console.warn('Generation limit reached for this session');
    return null;
  }
  generationCount++;

  const compressed = await compressImage(currentImageBase64);

  const editPrompt = `Edit this interior design: ${userPrompt}. Keep the rest of the room exactly the same. Professional interior photography, high quality.`;

  const img2img = await tryImg2Img(compressed, editPrompt);
  if (img2img) return img2img;

  return await tryTextToImage(editPrompt);
}
