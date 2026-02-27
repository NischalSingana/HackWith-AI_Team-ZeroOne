const db = require('../db');
const { generateJurisdictionInsights } = require('../services/aiInsightEngine');
const {
    JURISDICTION_STATIONS,
    OTHER_STATIONS_LABEL,
    resolveCanonicalStation
} = require('../utils/policeStationResolver');

function buildStationBuckets(rows) {
    const counts = new Map();
    const fatalCounts = new Map();
    const idBuckets = new Map();

    [...JURISDICTION_STATIONS, OTHER_STATIONS_LABEL].forEach((name) => {
        counts.set(name, 0);
        fatalCounts.set(name, 0);
        idBuckets.set(name, []);
    });

    for (const row of rows) {
        const station = resolveCanonicalStation(row.raw_text, row.area) || OTHER_STATIONS_LABEL;
        counts.set(station, (counts.get(station) || 0) + 1);
        if (row.severity === 'Fatal') {
            fatalCounts.set(station, (fatalCounts.get(station) || 0) + 1);
        }
        idBuckets.get(station).push(row.id);
    }

    return { counts, fatalCounts, idBuckets };
}

async function fetchAccidentCoreRows() {
    const result = await db.query(`
        SELECT a.id, a.fir_number, a.incident_date, a.cause, a.severity, a.raw_text, l.address, l.area
        FROM accidents a
        LEFT JOIN locations l ON a.id = l.accident_id
    `);
    return result.rows;
}

const getExclusiveSummary = async (req, res) => {
    try {
        const rows = await db.query(`
            SELECT a.id, a.severity, a.raw_text, l.area
            FROM accidents a
            LEFT JOIN locations l ON l.accident_id = a.id
            ORDER BY a.id
        `);
        const { counts, fatalCounts } = buildStationBuckets(rows.rows);

        const breakdown = [...JURISDICTION_STATIONS, OTHER_STATIONS_LABEL].map((name) => {
            const total = counts.get(name) || 0;
            const fatal = fatalCounts.get(name) || 0;
            return {
                name,
                total,
                fatal,
                fatality_rate: total > 0 ? parseFloat(((fatal / total) * 100).toFixed(1)) : 0
            };
        });

        res.json({
            success: true,
            total_records: rows.rows.length,
            breakdown
        });
    } catch (err) {
        console.error('❌ [Jurisdiction PS] Error computing summary:', err.message);
        res.status(500).json({ error: 'Failed to compute station summary', details: err.message });
    }
};

const getJurisdictionsSummary = async (req, res) => {
    try {
        const rows = await db.query(`
            SELECT a.id, a.severity, a.raw_text, l.area
            FROM accidents a
            LEFT JOIN locations l ON l.accident_id = a.id
            ORDER BY a.id
        `);
        const { counts, fatalCounts } = buildStationBuckets(rows.rows);

        const data = [...JURISDICTION_STATIONS, OTHER_STATIONS_LABEL]
            .map((name) => ({
                name,
                total_accidents: counts.get(name) || 0,
                fatal_count: fatalCounts.get(name) || 0
            }))
            .filter((item) => item.total_accidents > 0);

        res.json({ success: true, count: data.length, data });
    } catch (err) {
        console.error('❌ [Jurisdiction PS] Error fetching summary:', err.message);
        res.status(500).json({ error: 'Failed to fetch jurisdiction summary', details: err.message });
    }
};

const getJurisdictionHierarchy = (req, res) => {
    res.json({
        success: true,
        data: {
            "Jurisdiction Wise Stations": JURISDICTION_STATIONS
        }
    });
};

