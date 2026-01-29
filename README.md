# Tri-Model Voter Chat

A production-lean MVP that compares GPT, Gemini, and Claude answers, lets each model score all three responses, aggregates the scores, and keeps only the winning answer in the conversation context.

![Demo](./public/Screenshot.png)

Compare GPT vs Gemini vs Claude, then let them judge each other.

## What this app does
- Collects API keys locally in your browser (localStorage only).
- Generates three candidate answers in parallel (GPT, Gemini, Claude).
- Each model judges all three answers with a strict JSON scoring rubric.
- Aggregates scores, applies tie-breakers, and selects a winner.
- Only the winning answer is appended to the chat history for the next turn.
- Shows full transparency: all candidate answers and judge score table.

## Privacy and key handling
- Keys are stored **only in your browser** via `localStorage`.
- Keys are sent to the server **only for the current request**.
- The server does not persist keys or log prompts/keys.

## Local development
```bash
npm install
npm run dev
```
Then open `http://localhost:3000`.

## Deployment
- Recommended: Vercel.
- No server-side API keys are required.
- Ensure Node 18+ on your deployment target.

## Environment variables
Only defaults for app metadata (optional). No provider keys are required.
See `.env.example`.

## Tests
```bash
npm run test
```

## Screenshots
- Add screenshots here.

## Known limitations
- Latency and cost depend on three generations + three judgments per turn.
- No streaming of the winning answer in this MVP.
- In-memory rate limiting resets on server restarts.
