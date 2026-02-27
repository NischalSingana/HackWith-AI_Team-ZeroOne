# CrimeGraph AI 🛡️

### **Intelligent FIR Relationship Mapping & Strategic Analytics System**

[![Next.js](https://img.shields.io/badge/Frontend-Next.js-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/AI_Service-FastAPI-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Neo4j](https://img.shields.io/badge/Graph_DB-Neo4j-008CC1?style=for-the-badge&logo=neo4j)](https://neo4j.com/)
[![PostgreSQL](https://img.shields.io/badge/SQL_DB-PostgreSQL-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)

**CrimeGraph AI** is a high-fidelity multidimensional relationship engine designed for advanced crime pattern detection. By transforming raw, unstructured First Information Reports (FIRs) into a dynamic Knowledge Graph, the system empowers law enforcement and policy makers with non-obvious insights and actionable intelligence.

---

## 🚀 Key Features

### 1. **Neural Relationship Mapping**

Utilizes spectral clustering and PageRank algorithms to identify non-linear escalation vectors across incidents. It maps connections between **FIRs, Locations, Persons, Vehicles, and Crime Types**.

### 2. **Strategic Intelligence Reports**

An AI-driven synthesis engine that processes incident databases to generate high-level executive summaries, policy recommendations, and counter-measures tailored to identified vulnerability patterns.

### 3. **Graph Topology Explorer**

A specialized visualization suite with five distinct lenses:

- **Matrix**: Core relationship topology.
- **Flow**: Directional connectivity of criminal patterns.
- **Clusters**: Automatic community detection and grouping.
- **Threats**: Anomaly detection and escalation monitoring.
- **Bugs**: System integrity diagnostics.

### 4. **Universal OCR Pipeline**

A proprietary extraction engine powered by **Google Vision API** that converts bilingual, complex incident reports into structured JSON data in milliseconds, achieving near-perfect fidelity.

### 5. **Predictive Analytics & Hotspots**

Machine Learning models (NetworkX & Scikit-learn) that analyze spatial and temporal oscillations to predict future hotspots and kinetic root causes.

---

## 🛠 Technology Stack

### **Frontend (The Intelligence Portal)**

- **Framework**: [Next.js 14+](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (Glassmorphism UI)
- **Visualizations**: Custom HTML5 Canvas Graph Engine, Lucide Icons, Framer Motion
- **State Management**: React Hooks (useCallback, useEffect optimization)

### **Backend (The Core Engine)**

- **Runtime**: [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/)
- **Database**: [PostgreSQL (Neon DB)](https://neon.tech/) for structured metadata
- **Storage**: [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) for secure PDF archival

### **AI Service (The Neural Layer)**

- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **NLP**: [SpaCy](https://spacy.io/) & [Google Vision API](https://cloud.google.com/vision)
- **Graph Science**: [NetworkX](https://networkx.org/) & [Neo4j](https://neo4j.com/)
- **LLM Integration**: [Groq AI (Llama-3.3-70B)](https://groq.com/) for lightning-fast insight synthesis

---

## 🏗 System Architecture

The project follows a modular **Microservices Architecture**:

1.  **Client Portal**: A premium React dashboard for data exploration.
2.  **API Gateway**: Node.js backend managing authentication, storage, and database orchestration.
3.  **Neural Processor**: Python FastAPI service dedicated to OCR, Graph theory, and AI synthesis.
4.  **Graph Layer**: A persistent Neo4j cluster for multidimensional link analysis.

---

## 🔧 Installation & Setup

### Prerequisites

- Node.js v18+
- Python 3.10+
- PostgreSQL & Neo4j instances

### 1. Clone & Install

```bash
git clone https://github.com/NischalSingana/HackWith-AI_Team-ZeroOne.git
cd HackWith-AI_Team-ZeroOne
```

### 2. Configure Environment

Create `.env` files in `backend/`, `frontend/`, and `ai_service/` following the provided `.env.example` templates.

### 3. Run with Docker (Recommended)

```bash
docker-compose up --build
```

---

## 🚢 Deployment (Coolify)

This stack is optimized for deployment via **Coolify**.

1. Create a "Docker Compose" service in your Coolify dashboard.
2. Point to this repository.
3. Map your environment variables in the Coolify UI.
4. Refer to `README_COOLIFY.md` for specific configuration details.

---

## 🛡️ Security & Integrity

- **Data Encryption**: AES-256 encryption at rest for sensitive FIR identifiers.
- **Clearance Levels**: Role-based access control (Alpha/Beta levels) built into the Intelligence Portal.
- **Audit Logging**: Traceable AI synthesis logs with meta-provider tracking.

---

**Developed by Team ZeroOne**
