import OpenAI from "openai";

const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

if (!apiKey || !baseURL) {
  throw new Error(
    "The managed OpenAI integration requires AI_INTEGRATIONS_OPENAI_API_KEY and AI_INTEGRATIONS_OPENAI_BASE_URL.",
  );
}

export const managedOpenai = new OpenAI({
  apiKey,
  baseURL,
  timeout: 14_000,
  maxRetries: 0,
});
