const axios = require('axios');

// ============================================================
// NTR District Bounds (tight)
// Covers: Vijayawada, Jaggaiahpet, Nandigama, Tiruvuru,
//         Mylavaram, Ibrahimpatnam, Gannavaram, Chillakallu, etc.
// ============================================================
const NTR_DISTRICT_BOUNDS = {
    south: 16.25,
    west: 80.00,
    north: 16.95,
    east: 80.90,
};

// Center of NTR District (NOT Vijayawada)
const NTR_DISTRICT_CENTER = { lat: 16.60, lng: 80.45 };

// ============================================================
// Known area coordinates across NTR District
// ============================================================
const KNOWN_AREAS = {
    // Vijayawada Urban
    'ayyappa nagar': { lat: 16.4877, lng: 80.6707 },
    'yanamalakuduru': { lat: 16.4780, lng: 80.6600 },
    'benz circle': { lat: 16.4996, lng: 80.6634 },
    'governorpet': { lat: 16.5157, lng: 80.6229 },
    'gandhi nagar': { lat: 16.5097, lng: 80.6371 },
    'labbipet': { lat: 16.5088, lng: 80.6412 },
    'moghalrajpuram': { lat: 16.5137, lng: 80.6361 },
    'patamata': { lat: 16.4962, lng: 80.6585 },
    'auto nagar': { lat: 16.4886, lng: 80.6711 },
    'krishna lanka': { lat: 16.5224, lng: 80.6107 },
    'machavaram': { lat: 16.5285, lng: 80.6175 },
    'gunadala': { lat: 16.5253, lng: 80.6357 },
    'suryaraopet': { lat: 16.5101, lng: 80.6266 },
    'kothapet': { lat: 16.5077, lng: 80.6440 },
    'ashok nagar': { lat: 16.5021, lng: 80.6520 },
    'payakapuram': { lat: 16.5170, lng: 80.6470 },
    'wynchipet': { lat: 16.5140, lng: 80.6170 },
    'chuttugunta': { lat: 16.5080, lng: 80.6370 },
    'ajit singh nagar': { lat: 16.4970, lng: 80.6480 },
    'satyanarayanapuram': { lat: 16.5210, lng: 80.6340 },
    'vidyadharapuram': { lat: 16.5050, lng: 80.6540 },
    'ram nagar': { lat: 16.5030, lng: 80.6550 },
    'one town': { lat: 16.5130, lng: 80.6200 },
    'two town': { lat: 16.5090, lng: 80.6300 },
    'three town': { lat: 16.5060, lng: 80.6400 },
    'seethanagaram': { lat: 16.5200, lng: 80.6050 },
    'prakasam barrage': { lat: 16.5140, lng: 80.6120 },
    'mv road': { lat: 16.5100, lng: 80.6350 },
    'mg road': { lat: 16.5120, lng: 80.6320 },
    'ring road': { lat: 16.4900, lng: 80.6500 },

    // NTR District Towns & Mandals
    'penamaluru': { lat: 16.4700, lng: 80.6750 },
    'kanuru': { lat: 16.4850, lng: 80.7010 },
    'tadepalli': { lat: 16.4740, lng: 80.6050 },
    'mangalagiri': { lat: 16.4310, lng: 80.5680 },
    'nunna': { lat: 16.4420, lng: 80.5990 },
    'poranki': { lat: 16.4890, lng: 80.5760 },
    'gannavaram': { lat: 16.5430, lng: 80.8040 },
    'ibrahimpatnam': { lat: 16.5780, lng: 80.5160 },
    'mylavaram': { lat: 16.7490, lng: 80.6560 },
    'kondapalli': { lat: 16.6180, lng: 80.5330 },
    'chillakallu': { lat: 16.6200, lng: 80.4500 },
    'vuyyuru': { lat: 16.3670, lng: 80.8460 },
    'jaggayyapeta': { lat: 16.8920, lng: 80.0980 },
    'jaggaiahpet': { lat: 16.8920, lng: 80.0980 },
    'tiruvuru': { lat: 16.9060, lng: 80.6120 },
    'nandigama': { lat: 16.7720, lng: 80.2860 },
    'undavalli': { lat: 16.4940, lng: 80.5780 },

    // Roads & Highways
    'eluru road': { lat: 16.5050, lng: 80.5900 },
    'bandar road': { lat: 16.4980, lng: 80.6900 },
    'nh16': { lat: 16.4950, lng: 80.6600 },
    'nh65': { lat: 16.7000, lng: 80.3000 },
    'nh-65': { lat: 16.7000, lng: 80.3000 },
    'nh 65': { lat: 16.7000, lng: 80.3000 },
    'national highway': { lat: 16.4950, lng: 80.6600 },
};

