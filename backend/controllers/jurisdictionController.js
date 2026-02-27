/**
 * Jurisdiction Controller
 * =======================
 * Handles fetching area-wise accident statistics and
 * generating jurisdiction-specific AI insights.
 *
 * IMPORTANT: All matching is done ONLY on l.area (never l.city)
 * to prevent the city column ("NTR Commissionerate", "Vijayawada")
 * from causing broad false-positive matches.
 */

const db = require('../db');
const { generateJurisdictionInsights } = require('../services/aiInsightEngine');
const {
    getStationsForQuery,
    getJurisdictionTree,
    buildAreaCondition,
    buildExclusiveCondition,
    EXCLUSIVE_DCP_ORDER
} = require('../utils/jurisdictionHierarchy');

/**
 * GET /api/jurisdictions
 * Returns a summary of all jurisdictions (areas) and their total accident counts.
 */
const getJurisdictionsSummary = async (req, res) => {
    try {
        console.log('\n🗺️ [Jurisdictions] Fetching summary of all areas...');

        const result = await db.query(`
            SELECT 
                INITCAP(COALESCE(l.area, 'Unknown')) as name,
                COUNT(a.id)::int as total_accidents,
                COUNT(a.id) FILTER (WHERE a.severity = 'Fatal')::int as fatal_count,
                COUNT(a.id) FILTER (WHERE a.severity = 'Grievous')::int as grievous_count,
                COUNT(a.id) FILTER (WHERE a.severity = 'Non-Fatal')::int as non_fatal_count
            FROM accidents a
            LEFT JOIN locations l ON a.id = l.accident_id
            GROUP BY INITCAP(COALESCE(l.area, 'Unknown'))
            ORDER BY total_accidents DESC
        `);

        const validAreas = result.rows.filter(r => r.name && r.name !== 'Unknown');

        res.json({
            success: true,
            count: validAreas.length,
            data: validAreas
        });

    } catch (err) {
        console.error('❌ [Jurisdictions] Error fetching summary:', err.message);
        res.status(500).json({ error: 'Failed to fetch jurisdictions summary', details: err.message });
    }
};

/**
 * GET /api/jurisdictions/hierarchy
 * Returns the static tree of DCPs -> Zones -> Stations
 */
const getJurisdictionHierarchy = (req, res) => {
    try {
        res.json({
            success: true,
            data: getJurisdictionTree()
        });
    } catch (err) {
        console.error('❌ [Jurisdictions] Error fetching hierarchy:', err.message);
        res.status(500).json({ error: 'Failed to fetch jurisdiction hierarchy', details: err.message });
    }
};

/**
 * GET /api/jurisdictions/exclusive-summary
 * Returns exclusive (non-overlapping) counts for every DCP + "Other Areas".
 * Each record is assigned to exactly ONE bucket. Sum of all = total records.
 */
