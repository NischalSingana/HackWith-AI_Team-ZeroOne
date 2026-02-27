const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const dotenv = require("dotenv");
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
