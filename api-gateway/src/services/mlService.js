import { client } from '@gradio/client';

class MLService {
  constructor() {
    // Environment-based configuration
    // Use local Python backend in development
    this.useLocal = process.env.NODE_ENV === 'development';
    this.localUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8001';
    this.hfUrl = process.env.ML_SERVICE_HF_URL || 'https://acauanrr-phylo-ml-service.hf.space';
    this.hfSpaceId = 'acauanrr/phylo-ml-service';

    // Debug environment configuration
    console.log('🔧 MLService Configuration:');
    console.log('   NODE_ENV:', process.env.NODE_ENV);
    console.log('   useLocal:', this.useLocal);
    console.log('   localUrl:', this.localUrl);
    console.log('   hfUrl:', this.hfUrl);
  }

  /**
   * Generate phylogenetic tree from texts using ML service
   * @param {Array} texts - Array of text strings
   * @param {Array} labels - Array of labels for the texts
   * @returns {Object} Tree data with newick format
   */
  async generateTree(texts, labels = []) {
    console.log('🚀 generateTree called with:', { texts, labels, useLocal: this.useLocal, NODE_ENV: process.env.NODE_ENV });
    try {
      let result;

      if (this.useLocal) {
        // For local development, use the full pipeline endpoint
        console.log('🔍 Attempting to connect to local ML service at:', this.localUrl);
        console.log('📋 NODE_ENV:', process.env.NODE_ENV);
        console.log('🏠 useLocal:', this.useLocal);
        try {
          const axios = (await import('axios')).default;
          console.log('📤 Sending request to local Full Pipeline API...');

          // Prepare documents for the full pipeline API
          const documents = texts.map((text, index) => ({
            id: labels[index] || `doc${index + 1}`,
            content: text
          }));

          // Call the full pipeline endpoint that includes NJ tree reconstruction
          const response = await axios.post(
            `${this.localUrl}/api/v1/pipeline/full`,
            {
              documents,
              preprocess: true,
              distance_metric: 'cosine',
              algorithm: 'neighbor_joining'
            },
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 60000 // Increase timeout for full pipeline
            }
          );

          // Process full pipeline response
          const pipelineResponse = response.data;
          console.log('Full pipeline response received');

          result = {
            status: 'success',
            newick: pipelineResponse.newick,
            tree_structure: pipelineResponse.tree_structure,
            num_texts: texts.length,
            num_labels: labels.length,
            enhanced_labels: pipelineResponse.labels,
            distance_matrix: pipelineResponse.distance_matrix,
            statistics: pipelineResponse.statistics,
            model_used: pipelineResponse.statistics?.embedding_model
          };
        } catch (localError) {
          console.log('Local Flask API failed:', localError.message);
          throw localError;
        }
      } else {
        // For production, use Gradio client to connect to HuggingFace Space
        console.log('🔍 Connecting to HuggingFace Space via Gradio client...');

        const app = await client(this.hfSpaceId);

        // Format inputs as JSON strings as expected by the Gradio interface
        const textsJson = JSON.stringify(texts);
        const labelsJson = JSON.stringify(labels || []);

        // Call the /generate-tree endpoint
        console.log('📤 Sending request to HuggingFace Space via Gradio...');
        const response = await app.predict("/generate-tree", [textsJson, labelsJson]);

        console.log('Gradio response received:', response);

        // Parse the Gradio response
        if (response && response.data && response.data[0]) {
          const gradioOutput = response.data[0];
          console.log('Gradio output (first 500 chars):', gradioOutput.substring(0, 500));

          // Extract Newick tree from the text output
          const newickMatch = gradioOutput.match(/🌳 Enhanced Newick Tree:\s*\n(.+?)(\n|$)/);
          if (newickMatch) {
            const newick = newickMatch[1].trim();
            console.log('✅ Extracted Newick tree:', newick);

            // Extract other information
            const numTextsMatch = gradioOutput.match(/Number of texts: (\d+)/);
            const numLabelsMatch = gradioOutput.match(/Number of labels: (\d+)/);

            result = {
              status: 'success',
              newick: newick,
              num_texts: numTextsMatch ? parseInt(numTextsMatch[1]) : texts.length,
              num_labels: numLabelsMatch ? parseInt(numLabelsMatch[1]) : labels.length,
              enhanced_labels: labels,
              statistics: { algorithm: 'neighbor_joining_scikit_bio', num_taxa: texts.length }
            };
          } else {
            // If we can't parse the output, return it for debugging
            console.log('❌ Could not extract Newick tree from Gradio output');
            result = {
              status: 'success',
              newick: '(fallback);',
              raw_output: gradioOutput,
              num_texts: texts.length,
              num_labels: labels.length
            };
          }
        } else {
          throw new Error('Invalid response from Gradio client');
        }
      }

      return result;
    } catch (error) {
      console.error('ML Service Error:', error.message);
      throw new Error(`ML Service Error: ${error.message}. ${this.useLocal ? 'Local ML service' : 'HuggingFace Space'} required for phylogenetic reconstruction.`);
    }
  }

  /**
   * Search using ML service
   * @param {String} query - Search query
   * @returns {Object} Search results
   */
  async search(query) {
    try {
      if (this.useLocal) {
        // For local development, use direct Flask API
        const axios = (await import('axios')).default;
        const response = await axios.post(
          `${this.localUrl}/api/search`,
          { query },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
          }
        );
        return response.data;
      } else {
        // For production, use Gradio client
        const app = await client(this.hfSpaceId);
        const response = await app.predict("/search_node", [query]);

        // Parse the JSON response from Gradio
        if (response && response.data && response.data[0]) {
          return JSON.parse(response.data[0]);
        } else {
          throw new Error('Invalid search response from Gradio client');
        }
      }
    } catch (error) {
      console.error('ML Search Error:', error.message);
      throw new Error(`ML Search Error: ${error.message}`);
    }
  }

  /**
   * Health check for ML service
   * @returns {Object} Health status
   */
  async healthCheck() {
    try {
      if (this.useLocal) {
        // For local development, use direct Flask API
        const axios = (await import('axios')).default;
        const response = await axios.get(`${this.localUrl}/health`, { timeout: 5000 });
        return response.data;
      } else {
        // For HuggingFace Space, check if we can connect to Gradio client
        const app = await client(this.hfSpaceId);
        return {
          status: 'healthy',
          service: 'phylo-ml-service',
          mode: 'huggingface-space'
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

}

export default new MLService();