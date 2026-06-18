export interface AnalysisOptions {
  requestId?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string; // base64
  };
}

export interface LLMProvider {
  readonly name: string;
  readonly modelName: string;
  generateContent(parts: LLMPart[], options?: AnalysisOptions): Promise<string>;
}
