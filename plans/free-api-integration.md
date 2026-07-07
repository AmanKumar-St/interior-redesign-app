# Plan: Integrate Free APIs — Flux & OpenRouter for Lumina

## Objective

Replace the current paid Gemini API calls with **completely free** alternatives for both image generation (room redesign) and chat-based design advice, while handling rate limits for at least 2–3 image generations per session.

---

## Phase 0: Research Verdicts

### Image Generation (Style Makeover & Editing)

| Option | Free? | Image-to-Image? | Verdict |
|--------|-------|-----------------|---------|
| **Hugging Face Serverless + FLUX.1-dev** | ✅ Free tier (~300 req/hr, $0.10/mo credits) | ❌ Text-to-image only | Can't use directly; no native img2img |
| **HF Serverless + FLUX.1-Fill-dev** | ✅ Free tier | ✅ Inpainting (mask-based) | **BEST FREE OPTION** — can redesign rooms by masking the full image area |
| **HF Serverless + Stable Diffusion XL (img2img)** | ✅ Free tier | ✅ Native img2img | Good fallback, lower quality than Flux |
| **FLUX.1-schnell** | ✅ Apache 2.0 license | ❌ Text-to-image | Free to run locally, not via API |
| **Replicate (FLUX.1-schnell)** | ⚠️ Free tier limited | ✅ Paid for dev | Not reliable free tier |
| **NexaAPI** | ⚠️ Claims free tier | ✅ Flux Kontext | Unverified, likely limited |

**Winner: Hugging Face Inference API + FLUX.1-Fill-dev** (or FLUX.1-dev with img2img pipeline if available as warm model). If Flux models are too heavy for HF free tier, fall back to **Stable Diffusion img2img** models.

### Chat / Design Advice

| Option | Free? | Quality | Verdict |
|--------|-------|---------|---------|
| **OpenRouter free models** | ✅ 50 req/day (1,000 with $10 top-up) | Good | **BEST FREE OPTION** |
| **Hugging Face Serverless LLMs** | ✅ 300 req/hr | Decent | Good fallback |
| **OpenRouter `openrouter/free` router** | ✅ Auto-routes to best free model | Good | Simplest integration |

**Winner: OpenRouter** — OpenAI-compatible API, swap in 1 file. Use `openrouter/free` router for simplicity or `meta-llama/llama-3.3-70b-instruct:free` for consistency.

---

## Phase 1: Prerequisites & Setup

### Step 1.1 — Sign up for free API keys

| Service | Signup | Key Needed |
|---------|--------|------------|
| **Hugging Face** | https://huggingface.co/join | ✅ Create "Read" token in Settings → Access Tokens |
| **OpenRouter** | https://openrouter.ai/signup | ✅ Create key in dashboard |

No credit card required for either.

### Step 1.2 — Add keys to `.env.local`

```
# Replace existing GEMINI_API_KEY
HUGGINGFACE_API_KEY=hf_xxxxxxxxxx
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxx
```

### Step 1.3 — Update `vite.config.ts`

Add the new env vars to the `define` block so they're available at runtime:

```
'process.env.HUGGINGFACE_API_KEY': JSON.stringify(env.HUGGINGFACE_API_KEY),
'process.env.OPENROUTER_API_KEY': JSON.stringify(env.OPENROUTER_API_KEY)
```

---

## Phase 2: Image Generation — Hugging Face Inference API

### Step 2.1 — Create `services/huggingfaceService.ts`

Build a new service that replaces `services/geminiService.ts` for image generation.

**Key design decisions:**
- Use HF Serverless API endpoint: `https://api-inference.huggingface.co/models/{model_id}`
- Primary model: `black-forest-labs/FLUX.1-Fill-dev` (inpainting — redesign full image)
- Fallback model: `stabilityai/stable-diffusion-xl-base-1.0` (native img2img)
- Compress input images aggressively (256px, 0.3 quality) to save on compute credits
- Implement rate-limit handling with exponential backoff (same pattern as current geminiService)

**Functions to implement:**

```
generateStyleMakeover(imageBase64, stylePrompt) → Promise<string | null>
  - Takes room photo + style prompt
  - For FLUX.1-Fill-dev: Create a white mask covering the full image → inpaint with style prompt
  - For SDXL fallback: Use native img2img pipeline with denoising_strength ~0.85
  - Returns base64 image string

editImageWithPrompt(imageBase64, editInstruction) → Promise<string | null>
  - Takes current design + edit instruction
  - Same masking approach but with smaller area if possible
  - Returns base64 image string
```

**Rate limit strategy for 2–3 generations:**
1. Compress images to 256px before sending (already done in current code — keep this)
2. Set retry: 5 attempts with exponential backoff (15s → 22.5s → 34s → 51s → 76s)
3. Track generation count in-memory; if > 3 in 5 minutes, show user a cooldown message
4. Warm the model with a lightweight first request (text-to-image seed) before the real img2img call

```
HuggingFace API Call Flow:
  ┌─────────────┐
  │ Upload room  │
  │ photo        │
  └──────┬──────┘
         ▼
  ┌─────────────┐     ┌──────────────────┐
  │ Compress to  │────▶│ Retry with       │
  │ 256px, 0.3   │     │ exponential      │
  └──────┬──────┘     │ backoff (5 tries) │
         │            └──────────────────┘
         ▼
  ┌──────────────────────┐
  │ POST to HF Inference │
  │ API (FLUX.1-Fill-dev)│
  └──────────┬───────────┘
             │
    ┌────────▼────────┐
    │ 429? ───▶ Retry │
    │ 503? ───▶ Retry │
    │ 200? ───▶ Image │
    └─────────────────┘
```

