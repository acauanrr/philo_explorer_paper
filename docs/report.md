# Phylo Explorer System Architecture Report

## Executive Summary

Phylo Explorer is a sophisticated multi-tier web application designed for phylogenetic tree analysis and visualization. The system employs a microservices architecture with three primary components: a Next.js frontend for interactive data visualization, a Node.js/Express backend for API orchestration and web scraping, and a Python/FastAPI backend specialized in machine learning operations and natural language processing.

## System Components Overview

### 1. Frontend (Next.js/React)

**Purpose**: Interactive user interface for phylogenetic tree visualization and analysis.

**Key Technologies**:
- **Framework**: Next.js 14.2.32 with React 18.2.0
- **UI Components**: Chakra UI 2.7.1 for responsive design
- **Data Visualization**: D3.js 7.8.5 for advanced data visualizations
- **State Management**: React Context API (PhyloContext)
- **HTTP Client**: Axios for API communication
- **Styling**: Emotion, Styled Components, Framer Motion for animations

**Core Functionalities**:
- **Phylogenetic Tree Visualization**: Interactive tree explorer with zoom, pan, and node selection capabilities
- **Word Cloud Visualization**: Dynamic word clouds showing term frequencies and relationships
- **Geographic Visualization**: Map-based location data rendering
- **Theme River Visualization**: Temporal data flow visualization
- **File Upload System**: Support for multiple data formats (CSV, TXT, Newick)
- **Responsive Layout**: Adaptive design with collapsible panels and fullscreen mode
- **Real-time Data Updates**: Dynamic content updates based on node selection and search results

**Architecture Patterns**:
- Component-based architecture with reusable UI components
- Context-based state management for global application state
- Responsive grid layout system with breakpoint-aware rendering
- Client-side routing with Next.js App Router

### 2. Backend Node.js (Express)

**Purpose**: Primary API gateway, web scraping service, and business logic orchestration.

**Key Technologies**:
- **Framework**: Express 5.1.0 with ES6 modules
- **ML Integration**: Gradio Client for HuggingFace Space communication
- **Web Scraping**: Cheerio for HTML parsing
- **NLP**: Wink-NLP for text processing
- **Geocoding**: OpenCage API for location services
- **Security**: Helmet for HTTP headers, CORS for cross-origin requests
- **File Processing**: Multer for file uploads, Papa Parse for CSV processing

**Core Functionalities**:
- **API Gateway**: Routes requests between frontend and various backend services
- **Phylogenetic Tree Generation**: Coordinates with ML service for tree construction
- **Web Search Integration**: Performs web scraping and content extraction
- **Location Services**:
  - Named Entity Recognition (NER) for location extraction
  - Geocoding via OpenCage API
  - Fallback location detection patterns
- **File Upload Processing**: Handles multipart form data and file validation
- **Service Health Monitoring**: Health check endpoints for all integrated services
- **CORS Management**: Dynamic origin validation based on environment

**API Endpoints**:
- `POST /api/phylo/generate-tree`: Generate phylogenetic trees from text data
- `POST /api/phylo/search`: Search and extract information about nodes
- `GET /api/phylo/health`: ML service health status
- `POST /upload/*`: File upload endpoints
- Debug endpoints for service monitoring and pipeline testing

**External Service Integration**:
- HuggingFace Spaces (ML Service)
- OpenCage Geocoding API
- Web scraping targets

### 3. Backend Python (FastAPI)

**Purpose**: Machine learning operations, text embedding generation, and scientific computing.

**Key Technologies**:
- **Framework**: FastAPI with async/await support
- **ML Models**: Sentence Transformers (paraphrase-multilingual-mpnet-base-v2)
- **Scientific Computing**: NumPy, SciPy for numerical operations
- **Text Processing**: Custom preprocessing pipeline
- **Algorithm Implementation**: Neighbor Joining for phylogenetic reconstruction

**Core Functionalities**:
- **Text Embedding Generation**:
  - Multilingual support via transformer models
  - Batch processing with configurable batch sizes
  - Model caching for performance optimization
- **Distance Matrix Computation**:
  - Cosine similarity calculations
  - Euclidean distance metrics
  - Optimized matrix operations using NumPy
- **Phylogenetic Tree Reconstruction**:
  - Neighbor Joining algorithm implementation
  - UPGMA algorithm support
  - Newick format generation
- **Text Preprocessing Pipeline**:
  - HTML tag removal
  - Whitespace normalization
  - Stopword removal (language-specific)
  - Optional stemming and lemmatization
- **Dataset Management**:
  - Synthetic data generation for testing
  - Term evolution analysis
  - Time-series data processing

**API Endpoints**:
- `GET /health`: Service health check with ML model status
- `POST /api/v1/distancematrix`: Generate distance matrices from documents
- `POST /api/v1/embeddings`: Generate text embeddings
- `POST /api/v1/tree/reconstruct`: Reconstruct phylogenetic trees
- `POST /api/v1/pipeline/full`: Complete pipeline from texts to tree
- `GET /api/v1/datasets/*`: Dataset retrieval and management
- `POST /api/v1/evolution/analyze`: Term evolution analysis

**ML Model Management**:
- Lifespan context manager for model initialization
- Model caching in `./models_cache` directory
- Graceful degradation when models unavailable

## System Integration and Data Flow

### 1. Request Flow Architecture

```
User Interface (Frontend)
    ↓ HTTP/HTTPS
API Gateway (Node.js Backend)
    ↓ Internal API Calls
    ├→ ML Service (Python Backend) - For embeddings and NLP
    ├→ Web Scraping Service - For external data
    └→ Geocoding Service - For location data
```

