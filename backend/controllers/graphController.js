const db = require('../db');
const axios = require('axios');

/**
 * Graph Controller — Handles cached proxying to AI service for graph analysis
 */

const AI_SERVICE_ROOT = process.env.AI_SERVICE_URL 
    ? process.env.AI_SERVICE_URL.replace('/process_fir', '') 
    : 'http://localhost:8000';

exports.getCachedAnalysis = async (req, res) => {
    const analysisType = req.params.type; // summary, centrality, communities, etc.
    const identifier = req.query.identifier || 'global';
    
    try {
        // 1. Get the latest accident ID to check for cache freshness
        const latestAcc = await db.query('SELECT MAX(id) as max_id FROM accidents');
        const currentMaxId = latestAcc.rows[0].max_id || 0;
        
        // 2. Check if we have a valid cache
        const cacheRes = await db.query(
            'SELECT data, last_accident_id FROM ai_analysis_cache WHERE analysis_type = $1 AND identifier = $2',
            [`graph_${analysisType}`, identifier]
        );
        
        if (cacheRes.rows.length > 0) {
            const cached = cacheRes.rows[0];
            // If No new FIRs uploaded since last analysis, return cache instantly
            if (cached.last_accident_id >= currentMaxId) {
                console.log(`[Cache] Returning hit for graph_${analysisType}`);
                return res.json(cached.data);
            }
        }
        
        // 3. Cache miss or stale — Fetch from AI Service
        console.log(`[Cache] Miss/Stale for graph_${analysisType}. Fetching from AI...`);
        const aiUrl = `${AI_SERVICE_ROOT}/graph/analysis/${analysisType}`;
        const response = await axios.get(aiUrl, { timeout: 15000 });
        
        const freshData = response.data;
        
        // 4. Update Cache in background
        await db.query(
            `INSERT INTO ai_analysis_cache (analysis_type, identifier, last_accident_id, data, updated_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (analysis_type, identifier) 
             DO UPDATE SET data = $4, last_accident_id = $3, updated_at = NOW()`,
            [`graph_${analysisType}`, identifier, currentMaxId, JSON.stringify(freshData)]
        );
        
        res.json(freshData);
    } catch (err) {
        console.error(`Graph Cache Error (${analysisType}):`, err.message);
        // Fallback to direct proxy if DB fails
        try {
            const response = await axios.get(`${AI_SERVICE_ROOT}/graph/analysis/${analysisType}`);
            res.json(response.data);
        } catch (proxyErr) {
            res.status(500).json({ error: 'AI Service Unreachable', details: proxyErr.message });
        }
    }
};
