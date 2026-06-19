import { LLMProvider } from './types';
import { GeminiProvider } from './GeminiProvider';

async function getLatestFlashModel(apiKey: string): Promise<string> {
  const defaultModel = 'gemini-2.5-flash';
  if (!apiKey) return defaultModel;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) return defaultModel;
    
    const data = await response.json();
    if (!data.models || !Array.isArray(data.models)) return defaultModel;
    
    const flashModels = data.models
      .map((m: any) => m.name.replace('models/', ''))
      .filter((name: string) => 
        name.startsWith('gemini-') && 
        name.endsWith('-flash') && 
        !name.includes('experimental') && 
        !name.includes('tuning')
      );
      
    if (flashModels.length === 0) return defaultModel;
    
    // Sort models so that the highest version comes first (e.g. gemini-2.5-flash, gemini-1.5-flash)
    flashModels.sort((a: string, b: string) => b.localeCompare(a));
    
    console.log(`[LLMFactory] Dynamically resolved latest Gemini flash model: ${flashModels[0]}`);
    return flashModels[0];
  } catch (e) {
    console.warn('[LLMFactory] Failed to fetch latest Gemini models list, using default fallback:', e);
    return defaultModel;
  }
}

export class LLMFactory {
  static async getProvider(): Promise<LLMProvider> {
    const providerName = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();
    
    switch (providerName) {
      case 'gemini':
        const apiKey = process.env.GEMINI_API_KEY || '';
        if (!apiKey) {
          console.warn('[LLMFactory] WARNING: GEMINI_API_KEY is not defined in environment variables.');
        }
        
        let modelName = process.env.DEFAULT_GEMINI_MODEL;
        if (!modelName) {
          modelName = await getLatestFlashModel(apiKey);
        }
        
        return new GeminiProvider(apiKey, modelName);
      default:
        throw new Error(`Unsupported LLM provider: ${providerName}`);
    }
  }
}
