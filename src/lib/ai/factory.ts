import { LLMProvider } from './types';
import { GeminiProvider } from './GeminiProvider';

export class LLMFactory {
  static getProvider(): LLMProvider {
    const providerName = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();
    
    switch (providerName) {
      case 'gemini':
        const apiKey = process.env.GEMINI_API_KEY || '';
        const modelName = process.env.DEFAULT_GEMINI_MODEL || 'gemini-2.0-flash';
        if (!apiKey) {
          console.warn('[LLMFactory] WARNING: GEMINI_API_KEY is not defined in environment variables.');
        }
        return new GeminiProvider(apiKey, modelName);
      default:
        throw new Error(`Unsupported LLM provider: ${providerName}`);
    }
  }
}
