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

  protected convertSingleToDoubleQuotes(jsonString: string): string {
    const singleQuoteRegex = /'((?:\\.|[^\\'\n])*)'/g;
    return jsonString.replace(singleQuoteRegex, (match, content) => {
      let escapedContent = '';
      let backslashCount = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (char === '\\') {
          backslashCount++;
          escapedContent += char;
        } else if (char === '"') {
          if (backslashCount % 2 === 0) {
            escapedContent += '\\"';
          } else {
            escapedContent += char;
          }
          backslashCount = 0;
        } else {
          if (char === "'" && backslashCount % 2 === 1) {
            escapedContent = escapedContent.slice(0, -1) + "'";
          } else {
            escapedContent += char;
          }
          backslashCount = 0;
        }
      }
      return `"${escapedContent}"`;
    });
  }

  protected repairJSON(jsonString: string): string {
    let patched = jsonString;

    // Convert single quoted strings to double quoted strings first
    patched = this.convertSingleToDoubleQuotes(patched);

    // Fix Unquoted Keys
    patched = patched.replace(/([a-zA-Z0-9_]+)\s*:/g, (match, key) => {
      if (key === 'http' || key === 'https') return match;
      return `"${key}": `;
    });

    // Escape unescaped quotes character-by-character with container tracking
    let fixedStr = '';
    let inString = false;
    let lastStructural = '{';
    const containerStack: string[] = [];
    
    for (let i = 0; i < patched.length; i++) {
      const char = patched[i];
      if (!inString) {
        if (char === '{' || char === '[') {
          containerStack.push(char);
          lastStructural = char;
        } else if (char === '}' || char === ']') {
          containerStack.pop();
          lastStructural = char;
        } else if (char === ':' || char === ',') {
          lastStructural = char;
        }
        
        if (char === '"') {
          inString = true;
          fixedStr += char;
        } else {
          fixedStr += char;
        }
      } else {
        if (char === '"') {
          // Check if escaped
          let isEscaped = false;
          if (i > 0 && patched[i - 1] === '\\') {
            let backslashCount = 0;
            let j = i - 1;
            while (j >= 0 && patched[j] === '\\') {
              backslashCount++;
              j--;
            }
            if (backslashCount % 2 === 1) {
              isEscaped = true;
            }
          }
          
          if (isEscaped) {
            fixedStr += char;
          } else {
            // Check if this is the closing quote
            let isClosing = false;
            let j = i + 1;
            while (j < patched.length && /\s/.test(patched[j])) {
              j++;
            }
            
            const currentContainer = containerStack[containerStack.length - 1] || '{';
            
            if (currentContainer === '[') {
              // Inside an array
              if (j < patched.length && (patched[j] === ',' || patched[j] === ']')) {
                isClosing = true;
              } else if (j === patched.length) {
                isClosing = true;
              }
            } else {
              // Inside an object
              if (lastStructural === '{' || lastStructural === ',') {
                // Expecting key closing quote
                if (j < patched.length && patched[j] === ':') {
                  isClosing = true;
                }
              } else {
                // Expecting value closing quote
                if (j < patched.length && (patched[j] === ',' || patched[j] === '}')) {
                  isClosing = true;
                } else if (j === patched.length) {
                  isClosing = true;
                }
              }
            }
            
            if (isClosing) {
              inString = false;
              fixedStr += char;
            } else {
              // Unescaped quote -> escape it
              fixedStr += '\\"';
            }
          }
        } else {
          fixedStr += char;
        }
      }
    }
    patched = fixedStr;

    // Insert Missing Commas
    patched = patched.replace(/([\}\]"\]])\s*([\{\[\"])/g, '$1, $2');

    // Remove Trailing Commas
    patched = patched.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

    // Escape Newlines inside strings
    let fixed = '';
    inString = false;
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
