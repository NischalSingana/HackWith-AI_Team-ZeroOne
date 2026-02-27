const db = require('../db');
const axios = require('axios');

/**
 * Graph Controller — Handles cached proxying to AI service for graph analysis
 */

const AI_SERVICE_ROOT = process.env.AI_SERVICE_URL 
    ? process.env.AI_SERVICE_URL.replace('/process_fir', '') 
    : 'http://localhost:8000';

exports.getCachedAnalysis = async (req, res) => {
    const analysisType = req.params.type; // summary, centrality, communities, graph-data, etc.
    const identifier = req.query.identifier || 'global';
    
    try {
        // 0. Ensure cache table exists (Just in case setup_db didn't run)
        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS ai_analysis_cache (
                    id SERIAL PRIMARY KEY,
                    analysis_type VARCHAR(50) NOT NULL,
                    identifier VARCHAR(200) NOT NULL,
                    last_accident_id INTEGER NOT NULL DEFAULT 0,
                    data JSONB NOT NULL,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(analysis_type, identifier)
                )
            `);
        } catch (e) { /* ignore if fails */ }

        // 1. Get the latest accident ID to check for cache freshness
        let currentMaxId = 0;
        try {
            const latestAcc = await db.query('SELECT MAX(id) as max_id FROM accidents');
            currentMaxId = parseInt(latestAcc.rows[0].max_id) || 0;
        } catch (dbErr) {
            console.error("[Graph Cache] Failed to get max_id:", dbErr.message);
        }
        
        // 2. Check if we have a valid cache
        try {
            const cacheRes = await db.query(
                'SELECT data, last_accident_id FROM ai_analysis_cache WHERE analysis_type = $1 AND identifier = $2',
                [`graph_${analysisType}`, identifier]
            );
            
            if (cacheRes.rows.length > 0) {
                const cached = cacheRes.rows[0];
                if (cached.last_accident_id >= currentMaxId) {
                    console.log(`[Cache] Hit: graph_${analysisType}`);
                    return res.json(cached.data);
                }
            }
        } catch (dbErr) {
            console.warn("[Graph Cache] Cache lookup failed:", dbErr.message);
        }
        
        // 3. Cache miss or stale — Fetch from AI Service
        console.log(`[Cache] Miss/Stale for graph_${analysisType}. Fetching from ${AI_SERVICE_ROOT}...`);
        
        let freshData;

        if (analysisType === 'graph-data') {
            // Complex aggregate call for visualizer
            const [summaryRes, centralityRes, connectionsRes] = await Promise.all([
                axios.get(`${AI_SERVICE_ROOT}/analysis/summary`, { params: req.query }).catch(e => ({ data: {} })),
                axios.get(`${AI_SERVICE_ROOT}/analysis/centrality`, { params: { top_n: 100 } }).catch(e => ({ data: {} })),
                axios.get(`${AI_SERVICE_ROOT}/analysis/connections`, { params: { limit: 300 } }).catch(e => ({ data: {} })),
            ]);

            const allNodes = [
                ...(centralityRes.data.pagerank || []),
                ...(centralityRes.data.degree_centrality || []),
            ];
            
            const seen = new Set();
            const nodes = allNodes
                .filter(n => { if (seen.has(n.node)) return false; seen.add(n.node); return true; })
                .map(n => ({ id: n.node, node_type: n.node_type, severity: n.severity, cause: n.cause, area: n.area }));
            
            const edges = (connectionsRes.data.connections || []).map(edge => ({
                source: edge.source,
                target: edge.target,
                rel_type: edge.rel_type
            }));

            freshData = { nodes, edges, summary: summaryRes.data };
        } else {
            // Standard single analysis call
            const aiUrl = `${AI_SERVICE_ROOT}/analysis/${analysisType}`;
            const response = await axios.get(aiUrl, { 
                params: req.query,
                timeout: 25000 
            });
            freshData = response.data;
        }
        
        // 4. Update Cache in background
        try {
            await db.query(
                `INSERT INTO ai_analysis_cache (analysis_type, identifier, last_accident_id, data, updated_at)
                 VALUES ($1, $2, $3, $4, NOW())
                 ON CONFLICT (analysis_type, identifier) 
                 DO UPDATE SET data = $4, last_accident_id = $3, updated_at = NOW()`,
                [`graph_${analysisType}`, identifier, currentMaxId, JSON.stringify(freshData)]
            );
        } catch (dbErr) {
            console.error("[Graph Cache] Failed to update cache:", dbErr.message);
        }
        
        res.json(freshData);
    } catch (err) {
        const detail = err.response?.data?.detail || err.message;
        console.error(`[Graph Controller] Error (${analysisType}):`, detail);
        res.status(500).json({ error: 'Graph Analysis Error', detail });
    }
};
