# Lumina - AI-Powered Interior Design

Lumina is an AI-powered interior design web application that allows users to seamlessly transform their living spaces with the power of generative AI. By uploading a photo of a room, users can apply various design styles, receive intelligent suggestions, and edit the room using an interactive AI design consultant.

## Features

- 📸 **Room Photo Upload**: Seamlessly upload photos of your room to get started.
- 🎨 **Style Transformation**: Choose from various curated interior design styles to instantly reimagine your space.
- 💬 **AI Design Consultant (Chat Interface)**: An integrated chat assistant that acts as a professional interior designer. You can:
  - Ask for design advice based on your current room photo.
  - Request direct edits to the image (e.g., "paint the walls blue", "add a plant", "change the rug").
- 🔍 **Interactive Comparison**: A built-in before/after slider allows you to visually compare your original room with the AI-generated design.
- 📥 **Export & Download**: Export your newly designed room in full resolution or save it directly to your device.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: TailwindCSS
- **AI Integration**: 
  - **Hugging Face Inference API**: Powers the image-to-image and text-to-image generation (using models like Stable Diffusion XL and FLUX.1).
  - **OpenRouter API**: Powers the intelligent chat assistant providing expert design advice and context-aware responses (using OpenRouter free models).

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm, yarn, or pnpm
- API Keys for Hugging Face and OpenRouter

### Installation

1. **Navigate into the project directory**:
   ```bash
   cd interior-redesign-app
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```
   Open `.env.local` and add your API keys:
   - `HUGGINGFACE_API_KEY`: Get a free read token at [Hugging Face](https://huggingface.co/settings/tokens)
   - `OPENROUTER_API_KEY`: Sign up and get a key at [OpenRouter](https://openrouter.ai/signup)

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   The app will typically be available at `http://localhost:5173/` or another local port.

## How It Works

1. **Upload**: Users start by uploading an image of an interior space.
2. **Transform**: The app uses Hugging Face's Image-to-Image models (like Stable Diffusion XL) to apply a selected style prompt, generating a new version of the room while maintaining its original layout and architecture. If image-to-image fails, it falls back to text-to-image models.
3. **Refine**: Users can type instructions in the chat interface. If the message contains action words (e.g., "make", "add", "remove"), the app triggers an image edit. Otherwise, it queries OpenRouter to provide contextual expert advice based on the image and chat history.

## License

This project is open-source and free to use for personal projects.
