# 🌳 Phylo Explorer - Advanced Phylogenetic Document Analysis System

A sophisticated multi-tier web application for phylogenetic analysis of document collections, featuring interactive tree visualizations, NLP-powered text analysis, and real-time geospatial mapping.

## 📊 System Architecture

The system employs a microservices architecture with three core components working in harmony:

```
┌────────────────────────────────────────────────┐
│         Frontend (Next.js/React)               │
│   Interactive Visualizations & User Interface  │
│              Port: 3000                        │
└────────────────────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────┐
│      API Gateway (Node.js/Express)             │
│    Service Orchestration & Web Scraping        │
│              Port: 4000                        │
└────────────────────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────┐
│       ML Service (Python/FastAPI)              │
│    Text Embeddings & Tree Reconstruction       │
│              Port: 8001                        │
└────────────────────────────────────────────────┘
```

## 🚀 System Components

### Frontend (Next.js/React)
- **Port**: 3000
- **Framework**: Next.js 14.2.32 with React 18.2.0
- **UI Library**: Chakra UI 2.7.1
- **Visualization**: D3.js 7.8.5, D3-Cloud, D3-Geo
- **Key Features**:
  - **Interactive Phylogenetic Tree**: Zoom, pan, and node selection with D3.js
  - **Word Cloud Visualization**: Dynamic term frequency analysis
  - **Geographic Mapping**: Real-time location data with coordinate mapping
  - **Theme River**: Temporal evolution visualization
  - **Unified State Management**: React Context API for synchronized updates
  - **Responsive Design**: Adaptive layouts for all screen sizes

### Backend Node.js (Express API Gateway)
- **Port**: 4000
- **Framework**: Express 5.1.0 with ES6 modules
- **Key Technologies**:
  - **Gradio Client**: HuggingFace Space integration
  - **Cheerio**: Web scraping and HTML parsing
  - **Wink-NLP**: Natural language processing
  - **OpenCage API**: Geocoding services
  - **Multer**: File upload handling
- **Core Responsibilities**:
  - API request orchestration
  - Web content extraction and scraping
  - Location entity recognition and geocoding
  - Service health monitoring
  - CORS and security management

### Backend Python (FastAPI ML Service)
- **Port**: 8001
- **Framework**: FastAPI with async/await
- **ML Models**: Sentence Transformers (multilingual-mpnet-base-v2)
- **Key Technologies**:
  - **NumPy/SciPy**: Scientific computing
  - **Custom NLP Pipeline**: Text preprocessing
  - **Neighbor Joining**: Tree reconstruction algorithm
- **Core Capabilities**:
  - Semantic text embedding generation
  - Distance matrix computation (Cosine/Euclidean)
  - Phylogenetic tree reconstruction
  - Batch processing optimization
  - Model caching for performance

## 📁 Project Structure

```
philo_explorer_paper/
│
├── frontend/                    # Next.js Frontend Application
│   ├── app/                    # App Router (Next.js 14)
│   │   ├── layout.jsx         # Root layout
│   │   ├── page.jsx           # Main page
│   │   └── providers.jsx      # React providers
│   ├── components/            # React components
│   │   ├── layout/           # Layout components
│   │   │   ├── Navbar.jsx
│   │   │   └── DetailsPanel.jsx
│   │   ├── visualizations/   # D3.js visualizations
│   │   │   ├── PhyloExplorer/
│   │   │   ├── WordCloudVis.jsx
│   │   │   └── ThemeRiver.jsx
│   │   └── _ui/             # Reusable UI components
│   ├── contexts/            # React contexts
│   │   └── PhyloContext.js
│   ├── public/             # Static assets
│   │   └── datasets/       # Sample datasets
│   └── package.json
│
├── backend/                    # Node.js Backend Application
│   ├── src/                   # Source code
│   │   ├── routes/           # API routes
│   │   │   └── phyloRoutes.js
│   │   └── services/         # Business logic
│   │       ├── mlService.js
│   │       ├── webSearchService.js
│   │       └── geolocationService.js
│   ├── api/                  # API endpoints
│   │   └── routes/
│   │       └── upload.routes.js
│   ├── middleware/           # Express middleware
│   ├── config/              # Configuration
│   ├── index.js            # Entry point
│   └── package.json
│
├── backend-python/            # Python ML Service
│   ├── algorithms/          # Scientific algorithms
│   │   └── neighbor_joining.py
│   ├── processing/         # Text processing
│   │   └── text_preprocessor.py
│   ├── services/          # ML services
│   │   └── embedding_service.py
│   ├── routes/           # API routes
│   │   ├── dataset_routes.py
│   │   └── evolution_routes.py
│   ├── main.py          # FastAPI application
│   └── requirements.txt
│
├── docs/                     # Documentation
│   ├── report.md           # System architecture report
│   └── diagram.mmd         # Architecture diagram
│
├── docker-compose.yml       # Docker orchestration
├── .env.example            # Environment variables template
└── README.md              # This file
```

## 🚀 Installation & Setup

### Prerequisites
- Node.js 18+ and npm 9+
- Python 3.8+
- Git
- Docker (optional, for containerized deployment)

### Quick Start

#### 1. Clone the Repository
```bash
git clone https://github.com/acauanrr/philo_explorer_paper.git
cd philo_explorer_paper
```

#### 2. Backend Node.js Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
# Backend running at http://localhost:4000
```

#### 3. Backend Python Setup
```bash
cd backend-python
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
# ML Service running at http://localhost:8001
```

#### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Frontend running at http://localhost:3000
```

