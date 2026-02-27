#!/bin/bash
# ============================================
# FIR Analysis - Start All Services
# ============================================
# This script starts all 3 services.
# Run from the project root: bash start_all.sh
# ============================================

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "🚀 Starting FIR Analysis Project..."
echo "📁 Project Root: $ROOT_DIR"
echo ""

# Kill any existing processes on our ports
echo "🧹 Cleaning up old processes..."
lsof -ti :5001 | xargs kill -9 2>/dev/null
lsof -ti :8000 | xargs kill -9 2>/dev/null
sleep 1

# ============================================
# 1. Start AI Service (Python FastAPI on port 8000)
# ============================================
echo ""
echo "🤖 Starting AI Service (port 8000)..."
cd "$ROOT_DIR/ai_service"

# Find compatible Python (need < 3.14 for spacy)
PYTHON_CMD="python3"
if [ -x "/usr/bin/python3" ]; then
    PY_VER=$(/usr/bin/python3 --version 2>&1 | awk '{print $2}')
    case "$PY_VER" in
        3.9*|3.10*|3.11*|3.12*|3.13*)
            PYTHON_CMD="/usr/bin/python3"
            ;;
    esac
fi

# Create venv if needed
if [ ! -d "venv" ]; then
    echo "   Creating Python virtual environment..."
    $PYTHON_CMD -m venv venv
fi

source venv/bin/activate

# Install deps if needed
if ! python -c "import fastapi" &>/dev/null; then
    echo "   Installing Python dependencies..."
    pip install --upgrade pip setuptools wheel -q
    pip install -r requirements.txt -q
    python -m spacy download en_core_web_sm -q
fi

echo "   ✅ Starting uvicorn..."
python main.py &
AI_PID=$!
sleep 2

# ============================================
# 2. Start Backend (Node.js Express on port 5001)
# ============================================
echo ""
echo "📦 Starting Backend API (port 5001)..."
cd "$ROOT_DIR/backend"

# Install deps if needed
if [ ! -d "node_modules" ]; then
    echo "   Installing Node.js dependencies..."
    npm install -q
fi

node server.js &
BACKEND_PID=$!
sleep 1

# ============================================
# 3. Start Frontend (Next.js on port 3000)
# ============================================
echo ""
echo "🌐 Starting Frontend (port 3000)..."
cd "$ROOT_DIR/frontend"

# Install deps if needed
if [ ! -d "node_modules" ]; then
    echo "   Installing frontend dependencies..."
    npm install -q
fi

npm run dev &
FRONTEND_PID=$!

# ============================================
# Summary
# ============================================
echo ""
echo "============================================"
echo "✅ All services starting!"
echo "============================================"
echo "🤖 AI Service:  http://localhost:8000"
echo "📦 Backend API:  http://localhost:5001"
echo "🌐 Frontend:     http://localhost:3000"
echo "============================================"
echo ""
echo "Press Ctrl+C to stop all services."
echo ""

# Trap Ctrl+C to kill all child processes
cleanup() {
    echo ""
    echo "🛑 Shutting down all services..."
    kill $AI_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null
    wait 2>/dev/null
    echo "✅ All services stopped."
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for any child to exit
wait
