
export type InteriorStyle = {
  id: string;
  name: string;
  description: string;
  prompt: string;
  icon: string;
};

export type Message = {
  role: 'user' | 'assistant';
  content: string;
  isImageEdit?: boolean;
  timestamp: number;
};

export type DesignState = {
  originalImage: string | null;
  currentImage: string | null;
  history: string[]; // Base64 images
  messages: Message[];
  selectedStyleId: string;
  isProcessing: boolean;
  statusMessage: string;
};
