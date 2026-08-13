/**
 * Appwrite Configuration for React Native/Expo
 *
 * This file contains hardcoded Appwrite configuration values.
 */

import {
    createAppwriteConfig,
    validateAppwriteConfig as validateConfig,
} from "@naat-collection/shared";

/**
 * Static JSON fallback URLs (jsDelivr CDN)
 * These are used when Appwrite rate limits or payment limits are exceeded.
 * Run `node scripts/export-naats-to-json.js` to generate the exports,
 * commit them to the repo, and update the URLs below.
 */
export const STATIC_FALLBACK_URLS = {
  NAATS: process.env.EXPO_PUBLIC_STATIC_NAATS_URL ||
    'https://cdn.jsdelivr.net/gh/sahilhasnain/naat-production@main/static-exports/naats-export.json',
  CHANNELS: process.env.EXPO_PUBLIC_STATIC_CHANNELS_URL ||
    'https://cdn.jsdelivr.net/gh/sahilhasnain/naat-production@main/static-exports/channels-export.json',
};

// Hardcoded configuration values
const env = {
  APPWRITE_ENDPOINT: "https://sgp.cloud.appwrite.io/v1",
  APPWRITE_PROJECT_ID: "69cdf520001137b0e951",
  APPWRITE_DATABASE_ID: "69cdf9f4000f8532e829",
  APPWRITE_NAATS_COLLECTION_ID: "69cdf9f4003a2c23b94a",
  APPWRITE_CHANNELS_COLLECTION_ID: "channels",
  APPWRITE_AUDIO_CACHE_COLLECTION_ID: "695e43b700281bb0cc99",
  AUDIO_EXTRACTION_FUNCTION_URL: "",
  AUDIO_STREAMING_FUNCTION_URL: "",
  RAPIDAPI_KEY: "",
  SEMANTIC_SEARCH_FUNCTION_URL: "https://69a8e9000021d2eaafd9.sgp.appwrite.run",
  APPWRITE_VIEW_INCREMENT_FUNCTION_URL: "",
};

console.log("[DEBUG] Appwrite Config Env:", {
  semanticSearchUrl: env.SEMANTIC_SEARCH_FUNCTION_URL,
  hasSemanticSearch: !!env.SEMANTIC_SEARCH_FUNCTION_URL,
});

export const appwriteConfig = createAppwriteConfig(env);

console.log("[DEBUG] Created Appwrite Config:", {
  semanticSearchFunctionUrl: appwriteConfig.semanticSearchFunctionUrl,
  hasSemanticSearch: !!appwriteConfig.semanticSearchFunctionUrl,
});

/**
 * Validates that all required Appwrite configuration values are present
 * @throws Error if any required configuration is missing
 */
export function validateAppwriteConfig(): void {
  validateConfig(appwriteConfig);
}