const getExclusiveSummary = async (req, res) => {
    try {
        console.log('\n📊 [Jurisdictions] Computing exclusive DCP summary...');

        const totalRes = await db.query('SELECT COUNT(*)::int as total FROM accidents');
        const totalRecords = totalRes.rows[0].total;

        const results = [];
        let grandSum = 0;

        for (const dcpName of EXCLUSIVE_DCP_ORDER) {
            const { sql, params } = buildExclusiveCondition(dcpName);
            const countRes = await db.query(`
                SELECT COUNT(DISTINCT a.id)::int as total,
                       COUNT(DISTINCT a.id) FILTER (WHERE a.severity = 'Fatal')::int as fatal
                FROM accidents a
                LEFT JOIN locations l ON a.id = l.accident_id
                WHERE ${sql}
            `, params);

            const count = countRes.rows[0].total;
            const fatal = countRes.rows[0].fatal;
            grandSum += count;
            results.push({
                name: dcpName,
                total: count,
                fatal,
                fatality_rate: count > 0 ? parseFloat(((fatal / count) * 100).toFixed(1)) : 0
            });
        }

        const otherCount = totalRecords - grandSum;
        if (otherCount > 0) {
            const allStations = [];
            EXCLUSIVE_DCP_ORDER.forEach(dcp => allStations.push(...getStationsForQuery(dcp)));
            const { sql: allSql, params: allParams } = buildAreaCondition(allStations, 1);
            const otherRes = await db.query(`
                SELECT COUNT(DISTINCT a.id) FILTER (WHERE a.severity = 'Fatal')::int as fatal
                FROM accidents a
                LEFT JOIN locations l ON a.id = l.accident_id
                WHERE NOT ${allSql}
            `, allParams);
            const otherFatal = otherRes.rows[0].fatal;
            results.push({
                name: "OTHER AREAS",
                total: otherCount,
                fatal: otherFatal,
                fatality_rate: otherCount > 0 ? parseFloat(((otherFatal / otherCount) * 100).toFixed(1)) : 0
            });
        } else {
            results.push({ name: "OTHER AREAS", total: 0, fatal: 0, fatality_rate: 0 });
        }

        res.json({
            success: true,
            total_records: totalRecords,
            breakdown: results
        });

    } catch (err) {
        console.error('❌ [Jurisdictions] Error computing exclusive summary:', err.message);
        res.status(500).json({ error: 'Failed to compute exclusive summary', details: err.message });
    }
};

/**
 * GET /api/jurisdictions/:area/insights
 * Returns detailed statistics and AI analysis for a specific jurisdiction.
 * Uses exclusive matching so DCP counts don't overlap.
 */
