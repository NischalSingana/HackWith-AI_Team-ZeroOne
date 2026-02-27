/**
 * Insights Controller
 * ====================
 * Aggregates accident statistics from the database,
 * feeds them to the AI Insight Engine, and returns
 * LLM-generated analysis and policy recommendations.
 */

const db = require('../db');
const { generateInsights } = require('../services/aiInsightEngine');

/**
 * GET /api/insights
 * Generates AI-powered accident analysis insights.
 */
exports.getInsights = async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';

    console.log('\n📊 [Insights] Aggregating accident statistics from database...');

    let currentMaxId = 0;
    try {
        const maxIdRes = await db.query('SELECT MAX(id) as max_id FROM accidents');
        currentMaxId = parseInt(maxIdRes.rows[0]?.max_id) || 0;

        if (!forceRefresh) {
            const cacheRes = await db.query(
                'SELECT data, last_accident_id FROM ai_analysis_cache WHERE analysis_type = $1 AND identifier = $2',
                ['global_insights', 'all']
            );
            if (cacheRes.rows.length > 0) {
                const cacheRow = cacheRes.rows[0];
                if (cacheRow.last_accident_id >= currentMaxId) {
                    console.log(`⚡ [Insights] Cache Hit! Serving Instant Response`);
                    return res.json(cacheRow.data);
                } else {
                    console.log(`⏱️ [Insights] Cache Stale! New FIRs found. Regenerating...`);
                }
            } else {
                console.log(`⏱️ [Insights] Cache Miss! Generating for first time...`);
            }
        } else {
            console.log(`🔄 [Insights] Force Refresh requested by frontend.`);
        }
    } catch (dbErr) {
        console.warn('⚠️ [Insights] Failed to read cache, proceeding normally:', dbErr.message);
    }

    // -------- Aggregate statistics from DB --------
    const stats = await aggregateAccidentStats();

    console.log('📊 [Insights] Aggregated stats:', JSON.stringify(stats, null, 2));

    // -------- Generate AI insights --------
    const result = await generateInsights(stats);

    console.log(`✅ [Insights] Generated via: ${result.provider} (${result.latencyMs}ms)`);

    const responsePayload = {
      success: true,
      input_stats: stats,
      ...result.insights,
      meta: {
        provider: result.provider,
        model: result.model,
        latency_ms: result.latencyMs,
        generated_at: new Date().toISOString(),
      },
    };

    // -------- Cache insights in database (both old ai_insights log AND new cache) --------
    try {
      await db.query(`
        INSERT INTO ai_insights (input_stats, summary, key_insights, policy_recs, public_tips, provider, model, latency_ms)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        JSON.stringify(stats),
        result.insights.summary,
        JSON.stringify(result.insights.key_insights),
        JSON.stringify(result.insights.policy_recommendations),
        JSON.stringify(result.insights.public_awareness_suggestions),
        result.provider,
        result.model,
        result.latencyMs,
      ]);

      await db.query(`
          INSERT INTO ai_analysis_cache (analysis_type, identifier, last_accident_id, data, updated_at)
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
          ON CONFLICT (analysis_type, identifier)
          DO UPDATE SET 
              data = EXCLUDED.data,
              last_accident_id = EXCLUDED.last_accident_id,
              updated_at = EXCLUDED.updated_at
      `, ['global_insights', 'all', currentMaxId, JSON.stringify(responsePayload)]);

      console.log('💾 [Insights] Cached to database');
    } catch (cacheErr) {
      console.warn('⚠️ [Insights] Cache save failed:', cacheErr.message);
    }

    res.json(responsePayload);

  } catch (err) {
    console.error('❌ [Insights] Error:', err.message);
    res.status(500).json({ error: 'Failed to generate insights', details: err.message });
  }
};

/**
 * POST /api/insights/custom
 * Accepts custom accident stats JSON and generates insights.
 * Useful for testing or analyzing specific data subsets.
 */
exports.getCustomInsights = async (req, res) => {
  try {
    const customStats = req.body;

    if (!customStats || Object.keys(customStats).length === 0) {
      return res.status(400).json({ error: 'Request body must contain accident statistics JSON' });
    }

    console.log('\n📊 [Insights] Custom stats received:', JSON.stringify(customStats, null, 2));

    const result = await generateInsights(customStats);

    console.log(`✅ [Insights] Generated via: ${result.provider} (${result.latencyMs}ms)`);

    res.json({
      success: true,
      input_stats: customStats,
      ...result.insights,
      meta: {
        provider: result.provider,
        model: result.model,
        latency_ms: result.latencyMs,
        generated_at: new Date().toISOString(),
      },
    });

  } catch (err) {
    console.error('❌ [Insights] Error:', err.message);
    res.status(500).json({ error: 'Failed to generate insights', details: err.message });
  }
};

/**
 * GET /api/trends/analysis
 * Generates specifically time-based trend analysis.
 */
exports.getTrendAnalysis = async (req, res) => {
    try {
        const forceRefresh = req.query.refresh === 'true';
        console.log('\n📊 [Trend Analysis] Generating report...');

        let currentMaxId = 0;
        try {
            const maxIdRes = await db.query('SELECT MAX(id) as max_id FROM accidents');
            currentMaxId = parseInt(maxIdRes.rows[0]?.max_id) || 0;

            if (!forceRefresh) {
                const cacheRes = await db.query(
                    'SELECT data, last_accident_id FROM ai_analysis_cache WHERE analysis_type = $1 AND identifier = $2',
                    ['trends', 'all']
                );
                if (cacheRes.rows.length > 0) {
                    const cacheRow = cacheRes.rows[0];
                    if (cacheRow.last_accident_id >= currentMaxId) {
                        console.log(`⚡ [Trend Analysis] Cache Hit! Serving Instant Response`);
                        return res.json(cacheRow.data);
                    } else {
                        console.log(`⏱️ [Trend Analysis] Cache Stale! New FIRs found. Regenerating...`);
                    }
                } else {
                    console.log(`⏱️ [Trend Analysis] Cache Miss! Generating for first time...`);
                }
            } else {
                console.log(`🔄 [Trend Analysis] Force Refresh requested by frontend.`);
            }
        } catch (dbErr) {
            console.warn('⚠️ [Trend Analysis] Failed to read cache, proceeding normally:', dbErr.message);
        }

        // 1. Fetch Trend Stats (Re-using aggregation logic from firController roughly)
        // ideally we'd export aggregateTrendStats but for speed we'll query here
        const [monthlyRes, dayOfWeekRes, severityMonthlyRes] = await Promise.all([
            db.query(`SELECT TO_CHAR(incident_date, 'YYYY-MM') as month, COUNT(*)::int as count FROM accidents WHERE incident_date IS NOT NULL GROUP BY month ORDER BY month`),
            db.query(`SELECT TO_CHAR(incident_date, 'Day') as day_name, COUNT(*)::int as count FROM accidents WHERE incident_date IS NOT NULL GROUP BY day_name ORDER BY count DESC`),
            db.query(`SELECT TO_CHAR(incident_date, 'YYYY-MM') as month, severity, COUNT(*)::int as count FROM accidents WHERE incident_date IS NOT NULL GROUP BY month, severity ORDER BY month`)
        ]);

        const trendStats = {
            monthly_trend: monthlyRes.rows,
            day_distribution: dayOfWeekRes.rows,
            severity_trend: severityMonthlyRes.rows,
            peak_day: dayOfWeekRes.rows[0]?.day_name || 'Unknown'
        };

        // 2. Generate AI Report
        const { generateTrendInsights } = require('../services/aiInsightEngine');
        const result = await generateTrendInsights(trendStats);

        const responsePayload = {
            success: true,
            analysis: result.insights,
            meta: { provider: result.provider, latency: result.latencyMs }
        };

        try {
            await db.query(`
                INSERT INTO ai_analysis_cache (analysis_type, identifier, last_accident_id, data, updated_at)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                ON CONFLICT (analysis_type, identifier)
                DO UPDATE SET 
                    data = EXCLUDED.data,
                    last_accident_id = EXCLUDED.last_accident_id,
                    updated_at = EXCLUDED.updated_at
            `, ['trends', 'all', currentMaxId, JSON.stringify(responsePayload)]);
            console.log(`💾 [Trend Analysis] Successfully cached AI response.`);
        } catch (cacheWriteErr) {
            console.warn(`⚠️ [Trend Analysis] Failed to write to cache:`, cacheWriteErr.message);
        }

        res.json(responsePayload);

    } catch (err) {
        console.error('❌ [Trend Analysis] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ========================================================================
// DATABASE AGGREGATION
// ========================================================================

/**
 * Queries the accidents database and computes aggregated statistics
 * for the AI Insight Engine. Only sends aggregated data — never raw FIR text.
 */
async function aggregateAccidentStats() {
  // Run all queries in parallel for speed
  const [
    causeResult,
    ageResult,
    timeResult,
    locationResult,
    vehicleResult,
    fatalityResult,
    totalResult,
    accidentDataResult,
    monthlyResult
  ] = await Promise.all([
    // Cause Distribution
    db.query(`
      SELECT cause, COUNT(*)::int as count
      FROM accidents
      WHERE cause IS NOT NULL AND cause != 'Under Investigation'
      GROUP BY cause
      ORDER BY count DESC
    `),

    // Age Group Distribution
    db.query(`
      SELECT
        CASE
          WHEN age BETWEEN 0 AND 17 THEN '0-17'
          WHEN age BETWEEN 18 AND 25 THEN '18-25'
          WHEN age BETWEEN 26 AND 35 THEN '26-35'
          WHEN age BETWEEN 36 AND 50 THEN '36-50'
          WHEN age > 50 THEN '50+'
          ELSE 'Unknown'
        END as age_group,
        COUNT(*)::int as count
      FROM victims
      WHERE age IS NOT NULL
      GROUP BY age_group
      ORDER BY count DESC
    `),

    // Time of Day Distribution
    db.query(`
      SELECT
        CASE
          WHEN EXTRACT(HOUR FROM incident_date) BETWEEN 0 AND 3 THEN 'Late Night (00-04)'
          WHEN EXTRACT(HOUR FROM incident_date) BETWEEN 4 AND 7 THEN 'Early Morning (04-08)'
          WHEN EXTRACT(HOUR FROM incident_date) BETWEEN 8 AND 11 THEN 'Morning Peak (08-12)'
          WHEN EXTRACT(HOUR FROM incident_date) BETWEEN 12 AND 15 THEN 'Afternoon (12-16)'
          WHEN EXTRACT(HOUR FROM incident_date) BETWEEN 16 AND 19 THEN 'Evening Peak (16-20)'
          WHEN EXTRACT(HOUR FROM incident_date) BETWEEN 20 AND 23 THEN 'Night (20-00)'
          ELSE 'Unknown'
        END as time_slot,
        COUNT(*)::int as count
      FROM accidents
      WHERE incident_date IS NOT NULL
      GROUP BY time_slot
      ORDER BY count DESC
    `),

    // Hotspot Locations (Top 5)
    db.query(`
      SELECT area, COUNT(*)::int as count
      FROM locations
      WHERE area IS NOT NULL
      GROUP BY area
      ORDER BY count DESC
      LIMIT 10
    `),

    // Vehicle Types
    db.query(`
      SELECT vehicle_type, COUNT(*)::int as count
      FROM vehicles
      WHERE vehicle_type IS NOT NULL AND vehicle_type != 'Unknown'
      GROUP BY vehicle_type
      ORDER BY count DESC
    `),

    // Fatality percentage
    db.query(`
      SELECT
        ROUND(
          (COUNT(*) FILTER (WHERE severity = 'Fatal')::DECIMAL /
          NULLIF(COUNT(*), 0)) * 100, 1
        ) as fatality_pct
      FROM accidents
    `),

    // Total accidents
    db.query('SELECT COUNT(*)::int as total FROM accidents'),

    // Summaries for LLM context
    db.query(`
      SELECT fir_number, incident_date, cause, severity,
      (SELECT area FROM locations WHERE accident_id = accidents.id LIMIT 1) as location
      FROM accidents
      ORDER BY incident_date DESC
      LIMIT 50
    `),

    // Monthly Trend
    db.query(`
        SELECT TO_CHAR(incident_date, 'Mon-YYYY') as month, COUNT(*)::int as count
        FROM accidents 
        WHERE incident_date IS NOT NULL 
        GROUP BY month, DATE_TRUNC('month', incident_date)
        ORDER BY DATE_TRUNC('month', incident_date) DESC
        LIMIT 12
    `)
  ]);

  const summariesLines = (accidentDataResult.rows || []).map(a => 
      `- FIR ${a.fir_number} (${new Date(a.incident_date).toLocaleDateString()}): ${a.severity} accident at ${a.location || 'Unknown'}. Cause: ${a.cause || 'Unknown'}`
  ).join('\n');

  // Helper to get top item safely with filtering
  const getTopFiltered = (res, blacklist = []) => {
    if (!res.rows || res.rows.length === 0) return 'Unknown';
    const valid = res.rows.find(r => {
      const val = Object.values(r)[0]; // Assumes query returns { value, count }
      if (!val || typeof val !== 'string') return false;
      if (val.length > 60) return false; // Reject long garbage strings
      return !blacklist.some(b => val.toLowerCase().includes(b.toLowerCase()));
    });
    return valid ? Object.values(valid)[0] : (res.rows[0] ? Object.values(res.rows[0])[0] : 'Unknown');
  };

  const CAUSE_BLACKLIST = [
    'negligent', 'rash', 'driving', 'unknown', 'other', 'accident',
    'action taken', 'investigation', 'registered', 'offence', 'commission',
    'delay', 'reporting', 'complainant', 'informant'
  ];
  const LOCATION_BLACKLIST = ['p.s.', 'police', 'station', 'ntr', 'district', 'unknown', 'road', 'near'];

  return {
    total_accidents: parseInt(totalResult.rows[0]?.total) || 0,
    
    // Top-level stats (Filtered for Quality)
    most_common_cause: getTopFiltered(causeResult, CAUSE_BLACKLIST),
    high_risk_age_group: getTopFiltered(ageResult, ['unknown']),
    peak_time: getTopFiltered(timeResult, ['unknown']),
    hotspot_location: getTopFiltered(locationResult, LOCATION_BLACKLIST),
    most_risky_vehicle: getTopFiltered(vehicleResult, ['unknown']),
    fatality_percentage: parseFloat(fatalityResult.rows[0]?.fatality_pct) || 0,

    // Deep Dive Distributions
    cause_distribution: causeResult.rows,
    age_distribution: ageResult.rows,
    time_distribution: timeResult.rows,
    location_distribution: locationResult.rows,
    vehicle_distribution: vehicleResult.rows,
    monthly_trend: monthlyResult.rows,

    accident_summaries: summariesLines
  };
}

/**
 * GET /api/insights/history
 * Returns cached past insights from the database.
 */
exports.getInsightsHistory = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, input_stats, summary, key_insights, policy_recs, public_tips, 
             provider, model, latency_ms, created_at
      FROM ai_insights 
      ORDER BY created_at DESC 
      LIMIT 20
    `);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    console.error('❌ [Insights] History error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = exports;