### Step 2.2 — Test warm model availability

Before coding, verify that FLUX.1-Fill-dev responds on the HF free tier:

```bash
curl -X POST "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-Fill-dev" \
  -H "Authorization: Bearer $HF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"inputs": "test", "options": {"wait_for_model": true}}'
```

If 4xx/5xx, note the error and pre-register the fallback model. Models may need to be "warmed" (first request loads the model and takes 10–60s).

---

## Phase 3: Chat — OpenRouter Integration

### Step 3.1 — Create `services/openrouterService.ts`

Replace the Gemini-based `getExpertAdvice` with an OpenRouter-based chat service.

**Key design decisions:**
- Use OpenAI-compatible endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Use `openrouter/free` router model (auto-selects best free model)
- Include system prompt as before (expert interior designer)
- Stream responses for better UX (optional but nice)
- Keep Google Search grounding — OpenRouter doesn't support this natively; drop it or use web_search tool

**Function to implement:**

```
getExpertAdvice(imageBase64, userQuestion, chatHistory) → Promise<{text, sources}>
  - Uses openrouter/free model
  - Sends image as base64 in message content
  - Returns advice text + empty sources array (no grounding available on free tier)
```

### Step 3.2 — Handle OpenRouter rate limits

- Free tier: 50 req/day, 20 req/min
- Track request count in localStorage or in-memory
- If limit approached, warn user or degrade gracefully

---

## Phase 4: Wiring & App Changes

### Step 4.1 — Update `App.tsx`

Replace imports from `geminiService` to the new services:
- `generateStyleMakeover` → `huggingfaceService.ts`
- `editImageWithPrompt` → `huggingfaceService.ts`
- `getExpertAdvice` → `openrouterService.ts`

No UI changes needed — the existing state management and component structure stay the same.

### Step 4.2 — Remove unused code

- Keep `geminiService.ts` as a reference but detach it from `App.tsx`
- Update footer text from "Powered by Gemini 3.0 & 2.5" to "Powered by Flux & OpenRouter"

---

## Phase 5: Verification

### Step 5.1 — Test image generation flow
1. Start app: `npm run dev`
2. Upload a room photo
3. Apply a style (Mid-Century Modern, etc.)
4. Verify image returns within 60 seconds (allowing for model cold start)
5. Verify slider comparison works

### Step 5.2 — Test edit flow
1. After a style is applied, send an edit: "Make the rug blue"
2. Verify image updates

### Step 5.3 — Test chat flow
1. With a current image, ask: "What do you think of this design?"
2. Verify response comes back from OpenRouter

### Step 5.4 — Test rate limit resilience
1. Apply 3 different styles in quick succession
2. Verify all 3 succeed or graceful degradation on the 4th

---

## Dependency Graph

```
Step 1.1 (Sign up for keys)
  └── Step 1.2 (Add to .env.local)
        └── Step 1.3 (Update vite.config)
              ├── Step 2.1 (HF service)
              │     └── Step 4.1 (Wire into App.tsx)
              └── Step 3.1 (OpenRouter service)
                    └── Step 4.1 (Wire into App.tsx)

Steps 2.1 and 3.1 can run in parallel (no shared file dependencies).

Step 4.2 (Cleanup) and 4.3 (Footer text) can run anytime after 4.1.

Verification (Step 5.x) runs last.
```

---

## Anti-Patterns to Avoid

1. **Sending full-resolution images to HF API** — Always compress to 256px. Flux is a 12B param model and large images will exhaust free credits quickly.
2. **Calling image API on every keystroke** — Only call when user explicitly clicks "Apply Style" or sends an edit message.
3. **No in-memory generation counter** — Without tracking, you'll hit 429s silently. Track count in a ref.
4. **Expecting OpenRouter Google Search grounding** — Free tier doesn't support this. Remove the source citation feature or make it optional.
5. **Hardcoding model IDs** — HF's available "warm" models change. Store model ID in a constant that can be swapped without code changes.

---

## Rollback Strategy

| Step | Rollback |
|------|----------|
| 1.2–1.3 | Restore original `.env.local` and `vite.config.ts` from git |
| 2.1 | Delete `huggingfaceService.ts`, restore `geminiService.ts` imports in `App.tsx` |
| 3.1 | Delete `openrouterService.ts`, restore `geminiService.ts` imports in `App.tsx` |
| 4.1 | `git checkout -- App.tsx` |

---

## Summary

| Component | Before (Gemini Paid) | After (Free) | Rate Limit |
|-----------|---------------------|-------------|------------|
| Style makeover | `gemini-2.5-flash-image` | `FLUX.1-Fill-dev` via HF | ~300 req/hr |
| Image editing | `gemini-2.5-flash-image` | `FLUX.1-Fill-dev` via HF | ~300 req/hr |
| Design advice | `gemini-3-pro-preview` | OpenRouter free router | 50 req/day |
| Cost | Pay-per-token | $0 (within limits) | — |

**Estimated effort:** 2–3 hours of implementation work.
**Max free image generations:** 10+ per hour (HF limit), well above the 2–3 requirement.
