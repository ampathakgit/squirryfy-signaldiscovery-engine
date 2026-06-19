import { GoogleGenerativeAI } from "@google/generative-ai";
import { BaseLLMProvider } from './BaseLLMProvider';
import { LLMPart, AnalysisOptions } from './types';

export class GeminiProvider extends BaseLLMProvider {
  readonly name = 'gemini';
  readonly modelName: string;
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string, modelName: string = "gemini-2.5-flash") {
    super();
    this.modelName = modelName;
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
      }
    });
  }

  async generateContent(parts: LLMPart[], options?: AnalysisOptions): Promise<string> {
    const geminiParts = parts.map(p => {
      if (p.text) return { text: p.text };
      if (p.inlineData) return { inlineData: p.inlineData };
      return p;
    });

    try {
      const result = await this.generateWithRetry(geminiParts, options?.requestId);
      return await this.cleanAndParseResponse(result);
    } catch (error) {
      console.error(`[GeminiProvider] Generation failed:`, error);
      throw error;
    }
  }

  private async generateWithRetry(parts: any[], requestId?: string, retries = 3, delay = 2000): Promise<string> {
    for (let i = 0; i < retries; i++) {
      try {
        const result = await this.model.generateContent(parts);
        const response = await result.response;
        return response.text();
      } catch (error: any) {
        if ((error.message?.includes('429') || error.message?.includes('503')) && i < retries - 1) {
          console.log(`[GeminiProvider] Rate Limit/Server Error. Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
        throw error;
      }
    }
    throw new Error('Max retries exceeded');
  }

  protected override postProcessResponse(text: string): string {
    return text.trim();
  }
}
