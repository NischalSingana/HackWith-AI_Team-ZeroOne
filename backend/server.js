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
const defaultOrigins = [
  "https://crimegraph.zeroonedevs.in",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const originAllowlist = allowedOrigins.length > 0 ? allowedOrigins : defaultOrigins;

const corsOptions = {
  origin(origin, callback) {
    // Allow server-to-server and non-browser calls without Origin header.
    if (!origin) return callback(null, true);
    if (originAllowlist.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
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
