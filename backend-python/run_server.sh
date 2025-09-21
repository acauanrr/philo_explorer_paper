#!/bin/bash

# Activate virtual environment
source venv/bin/activate

# Run the FastAPI server
echo "🚀 Starting FastAPI Backend..."
echo "📚 Documentation will be available at: http://localhost:8001/docs"
echo "📊 ReDoc available at: http://localhost:8001/redoc"
echo "----------------------------------------"

# Check if uvicorn is installed
if ! command -v uvicorn &> /dev/null; then
    echo "❌ Error: uvicorn not found. Installing dependencies..."
    pip install -r requirements.txt
fi

# Get port from environment or use default
PORT=${PORT:-8001}

# Run with auto-reload for development
echo "Starting server on port $PORT..."
python -m uvicorn main:app --host 0.0.0.0 --port $PORT --reload