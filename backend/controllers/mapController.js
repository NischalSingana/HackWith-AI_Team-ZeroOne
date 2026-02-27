/**
 * Map Controller — Accident location data for Leaflet maps
 * ==========================================================
 *  - GET /api/map/locations → All accident locations with lat/lng
 *  - GET /api/map/heatmap   → Heatmap data points [lat, lng, intensity]
 *  - POST /api/map/geocode  → Geocode an address and store lat/lng
 */

const db = require('../db');
const axios = require('axios');
const { resolveCanonicalStation } = require('../utils/policeStationResolver');

// ========================================================================
// GET /api/map/locations — All accident markers for the map
// ========================================================================
exports.getMapLocations = async (req, res) => {
  try {
    const includeAll = req.query.all === 'true';
    const coordFilter = includeAll ? '' : 'WHERE l.latitude IS NOT NULL AND l.longitude IS NOT NULL';

    const result = await db.query(`
      SELECT 
        a.id, a.fir_number, a.severity, a.cause, a.incident_date,
        a.confidence_score, a.raw_text,
        l.address, l.area, l.city, l.latitude, l.longitude,
        (SELECT COUNT(*) FROM victims v WHERE v.accident_id = a.id) as victim_count,
        (SELECT COUNT(*) FROM victims v WHERE v.accident_id = a.id AND v.is_fatality = true) as fatality_count
      FROM accidents a
      LEFT JOIN locations l ON l.accident_id = a.id
      ${coordFilter}
      ORDER BY a.created_at DESC
    `);

    const markers = result.rows.map(row => ({
      id: row.id,
      fir_number: row.fir_number,
      severity: row.severity,
      cause: row.cause,
      incident_date: row.incident_date,
      address: row.address,
      area: row.area || '',
      city: row.city || '',
      police_station: resolveCanonicalStation(row.raw_text, row.area),
      lat: row.latitude ? parseFloat(row.latitude) : null,
      lng: row.longitude ? parseFloat(row.longitude) : null,
      victim_count: parseInt(row.victim_count),
      fatality_count: parseInt(row.fatality_count),
      confidence_score: row.confidence_score,
    }));

    res.json({
      success: true,
      count: markers.length,
      center: { lat: 16.60, lng: 80.45 },
      data: markers,
    });
  } catch (err) {
    console.error('❌ getMapLocations error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ========================================================================
// GET /api/map/heatmap — Heatmap data: [lat, lng, intensity]
// ========================================================================
exports.getHeatmapData = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        l.latitude, l.longitude, a.severity,
        COUNT(*) OVER (PARTITION BY l.area) as area_accident_count
      FROM accidents a
      INNER JOIN locations l ON l.accident_id = a.id
      WHERE l.latitude IS NOT NULL AND l.longitude IS NOT NULL
    `);

    // Convert to heatmap format: [lat, lng, intensity]
    // Intensity: Fatal=1.0, Grievous=0.7, Non-Fatal=0.4, Unknown=0.3
    const severityWeight = {
      'Fatal': 1.0,
      'Grievous': 0.7,
      'Non-Fatal': 0.4,
      'Unknown': 0.3,
    };

    const points = result.rows.map(row => ([
      parseFloat(row.latitude),
      parseFloat(row.longitude),
      severityWeight[row.severity] || 0.3,
    ]));

    res.json({
      success: true,
      count: points.length,
      data: points,
    });
  } catch (err) {
    console.error('❌ getHeatmapData error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ========================================================================
// POST /api/map/geocode — Geocode address & update location in DB
// ========================================================================
exports.geocodeAndStore = async (req, res) => {
  const { geocodeAddress } = require('../services/geocoder');
  try {
    const { accident_id, address } = req.body;

    if (!accident_id || !address) {
      return res.status(400).json({ error: 'accident_id and address are required' });
    }

    // Check if already geocoded
    const existing = await db.query(
      'SELECT latitude, longitude FROM locations WHERE accident_id = $1',
      [accident_id]
    );

    if (existing.rows[0]?.latitude && existing.rows[0]?.longitude) {
      return res.json({
        success: true,
        message: 'Already geocoded',
        lat: parseFloat(existing.rows[0].latitude),
        lng: parseFloat(existing.rows[0].longitude),
      });
    }

    const result = await geocodeAddress(address);

    if (!result) {
      return res.status(404).json({ error: 'Could not geocode this address' });
    }

    // Store permanently
    await db.query(
      'UPDATE locations SET latitude = $1, longitude = $2 WHERE accident_id = $3',
      [result.lat, result.lng, accident_id]
    );

    console.log(`✅ Geocoded & stored: ${address} → [${result.lat}, ${result.lng}]`);

    res.json({ success: true, lat: result.lat, lng: result.lng, display_name: result.display_name });
  } catch (err) {
    console.error('❌ geocodeAndStore error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ========================================================================
// POST /api/map/geocode-all — Batch geocode all locations missing lat/lng
// ========================================================================
exports.geocodeAll = async (req, res) => {
  const { geocodeAddress } = require('../services/geocoder');
  try {
    const missing = await db.query(`
      SELECT l.id, l.accident_id, l.address, l.area, l.city
      FROM locations l
      WHERE (l.latitude IS NULL OR l.longitude IS NULL)
        AND (l.address IS NOT NULL OR l.area IS NOT NULL)
    `);

    console.log(`🗺️  Batch geocoding ${missing.rows.length} locations...`);

    let geocoded = 0;
    let failed = 0;

    for (const loc of missing.rows) {
      const fullAddress = [loc.address, loc.area, loc.city].filter(Boolean).join(', ');

      try {
        const result = await geocodeAddress(fullAddress);

        if (result) {
          await db.query(
            'UPDATE locations SET latitude = $1, longitude = $2 WHERE id = $3',
            [result.lat, result.lng, loc.id]
          );
          geocoded++;
          console.log(`   ✅ ${fullAddress} → [${result.lat}, ${result.lng}]`);
        } else {
          failed++;
          console.log(`   ❌ No results for: ${fullAddress}`);
        }

        // Respect Nominatim rate limit: 1 req/sec
        await new Promise(r => setTimeout(r, 1100));
      } catch (geoErr) {
        failed++;
        console.error(`   ❌ Failed: ${fullAddress} — ${geoErr.message}`);
      }
    }

    res.json({
      success: true,
      total: missing.rows.length,
      geocoded,
      failed,
    });
  } catch (err) {
    console.error('❌ geocodeAll error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

