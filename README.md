# OS-Agent

Daily Astrology OS is a React + Vite desktop-style app that turns a date into a practical daily operating system using tropical astrology, somatic psychology, behavior design, and shadow-work prompts.

## What it does

- Generates a daily guide backed by a real OpenAI model
- Falls back to local deterministic logic if the API is unavailable
- Saves generated readings in a local history panel
- Lets you copy the full guide as plain text

## Run locally

1. Install dependencies

```bash
npm install
```

2. Set your OpenAI API key

```bash
OPENAI_API_KEY=your_key_here
```

3. Start the app

```bash
npm run dev
```

## Deploy

This project is ready for Vercel deployment. Make sure `OPENAI_API_KEY` is set in the Vercel project environment variables.

## Notes

- The app uses the Responses API with structured JSON output on the server side.
- The browser never receives the OpenAI API key.