#### 5. Access the Application
Open your browser at http://localhost:3000

### Docker Deployment

For production deployment using Docker:

```bash
# Build and start all services
docker-compose up -d

# Services will be available at:
# - Frontend: http://localhost:3000
# - Node.js Backend: http://localhost:4000
# - Python Backend: http://localhost:8001
```

## 📡 API Documentation

### Node.js Backend Endpoints (Port 4000)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/api/phylo/generate-tree` | POST | Generate phylogenetic tree from texts |
| `/api/phylo/search` | POST | Search and extract node information |
| `/api/phylo/health` | GET | ML service status |
| `/upload/file` | POST | Upload and process files |
| `/api/phylo/debug/config` | GET | View configuration (debug) |
| `/api/phylo/debug/services` | GET | Test service connectivity |
| `/api/phylo/debug/pipeline-test` | POST | Test complete pipeline |

### Python Backend Endpoints (Port 8001)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health with ML model status |
| `/api/v1/distancematrix` | POST | Generate distance matrix from documents |
| `/api/v1/embeddings` | POST | Generate text embeddings |
| `/api/v1/tree/reconstruct` | POST | Reconstruct phylogenetic tree |
| `/api/v1/pipeline/full` | POST | Complete pipeline execution |
| `/api/v1/evolution/analyze` | POST | Analyze term evolution |

## 🔄 Key Features

### Data Processing Pipeline
1. **Text Input** → Upload files (CSV, JSON, TXT) or paste text
2. **Preprocessing** → Clean and normalize text data
3. **Embedding Generation** → Create semantic vector representations
4. **Distance Calculation** → Compute similarity metrics
5. **Tree Reconstruction** → Build phylogenetic tree using Neighbor Joining
6. **Visualization** → Render interactive D3.js visualizations

### Interactive Visualizations
- **Phylogenetic Tree**: Explore hierarchical relationships with zoom/pan
- **Word Cloud**: Analyze term frequencies and importance
- **Geographic Map**: Visualize location-based data
- **Theme River**: Track temporal evolution of themes
- **Synchronized Selection**: Click any element to update all views

### Advanced Features
- **Named Entity Recognition (NER)**: Extract locations, people, organizations
- **Geocoding**: Convert location names to coordinates
- **Web Scraping**: Enrich nodes with external data
- **Multilingual Support**: Process documents in multiple languages
- **Real-time Updates**: Live visualization updates

## ⚙️ Configuration

### Environment Variables

#### Backend Node.js (.env)
```env
NODE_ENV=development
PORT=4000
CORS_ORIGIN=http://localhost:3000
ML_SERVICE_URL=http://localhost:8001
ML_SERVICE_HF_URL=https://your-space.hf.space
OPENCAGE_API_KEY=your_api_key_here
```

#### Backend Python (.env)
```env
ENVIRONMENT=development
PORT=8001
EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-mpnet-base-v2
CACHE_DIR=./models_cache
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_PYTHON_API_URL=http://localhost:8001
```

## 📊 Sample Datasets

The application includes several sample datasets for testing:

### CSV Files
- `bbc_news_sample.csv`: BBC news articles
- `fake_news_sample.csv`: Fake news detection dataset

### JSON Files
- `News_Category_Dataset_sample.json`: Categorized news articles

### Newick Trees
- `articles_n_25.txt`: Pre-computed tree of 25 articles
- `news.txt`: News category tree

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Check process using port
lsof -i :4000  # or :3000, :8001
# Kill process
kill -9 <PID>
```

### CORS Errors
1. Verify backend is running on correct port
2. Check environment variables
3. Restart all services

### ML Model Download Issues
The first run may take time to download ML models (~400MB). Ensure stable internet connection.

### Memory Issues
Python backend requires ~2-4GB RAM for ML models. Increase Docker memory limits if needed.

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📚 Documentation

- [System Architecture Report](docs/report.md) - Detailed technical documentation
- [Architecture Diagram](docs/diagram.mmd) - Visual system overview
- [API Documentation](#-api-documentation) - Endpoint reference

## 🛠️ Technology Stack

### Frontend
- Next.js 14.2.32
- React 18.2.0
- Chakra UI 2.7.1
- D3.js 7.8.5
- Axios 1.12.2

### Backend Node.js
- Express 5.1.0
- Gradio Client 1.19.0
- Cheerio 1.0.0
- Wink-NLP 2.4.0
- OpenCage API Client 2.0.0

### Backend Python
- FastAPI
- Sentence Transformers
- NumPy
- SciPy
- Pydantic

### DevOps
- Docker & Docker Compose
- Nginx (reverse proxy)
- Redis (caching)

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

**Acauan R. Ribeiro**
- GitHub: [@acauanrr](https://github.com/acauanrr)
- Institution: Federal University of Amazonas (UFAM)

## 🙏 Acknowledgments

- Federal University of Amazonas (UFAM)
- Graduate Program in Computer Science
- Research funded by CAPES/CNPq

## 📊 Project Status

- **Version**: 2.0.0
- **Status**: ✅ Active Development
- **Last Updated**: January 2025

## 🔗 Links

- [Live Demo](https://phylo-explorer.herokuapp.com) (when deployed)
- [Documentation](docs/)
- [Issue Tracker](https://github.com/acauanrr/philo_explorer_paper/issues)

---

<div align="center">
Made with ❤️ at UFAM
</div>