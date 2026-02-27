#!/bin/bash
cd ai_service

# Prefer /usr/bin/python3 (usually 3.9) over homebrew python (often unstable edge) if available
PYTHON_CMD="python3"
if [ -x "/usr/bin/python3" ]; then
    PYTHON_CMD="/usr/bin/python3"
fi

# Check version - if 3.14+, warn and maybe fallback/fail?
# Pydantic < 2 issues with 3.14.
PY_VERSION=$($PYTHON_CMD --version 2>&1 | awk '{print $2}')
echo "Using Python: $PYTHON_CMD ($PY_VERSION)"

if [[ "$PY_VERSION" == 3.14* ]]; then
    echo "Warning: Python 3.14 detected. Trying to find an older compatible version..."
    # Try finding 3.12, 3.11, 3.10, 3.9
    for ver in 3.12 3.11 3.10 3.9; do
        if command -v python$ver &> /dev/null; then
            PYTHON_CMD="python$ver"
            echo "Switching to python$ver"
            break
        fi
    done
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    $PYTHON_CMD -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Upgrade pip and setuptools to avoid issues
pip install --upgrade pip setuptools wheel

# Install dependencies if simple check fails (e.g. fastapi)
if ! python -c "import fastapi" &> /dev/null; then
    echo "Installing dependencies..."
    # Force reinstall to ensure we get compatible versions for this python
    pip install -r requirements.txt --force-reinstall
    # Download Spacy model explicitly to be safe
    python -m spacy download en_core_web_sm
fi

echo "Starting AI Service on port 8000..."
python main.py
