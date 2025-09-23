#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📊 Phylo Explorer Services Status${NC}"
echo -e "${YELLOW}$(date)${NC}"
echo ""

# Function to check service status
check_service() {
    local PORT=$1
    local SERVICE=$2
    local URL=$3

    echo -e "${BLUE}$SERVICE:${NC}"

    # Check if port is in use
    if lsof -i:$PORT > /dev/null 2>&1; then
        PID=$(lsof -t -i:$PORT | head -n 1)
        echo -e "   ${GREEN}✅ ONLINE${NC} (Port $PORT, PID: $PID)"

        # Try to check health endpoint if URL is provided
        if [ -n "$URL" ]; then
            if curl -s -o /dev/null -w "%{http_code}" "$URL" | grep -q "200\|304"; then
                echo -e "   ${GREEN}✅ HEALTHY${NC} ($URL)"
            else
                HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
                echo -e "   ${YELLOW}⚠️  HTTP $HTTP_CODE${NC} ($URL)"
            fi
        fi
    else
        echo -e "   ${RED}❌ OFFLINE${NC} (Port $PORT)"
    fi
}

# Check services
check_service 3000 "Frontend" "http://localhost:3000"
check_service 4000 "API Gateway" "http://localhost:4000"
check_service 8001 "Python Backend" "http://localhost:8001/health"

echo ""
echo -e "${GREEN}📍 Service URLs:${NC}"
echo -e "   Frontend:       ${BLUE}http://localhost:3000${NC}"
echo -e "   API Gateway:    ${BLUE}http://localhost:4000${NC}"
echo -e "   Python Backend: ${BLUE}http://localhost:8001${NC}"
echo -e "   API Docs:       ${BLUE}http://localhost:8001/docs${NC}"

echo ""
echo -e "${GREEN}🚀 Quick Start Commands:${NC}"
echo -e "   Start Frontend:     ${YELLOW}./start-frontend.sh${NC}"
echo -e "   Start API Gateway:  ${YELLOW}./start-api-gateway.sh${NC}"
echo -e "   Start Python API:   ${YELLOW}cd backend-python && ./run_simple.sh${NC}"