// ============================================================
// Keywords indicating existing location context in address
// ============================================================
const LOCATION_CONTEXT_KEYWORDS = [
    'mandal', 'district', 'commissionerate', 'municipality', 'rural',
    'andhra pradesh', 'a.p.', 'a.p',
    'ntr', 'krishna',
    'vijayawada', 'jaggaiahpet', 'jaggayyapeta', 'nandigama',
    'tiruvuru', 'mylavaram', 'ibrahimpatnam', 'gannavaram',
    'vuyyuru', 'gudivada', 'machilipatnam', 'nuzvid',
    'kondapalli', 'chillakallu', 'penamaluru', 'mangalagiri',
    'tadepalli', 'kanuru', 'nunna', 'poranki',
];

// ============================================================
// Core Functions
// ============================================================

/**
 * Check if address already has location context
 */
function hasLocationContext(address) {
    const lower = address.toLowerCase();
    return LOCATION_CONTEXT_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Build geocoding query — NEVER appends "Vijayawada"
 */
function buildGeoQuery(address) {
    if (hasLocationContext(address)) {
        return `${address}, Andhra Pradesh, India`;
    }
    return `${address}, NTR District, Andhra Pradesh, India`;
}

/**
 * Validate coordinates are within NTR District bounds
 */
function isWithinRegion(lat, lng) {
    return (
        lat >= NTR_DISTRICT_BOUNDS.south &&
        lat <= NTR_DISTRICT_BOUNDS.north &&
        lng >= NTR_DISTRICT_BOUNDS.west &&
        lng <= NTR_DISTRICT_BOUNDS.east
    );
}

/**
 * Match known area from address string
 */
function matchKnownArea(address) {
    if (!address) return null;
    const lower = address.toLowerCase();

    const sortedAreas = Object.entries(KNOWN_AREAS)
        .sort((a, b) => b[0].length - a[0].length);

    for (const [area, coords] of sortedAreas) {
        if (lower.includes(area)) {
            console.log(`   📍 Matched known area: "${area}" [${coords.lat}, ${coords.lng}]`);
            return coords;
        }
    }
    return null;
}

/**
 * Extract meaningful location parts from a complex address
 * Returns last 1-2 meaningful parts (town/mandal name)
 */
function extractLocationParts(address) {
    if (!address) return null;

    const cleaned = address
        .replace(/^(opp\.?|opposite|near|behind|beside|adj\.?|adjacent|out\s*skirts?\s*(of)?)\s+/i, '')
        .replace(/,\s*/g, ', ')
        .trim();

    const parts = cleaned.split(',')
        .map(p => p.trim())
        .filter(p => p.length > 2)
        .filter(p => !/^(nh|national highway|railway|bridge|road)$/i.test(p));

    if (parts.length >= 2) {
        return parts.slice(-2).join(', ');
    }
    if (parts.length === 1) {
        return parts[0];
    }
    return null;
}

/**
 * Search Google Maps Geocoding API with NTR District biasing
 */
async function googleMapsSearch(query) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        console.error('❌ GOOGLE_MAPS_API_KEY is missing in environment variables.');
        return null;
    }

    try {
        const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
                address: query,
                key: apiKey,
                bounds: `${NTR_DISTRICT_BOUNDS.south},${NTR_DISTRICT_BOUNDS.west}|${NTR_DISTRICT_BOUNDS.north},${NTR_DISTRICT_BOUNDS.east}`,
                region: 'in',
                components: 'administrative_area:Andhra Pradesh|country:IN',
            },
            timeout: 10000,
        });

        if (response.data.status === 'OK' && response.data.results.length > 0) {
            const r = response.data.results[0];
            const loc = r.geometry.location;
            console.log(`   ✅ Google result: ${r.formatted_address} [${loc.lat}, ${loc.lng}]`);
            return {
                lat: loc.lat,
                lng: loc.lng,
                display_name: r.formatted_address,
            };
        } else {
            console.log(`   ⚠️ Google Maps API status: ${response.data.status}`);
            if (response.data.error_message) {
                console.error(`   Error: ${response.data.error_message}`);
            }
        }
    } catch (error) {
        console.error('   ❌ Google Maps API Request Failed:', error.message);
    }
    return null;
}

