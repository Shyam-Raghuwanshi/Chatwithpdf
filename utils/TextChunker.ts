export interface TextChunk {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
  chunkIndex: number;
  metadata?: Record<string, any>;
}

export interface ChunkingOptions {
  chunkSize: number; // Size in tokens (approximately)
  overlap: number; // Overlap in tokens
  preserveParagraphs: boolean; // Try to preserve paragraph boundaries
  minChunkSize: number; // Minimum chunk size to avoid tiny chunks
}

export class TextChunker {
  private static readonly DEFAULT_OPTIONS: ChunkingOptions = {
    chunkSize: 600,
    overlap: 200,
    preserveParagraphs: true,
    minChunkSize: 100,
  };

  /**
   * Rough token estimation (1 token ≈ 4 characters for English text)
   */
  private static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Split text into manageable chunks with overlap
   */
  static chunkText(
    text: string,
    options: Partial<ChunkingOptions> = {}
  ): TextChunk[] {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const chunks: TextChunk[] = [];

    if (!text.trim()) {
      return chunks;
    }

    // Clean and normalize text
    const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // If preserveParagraphs is true, first split by paragraphs
    let segments: string[] = [];
    if (opts.preserveParagraphs) {
      segments = this.splitByParagraphs(cleanText);
    } else {
      segments = [cleanText];
    }

    let currentChunk = '';
    let currentStartIndex = 0;
    let chunkIndex = 0;

    for (const segment of segments) {
      const segmentTokens = this.estimateTokens(segment);
      const currentTokens = this.estimateTokens(currentChunk);

      // If adding this segment would exceed chunk size
      if (currentTokens + segmentTokens > opts.chunkSize && currentChunk.trim()) {
        // Save current chunk
        const chunk = this.createChunk(
          currentChunk.trim(),
          currentStartIndex,
          chunkIndex++
        );
        chunks.push(chunk);

        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk, opts.overlap);
        currentChunk = overlapText + segment;
        currentStartIndex = this.findTextIndex(cleanText, currentChunk, currentStartIndex);
      } else {
        // Add segment to current chunk
        if (currentChunk) {
          currentChunk += '\n\n' + segment;
        } else {
          currentChunk = segment;
          currentStartIndex = cleanText.indexOf(segment);
        }
      }
    }

    // Add remaining chunk if it meets minimum size
    if (currentChunk.trim() && this.estimateTokens(currentChunk) >= opts.minChunkSize) {
      const chunk = this.createChunk(
        currentChunk.trim(),
        currentStartIndex,
        chunkIndex
      );
      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Split text by paragraphs while preserving structure
   */
  private static splitByParagraphs(text: string): string[] {
    // Split by double newlines (paragraph breaks)
    const paragraphs = text.split(/\n\s*\n/);
    return paragraphs
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }

  /**
   * Get overlap text from the end of current chunk
   */
  private static getOverlapText(text: string, overlapTokens: number): string {
    const overlapChars = overlapTokens * 4; // Rough estimation
    const startIndex = Math.max(0, text.length - overlapChars);
    
    // Try to start at a sentence or word boundary
    let overlap = text.substring(startIndex);
    
    // Find the first sentence or word boundary
    const sentenceBoundary = overlap.search(/[.!?]\s+/);
    if (sentenceBoundary > 0 && sentenceBoundary < overlap.length / 2) {
      overlap = overlap.substring(sentenceBoundary + 1).trim();
    } else {
      const wordBoundary = overlap.indexOf(' ');
      if (wordBoundary > 0) {
        overlap = overlap.substring(wordBoundary + 1).trim();
      }
    }

    return overlap;
  }

  /**
   * Find the index of text chunk in the original text
   */
  private static findTextIndex(originalText: string, chunkText: string, startFrom: number): number {
    // Remove overlap and find the main content
    const lines = chunkText.split('\n');
    let searchText = lines[0];
    
    // Try to find a unique part of the chunk
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length > 20) {
        searchText = lines[i];
        break;
      }
    }

    const index = originalText.indexOf(searchText, startFrom);
    return index >= 0 ? index : startFrom;
  }

  /**
   * Create a text chunk object
   */
  private static createChunk(
    text: string,
    startIndex: number,
    chunkIndex: number,
    metadata?: Record<string, any>
  ): TextChunk {
    return {
      id: this.generateChunkId(chunkIndex),
      text,
      startIndex,
      endIndex: startIndex + text.length,
      chunkIndex,
      metadata: metadata || {},
    };
  }

  /**
   * Generate a unique ID for a chunk
   */
  private static generateChunkId(chunkIndex: number): string {
    const timestamp = Date.now();
    return `chunk_${chunkIndex}_${timestamp}`;
  }

  /**
   * Chunk text for specific document with document metadata
   */
  static chunkDocument(
    text: string,
    documentId: string,
    documentTitle: string,
    options: Partial<ChunkingOptions> = {}
  ): TextChunk[] {
    const chunks = this.chunkText(text, options);
    
    // Add document metadata to each chunk
    return chunks.map(chunk => ({
      ...chunk,
      id: `${documentId}_${chunk.chunkIndex}`,
      metadata: {
        ...chunk.metadata,
        documentId,
        documentTitle,
        totalChunks: chunks.length,
      },
    }));
  }
}

export default TextChunker;
