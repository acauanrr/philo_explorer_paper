# Phylo-Explorer Frontend - version: 1

Interactive web interface for visualizing phylogenetic trees, word clouds, and temporal patterns in document collections.

## Live Demo

https://phylo-explorer-front-5c59fee5d5c4.herokuapp.com/

## Features

- **Interactive Phylogenetic Tree Visualization** - D3.js-powered tree explorer with node selection and zoom
- **Geographic Location Mapping** - Automatic location extraction with interactive world map visualization
- **Semantic Search Integration** - Enhanced search with Wikipedia and web source enrichment
- **Word Cloud Generation** - Visual representation of term frequencies
- **Timeline Visualization** - Track document changes over time
- **Real-time Information Retrieval** - Dynamic content fetching with location geocoding
- **Responsive Design** - Mobile and desktop optimized
- **Full-screen Mode** - Focus view for detailed analysis
- **CSV File Upload** - Easy data import interface

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

Create `.env.local` file:

```
NEXT_PUBLIC_API_URL=http://localhost:6001
NEXT_PUBLIC_APP_NAME=Phylo Explorer
NEXT_PUBLIC_APP_VERSION=1.0.0
```

For production deployment:
```
NEXT_PUBLIC_API_URL=https://phylo-explorer-api-v2-2fcb24032c89.herokuapp.com
```

## Project Structure

```
phylo-explorer-front/
├── app/                  # Next.js 13 app directory
│   ├── layout.jsx       # Root layout
│   ├── page.jsx         # Main page
│   └── providers.jsx    # Context providers
├── components/
│   ├── _ui/             # Reusable UI components
│   ├── layout/          # Layout components
│   └── visualizations/  # D3.js visualizations
├── contexts/            # React contexts
└── public/              # Static assets
```

## Key Components

### Visualizations

- **PhyloExplorer** - Interactive phylogenetic tree using D3.js with node selection and real-time details
- **LocationMap** - Interactive world map with geographic markers using D3.js and OpenStreetMap data
- **WordCloudVis** - Dynamic word cloud visualization
- **TimeVis** - Timeline chart for temporal data
- **ThemeRiver** - Temporal flow visualization for document themes

### Layout

- **Navbar** - Main navigation with file upload
- **DetailsPanel** - Dynamic document details with semantic search and location data
- **InfoMenu** - Information and help menu
- **PhyloContext** - Unified state management for tree selection and location data

## Development

```bash
# Run development server with hot reload
npm run dev

# Check for linting issues
npm run lint

# Build optimized production bundle
npm run build
```

## Deployment

### Heroku

```bash
heroku create phylo-explorer
heroku config:set NEXT_PUBLIC_API_URL_DEPLOY=https://your-api.herokuapp.com/
git push heroku main
```

### Vercel

```bash
vercel --prod
```

### Static Export

```bash
# Generate static HTML export
npm run build
npm run export
```

## Technologies

- **Next.js 13** - React framework
- **Chakra UI** - Component library
- **D3.js** - Data visualization
- **React 18** - UI library
- **Framer Motion** - Animations

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Performance Optimizations

- Code splitting
- Lazy loading
- Optimized bundle size
- Responsive images
- SWC minification

## Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open pull request

## License

ISC License

## Author

Acauan Ribeiro

## Contact

- Email: acauan.ribeiro@ufrr.br
- LinkedIn: [acauanribeiro](https://www.linkedin.com/in/acauanribeiro)