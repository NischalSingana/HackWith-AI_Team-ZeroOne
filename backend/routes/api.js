const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const firController = require('../controllers/firController');
const insightsController = require('../controllers/insightsController');
const mapController = require('../controllers/mapController');
const jurisdictionController = require('../controllers/jurisdictionPsController');
const systemController = require('../controllers/systemController');

// ================ System Health ================
router.get('/system/status', systemController.getSystemStatus);

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

const authController = require('../controllers/authController');

// ================ Authentication ================
router.post('/auth/login', authController.login);

// ================ FIR Upload ================
router.post('/upload', upload.single('file'), firController.uploadFIR);

// ================ Accidents CRUD ================
router.get('/accidents', firController.getAccidents);
router.get('/accidents/:id', firController.getAccidentById);
router.get('/accidents/:id/pdf', firController.downloadFIR);
router.delete('/accidents/:id', firController.deleteAccident);

// ================ Stats & Search ================
router.get('/stats', firController.getStats);
router.get('/search', firController.searchAccidents);
router.get('/trends', firController.getTrends);

// ================ AI Insights ================
router.get('/insights', insightsController.getInsights);
router.post('/insights/custom', insightsController.getCustomInsights);
router.get('/insights/history', insightsController.getInsightsHistory);
router.get('/trends/analysis', insightsController.getTrendAnalysis);

// ================ Jurisdictions ================
router.get('/jurisdictions', jurisdictionController.getJurisdictionsSummary);
router.get('/jurisdictions/hierarchy', jurisdictionController.getJurisdictionHierarchy);
router.get('/jurisdictions/exclusive-summary', jurisdictionController.getExclusiveSummary);
router.get('/jurisdictions/:area/insights', jurisdictionController.getJurisdictionInsights);
router.get('/areas/:area/insights', jurisdictionController.getAreaInsights);

// ================ Map & Geocoding ================
router.get('/map/locations', mapController.getMapLocations);
router.get('/map/heatmap', mapController.getHeatmapData);
router.post('/map/geocode', mapController.geocodeAndStore);
router.post('/map/geocode-all', mapController.geocodeAll);

// ================ Bulk Processing from R2 ================
router.get('/bulk/list', firController.listR2FIRs);
router.post('/bulk/process', firController.bulkProcessFromR2);
router.post('/bulk/stop', firController.stopBulkProcess);

// Prototype routes removed (Transitioned to real Graph Analysis)

// ================ Graph Analysis (Neo4j + NetworkX proxy) ================
const axios = require('axios');
const AI_SERVICE_URL = process.env.AI_SERVICE_URL
    ? process.env.AI_SERVICE_URL.replace('/process_fir', '')
    : 'http://localhost:8000';

// Generic proxy helper
async function proxyToAI(req, res, aiPath, method = 'GET', body = null) {
    try {
        const opts = {
            method,
            url: `${AI_SERVICE_URL}${aiPath}`,
            params: req.query,
        };
        if (body) {
            opts.data = body;
            opts.headers = { 'Content-Type': 'application/json' };
        }
        const response = await axios(opts);
        res.json(response.data);
    } catch (err) {
        const status = err.response?.status || 503;
        const detail = err.response?.data?.detail || err.message || 'AI service error';
        res.status(status).json({ error: detail });
    }
}

// Graph health
router.get('/graph/health', (req, res) => proxyToAI(req, res, '/graph/health'));

// Graph stats (Neo4j node/rel counts)
router.get('/graph/stats', (req, res) => proxyToAI(req, res, '/graph/stats'));

// Ingest a single FIR into the graph
router.post('/graph/ingest', (req, res) => proxyToAI(req, res, '/graph/ingest', 'POST', req.body));

// Ingest a batch of FIRs
router.post('/graph/ingest-batch', (req, res) => proxyToAI(req, res, '/graph/ingest-batch', 'POST', req.body));

// Graph analysis routes (Cached)
const graphController = require('../controllers/graphController');
router.get('/graph/analysis/:type', graphController.getCachedAnalysis);

// Graph health & stats
router.get('/graph/health', (req, res) => proxyToAI(req, res, '/graph/health'));
router.get('/graph/stats', (req, res) => proxyToAI(req, res, '/graph/stats'));

// ML prediction endpoints
router.post('/graph/ml/train', (req, res) => proxyToAI(req, res, '/ml/train', 'POST'));
router.post('/graph/ml/predict-severity', (req, res) => proxyToAI(req, res, '/ml/predict-severity', 'POST', req.body));
router.get('/graph/ml/predict-hotspots', (req, res) => proxyToAI(req, res, '/ml/predict-hotspots'));
router.get('/graph/ml/detect-anomalies', (req, res) => proxyToAI(req, res, '/ml/detect-anomalies'));

module.exports = router;
