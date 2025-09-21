# Phylo-Explorer Frontend

Next.js-based frontend application for Phylo-Explorer, providing interactive visualizations for phylogenetic trees and text analysis.

## Setup

### Prerequisites
- Node.js 18.x or higher
- npm 9.x or higher

### Installation
```bash
npm install
```

## Development

### Environment Configuration

The frontend uses environment-specific configuration files:

#### Development Environment
- **File**: `.env.local` or `.env.development`
- **Auto-loaded** when running `npm run dev`

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:6001
NEXT_PUBLIC_ENV=development
```

#### Production Environment
- **File**: `.env.production`
- **Auto-loaded** when running `npm run build` or deployed

```bash
# .env.production
NEXT_PUBLIC_API_URL=https://phylo-explorer-api-v2-2fcb24032c89.herokuapp.com
NEXT_PUBLIC_ENV=production
```

### Available Scripts

#### Development Mode
```bash
npm run dev
```
- Starts Next.js development server on http://localhost:3000
- Hot module replacement enabled
- Auto-loads `.env.local` and `.env.development`
- Source maps enabled for debugging

#### Development with Production Config
```bash
npm run dev:prod
```
- Runs development server with production environment variables
- Useful for testing production API connections locally

#### Build Commands
```bash
# Development build
npm run build:dev

# Production build (default)
npm run build

# Production build (explicit)
npm run build:prod
```

#### Start Commands
```bash
# Start with dynamic port (for Heroku)
npm start

# Start development server
npm run start:dev

# Start production server
npm run start:prod
```

#### Code Quality
```bash
# Run ESLint
npm run lint
```

## Features

### Modernized File Upload Component
- **Supports CSV and JSON** file formats
- **Sample Datasets** from Kaggle:
  - News Category Dataset (200k+ articles)
  - BBC News Dataset (2,225 articles)
  - FakeNewsNet Dataset (23k+ articles)
- **Interactive UI** with format guides and examples
- **Toast notifications** for user feedback
- **Direct sample dataset loading** from UI

### Visualizations
- **PhyloExplorer**: Interactive phylogenetic tree visualization
- **WordCloudVis**: Dynamic word cloud generation
- **TimeVis**: Temporal data visualization
- **LocationMap**: Geographic data mapping

## Project Structure

```
phylo-explorer-front/
├── app/                      # Next.js 13+ app directory
│   ├── layout.jsx           # Root layout
│   └── page.jsx             # Main page component
├── components/
│   ├── _ui/
│   │   └── FileUploadNew/   # Modernized file upload
│   └── visualizations/      # D3.js visualizations
│       ├── PhyloExplorer/
│       ├── WordCloudVis/
│       ├── TimeVis/
│       └── LocationMap/
├── public/
│   └── datasets/            # Sample datasets
│       ├── csv/
│       └── json/
├── styles/                  # Global styles
├── contexts/               # React contexts
├── .env.local             # Development environment
├── .env.production        # Production environment
├── next.config.js         # Next.js configuration
└── package.json           # Dependencies and scripts
```

## API Integration

The frontend automatically selects the correct API URL based on the environment:

### Development
- API URL: `http://localhost:6001`
- CORS enabled for local development

### Production
- API URL: `https://phylo-explorer-api-v2-2fcb24032c89.herokuapp.com`
- Secure HTTPS connection

### Environment Variable Usage
```javascript
// Automatically uses the right environment
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:6001";
```

## Data Formats

### CSV Format
```csv
id,title,content,date,category
1,"Title","Content text...","2024-01-01","Category"
```

### JSON Format
```json
[
  {
    "id": 1,
    "title": "Title",
    "content": "Content text...",
    "date": "2024-01-01",
    "category": "Category"
  }
]
```

## Deployment

### Heroku Deployment
```bash
git push heroku main
```

The frontend is configured with:
- **Auto-build**: `heroku-postbuild` script
- **Dynamic port binding**: `$PORT` environment variable
- **Production optimization**: Automatic via Next.js

### Environment Variables on Heroku
```bash
heroku config:set NEXT_PUBLIC_API_URL=https://your-api-url.herokuapp.com
heroku config:set NEXT_PUBLIC_ENV=production
```

## Development Workflow

1. **Start Backend API** (in separate terminal):
   ```bash
   cd ../phylo-explorer-api
   npm run dev
   ```

2. **Start Frontend**:
   ```bash
   npm run dev
   ```

3. **Access Application**:
   - Frontend: http://localhost:3000
   - API: http://localhost:6001

## Troubleshooting

### Port Already in Use
Next.js will automatically try the next available port (3001, 3002, etc.)

### Environment Variables Not Loading
- Ensure `.env.local` exists for development
- Restart the dev server after changing env files
- Check variable names start with `NEXT_PUBLIC_` for client-side access

### API Connection Issues
- Verify backend is running on port 6001
- Check CORS configuration in backend
- Ensure `NEXT_PUBLIC_API_URL` is set correctly

### Build Errors
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

## Performance Optimization

- **Static Generation**: Pages are pre-rendered when possible
- **Image Optimization**: Next.js Image component for automatic optimization
- **Code Splitting**: Automatic per-page code splitting
- **Source Maps**: Development-only for smaller production builds

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT