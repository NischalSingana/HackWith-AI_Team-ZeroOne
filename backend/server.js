const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Ensure required directories exist
const uploadDir = path.join(__dirname, "uploads");
const tempDir = path.join(__dirname, "temp");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

const apiRoutes = require("./routes/api");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api", apiRoutes);

// Database check (handled in db.js via pool, no direct connect needed but good to log)
console.log('📦 Database initialized via db.js');

// Error Handling
app.use((err, req, res, next) => {
  console.error('❌ Unhandled Error:', err.stack);
  res.status(500).json({ error: err.message || 'Internal server error', details: err.stack });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT} bound to 0.0.0.0`);
});
