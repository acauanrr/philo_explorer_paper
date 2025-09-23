#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Frontend (Next.js)${NC}"
echo -e "${BLUE}Port: 3000${NC}"
echo ""

# Check if port is in use
if lsof -i:3000 > /dev/null 2>&1; then
    echo -e "${RED}❌ Port 3000 is already in use${NC}"
    echo "Kill the process first or use a different port"
    exit 1
fi

# Navigate to frontend directory
cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    npm install
fi

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo -e "${BLUE}⚙️  Creating .env.local from example...${NC}"
    cp .env.example .env.local
fi

echo -e "${GREEN}✅ Starting development server...${NC}"
echo -e "${BLUE}Access at: http://localhost:3000${NC}"
echo ""

# Start the development server
npm run dev