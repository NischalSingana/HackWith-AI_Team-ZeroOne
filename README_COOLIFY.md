# Coolify Deployment Guide

This project is optimized for deployment on **Coolify** using the included `docker-compose.yml` file.

## 🚀 Deployment Steps

1. **Create a New Service**: In Coolify, go to "Services" and click "Add New Service".
2. **Select Docker Compose**: Choose the "Docker Compose" option.
3. **Connect Repository**: Connect your GitHub/GitLab repository.
4. **Environment Variables**: Coolify will automatically detect the variables in the `docker-compose.yml`. You MUST provide the following in the Coolify UI:
   - `DATABASE_URL`: Your PostgreSQL connection string (Neon or local).
   - `GROQ_KEY_1` to `GROQ_KEY_8`: Your API keys for the AI engine.
   - `GOOGLE_VISION_API_KEY`: For OCR processing.
   - `NEXT_PUBLIC_API_URL`: The **public** URL of your backend (e.g., `https://api.yourdomain.com/api`).
   - `NEO4J_PASSWORD`: A secure password for the graph database.

## 🛠 Internal Networking

The services communicate internally using Docker's bridge network:

- **Backend** connects to AI Service at: `http://ai-service:8000/process_fir`
- **AI Service** connects to Neo4j at: `bolt://neo4j:7687`

## 📦 Persistence

The Neo4j database data is persisted in a Docker volume named `neo4j_data`. Coolify will manage this volume automatically.

---

**Developed by Team ZeroOne**