### 2. Data Processing Pipeline

**Text to Phylogenetic Tree Pipeline**:
1. **Data Input**: User uploads file or inputs text via frontend
2. **Preprocessing**: Node.js backend validates and formats data
3. **Embedding Generation**: Python backend creates semantic embeddings
4. **Distance Calculation**: Python backend computes distance matrix
5. **Tree Reconstruction**: Neighbor Joining algorithm builds tree structure
6. **Visualization**: Frontend renders interactive tree using D3.js

**Search and Information Extraction Pipeline**:
1. **Query Input**: User selects node or enters search query
2. **Web Search**: Node.js backend performs web scraping
3. **NER Processing**: ML service extracts entities (locations, dates)
4. **Geocoding**: Location names converted to coordinates
5. **Result Aggregation**: Combined data returned to frontend
6. **Visualization Update**: Multiple visualizations updated simultaneously

### 3. Inter-Service Communication

**Frontend ↔ Node.js Backend**:
- Protocol: HTTP/HTTPS with JSON payloads
- Authentication: JWT tokens (when configured)
- CORS: Configurable origins based on environment
- Error Handling: Standardized error response format

**Node.js Backend ↔ Python Backend**:
- Protocol: HTTP REST API
- Service Discovery: Environment-based URL configuration
- Timeout Management: 30-second timeout for ML operations
- Fallback Mechanisms: Graceful degradation when service unavailable

**Node.js Backend ↔ External Services**:
- HuggingFace Spaces: Gradio client integration
- OpenCage API: Rate-limited geocoding requests
- Web Scraping: Axios with retry logic

## Deployment Architecture

### 1. Docker Containerization

The system uses Docker Compose for orchestration with the following services:

**Core Services**:
- **frontend**: Next.js application (Port 3000)
- **backend**: Node.js/Express API (Port 4000)
- **backend-python**: FastAPI ML service (Port 8001)

**Supporting Services**:
- **nginx**: Reverse proxy and load balancer (Ports 80/443)
- **redis**: Caching layer for async tasks (Port 6379)

**Resource Allocation**:
- Python Backend: 2-4GB memory reservation for ML models
- Model Cache: Persistent volume for ML model storage
- Health Checks: All services include health monitoring

### 2. Environment Configuration

**Development Environment**:
- Hot reloading enabled for all services
- Verbose logging for debugging
- CORS allows all origins
- Local service URLs

**Production Environment**:
- Optimized builds with minification
- Restricted CORS origins
- SSL/TLS termination at nginx
- Environment-specific API URLs
- Resource limits enforced

### 3. Scaling Considerations

**Horizontal Scaling**:
- Frontend: Stateless, easily scalable behind load balancer
- Node.js Backend: Stateless API, supports multiple instances
- Python Backend: Model caching requires shared storage

**Vertical Scaling**:
- Python Backend: Memory-intensive due to ML models
- Recommended: 4GB+ RAM for production

## Security Architecture

### 1. Network Security
- CORS policy enforcement
- Helmet.js security headers
- Rate limiting on API endpoints
- Input validation and sanitization

### 2. Data Security
- Environment variable management
- Secure API key storage
- HTTPS enforcement in production
- XSS protection via React

### 3. Service Isolation
- Docker network isolation
- Internal service communication
- External access only through nginx

## Performance Optimizations

### 1. Frontend Optimizations
- Code splitting with Next.js
- Lazy loading of visualizations
- React component memoization
- Responsive image loading

### 2. Backend Optimizations
- Connection pooling
- Response caching with Redis
- Batch processing for embeddings
- Asynchronous request handling

### 3. ML Service Optimizations
- Model caching and preloading
- Batch embedding generation
- NumPy vectorized operations
- Memory-efficient data structures

## Key Workflows

### 1. File Upload and Processing
1. User selects file in frontend
2. Multipart upload to Node.js backend
3. File validation and parsing
4. Data forwarding to Python backend
5. Processing and tree generation
6. Results returned to frontend

### 2. Real-time Search
1. User enters search query
2. Parallel execution of:
   - Web scraping
   - NER extraction
   - Geocoding
3. Result aggregation
4. Frontend visualization update

### 3. Cross-Visualization Interaction
1. User selects node in tree
2. Context update triggers:
   - Word cloud regeneration
   - Timeline highlighting
   - Map marker updates
3. Unified selection state management

## Monitoring and Observability

### 1. Health Checks
- Service-level health endpoints
- Docker health check configurations
- Dependency status monitoring

### 2. Logging
- Morgan for HTTP request logging
- Structured logging in Python
- Environment-based log levels

### 3. Debug Endpoints
- `/api/phylo/debug/config`: Configuration verification
- `/api/phylo/debug/services`: Service connectivity testing
- `/api/phylo/debug/pipeline-test`: End-to-end pipeline testing

## Conclusion

The Phylo Explorer system represents a sophisticated integration of modern web technologies, machine learning capabilities, and scientific computing. Its microservices architecture ensures scalability, maintainability, and clear separation of concerns. The system successfully combines real-time data processing, interactive visualizations, and advanced NLP capabilities to provide a comprehensive platform for phylogenetic analysis.

Key strengths include:
- Modular architecture enabling independent service scaling
- Robust error handling and fallback mechanisms
- Comprehensive API design with clear service boundaries
- Performance optimizations at multiple levels
- Flexible deployment options via Docker

The architecture supports future enhancements such as:
- Additional ML models and algorithms
- Extended visualization capabilities
- Real-time collaboration features
- Advanced caching strategies
- Distributed processing capabilities