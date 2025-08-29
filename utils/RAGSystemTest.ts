import RAGService from '../utils/RAGService';
import { getConfig, validateConfig } from '../utils/Config';

/**
 * Integration test for the RAG system
 * Run this to verify your setup is working correctly
 */

export class RAGSystemTest {
  private ragService: RAGService | null = null;
  private testUserId = 'test-user-123';
  private testResults: Array<{ test: string; status: 'pass' | 'fail'; message: string }> = [];

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting RAG System Integration Tests...\n');

    try {
      await this.testConfiguration();
      await this.testServiceInitialization();
      await this.testEmbeddingService();
      await this.testVectorDatabase();
      await this.testTextChunking();
      await this.testSystemStatus();
      
      this.printResults();
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    }
  }

  private async testConfiguration(): Promise<void> {
    console.log('1️⃣ Testing Configuration...');
    
    try {
      const config = getConfig();
      const validation = validateConfig(config);
      
      if (validation.isValid) {
        this.addResult('Configuration Validation', 'pass', 'All configuration values are valid');
      } else {
        this.addResult('Configuration Validation', 'fail', `Config errors: ${validation.errors.join(', ')}`);
      }
    } catch (error: any) {
      this.addResult('Configuration Validation', 'fail', error.message);
    }
  }

  private async testServiceInitialization(): Promise<void> {
    console.log('2️⃣ Testing Service Initialization...');
    
    try {
      const config = getConfig();
      this.ragService = new RAGService(config);
      await this.ragService.initialize();
      
      this.addResult('Service Initialization', 'pass', 'RAG service initialized successfully');
    } catch (error: any) {
      this.addResult('Service Initialization', 'fail', error.message);
    }
  }

  private async testEmbeddingService(): Promise<void> {
    console.log('3️⃣ Testing Embedding Service...');
    
    if (!this.ragService) {
      this.addResult('Embedding Service', 'fail', 'RAG service not initialized');
      return;
    }

    try {
      // Test with a simple text
      const testText = 'This is a test document for embedding generation.';
      
      // Note: This is a simplified test. In the actual implementation,
      // you would access the embedding service through the RAG service
      // For now, we'll test the system status which includes embedding service status
      
      const status = await this.ragService.getSystemStatus();
      
      if (status.embeddingService) {
        this.addResult('Embedding Service', 'pass', 'VoyageAI embedding service is accessible');
      } else {
        this.addResult('Embedding Service', 'fail', 'VoyageAI embedding service is not accessible');
      }
    } catch (error: any) {
      this.addResult('Embedding Service', 'fail', error.message);
    }
  }

  private async testVectorDatabase(): Promise<void> {
    console.log('4️⃣ Testing Vector Database...');
    
    if (!this.ragService) {
      this.addResult('Vector Database', 'fail', 'RAG service not initialized');
      return;
    }

    try {
      const status = await this.ragService.getSystemStatus();
      
      if (status.vectorDatabase) {
        this.addResult('Vector Database', 'pass', 'Qdrant vector database is accessible');
        
        if (status.collections.includes('document_embeddings')) {
          this.addResult('Vector Database Collections', 'pass', 'Required collections exist');
        } else {
          this.addResult('Vector Database Collections', 'pass', 'Collections will be created on first use');
        }
      } else {
        this.addResult('Vector Database', 'fail', 'Qdrant vector database is not accessible');
      }
    } catch (error: any) {
      this.addResult('Vector Database', 'fail', error.message);
    }
  }

  private async testTextChunking(): Promise<void> {
    console.log('5️⃣ Testing Text Chunking...');
    
    try {
      // Import the TextChunker directly for testing
      const { TextChunker } = await import('../utils/TextChunker');
      
      const testText = `
        This is a test document with multiple paragraphs.
        
        The first paragraph contains some basic information about the document.
        It should be chunked appropriately based on the configured parameters.
        
        The second paragraph continues with more detailed information.
        This text will help us verify that the chunking algorithm works correctly.
        
        Finally, the third paragraph concludes the document.
        All chunks should maintain proper overlap and context.
      `.trim();

      const chunks = TextChunker.chunkDocument(
        testText,
        'test-doc-id',
        'Test Document'
      );

      if (chunks.length > 0) {
        this.addResult('Text Chunking', 'pass', `Generated ${chunks.length} chunks successfully`);
        
        // Verify chunk properties
        const hasValidChunks = chunks.every(chunk => 
          chunk.id && chunk.text && chunk.metadata && chunk.metadata.documentId
        );
        
        if (hasValidChunks) {
          this.addResult('Chunk Validation', 'pass', 'All chunks have required properties');
        } else {
          this.addResult('Chunk Validation', 'fail', 'Some chunks are missing required properties');
        }
      } else {
        this.addResult('Text Chunking', 'fail', 'No chunks generated from test text');
      }
    } catch (error: any) {
      this.addResult('Text Chunking', 'fail', error.message);
    }
  }

  private async testSystemStatus(): Promise<void> {
    console.log('6️⃣ Testing Overall System Status...');
    
    if (!this.ragService) {
      this.addResult('System Status', 'fail', 'RAG service not initialized');
      return;
    }

    try {
      const status = await this.ragService.getSystemStatus();
      
      const allServicesUp = status.embeddingService && status.vectorDatabase;
      
      if (allServicesUp) {
        this.addResult('System Status', 'pass', 'All services are operational');
      } else {
        const failedServices = [];
        if (!status.embeddingService) failedServices.push('Embedding Service');
        if (!status.vectorDatabase) failedServices.push('Vector Database');
        
        this.addResult('System Status', 'fail', `Failed services: ${failedServices.join(', ')}`);
      }
    } catch (error: any) {
      this.addResult('System Status', 'fail', error.message);
    }
  }

  private addResult(test: string, status: 'pass' | 'fail', message: string): void {
    this.testResults.push({ test, status, message });
    const emoji = status === 'pass' ? '✅' : '❌';
    console.log(`   ${emoji} ${test}: ${message}`);
  }

  private printResults(): void {
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    const passed = this.testResults.filter(r => r.status === 'pass').length;
    const failed = this.testResults.filter(r => r.status === 'fail').length;
    const total = this.testResults.length;
    
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);
    
    if (failed > 0) {
      console.log('\n🔧 Failed Tests:');
      this.testResults
        .filter(r => r.status === 'fail')
        .forEach(result => {
          console.log(`   • ${result.test}: ${result.message}`);
        });
        
      console.log('\n💡 Next Steps:');
      console.log('   1. Check your API keys and endpoints in utils/Config.ts');
      console.log('   2. Verify network connectivity to all services');
      console.log('   3. Ensure Appwrite database collections are created');
      console.log('   4. Check the RAG_SETUP.md guide for detailed setup instructions');
    } else {
      console.log('\n🎉 All tests passed! Your RAG system is ready to use.');
      console.log('\n🚀 You can now:');
      console.log('   1. Upload PDF documents through the PdfScreen');
      console.log('   2. Chat with your documents using the ChatScreen');
      console.log('   3. View chat history and manage documents');
    }
  }
}

/**
 * Simple test runner function
 * Call this from your app to test the RAG system
 */
export async function testRAGSystem(): Promise<void> {
  const tester = new RAGSystemTest();
  await tester.runAllTests();
}

export default RAGSystemTest;
