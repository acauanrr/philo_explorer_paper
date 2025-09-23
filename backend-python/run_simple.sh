#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Python Backend (FastAPI)${NC}"
echo -e "${BLUE}Port: 8001${NC}"
echo ""

# Check if port is in use
if lsof -i:8001 > /dev/null 2>&1; then
    echo -e "${RED}❌ Port 8001 is already in use${NC}"
    echo "Kill the process first or use a different port"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${BLUE}🐍 Creating virtual environment...${NC}"
    python -m venv venv
fi

# Activate virtual environment
echo -e "${BLUE}🔄 Activating virtual environment...${NC}"
source venv/bin/activate

# Check if requirements are installed
if [ ! -f "venv/requirements_installed.flag" ]; then
    echo -e "${BLUE}📦 Installing Python dependencies...${NC}"
    pip install -r requirements.txt
    touch venv/requirements_installed.flag
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${BLUE}⚙️  Creating .env from example...${NC}"
    cp .env.example .env
fi

# Get port from environment or use default
PORT=${PORT:-8001}

echo -e "${GREEN}✅ Starting development server...${NC}"
echo -e "${BLUE}📚 Documentation: http://localhost:$PORT/docs${NC}"
echo -e "${BLUE}📊 ReDoc: http://localhost:$PORT/redoc${NC}"
echo -e "${BLUE}🩺 Health: http://localhost:$PORT/health${NC}"
echo ""

# Run with auto-reload for development
python -m uvicorn main:app --host 0.0.0.0 --port $PORT --reload