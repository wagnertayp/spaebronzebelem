import OpenAI from "openai";

const customApiKey = process.env.OPENAI_API_KEY;
const managedApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const apiKey = customApiKey ?? managedApiKey;
const baseURL = customApiKey
  ? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"
  : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

if (!baseURL) {
  throw new Error(
    "An OpenAI base URL is required. Set OPENAI_API_KEY for the direct OpenAI API or provision the Replit OpenAI integration.",
  );
}

if (!apiKey) {
  throw new Error(
    "An OpenAI API key is required. Set OPENAI_API_KEY or provision the Replit OpenAI integration.",
  );
}

export const openai = new OpenAI({
  apiKey,
  baseURL,
  timeout: 14_000,
  maxRetries: 0,
});
