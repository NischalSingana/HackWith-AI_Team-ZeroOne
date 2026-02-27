const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const firController = require('../controllers/firController');
const insightsController = require('../controllers/insightsController');
const mapController = require('../controllers/mapController');
const jurisdictionController = require('../controllers/jurisdictionPsController');

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

// Graph visualization data (nodes + edges for canvas renderer)
router.get('/graph/analysis/graph-data', async (req, res) => {
    try {
        // Pull centrality data to get node list, then build a trimmed graph payload
        const [summaryRes, centralityRes] = await Promise.all([
            axios.get(`${AI_SERVICE_URL}/analysis/summary`, { params: req.query }),
            axios.get(`${AI_SERVICE_URL}/analysis/centrality`, { params: { top_n: 100 } }),
        ]);
        const allNodes = [
            ...(centralityRes.data.pagerank || []),
            ...(centralityRes.data.degree_centrality || []),
        ];
        // Deduplicate
        const seen = new Set();
        const nodes = allNodes
            .filter(n => { if (seen.has(n.node)) return false; seen.add(n.node); return true; })
            .map(n => ({ id: n.node, node_type: n.node_type, severity: n.severity, cause: n.cause, area: n.area }));
        res.json({ nodes, edges: [], summary: summaryRes.data });
    } catch (err) {
        const status = err.response?.status || 503;
        res.status(status).json({ error: err.message });
    }
});

// Analysis endpoints
router.get('/graph/analysis/summary', (req, res) => proxyToAI(req, res, '/analysis/summary'));
router.get('/graph/analysis/centrality', (req, res) => proxyToAI(req, res, '/analysis/centrality'));
router.get('/graph/analysis/communities', (req, res) => proxyToAI(req, res, '/analysis/communities'));
router.get('/graph/analysis/hotspots', (req, res) => proxyToAI(req, res, '/analysis/hotspots'));
router.get('/graph/analysis/connections', (req, res) => proxyToAI(req, res, '/analysis/connections'));

// ML prediction endpoints
router.post('/graph/ml/train', (req, res) => proxyToAI(req, res, '/ml/train', 'POST'));
router.post('/graph/ml/predict-severity', (req, res) => proxyToAI(req, res, '/ml/predict-severity', 'POST', req.body));
router.get('/graph/ml/predict-hotspots', (req, res) => proxyToAI(req, res, '/ml/predict-hotspots'));
router.get('/graph/ml/detect-anomalies', (req, res) => proxyToAI(req, res, '/ml/detect-anomalies'));

module.exports = router;