const getJurisdictionInsights = async (req, res) => {
    try {
        const { area } = req.params;
        const forceRefresh = req.query.refresh === 'true';

        if (!area) {
            return res.status(400).json({ error: 'Area parameter is required' });
        }

        console.log(`\n📊 [Jurisdictions] Aggregating stats for area/node: "${area}"`);

        let currentMaxId = 0;
        const cacheKey = `jurisdiction_excl_${area}`;
        try {
            const maxIdRes = await db.query('SELECT MAX(id) as max_id FROM accidents');
            currentMaxId = parseInt(maxIdRes.rows[0]?.max_id) || 0;

            if (!forceRefresh) {
                const cacheRes = await db.query(
                    'SELECT data, last_accident_id FROM ai_analysis_cache WHERE analysis_type = $1 AND identifier = $2',
                    ['jurisdiction', cacheKey]
                );
                if (cacheRes.rows.length > 0) {
                    const cacheRow = cacheRes.rows[0];
                    if (cacheRow.last_accident_id >= currentMaxId) {
                        console.log(`⚡ [Jurisdictions] Cache Hit for ${area}`);
                        return res.json(cacheRow.data);
                    }
                    console.log(`⏱️ [Jurisdictions] Cache Stale for ${area}. Regenerating...`);
                } else {
                    console.log(`⏱️ [Jurisdictions] Cache Miss for ${area}. Generating...`);
                }
            } else {
                console.log(`🔄 [Jurisdictions] Force Refresh for ${area}.`);
            }
        } catch (dbErr) {
            console.warn('⚠️ [Jurisdictions] Cache read failed:', dbErr.message);
        }

        let areaCondition, areaParams;

        if (area === 'OTHER AREAS') {
            const allStations = [];
            EXCLUSIVE_DCP_ORDER.forEach(dcp => allStations.push(...getStationsForQuery(dcp)));
            const { sql, params } = buildAreaCondition(allStations, 1);
            areaCondition = `NOT ${sql}`;
            areaParams = params;
        } else if (EXCLUSIVE_DCP_ORDER.includes(area)) {
            const { sql, params } = buildExclusiveCondition(area);
            areaCondition = sql;
            areaParams = params;
        } else {
            const stations = getStationsForQuery(area);
            const { sql, params } = buildAreaCondition(stations, 1);
            areaCondition = sql;
            areaParams = params;
        }

        const [
            totalRes,
            severityRes,
            causeRes,
            timeRes,
            ageRes,
            vehicleRes,
            monthlyRes,
            accidentDataResult
        ] = await Promise.all([
            db.query(`
                SELECT COUNT(a.id)::int as total 
                FROM accidents a LEFT JOIN locations l ON a.id = l.accident_id
                WHERE ${areaCondition}
            `, areaParams),

            db.query(`
                SELECT a.severity, COUNT(a.id)::int as count 
                FROM accidents a LEFT JOIN locations l ON a.id = l.accident_id
                WHERE ${areaCondition}
                GROUP BY a.severity ORDER BY count DESC
            `, areaParams),

            db.query(`
                SELECT a.cause, COUNT(a.id)::int as count 
                FROM accidents a LEFT JOIN locations l ON a.id = l.accident_id
                WHERE ${areaCondition} AND a.cause IS NOT NULL AND a.cause != 'Under Investigation'
                GROUP BY a.cause ORDER BY count DESC LIMIT 10
            `, areaParams),

            db.query(`
                SELECT
                    CASE
                        WHEN EXTRACT(HOUR FROM a.incident_date) BETWEEN 0 AND 3 THEN 'Late Night (00-04)'
                        WHEN EXTRACT(HOUR FROM a.incident_date) BETWEEN 4 AND 7 THEN 'Early Morning (04-08)'
                        WHEN EXTRACT(HOUR FROM a.incident_date) BETWEEN 8 AND 11 THEN 'Morning Peak (08-12)'
                        WHEN EXTRACT(HOUR FROM a.incident_date) BETWEEN 12 AND 15 THEN 'Afternoon (12-16)'
                        WHEN EXTRACT(HOUR FROM a.incident_date) BETWEEN 16 AND 19 THEN 'Evening Peak (16-20)'
                        WHEN EXTRACT(HOUR FROM a.incident_date) BETWEEN 20 AND 23 THEN 'Night (20-00)'
                        ELSE 'Unknown'
                    END as time_slot,
                    COUNT(a.id)::int as count
                FROM accidents a LEFT JOIN locations l ON a.id = l.accident_id
                WHERE ${areaCondition} AND a.incident_date IS NOT NULL
                GROUP BY time_slot ORDER BY count DESC
            `, areaParams),

            db.query(`
                SELECT
                    CASE
                        WHEN v.age BETWEEN 0 AND 17 THEN '0-17'
                        WHEN v.age BETWEEN 18 AND 25 THEN '18-25'
                        WHEN v.age BETWEEN 26 AND 35 THEN '26-35'
                        WHEN v.age BETWEEN 36 AND 50 THEN '36-50'
                        WHEN v.age > 50 THEN '50+'
                        ELSE 'Unknown'
                    END as age_group,
                    COUNT(v.id)::int as count
                FROM victims v 
                JOIN accidents a ON v.accident_id = a.id
                LEFT JOIN locations l ON a.id = l.accident_id
                WHERE ${areaCondition} AND v.age IS NOT NULL
                GROUP BY age_group ORDER BY count DESC
            `, areaParams),

            db.query(`
                SELECT vh.vehicle_type, COUNT(vh.id)::int as count 
                FROM vehicles vh
                JOIN accidents a ON vh.accident_id = a.id
                LEFT JOIN locations l ON a.id = l.accident_id
                WHERE ${areaCondition} AND vh.vehicle_type IS NOT NULL AND vh.vehicle_type != 'Unknown'
                GROUP BY vh.vehicle_type ORDER BY count DESC
            `, areaParams),

            db.query(`
                SELECT TO_CHAR(a.incident_date, 'Mon-YYYY') as month, COUNT(a.id)::int as count
                FROM accidents a LEFT JOIN locations l ON a.id = l.accident_id
                WHERE ${areaCondition} AND a.incident_date IS NOT NULL 
                GROUP BY month, DATE_TRUNC('month', a.incident_date)
                ORDER BY DATE_TRUNC('month', a.incident_date) ASC
                LIMIT 12
            `, areaParams),

            db.query(`
                SELECT a.fir_number, a.incident_date, a.cause, a.severity, l.address, l.area
                FROM accidents a LEFT JOIN locations l ON a.id = l.accident_id
                WHERE ${areaCondition}
                ORDER BY a.incident_date DESC
                LIMIT 30
            `, areaParams)
        ]);

        const totalAccidents = parseInt(totalRes.rows[0]?.total) || 0;

        if (totalAccidents === 0) {
            return res.json({
                success: true,
                area,
                total_accidents: 0,
                message: "No accidents found for this jurisdiction."
            });
        }

        const fatalCount = severityRes.rows.find(s => s.severity === 'Fatal')?.count || 0;
        const fatalityRate = totalAccidents > 0 ? parseFloat(((fatalCount / totalAccidents) * 100).toFixed(1)) : 0;

        const summariesLines = (accidentDataResult.rows || []).map(a =>
            `- FIR ${a.fir_number} (${new Date(a.incident_date).toLocaleDateString()}): ${a.severity} accident at ${a.address || 'Unknown'}. Cause: ${a.cause || 'Unknown'}`
        ).join('\n');

        const CAUSE_BLACKLIST = ['negligent', 'rash', 'driving', 'unknown', 'other', 'accident', 'action taken', 'investigation'];

        const getTopFiltered = (queryRes, blacklist = []) => {
            if (!queryRes.rows || queryRes.rows.length === 0) return 'Unknown';
            const valid = queryRes.rows.find(r => {
                const val = Object.values(r)[0];
                if (!val || typeof val !== 'string') return false;
                if (val.length > 60) return false;
                return !blacklist.some(b => val.toLowerCase().includes(b.toLowerCase()));
            });
            return valid ? Object.values(valid)[0] : (queryRes.rows[0] ? Object.values(queryRes.rows[0])[0] : 'Unknown');
        };

        const stats = {
            area_name: area,
            total_accidents: totalAccidents,
            fatality_percentage: fatalityRate,
            most_common_cause: getTopFiltered(causeRes, CAUSE_BLACKLIST),
            high_risk_age_group: getTopFiltered(ageRes, ['unknown']),
            peak_time: getTopFiltered(timeRes, ['unknown']),
            most_risky_vehicle: getTopFiltered(vehicleRes, ['unknown']),

            severity_distribution: severityRes.rows,
            cause_distribution: causeRes.rows,
            time_distribution: timeRes.rows,
            age_distribution: ageRes.rows,
            vehicle_distribution: vehicleRes.rows,
            monthly_trend: monthlyRes.rows,

            accident_summaries: summariesLines
        };

        console.log(`📊 [Jurisdictions] Stats compiled. Calling AI Engine for ${area}...`);

        const aiResult = await generateJurisdictionInsights(stats, area);

        const responsePayload = {
            success: true,
            area,
            input_stats: stats,
            ...aiResult.insights,
            meta: {
                provider: aiResult.provider,
                model: aiResult.model,
                latency_ms: aiResult.latencyMs,
            }
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
            `, ['jurisdiction', cacheKey, currentMaxId, JSON.stringify(responsePayload)]);
            console.log(`💾 [Jurisdictions] Cached response for ${area}.`);
        } catch (cacheWriteErr) {
            console.warn(`⚠️ [Jurisdictions] Cache write failed for ${area}:`, cacheWriteErr.message);
        }

        res.json(responsePayload);

    } catch (err) {
        console.error('❌ [Jurisdictions] Error fetching insights:', err.message);
        res.status(500).json({ error: 'Failed to generate jurisdiction insights', details: err.message });
    }
};

module.exports = {
    getJurisdictionsSummary,
    getJurisdictionHierarchy,
    getJurisdictionInsights,
    getExclusiveSummary
};
