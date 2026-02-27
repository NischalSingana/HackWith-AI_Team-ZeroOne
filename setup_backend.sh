#!/bin/bash
cd backend
npm install express pg cors body-parser multer axios dotenv morgan form-data
echo "Backend dependencies installed."
# Create dummy .env
echo "PORT=5000\nDB_USER=postgres\nDB_PASSWORD=password\nDB_HOST=localhost\nDB_NAME=fir_db\nDB_PORT=5432\nAI_SERVICE_URL=http://localhost:8000/process_fir" > .env
echo "Created sample .env file."