/**
 * Main geocoding function.
 *
 * Strategy:
 *   1. Google Maps with smart query + bounds + component filter
 *      → Validate result is in NTR District
 *   2. Known area lookup (fallback)
 *   3. Retry Google Maps with simplified address parts
 *      → Validate result is in NTR District
 *   4. Return null (NEVER returns fake coordinates)
 */
async function geocodeAddress(address) {
    if (!address) return null;

    // ── Strategy 1: Google Maps with full address ──
    try {
        const query = buildGeoQuery(address);
        console.log(`🗺️  Geocoding: "${query}"`);

        const result = await googleMapsSearch(query);
        if (result) {
            if (isWithinRegion(result.lat, result.lng)) {
                console.log(`   ✅ ACCEPTED — inside NTR District`);
                return result;
            }
            console.log(`   ❌ REJECTED — [${result.lat}, ${result.lng}] is OUTSIDE NTR District bounds`);
        }
    } catch (err) {
        console.error('   ⚠️ Strategy 1 failed:', err.message);
    }

    // ── Strategy 2: Known area lookup ──
    const knownCoords = matchKnownArea(address);
    if (knownCoords) {
        if (isWithinRegion(knownCoords.lat, knownCoords.lng)) {
            const offset = () => (Math.random() - 0.5) * 0.003;
            console.log(`   ✅ Using known area coordinates`);
            return {
                lat: knownCoords.lat + offset(),
                lng: knownCoords.lng + offset(),
                display_name: address,
            };
        }
        console.log(`   ❌ Known area coords outside bounds, skipping`);
    }

    // ── Strategy 3: Retry with simplified address parts ──
    try {
        const parts = extractLocationParts(address);
        if (parts) {
            const simpleQuery = `${parts}, NTR District, Andhra Pradesh, India`;
            console.log(`   🔄 Retry with: "${simpleQuery}"`);
            const simpleResult = await googleMapsSearch(simpleQuery);
            if (simpleResult && isWithinRegion(simpleResult.lat, simpleResult.lng)) {
                console.log(`   ✅ ACCEPTED (simplified) — inside NTR District`);
                return simpleResult;
            }
            if (simpleResult) {
                console.log(`   ❌ REJECTED (simplified) — [${simpleResult.lat}, ${simpleResult.lng}] outside bounds`);
            }
        }
    } catch (err) {
        console.error('   ⚠️ Strategy 3 failed:', err.message);
    }

    // ── No valid result — return null, NEVER fake coordinates ──
    console.log(`   ❌ All strategies failed for: "${address}" — returning null`);
    return null;
}

module.exports = { geocodeAddress, matchKnownArea, NTR_DISTRICT_CENTER, NTR_DISTRICT_BOUNDS, isWithinRegion };