const getJurisdictionInsights = async (req, res) => {
    try {
        const { area } = req.params;
        const forceRefresh = req.query.refresh === 'true';

        if (!area) {
            return res.status(400).json({ error: 'Area parameter is required' });
        }

        const target = decodeURIComponent(area);
        const cacheKey = `jurisdiction_ps_${target}`;

        let currentMaxId = 0;
        try {
            const maxIdRes = await db.query('SELECT MAX(id) as max_id FROM accidents');
            currentMaxId = parseInt(maxIdRes.rows[0]?.max_id, 10) || 0;

            if (!forceRefresh) {
                const cacheRes = await db.query(
                    'SELECT data, last_accident_id FROM ai_analysis_cache WHERE analysis_type = $1 AND identifier = $2',
                    ['jurisdiction', cacheKey]
                );
                if (cacheRes.rows.length > 0 && cacheRes.rows[0].last_accident_id >= currentMaxId) {
                    return res.json(cacheRes.rows[0].data);
                }
            }
        } catch (cacheErr) {
            console.warn('⚠️ [Jurisdiction PS] Cache read failed:', cacheErr.message);
        }

        const allAccidents = await fetchAccidentCoreRows();
        const { idBuckets } = buildStationBuckets(allAccidents);
        const selectedIds = idBuckets.get(target) || [];

        if (selectedIds.length === 0) {
            return res.json({
                success: true,
                area: target,
                total_accidents: 0,
                message: "No accidents found for this jurisdiction."
            });
        }

        const idParam = [selectedIds];
        const [severityRes, causeRes, timeRes, ageRes, vehicleRes, monthlyRes] = await Promise.all([
            db.query(`
                SELECT severity, COUNT(*)::int as count
                FROM accidents
                WHERE id = ANY($1::int[])
                GROUP BY severity
                ORDER BY count DESC
            `, idParam),
            db.query(`
                SELECT cause, COUNT(*)::int as count
                FROM accidents
                WHERE id = ANY($1::int[]) AND cause IS NOT NULL AND cause != 'Under Investigation'
                GROUP BY cause
                ORDER BY count DESC
                LIMIT 10
            `, idParam),
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
                WHERE id = ANY($1::int[]) AND incident_date IS NOT NULL
                GROUP BY time_slot
                ORDER BY count DESC
            `, idParam),
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
                WHERE accident_id = ANY($1::int[]) AND age IS NOT NULL
                GROUP BY age_group
                ORDER BY count DESC
            `, idParam),
            db.query(`
                SELECT vehicle_type, COUNT(*)::int as count
                FROM vehicles
                WHERE accident_id = ANY($1::int[]) AND vehicle_type IS NOT NULL AND vehicle_type != 'Unknown'
                GROUP BY vehicle_type
                ORDER BY count DESC
            `, idParam),
            db.query(`
                SELECT TO_CHAR(incident_date, 'Mon-YYYY') as month, COUNT(*)::int as count
                FROM accidents
                WHERE id = ANY($1::int[]) AND incident_date IS NOT NULL
                GROUP BY month, DATE_TRUNC('month', incident_date)
                ORDER BY DATE_TRUNC('month', incident_date) ASC
                LIMIT 12
            `, idParam)
        ]);

        const selectedAccidents = allAccidents
            .filter((acc) => selectedIds.includes(acc.id))
            .sort((a, b) => {
                const da = a.incident_date ? new Date(a.incident_date).getTime() : 0;
                const dbTime = b.incident_date ? new Date(b.incident_date).getTime() : 0;
                return dbTime - da;
            })
            .slice(0, 30);

        const totalAccidents = selectedIds.length;
        const fatalCount = severityRes.rows.find((s) => s.severity === 'Fatal')?.count || 0;
        const fatalityRate = totalAccidents > 0 ? parseFloat(((fatalCount / totalAccidents) * 100).toFixed(1)) : 0;

        const summariesLines = selectedAccidents.map((a) => {
            const dateLabel = a.incident_date ? new Date(a.incident_date).toLocaleDateString() : 'Unknown date';
            return `- FIR ${a.fir_number} (${dateLabel}): ${a.severity} accident at ${a.address || 'Unknown'}. Cause: ${a.cause || 'Unknown'}`;
        }).join('\n');

        const getTop = (rows, field) => (rows[0] && rows[0][field]) ? rows[0][field] : 'Unknown';

        const stats = {
            area_name: target,
            total_accidents: totalAccidents,
            fatality_percentage: fatalityRate,
            most_common_cause: getTop(causeRes.rows, 'cause'),
            high_risk_age_group: getTop(ageRes.rows, 'age_group'),
            peak_time: getTop(timeRes.rows, 'time_slot'),
            most_risky_vehicle: getTop(vehicleRes.rows, 'vehicle_type'),
            severity_distribution: severityRes.rows,
            cause_distribution: causeRes.rows,
            time_distribution: timeRes.rows,
            age_distribution: ageRes.rows,
            vehicle_distribution: vehicleRes.rows,
            monthly_trend: monthlyRes.rows,
            accident_summaries: summariesLines
        };

        const aiResult = await generateJurisdictionInsights(stats, target);
        const responsePayload = {
            success: true,
            area: target,
            input_stats: stats,
            ...aiResult.insights,
            meta: {
                provider: aiResult.provider,
                model: aiResult.model,
                latency_ms: aiResult.latencyMs
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
        } catch (cacheWriteErr) {
            console.warn('⚠️ [Jurisdiction PS] Cache write failed:', cacheWriteErr.message);
        }

        res.json(responsePayload);
    } catch (err) {
        console.error('❌ [Jurisdiction PS] Error generating insights:', err.message);
        res.status(500).json({ error: 'Failed to generate jurisdiction insights', details: err.message });
    }
};

