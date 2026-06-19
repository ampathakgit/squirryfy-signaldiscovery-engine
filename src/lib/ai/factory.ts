import { LLMProvider } from './types';
import { GeminiProvider } from './GeminiProvider';

async function getLatestFlashModel(apiKey: string): Promise<string | null> {
  if (!apiKey) return null;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.models || !Array.isArray(data.models)) return null;
    
    const flashModels = data.models
      .map((m: any) => m.name.replace('models/', ''))
      .filter((name: string) => 
        name.startsWith('gemini-') && 
        name.endsWith('-flash') && 
        !name.includes('experimental') && 
        !name.includes('tuning')
      );
      
    if (flashModels.length === 0) return null;
    
    // Sort models so that the highest version comes first (e.g. gemini-2.5-flash, gemini-1.5-flash)
    flashModels.sort((a: string, b: string) => {
      const getVersionKey = (name: string): number[] => {
        const match = name.match(/gemini-(\d+(?:\.\d+)*)-flash/);
        return match ? match[1].split('.').map(Number) : [0];
      };
      
      const keyA = getVersionKey(a);
      const keyB = getVersionKey(b);
      
      for (let i = 0; i < Math.max(keyA.length, keyB.length); i++) {
        const valA = keyA[i] || 0;
        const valB = keyB[i] || 0;
        if (valA !== valB) {
          return valB - valA;
        }
      }
      return 0;
    });
    
    console.log(`[LLMFactory] Dynamically resolved latest Gemini flash model: ${flashModels[0]}`);
    return flashModels[0];
  } catch (e) {
    console.warn('[LLMFactory] Failed to fetch latest Gemini models list:', e);
    return null;
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
        
        // 1. First choice: Try dynamic discovery
        let modelName = await getLatestFlashModel(apiKey);
        
        if (!modelName) {
          // 2. Second choice: Fallback to environment variable
          modelName = process.env.DEFAULT_GEMINI_MODEL || '';
          if (modelName) {
            console.log(`[LLMFactory] Dynamic lookup failed. Using environment variable fallback: ${modelName}`);
          }
        }
        
        if (!modelName) {
          // 3. Third choice: Fallback to hardcoded safe baseline
          modelName = 'gemini-2.5-flash';
          console.log(`[LLMFactory] Dynamic and env lookups failed. Using hardcoded safe baseline: ${modelName}`);
        }
        
        return new GeminiProvider(apiKey, modelName);
      default:
        throw new Error(`Unsupported LLM provider: ${providerName}`);
    }
  }
}
