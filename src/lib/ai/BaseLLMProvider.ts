import { LLMPart, LLMProvider, AnalysisOptions } from './types';

export abstract class BaseLLMProvider implements LLMProvider {
  abstract readonly name: string;
  abstract readonly modelName: string;

  abstract generateContent(parts: LLMPart[], options?: AnalysisOptions): Promise<string>;

  protected async cleanAndParseResponse(text: string): Promise<string> {
    let cleaned = this.extractJSON(text);
    if (!cleaned) return text;

    cleaned = this.repairJSON(cleaned);
    cleaned = this.postProcessResponse(cleaned);

    return cleaned;
  }

  protected postProcessResponse(text: string): string {
    return text;
  }

  protected extractJSON(text: string): string | null {
    const codeBlockMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      return codeBlockMatch[1];
    }

    let braceCount = 0;
    let startIndex = -1;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        if (braceCount === 0) startIndex = i;
        braceCount++;
      } else if (text[i] === '}') {
        braceCount--;
        if (braceCount === 0 && startIndex !== -1) {
          return text.substring(startIndex, i + 1);
        }
      }
    }
    return null;
  }

  protected repairJSON(jsonString: string): string {
    let patched = jsonString;

    // Fix Unquoted Keys
    patched = patched.replace(/([a-zA-Z0-9_]+)\s*:/g, (match, key) => {
      if (key === 'http' || key === 'https') return match;
      return `"${key}": `;
    });

    // Replace Single Quotes with Double Quotes for structure
    patched = patched.replace(/'([a-zA-Z0-9_]+)'\s*:/g, '"$1":');
    patched = patched.replace(/:\s*'([^']*)'/g, ': "$1"');

    // Fix Unescaped Quotes
    patched = patched.replace(/(?<!\\)(?<![\{\[\,]\s*)(?<!:\s*)"(?!\s*[:])(?!\s*[,}\]])/g, '\\"');

    // Insert Missing Commas
    patched = patched.replace(/([\}\]"\]])\s*([\{\[\"])/g, '$1, $2');

    // Remove Trailing Commas
    patched = patched.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

    // Escape Newlines inside strings
    let fixed = '';
    let inString = false;
    for (let i = 0; i < patched.length; i++) {
      const char = patched[i];
      if (char === '"' && (i === 0 || patched[i - 1] !== '\\')) {
        inString = !inString;
      }

      if (inString) {
        if (char === '\n') fixed += '\\n';
        else if (char === '\r') { }
        else if (char === '\t') fixed += '\\t';
        else fixed += char;
      } else {
        fixed += char;
      }
    }

    return fixed;
  }
}