const getAreaInsights = async (req, res) => {
    try {
        const { area } = req.params;
        const forceRefresh = req.query.refresh === 'true';
        const target = decodeURIComponent(area || '').trim();

        if (!target) {
            return res.status(400).json({ error: 'Area parameter is required' });
        }

        const cacheKey = `area_name_${target}`;
        let currentMaxId = 0;
        try {
            const maxIdRes = await db.query('SELECT MAX(id) as max_id FROM accidents');
            currentMaxId = parseInt(maxIdRes.rows[0]?.max_id, 10) || 0;

            if (!forceRefresh) {
                const cacheRes = await db.query(
                    'SELECT data, last_accident_id FROM ai_analysis_cache WHERE analysis_type = $1 AND identifier = $2',
                    ['jurisdiction', cacheKey]
                );
                if (cacheRes.rows.length > 0 && cacheRes.rows[0].last_accident_id >= currentMaxId) {
                    return res.json(cacheRes.rows[0].data);
                }
            }
        } catch (cacheErr) {
            console.warn('⚠️ [Area Insights] Cache read failed:', cacheErr.message);
        }

        const areaWhere = target.toLowerCase() === 'unknown area'
            ? `(l.area IS NULL OR TRIM(l.area) = '')`
            : `LOWER(TRIM(COALESCE(l.area, ''))) = LOWER(TRIM($1))`;
        const params = target.toLowerCase() === 'unknown area' ? [] : [target];

        const [totalRes, severityRes, causeRes, timeRes, ageRes, vehicleRes, monthlyRes, accidentDataResult] = await Promise.all([
            db.query(`
                SELECT COUNT(a.id)::int as total
                FROM accidents a
                LEFT JOIN locations l ON a.id = l.accident_id
                WHERE ${areaWhere}
            `, params),
            db.query(`
                SELECT a.severity, COUNT(a.id)::int as count
                FROM accidents a
                LEFT JOIN locations l ON a.id = l.accident_id
                WHERE ${areaWhere}
                GROUP BY a.severity
                ORDER BY count DESC
            `, params),
            db.query(`
                SELECT a.cause, COUNT(a.id)::int as count
                FROM accidents a
                LEFT JOIN locations l ON a.id = l.accident_id
                WHERE ${areaWhere} AND a.cause IS NOT NULL AND a.cause != 'Under Investigation'
                GROUP BY a.cause
                ORDER BY count DESC
                LIMIT 10
            `, params),
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
                FROM accidents a
                LEFT JOIN locations l ON a.id = l.accident_id
                WHERE ${areaWhere} AND a.incident_date IS NOT NULL
                GROUP BY time_slot
                ORDER BY count DESC
            `, params),
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
                WHERE ${areaWhere} AND v.age IS NOT NULL
                GROUP BY age_group
                ORDER BY count DESC
            `, params),
            db.query(`
                SELECT vh.vehicle_type, COUNT(vh.id)::int as count
                FROM vehicles vh
                JOIN accidents a ON vh.accident_id = a.id
                LEFT JOIN locations l ON a.id = l.accident_id
                WHERE ${areaWhere} AND vh.vehicle_type IS NOT NULL AND vh.vehicle_type != 'Unknown'
                GROUP BY vh.vehicle_type
                ORDER BY count DESC
            `, params),
            db.query(`
                SELECT TO_CHAR(a.incident_date, 'Mon-YYYY') as month, COUNT(a.id)::int as count
                FROM accidents a
                LEFT JOIN locations l ON a.id = l.accident_id
                WHERE ${areaWhere} AND a.incident_date IS NOT NULL
                GROUP BY month, DATE_TRUNC('month', a.incident_date)
                ORDER BY DATE_TRUNC('month', a.incident_date) ASC
                LIMIT 12
            `, params),
            db.query(`
                SELECT a.fir_number, a.incident_date, a.cause, a.severity, l.address, l.area
                FROM accidents a
                LEFT JOIN locations l ON a.id = l.accident_id
                WHERE ${areaWhere}
                ORDER BY a.incident_date DESC NULLS LAST
                LIMIT 30
            `, params)
        ]);

        const totalAccidents = parseInt(totalRes.rows[0]?.total, 10) || 0;
        if (totalAccidents === 0) {
            return res.json({
                success: true,
                area: target,
                total_accidents: 0,
                message: 'No accidents found for this area.'
            });
        }

        const fatalCount = severityRes.rows.find((s) => s.severity === 'Fatal')?.count || 0;
        const fatalityRate = totalAccidents > 0 ? parseFloat(((fatalCount / totalAccidents) * 100).toFixed(1)) : 0;
        const summariesLines = (accidentDataResult.rows || []).map((a) => {
            const dateLabel = a.incident_date ? new Date(a.incident_date).toLocaleDateString() : 'Unknown date';
            return `- FIR ${a.fir_number} (${dateLabel}): ${a.severity} accident at ${a.address || 'Unknown'}. Cause: ${a.cause || 'Unknown'}`;
        }).join('\n');

        const getTop = (rows, field) => (rows[0] && rows[0][field]) ? rows[0][field] : 'Unknown';
        const stats = {
            area_name: target,
            total_accidents: totalAccidents,
            fatality_percentage: fatalityRate,
            most_common_cause: getTop(causeRes.rows, 'cause'),
            high_risk_age_group: getTop(ageRes.rows, 'age_group'),
            peak_time: getTop(timeRes.rows, 'time_slot'),
            most_risky_vehicle: getTop(vehicleRes.rows, 'vehicle_type'),
            severity_distribution: severityRes.rows,
            cause_distribution: causeRes.rows,
            time_distribution: timeRes.rows,
            age_distribution: ageRes.rows,
            vehicle_distribution: vehicleRes.rows,
            monthly_trend: monthlyRes.rows,
            accident_summaries: summariesLines
        };

        const aiResult = await generateJurisdictionInsights(stats, target);
        const responsePayload = {
            success: true,
            area: target,
            input_stats: stats,
            ...aiResult.insights,
            meta: {
                provider: aiResult.provider,
                model: aiResult.model,
                latency_ms: aiResult.latencyMs
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
        } catch (cacheWriteErr) {
            console.warn('⚠️ [Area Insights] Cache write failed:', cacheWriteErr.message);
        }

        return res.json(responsePayload);
    } catch (err) {
        console.error('❌ [Area Insights] Error generating insights:', err.message);
        return res.status(500).json({ error: 'Failed to generate area insights', details: err.message });
    }
};

module.exports = {
    getJurisdictionsSummary,
    getJurisdictionHierarchy,
    getExclusiveSummary,
    getJurisdictionInsights,
    getAreaInsights
};
