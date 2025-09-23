#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting API Gateway (Node.js/Express)${NC}"
echo -e "${BLUE}Port: 4000${NC}"
echo ""

# Check if port is in use
if lsof -i:4000 > /dev/null 2>&1; then
    echo -e "${RED}❌ Port 4000 is already in use${NC}"
    echo "Kill the process first or use a different port"
    exit 1
fi

# Navigate to api-gateway directory
cd api-gateway

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    npm install
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${BLUE}⚙️  Creating .env from example...${NC}"
    cp .env.example .env
fi

# Disable Redis temporarily by setting environment variable
export DISABLE_REDIS=true

echo -e "${YELLOW}⚠️  Redis cache is disabled - running without cache${NC}"
echo -e "${GREEN}✅ Starting development server...${NC}"
echo -e "${BLUE}Access at: http://localhost:4000${NC}"
echo ""

# Start the development server
npm run dev