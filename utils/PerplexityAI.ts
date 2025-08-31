/**
 * Perplexity AI Service for Document Q&A
 * 
 * This service uses Perplexity AI to generate intelligent responses
 * based on document context, reducing dependency on VoyageAI embeddings
 * for answer generation.
 */

export interface PerplexityConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
  timeout: number;
}

export interface ChatContext {
  documentTitle?: string;
  documentContent?: string;
  relevantChunks?: Array<{
    text: string;
    score?: number;
  }>;
  chatHistory?: Array<{
    question: string;
    answer: string;
  }>;
}

export interface PerplexityResponse {
  success: boolean;
  response?: string;
  error?: string;
  tokensUsed?: number;
  model?: string;
}

export class PerplexityAI {
  private config: PerplexityConfig;

  constructor(config: Partial<PerplexityConfig> = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.EXPO_PUBLIC_PERPLEXITY_API_KEY || "",
      apiUrl: config.apiUrl || "https://api.perplexity.ai/chat/completions",
      model: config.model || "sonar-pro",
      timeout: config.timeout || 30000,
    };

    if (!this.config.apiKey) {
      console.warn('Perplexity API key not configured. Please set EXPO_PUBLIC_PERPLEXITY_API_KEY');
    }
  }

  /**
   * Generate an answer based on document context and user question
   */
  async generateAnswer(
    question: string,
    context: ChatContext = {}
  ): Promise<PerplexityResponse> {
    if (!this.config.apiKey) {
      return {
        success: false,
        error: "Perplexity API key not configured"
      };
    }

    try {
      const prompt = this.buildPrompt(question, context);
      
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: "system",
              content: "You are an expert document analyst and AI assistant. You help users understand and analyze documents by providing accurate, relevant, and insightful answers based on the provided context. Always cite specific parts of the document when possible and be concise but comprehensive."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
          top_p: 0.9
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Perplexity API error: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
      }

      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content;

      if (!aiResponse) {
        throw new Error("No response from Perplexity AI");
      }

      return {
        success: true,
        response: aiResponse.trim(),
        tokensUsed: data.usage?.total_tokens || 0,
        model: data.model || this.config.model
      };

    } catch (error: any) {
      console.error('Perplexity AI error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  /**
   * Build an effective prompt for document Q&A
   */
  private buildPrompt(question: string, context: ChatContext): string {
    let prompt = `Question: ${question}\n\n`;

    // Add document context if available
    if (context.documentTitle) {
      prompt += `Document: ${context.documentTitle}\n\n`;
    }

    // Add relevant chunks or full content
    if (context.relevantChunks && context.relevantChunks.length > 0) {
      prompt += "Relevant Content:\n";
      context.relevantChunks.forEach((chunk, index) => {
        prompt += `[Section ${index + 1}]${chunk.score ? ` (Relevance: ${(chunk.score * 100).toFixed(1)}%)` : ''}\n${chunk.text}\n\n`;
      });
    } else if (context.documentContent) {
      // If no specific chunks, use truncated full content
      const truncatedContent = context.documentContent.length > 4000 
        ? context.documentContent.substring(0, 4000) + "...\n[Content truncated]"
        : context.documentContent;
      prompt += `Document Content:\n${truncatedContent}\n\n`;
    }

    // Add chat history for context
    if (context.chatHistory && context.chatHistory.length > 0) {
      prompt += "Previous Conversation:\n";
      context.chatHistory.slice(-3).forEach((chat, index) => {
        prompt += `Q${index + 1}: ${chat.question}\nA${index + 1}: ${chat.answer}\n\n`;
      });
    }

    prompt += `Instructions:
1. Answer the question based on the provided document content
2. If the answer is not in the document, clearly state that
3. Cite specific sections or quotes when possible
4. Be concise but comprehensive
5. If multiple interpretations are possible, mention them
6. Format your response clearly with sections if needed

Answer:`;

    return prompt;
  }

  /**
   * Test the Perplexity AI connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.generateAnswer(
        "What is the purpose of this test?",
        {
          documentContent: "This is a test document to verify the AI connection is working properly."
        }
      );
      return result.success;
    } catch (error) {
      console.error('Perplexity connection test failed:', error);
      return false;
    }
  }

  /**
   * Generate document summary
   */
  async generateDocumentSummary(
    documentTitle: string,
    documentContent: string,
    maxLength: 'short' | 'medium' | 'long' = 'medium'
  ): Promise<PerplexityResponse> {
    const lengthInstructions = {
      short: "Provide a concise 2-3 sentence summary",
      medium: "Provide a comprehensive paragraph summary (4-6 sentences)",
      long: "Provide a detailed summary with key points and main themes (8-10 sentences)"
    };

    const prompt = `Document Title: ${documentTitle}

Document Content:
${documentContent.length > 6000 ? documentContent.substring(0, 6000) + "...\n[Content truncated]" : documentContent}

Instructions: ${lengthInstructions[maxLength]}. Focus on the main themes, key points, and important information. Structure the summary logically.

Summary:`;

    try {
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: "system",
              content: "You are an expert document summarizer. Create clear, accurate, and insightful summaries that capture the essence and key information of documents."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.5,
          max_tokens: maxLength === 'short' ? 150 : maxLength === 'medium' ? 300 : 500
        })
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.status}`);
      }

      const data = await response.json();
      const summary = data.choices?.[0]?.message?.content;

      if (!summary) {
        throw new Error("No summary generated");
      }

      return {
        success: true,
        response: summary.trim(),
        tokensUsed: data.usage?.total_tokens || 0,
        model: data.model || this.config.model
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to generate summary'
      };
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PerplexityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration (excluding sensitive data)
   */
  getConfig(): Omit<PerplexityConfig, 'apiKey'> {
    const { apiKey, ...safeConfig } = this.config;
    return safeConfig;
  }
}

export default PerplexityAI;
