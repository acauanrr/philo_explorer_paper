# Phylo Explorer - Phylogenetic Tree Analysis System

## 📊 Overview

Phylo Explorer is a comprehensive web application for visualizing and analyzing phylogenetic trees with quality metrics. It enables researchers to compare datasets, analyze missing neighbors, and evaluate projection quality through interactive visualizations.

## 🚀 Features

### Core Functionality
- **Dataset Configuration Wizard**: Step-by-step interface for loading T1 and T2 datasets
- **Phylogenetic Tree Visualization**: D3.js-based tree rendering with neighbor-joining algorithm
- **Quality Analysis**: Comprehensive metrics for projection quality assessment
- **Dataset Comparison**: Visual comparison between T1 and T2 datasets with change detection

### Visualization Tabs
1. **Data Input**: Configure and load datasets with validation
2. **Neighborhood Preservation**: JDK/SDK neighborhood preservation metrics on the NJ tree, enhanced with Voronoi overlays, word cloud insights, and a Theme River timeline
3. **Quality Inspector**: Interactive tree visualization with quality metrics
4. **Aggregated Errors**: Statistical analysis of projection errors
5. **Missing Neighbors**: Analysis of missing neighbor relationships between datasets
6. **Compare Projections**: Side-by-side comparison of different projection methods

## 🏗️ Architecture

### Frontend Structure (Cleaned & Optimized)
```
frontend/
├── app/                        # Next.js app directory
│   ├── layout.jsx             # Root layout with providers
│   ├── page.jsx               # Main application page
│   └── providers.jsx          # Chakra UI provider setup
├── components/
│   ├── dataset/
│   │   └── DatasetSelector.jsx    # Dataset loading wizard
│   ├── layout/
│   │   └── AppHeader.jsx          # Application header
│   ├── navigation/
│   │   └── MainNavigation.jsx     # Tab navigation system
│   └── quality/
│       └── QualityInspectorTreeNJ.jsx  # Tree quality inspector
├── src/
│   ├── components/quality/
│   │   ├── AggregatedErrorTreeView.jsx    # Error aggregation view
│   │   ├── CompareProjectionsTreeView.jsx # Projection comparison
│   │   ├── MissingNeighborsTreeView.jsx   # Missing neighbors analysis
│   │   ├── NeighborhoodPreservationTreeView.jsx # JDK/SDK neighborhood metrics
│   │   └── shepard.ts                     # Shepard diagram utilities
│   ├── context/
│   │   └── PhyloContext.jsx    # Global state management
│   └── utils/
│       ├── treeRenderer.js     # Shared D3 radial tree renderer
│       ├── treeUtils.js        # Backend pipeline & tree utilities
│       └── incrementalTreeUtils.js  # Incremental tree construction
└── public/
    ├── datasets/               # Sample datasets (e.g., Climate Change News T1/T2)
    └── vis/tree-of-life/      # D3.js tree visualization library
```

### Backend Services

The system uses a microservices architecture:

- **API Gateway** (Port 4000): Routes requests to appropriate services
- **Backend Python** (Port 8001): Handles phylogenetic tree generation and ML operations
- **Frontend** (Port 3000): Next.js React application

## 🛠️ Installation

### Prerequisites
- Node.js 18+
- Python 3.8+
- npm or yarn

### Setup Instructions

1. **Clone the repository**
```bash
git clone [repository-url]
cd phylo_explorer_project/philo_explorer_paper/frontend
```

2. **Install frontend dependencies**
```bash
npm install
```

3. **Setup Python backend**
```bash
cd ../backend-python
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

4. **Setup API Gateway**
```bash
cd ../api-gateway
npm install
```

## 🚀 Running the Application

### Start all services:

1. **Backend Python Service**
```bash
cd backend-python
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

2. **API Gateway**
```bash
cd api-gateway
PORT=4000 npm run dev
```

3. **Frontend**
```bash
cd frontend
npm run dev
```

Access the application at: `http://localhost:3000`

## 📁 Data Format

### Dataset Structure
Datasets should be JSON files with the following structure:
```json
[
  {
    "id": "unique-identifier",
    "title": "Article Title",
    "content": "Article content text...",
    "metadata": {}
  }
]
```

### Sample Datasets
- `T1_news_dataset_full.json`: 200 news articles (baseline)
- `T2_news_dataset_full.json`: 210 news articles (includes 10 additional)

### Supported Formats
- JSON datasets in `/public/datasets/json/`
- Newick format trees in `/public/datasets/newicks/`
- CSV data in `/public/datasets/csv/`

## 🔧 Configuration

### Environment Variables
Create a `.env.local` file in the frontend directory:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_BACKEND_URL=http://localhost:8001
```

### Key Technologies
- **Frontend**: Next.js 13+, React 18, Chakra UI, D3.js
- **Backend**: FastAPI, NumPy, SciPy, scikit-learn
- **API Gateway**: Express.js, Axios
- **Visualization**: D3.js, Observable HQ Tree of Life

## 📊 Quality Metrics

The system calculates various quality metrics:
- **Stress**: Measures preservation of distances in projection
- **Trustworthiness**: Local neighborhood preservation
- **Missing Neighbors**: Identifies lost connections between datasets
- **Structural Similarity**: Tree topology comparison
- **Incremental Changes**: Tracks additions, removals, and modifications

## 🧪 Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Project Structure Philosophy
- **Modular Components**: Each visualization tab is self-contained
- **Centralized State**: PhyloContext manages global application state
- **Efficient Tree Generation**: Trees generated once and reused across views
- **Progressive Enhancement**: Graceful degradation for large datasets
- **Clean Architecture**: Removed unused files, optimized imports

## 📈 Performance Considerations

- **Dataset Size**: Optimized for datasets with 200-500 nodes
- **Tree Generation**: Uses neighbor-joining algorithm with O(n³) complexity
- **Visualization**: D3.js with efficient DOM updates
- **Caching**: Tree structures cached to avoid recomputation
- **Incremental Updates**: Efficient handling of dataset differences

## 🎨 UI/UX Features

- **Step-by-Step Wizard**: Guided dataset configuration
- **Real-time Feedback**: Loading states and progress indicators
- **Interactive Trees**: Zoom, pan, and node selection
- **Color Coding**: Visual distinction for added/removed/modified nodes
- **Responsive Design**: Adapts to different screen sizes

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 Recent Updates

- **Project Cleanup**: Removed unused Phase 3 implementations and duplicate components
- **Architecture Optimization**: Streamlined component structure
- **Documentation Update**: Comprehensive README with current structure
- **Bug Fixes**: Fixed dataset loading and tree generation issues

## 🐛 Known Issues

- Large datasets (>1000 nodes) may experience performance degradation
- WebGL rendering fallback to Canvas 2D for older browsers
- Tree layout may require manual adjustment for optimal viewing

## 📚 References

- [D3.js Tree of Life](https://observablehq.com/@d3/tree-of-life)
- [Neighbor-Joining Algorithm](https://en.wikipedia.org/wiki/Neighbor_joining)
- [Chakra UI Documentation](https://chakra-ui.com/)
- [Next.js Documentation](https://nextjs.org/docs)

## 👥 Team

- Research team at UFAM (Federal University of Amazonas)
- Phylogenetic analysis and visualization specialists

## 💬 Support

For issues, questions, or suggestions, please open an issue on the GitHub repository.

---

**Note**: This is an active research project. Features and APIs may change as the project evolves.

**Last Updated**: September 2024
