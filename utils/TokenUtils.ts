/**
 * Token utilities for chat applications
 * Provides helpers for token estimation, validation, and cost calculation
 */

export interface DetailedTokenUsage {
  total: number;
  input: number;
  output: number;
  estimated?: boolean;
}

export interface TokenStats {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  averageTokensPerChat: number;
  estimatedCost?: number;
}

export class TokenUtils {
  // Rough estimation: 1 token ≈ 4 characters for English text
  private static readonly CHARS_PER_TOKEN = 4;
  
  // Typical token costs (in USD per 1K tokens) - update based on your provider
  private static readonly TOKEN_COSTS = {
    input: 0.0005,   // $0.50 per 1M input tokens (typical)
    output: 0.0015,  // $1.50 per 1M output tokens (typical)
  };

  /**
   * Estimate tokens from text length
   */
  static estimateTokens(text: string): number {
    return Math.ceil(text.length / this.CHARS_PER_TOKEN);
  }

  /**
   * Estimate input and output tokens for a chat interaction
   */
  static estimateChatTokens(
    userMessage: string,
    context: string = '',
    expectedResponseLength: number = 150
  ): DetailedTokenUsage {
    const inputTokens = this.estimateTokens(userMessage + context);
    const outputTokens = expectedResponseLength;
    
    return {
      total: inputTokens + outputTokens,
      input: inputTokens,
      output: outputTokens,
      estimated: true,
    };
  }

  /**
   * Create detailed token usage from API response
   */
  static createDetailedUsage(
    totalTokens: number,
    inputTokens?: number,
    outputTokens?: number
  ): DetailedTokenUsage {
    // If we have detailed breakdown, use it
    if (inputTokens !== undefined && outputTokens !== undefined) {
      return {
        total: totalTokens,
        input: inputTokens,
        output: outputTokens,
        estimated: false,
      };
    }
    
    // If we only have total, estimate the breakdown
    // Typically, input is 70% and output is 30% of total tokens
    const estimatedInput = Math.floor(totalTokens * 0.7);
    const estimatedOutput = totalTokens - estimatedInput;
    
    return {
      total: totalTokens,
      input: estimatedInput,
      output: estimatedOutput,
      estimated: true,
    };
  }

  /**
   * Calculate estimated cost for token usage
   */
  static calculateCost(tokenUsage: DetailedTokenUsage): number {
    const inputCost = (tokenUsage.input / 1000) * this.TOKEN_COSTS.input;
    const outputCost = (tokenUsage.output / 1000) * this.TOKEN_COSTS.output;
    return inputCost + outputCost;
  }

  /**
   * Calculate user's token statistics
   */
  static calculateTokenStats(
    totalTokens: number,
    inputTokens: number = 0,
    outputTokens: number = 0,
    totalChats: number = 1
  ): TokenStats {
    const averageTokensPerChat = totalChats > 0 ? Math.round(totalTokens / totalChats) : 0;
    const estimatedCost = this.calculateCost({
      total: totalTokens,
      input: inputTokens || Math.floor(totalTokens * 0.7),
      output: outputTokens || Math.floor(totalTokens * 0.3),
    });

    return {
      totalTokens,
      inputTokens,
      outputTokens,
      averageTokensPerChat,
      estimatedCost,
    };
  }

  /**
   * Validate token usage data consistency
   */
  static validateTokenUsage(
    totalTokens: number,
    inputTokens?: number,
    outputTokens?: number
  ): { isValid: boolean; error?: string } {
    if (totalTokens < 0) {
      return { isValid: false, error: 'Total tokens cannot be negative' };
    }

    if (inputTokens !== undefined && inputTokens < 0) {
      return { isValid: false, error: 'Input tokens cannot be negative' };
    }

    if (outputTokens !== undefined && outputTokens < 0) {
      return { isValid: false, error: 'Output tokens cannot be negative' };
    }

    if (inputTokens !== undefined && outputTokens !== undefined) {
      const sum = inputTokens + outputTokens;
      if (Math.abs(sum - totalTokens) > 5) { // Allow small rounding differences
        return { 
          isValid: false, 
          error: `Input tokens (${inputTokens}) + Output tokens (${outputTokens}) = ${sum} does not match total tokens (${totalTokens})` 
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Format token usage for display
   */
  static formatTokenUsage(tokenUsage: DetailedTokenUsage): string {
    const { total, input, output, estimated } = tokenUsage;
    const estimatedTag = estimated ? ' (estimated)' : '';
    return `${total} tokens${estimatedTag} (${input} input + ${output} output)`;
  }

  /**
   * Check if user is approaching token limit
   */
  static checkTokenLimit(
    currentUsage: number,
    limit: number,
    warningThreshold: number = 0.8
  ): { isNearLimit: boolean; percentUsed: number; remainingTokens: number } {
    const percentUsed = currentUsage / limit;
    const remainingTokens = Math.max(0, limit - currentUsage);
    
    return {
      isNearLimit: percentUsed >= warningThreshold,
      percentUsed: Math.round(percentUsed * 100) / 100,
      remainingTokens,
    };
  }
}

export default TokenUtils;
