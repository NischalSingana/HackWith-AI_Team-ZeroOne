/**
 * FIR Controller — Upload, Store, and Retrieve Accident Data
 * ===========================================================
 * Handles detailed accident reconstruction, legal analysis, and precise location mapping.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { geocodeAddress } = require('../services/geocoder');
const { uploadToR2, deleteFromR2, getFileStream, listR2Files, downloadR2ToLocal } = require('../services/r2Storage');
const { extractPoliceStation } = require('../utils/policeStationResolver');

// ... (existing code)



// ========================================================================
// HELPERS
// ========================================================================
const Groq = require('groq-sdk');

// ========================================================================
// HELPER: AI Analysis
// ========================================================================
async function analyzeFIRText(text) {
    // Collect all available keys (Groq + OpenRouter)
    const keys = [
        process.env.GROQ_KEY_1,
        process.env.GROQ_KEY_2,
        process.env.GROQ_KEY_3,
        process.env.GROQ_KEY_4,
        process.env.GROQ_KEY_5,
        process.env.GROQ_KEY_6,
        process.env.GROQ_KEY_7,
        process.env.GROQ_KEY_8,
        process.env.GROQ_API_KEY,
        process.env.OPENROUTER_KEY_1,
        process.env.OPENROUTER_KEY_2,
        process.env.OPENROUTER_KEY_3,
        process.env.OPENROUTER_KEY_4
    ].filter(Boolean);

    // DEBUG LOGGING START
    const debugLog = (msg) => {
        const logMsg = `[${new Date().toISOString()}] ${msg}\n`;
        // Try writing to root first (where typical node execution happens)
        fs.appendFile('llm_debug.log', logMsg, (err) => {
             if (err) {
                 // Fallback to relative path
                 fs.appendFile(path.join(__dirname, '../llm_debug.log'), logMsg, () => {});
             }
        });
    }

    if (!text) {
        debugLog('❌ analyzeFIRText: No text provided to analyze.');
        return null;
    }
    if (keys.length === 0) {
        debugLog('❌ analyzeFIRText: No API Keys found in environment.');
        return null;
    }

    debugLog(`🚀 Starting LLM Analysis. Text length: ${text.length} chars. Available Keys: ${keys.length}`);

    // Try each key until success or exhaustion
    for (let i = 0; i < keys.length; i++) {
        const apiKey = keys[i];
        const isGroq = apiKey.startsWith('gsk_');
        const isOpenRouter = apiKey.startsWith('sk-or-');
        const keyId = apiKey.substring(0, 8) + '...'; 

        try {
            const providerName = isGroq ? 'Groq (Llama-3-70B)' : (isOpenRouter ? 'OpenRouter (Llama-3-70B)' : 'Unknown');
            console.log(`🧠 Enhancing data with ${providerName} [Attempt ${i+1}/${keys.length}] using key ${keyId}`);
            debugLog(`🔄 Attempt ${i+1} (${providerName}) with key ${keyId}`);

            const prompt = `
                You are a Senior Traffic Safety Analyst and Accident Reconstruction Expert reporting directly to the NTR Police Commissioner. 
                Analyze the following FIR text with MAXIMUM DETAIL. 

                YOUR GOAL: Extract EVERY single person (victims/passengers), EVERY vehicle, and the FULL legal context.

                CRITICAL NEGATIVE CONSTRAINTS:
                - DO NOT output "Name Redacted" if a name exists. Extract the ACTUAL NAME of the victim, passenger, or deceased.
                - If you see "s for delay in reporting", that is a header. The ACTUAL technical cause is in the narrative.
                - IGNORE Preamble headers (Station name, etc.) when extracting the Incident Location. Use the narrative description of the road/landmark.

                Text to analyze (Full OCR):
                """
                ${text.substring(0, 50000)}
                """

                Extract and Analyze in STRICT JSON format:
                {
                    "fir_number": "...",
                    "date_time": "DD/MM/YYYY HH:MM",
                    "cause": "Professional technical cause (e.g. Over-speeding, Rash driving, Brake failure). NOT A HEADER.",
                    "severity": "Fatal/Grievous/Non-Fatal",
                    "location": { "address": "Detailed Landmark/Road", "area": "Village/Mandal", "city": "NTR District", "lat": numeric, "lng": numeric },
                    "victims": [{ "name": "Full Name (IMPORTANT)", "age": int, "gender": "...", "injury": "..." }],
                    "vehicles": [{ "type": "...", "number": "...", "driver_name": "Full Name" }],
                    "ai_analysis": {
                      "summary": "Comprehensive summary of the incident.",
                      "accident_reconstruction": "Exhaustive 4-6 sentence reconstruction of mechanics.",
                      "contributing_factors": ["Human error", "Infrastructure", "Weather", "etc."],
                      "road_conditions": "Surface type, condition, width, etc. (e.g., 'Wet/Slippery', 'Pot-holed')",
                      "visibility": "Lighting conditions (e.g., 'Daylight', 'Dark - No Streetlights')",
                      "weather_conditions": "Weather at time of incident (e.g., 'Clear', 'Raining')",
                      "helmet_seatbelt": "Usage status (e.g., 'Helmet Not Worn', 'Seatbelt Used')",
                      "alcohol_drugs": "Intoxication status (e.g., 'Alcohol Detected', 'None')",
                      "speed_analysis": "Estimated speed or behavior (e.g., 'High Speed (>80kmph)', 'Moderate')",
                      "emergency_response": "Details on ambulance/police arrival (e.g., '108 Ambulance shifted victim')",
                      "blackspot_prediction": "Is this a potential blackspot? (Yes/No + Reason)",
                      "similar_case_pattern": "Reference to common accident patterns in this area",
                      "legal_analysis": { 
                        "applicable_sections": "List all sections (e.g. 106(1) BNS, 281 BNS, 125(a) BNS, 304A IPC, 184 MV Act)", 
                        "charges_explanation": "Explain why these specific sections apply.",
                        "penalty_range": "Potential punishment/fine for these offences (e.g., 'Up to 5 years imprisonment', 'Fine of Rs. 1000')"
                      },
                      "recommendations": { "engineering": "...", "enforcement": "...", "education": "..." },
                      "risk_score": 1-10
                    }
                }
            `;

            let result = null;

            if (isGroq) {
                const groq = new Groq({ apiKey });
                const chatCompletion = await groq.chat.completions.create({
                    messages: [{ role: 'user', content: prompt }],
                    model: 'llama-3.3-70b-versatile',
                    temperature: 0.1,
                    response_format: { type: 'json_object' }
                });
                result = JSON.parse(chatCompletion.choices[0].message.content);

            } else if (isOpenRouter) {
                const orResponse = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                    model: 'meta-llama/llama-3.3-70b-instruct', // Similar model on OpenRouter
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.1,
                    response_format: { type: 'json_object' }
                }, {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'HTTP-Referer': 'https://nischalsingana.com', // Required by OpenRouter
                        'X-Title': 'FIR Analysis Tool'
                    },
                    timeout: 120000 // 2 min timeout
                });

                if (orResponse.data && orResponse.data.choices && orResponse.data.choices[0]) {
                     const content = orResponse.data.choices[0].message.content;
                     // Clean markdown if present
                     const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
                     result = JSON.parse(jsonStr);
                } else {
                    throw new Error('OpenRouter response structure invalid');
                }
            }

            if (result) {
                debugLog('✅ LLM Analysis successful!');
                return result;
            }

        } catch (llmErr) {
            const isRateLimit = (llmErr.response && llmErr.response.status === 429) || 
                                llmErr.message.includes('429') || 
                                llmErr.status === 429 || 
                                llmErr.code === 'rate_limit_exceeded';
            
            debugLog(`⚠️ Error with key ${keyId}: ${llmErr.message}`);
            
            if (isRateLimit) {
                console.warn(`⚠️ Rate limit hit for key ${keyId}. Switching to next...`);
                continue;
            } else {
                console.error(`⚠️ Enhancement failed with ${keyId}:`, llmErr.message);
                // Also treat 500s or other errors as "move to next provider" in high-throughput scenarios
                // Wait, if content was invalid JSON, maybe try another model? 
                // Let's safe-fail to next key.
                continue; 
            }
        }
    }
    
    debugLog('❌ All API keys exhausted or failed.');
    console.error('❌ FATAL: All API keys (Groq + OpenRouter) exhausted.');
    return null;
}

// Fallback creation removed to ensure data integrity. All data must come from real FIR uploads via AI service.

// ========================================================================
// POST /api/upload — Process FIR and save to database
// ========================================================================

exports.uploadFIR = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const filePath = req.file.path;
        const fileName = req.file.filename;

        // Step 1: Send file to AI Service for OCR + NLP
        const FormData = require('form-data');
        const form = new FormData();
        form.append('file', fs.createReadStream(filePath));

        const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000/process_fir';
        console.log(`\n📤 Sending ${fileName} to AI service...`);

        let data;
        try {
            const aiResponse = await axios.post(aiServiceUrl, form, {
                headers: { ...form.getHeaders() },
                timeout: 120000,
            });
            data = aiResponse.data;
            console.log(`✅ AI extracted (Basic): FIR#${data.fir_number}, Severity: ${data.severity}`);
        } catch (aiErr) {
            console.error(`❌ AI service unavailable or failed to process document: ${aiErr.message}`);
            return res.status(503).json({ 
                error: 'Document analysis failed. Please ensure the AI extraction service is running and the document is a valid FIR PDF.' 
            });
        }

        if (data.fir_number === 'INVALID_FILE') {
             return res.status(400).json({ error: 'Invalid file uploaded (appears to be an HTML error page, not a PDF).' });
        }

        // Step 1.5: Enhance with Llama-3 (Groq) if raw_text is available
        const enhancedData = await analyzeFIRText(data.raw_text);
        
        if (enhancedData) {
            // Merge enhanced data (prefer LLM)
            data = { ...data, ...enhancedData };
            // Ensure victims/vehicles are arrays
            data.victims = Array.isArray(enhancedData.victims) ? enhancedData.victims : data.victims;
            data.vehicles = Array.isArray(enhancedData.vehicles) ? enhancedData.vehicles : data.vehicles;
            data.confidence_score = 0.95; // LLM is usually accurate

            console.log(`✨ Llama-3 Enhanced: FIR#${data.fir_number}, Severity: ${data.severity}, Victims: ${data.victims.length}`);

            // --- POST-EXTRACTION SAFETY GUARD ---
            const boilerplateRegex = /reasons\s+for\s+delay|delay\s+in\s+reporting|police\s+station|ion\s+report|p\.s\./i;
            if (data.cause && boilerplateRegex.test(data.cause)) {
                 console.log(`   🚨 SAFETY: Rejecting boilerplate cause: "${data.cause}"`);
                 data.cause = "Under Investigation";
                 if (data.ai_analysis) data.ai_analysis.accident_reconstruction = "Narrative analysis pending - potential boilerplate detected in source text.";
            }
            if (data.location && data.location.address && boilerplateRegex.test(data.location.address)) {
                 console.log(`   🚨 SAFETY: Rejecting boilerplate location: "${data.location.address}"`);
                 data.location.address = data.location.area || "NTR District";
            }
        }

        // --- SEVERITY NORMALIZATION ---
        // Ensure severity matches DB constraint: 'Fatal', 'Grievous', 'Non-Fatal', 'Unknown'
        const validSeverities = ['Fatal', 'Grievous', 'Non-Fatal', 'Unknown'];
        if (data.severity) {
             const s = data.severity.toLowerCase();
             if (s.includes('fatal') && !s.includes('non')) data.severity = 'Fatal';
             else if (s.includes('grievous') || s.includes('serious')) data.severity = 'Grievous';
             else if (s.includes('simple') || s.includes('minor') || s.includes('non-injury') || s.includes('no injury')) data.severity = 'Non-Fatal';
             else if (!validSeverities.includes(data.severity)) data.severity = 'Unknown';
        } else {
             data.severity = 'Unknown';
        }

        // --- TRUNCATION SAFETY ---
        if (data.fir_number && data.fir_number.length > 100) data.fir_number = data.fir_number.substring(0, 100);
        if (data.location) {
            if (data.location.city && data.location.city.length > 100) data.location.city = data.location.city.substring(0, 100);
            if (data.location.area && data.location.area.length > 200) data.location.area = data.location.area.substring(0, 200);
        }
        if (data.victims) {
            data.victims.forEach(v => {
                if (v.injury && v.injury.length > 100) v.injury = v.injury.substring(0, 100);
                if (v.name && v.name.length > 200) v.name = v.name.substring(0, 200);
                // Sanitize Age
                if (v.age) {
                     const ageStr = String(v.age);
                     const match = ageStr.match(/\d+/);
                     if (match) v.age = parseInt(match[0]);
                     else v.age = null;
                }
            });
        }
        if (data.vehicles) {
            data.vehicles.forEach(v => {
                if (v.type && v.type.length > 50) v.type = v.type.substring(0, 50);
                if (v.number && v.number.length > 30) v.number = v.number.substring(0, 30);
                if (v.driver_name && v.driver_name.length > 200) v.driver_name = v.driver_name.substring(0, 200);
            });
        }

        // Step 2: Upload PDF to Cloudflare R2
        let pdfUrl = filePath;
        let r2Key = null;
        try {
            const r2Result = await uploadToR2(filePath, req.file.originalname);
            if (r2Result.success) {
                pdfUrl = r2Result.url;
                r2Key = r2Result.key;
                console.log(`☁️  PDF stored in R2: ${r2Result.key}`);
                // Clean up local file after successful R2 upload
                fs.unlink(filePath, () => {});
            } else {
                console.log(`⚠️  R2 upload skipped: ${r2Result.error}, keeping local file`);
            }
        } catch (r2Err) {
            console.error('⚠️  R2 upload error (continuing with local):', r2Err.message);
        }

        // Step 3: Save to Database
        let dbSaved = false;
        let accidentId = null;

        try {
            const client = await db.pool.connect();
            try {
                await client.query('BEGIN');

                // Insert accident
                const accResult = await client.query(`
                    INSERT INTO accidents 
                        (fir_number, incident_date, cause, severity, pdf_url, status, confidence_score, ai_analysis, raw_text)
                    VALUES ($1, $2, $3, $4, $5, 'Processed', $6, $7, $8)
                    RETURNING id
                `, [
                    data.fir_number,
                    data.date_time !== 'UNKNOWN' ? parseDate(data.date_time) : null,
                    data.cause,
                    data.severity,
                    pdfUrl,
                    data.confidence_score,
                    data.ai_analysis || null,
                    data.raw_text || null
                ]);
                accidentId = accResult.rows[0].id;

                // Insert location — ALWAYS geocode via Google Maps, never trust AI's lat/lng
                if (data.location) {
                    let geoLat = null;
                    let geoLng = null;

                    // Build the best possible address string for geocoding
                    const fullAddress = [
                        data.location.address,
                        data.location.area,
                        data.location.city
                    ].filter(Boolean).join(', ');

                    if (fullAddress.length > 3) {
                        console.log(`📍 Geocoding location for FIR: "${fullAddress}"`);
                        const geo = await geocodeAddress(fullAddress);
                        if (geo) {
                            geoLat = geo.lat;
                            geoLng = geo.lng;
                            console.log(`   ✅ Geocoded: [${geoLat}, ${geoLng}]`);
                        } else {
                            console.log(`   ❌ Geocoding returned null for: "${fullAddress}"`);
                        }
                    }

                    await client.query(`
                        INSERT INTO locations (accident_id, address, area, city, latitude, longitude)
                        VALUES ($1, $2, $3, $4, $5, $6)
                    `, [
                        accidentId,
                        data.location.address,
                        data.location.area,
                        data.location.city || 'NTR District',
                        geoLat,
                        geoLng
                    ]);
                }

                if (data.victims && data.victims.length > 0) {
                    for (const v of data.victims) {
                        await client.query(`
                            INSERT INTO victims (accident_id, age, gender, injury_severity, is_fatality, victim_name)
                            VALUES ($1, $2, $3, $4, $5, $6)
                        `, [
                            accidentId,
                            v.age,
                            v.gender,
                            v.injury,
                            data.severity === 'Fatal',
                            v.name || null
                        ]);
                    }
                }

                // Insert vehicles
                if (data.vehicles && data.vehicles.length > 0) {
                    for (const v of data.vehicles) {
                        await client.query(`
                            INSERT INTO vehicles (accident_id, vehicle_type, vehicle_number, driver_name)
                            VALUES ($1, $2, $3, $4)
                        `, [accidentId, v.type, v.number, v.driver_name]);
                    }
                }

                await client.query('COMMIT');
                dbSaved = true;
                console.log(`💾 Saved to database: accident_id=${accidentId}`);

                // --- Ingest to Neo4j Graph DB ---
                try {
                     const graphIngestUrl = aiServiceUrl.replace('/process_fir', '/graph/ingest');
                     const graphPayload = {
                         id: accidentId,
                         fir_number: data.fir_number,
                         incident_date: data.date_time,
                         cause: data.cause,
                         severity: data.severity,
                         confidence_score: data.confidence_score,
                         raw_text: data.raw_text,
                         location: data.location,
                         victims: data.victims,
                         vehicles: data.vehicles
                     };
                     await axios.post(graphIngestUrl, graphPayload, { timeout: 10000 });
                     console.log(`🕸️ Ingested into Graph DB: ${data.fir_number}`);
                } catch (graphErr) {
                     console.error(`⚠️ Graph ingestion failed (non-fatal): ${graphErr.message}`);
                }

            } catch (dbErr) {
                await client.query('ROLLBACK');
                console.error('❌ DB transaction error:', dbErr.message);
            } finally {
                client.release();
            }
        } catch (connErr) {
            console.error('❌ DB connection error:', connErr.message);
        }

        res.json({
            success: true,
            message: dbSaved ? 'FIR Processed & Saved Successfully' : 'FIR Processed (DB save failed)',
            db_saved: dbSaved,
            accident_id: accidentId,
            data,
        });

    } catch (error) {
        console.error('❌ Error processing FIR:', error.message);
        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({ error: 'AI Service is not running. Start it on port 8000.' });
        }
        res.status(500).json({ error: 'Failed to process FIR', details: error.message });
    }
};

// ========================================================================
// GET /api/accidents — List all accidents with location info
// ========================================================================

exports.getAccidents = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                a.id, a.fir_number, a.incident_date, a.cause, a.severity,
                a.status, a.confidence_score, a.created_at,
                l.address, l.area, l.city, l.latitude, l.longitude,
                (SELECT COUNT(*) FROM victims v WHERE v.accident_id = a.id) as victim_count,
                (SELECT COUNT(*) FROM vehicles vh WHERE vh.accident_id = a.id) as vehicle_count
            FROM accidents a
            LEFT JOIN locations l ON l.accident_id = a.id
            ORDER BY a.created_at DESC
        `);
        res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (err) {
        console.error('❌ getAccidents error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ========================================================================
// GET /api/accidents/:id — Full accident detail with all relations
// ========================================================================

exports.getAccidentById = async (req, res) => {
    try {
        const { id } = req.params;
        const [accident, location, victims, vehicles] = await Promise.all([
            db.query('SELECT * FROM accidents WHERE id = $1', [id]),
            db.query('SELECT * FROM locations WHERE accident_id = $1', [id]),
            db.query('SELECT * FROM victims WHERE accident_id = $1', [id]),
            db.query('SELECT * FROM vehicles WHERE accident_id = $1', [id]),
        ]);

        if (accident.rows.length === 0) {
            return res.status(404).json({ error: 'Accident not found' });
        }

        let accidentData = accident.rows[0];

        // CHECK: If AI Analysis is missing but raw_text exists, perform analysis now (Lazy Loading)
        if ((!accidentData.ai_analysis || Object.keys(accidentData.ai_analysis).length === 0) && accidentData.raw_text) {
             console.log(`🔄 Performing lazy AI analysis for Accident #${id}`);
             const enhancedData = await analyzeFIRText(accidentData.raw_text);

             if (enhancedData && enhancedData.ai_analysis) {
                 // Update Database
                 await db.query(`
                    UPDATE accidents 
                    SET ai_analysis = $1, cause = COALESCE(cause, $2), severity = COALESCE(severity, $3)
                    WHERE id = $4
                 `, [
                    enhancedData.ai_analysis, 
                    enhancedData.cause, // fallback update if null
                    enhancedData.severity, // fallback update if null
                    id
                 ]);

                 // Update local object
                 accidentData.ai_analysis = enhancedData.ai_analysis;
                 if (!accidentData.cause) accidentData.cause = enhancedData.cause;
                 if (!accidentData.severity) accidentData.severity = enhancedData.severity;
                 
                 console.log(`✅ Lazy analysis complete & saved for Accident #${id}`);
             }
        }

        // CHECK: If location is missing lat/lng or has default/placeholder coords, re-geocode
        if (location.rows[0]) {
             const loc = location.rows[0];
             const lat = loc.latitude ? parseFloat(loc.latitude) : null;
             const lng = loc.longitude ? parseFloat(loc.longitude) : null;

             // Detect default/placeholder coordinates from AI prompts
             const isDefault = !lat || !lng
                 || (Math.abs(lat - 16.5) < 0.01 && Math.abs(lng - 80.6) < 0.01)   // LLM default
                 || (Math.abs(lat - 16.5062) < 0.01 && Math.abs(lng - 80.648) < 0.01); // Old Vijayawada center

             if (isDefault) {
                 // Build full address for geocoding
                 const parts = [loc.address, loc.area, loc.city].filter(Boolean);
                 let addressStr = parts.join(', ');
                 
                 if (!addressStr || addressStr.length < 5) addressStr = loc.area || loc.city || 'NTR District';
                 
                 console.log(`📍 Re-geocoding (had default coords): "${addressStr}"`);
                 const geo = await geocodeAddress(addressStr);
                 
                 if (geo) {
                     await db.query(`UPDATE locations SET latitude=$1, longitude=$2 WHERE id=$3`, [geo.lat, geo.lng, loc.id]);
                     loc.latitude = geo.lat;
                     loc.longitude = geo.lng;
                     console.log(`✅ Location updated: ${geo.lat}, ${geo.lng}`);
                 } else {
                     console.log(`❌ Geocoding failed for: "${addressStr}"`);
                 }
             }
        }

        res.json({
            success: true,
            data: {
                ...accidentData,
                police_station: extractPoliceStation(accidentData.raw_text),
                location: location.rows[0] || null,
                victims: victims.rows,
                vehicles: vehicles.rows,
            },
        });
    } catch (err) {
        console.error('❌ getAccidentById error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ========================================================================
// GET /api/accidents/:id/pdf — Download/View Original FIR
// ========================================================================

exports.downloadFIR = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT pdf_url, fir_number FROM accidents WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Accident not found' });
        }

        const { pdf_url, fir_number } = result.rows[0];
        if (!pdf_url) {
            return res.status(404).json({ error: 'No PDF attached to this record' });
        }

        console.log(`📂 Attempting to serve PDF: ${pdf_url}`);

        // Strategy 1: Cloudflare R2 (Key or URL)
        const isR2Key = pdf_url.startsWith('fir-pdfs/');
        const isR2Url = pdf_url.includes('r2.cloudflarestorage.com') || 
                       (process.env.R2_PUBLIC_URL && pdf_url.includes(process.env.R2_PUBLIC_URL));

        if (isR2Key || isR2Url) {
            let key = pdf_url;
            if (isR2Url && !isR2Key) {
                const parts = pdf_url.split('/fir-pdfs/');
                if (parts.length > 1) {
                    key = `fir-pdfs/${parts[1]}`;
                }
            }

            console.log(`☁️ Proxying from R2: ${key}`);
            try {
                const stream = await getFileStream(key);
                if (stream) {
                    res.setHeader('Content-Type', 'application/pdf');
                    // Clean up filename for header
                    res.setHeader('Content-Disposition', `inline; filename="FIR_${fir_number.replace(/\//g, '_')}.pdf"`);
                    
                    if (stream.pipe) {
                        return stream.pipe(res);
                    } else {
                        const chunks = [];
                        for await (const chunk of stream) {
                            chunks.push(chunk);
                        }
                        return res.send(Buffer.concat(chunks));
                    }
                }
            } catch (r2Err) {
                console.error('❌ R2 error:', r2Err.message);
                if (isR2Url) return res.redirect(pdf_url);
            }
        }

        // Strategy 2: Local File
        // Check both absolute and relative to project root
        const pathsToTry = [
            pdf_url,
            path.join(__dirname, '..', pdf_url),
            path.join(__dirname, '..', 'uploads', path.basename(pdf_url))
        ];

        for (const p of pathsToTry) {
            if (fs.existsSync(p) && fs.lstatSync(p).isFile()) {
                console.log(`🏠 Serving local file: ${p}`);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `inline; filename="FIR_${fir_number.replace(/\//g, '_')}.pdf"`);
                return fs.createReadStream(p).pipe(res);
            }
        }

        // Strategy 3: External Redirect
        if (pdf_url.startsWith('http')) {
            console.log(`🌐 Redirecting to: ${pdf_url}`);
            return res.redirect(pdf_url);
        }

        res.status(404).json({ error: 'PDF file not found' });
    } catch (err) {
        console.error('❌ downloadFIR error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ========================================================================
// GET /api/stats — Aggregated statistics for dashboard
// ========================================================================

exports.getStats = async (req, res) => {
    try {
        const [
            totalRes,
            severityRes,
            timeRes,
            causeRes,
            ageRes,
            vehicleRes,
            monthlyRes,
            confidenceRes,
            recentRes,
            victimCountRes
        ] = await Promise.all([
            db.query('SELECT COUNT(*) as total FROM accidents'),
            db.query('SELECT severity, COUNT(*)::int as count FROM accidents GROUP BY severity ORDER BY count DESC'),
            db.query(`
                SELECT EXTRACT(HOUR FROM incident_date)::int as hour, COUNT(*)::int as count
                FROM accidents WHERE incident_date IS NOT NULL
                GROUP BY hour ORDER BY hour
            `),
            db.query(`
                SELECT cause, COUNT(*)::int as count FROM accidents 
                WHERE cause IS NOT NULL AND cause != 'Under Investigation'
                GROUP BY cause ORDER BY count DESC LIMIT 10
            `),
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
                FROM victims WHERE age IS NOT NULL
                GROUP BY age_group ORDER BY count DESC
            `),
            db.query(`
                SELECT vehicle_type, COUNT(*)::int as count FROM vehicles
                WHERE vehicle_type IS NOT NULL AND vehicle_type != 'Unknown'
                GROUP BY vehicle_type ORDER BY count DESC
            `),
            db.query(`
                SELECT TO_CHAR(incident_date, 'YYYY-MM') as month, COUNT(*)::int as count
                FROM accidents WHERE incident_date IS NOT NULL
                GROUP BY month ORDER BY month
            `),
            // Average confidence score
            db.query('SELECT ROUND(AVG(confidence_score)::numeric, 2) as avg_confidence FROM accidents WHERE confidence_score > 0'),
            // Recent 5 accidents
            db.query(`
                SELECT a.id, a.fir_number, a.severity, a.cause, a.incident_date, a.created_at,
                       l.area, l.city
                FROM accidents a 
                LEFT JOIN locations l ON l.accident_id = a.id
                ORDER BY a.created_at DESC LIMIT 5
            `),
            // Total victims count
            db.query('SELECT COUNT(*)::int as total FROM victims')
        ]);

        // Compute most dangerous hour
        const peakHour = timeRes.rows.length > 0 
            ? timeRes.rows.reduce((max, row) => row.count > max.count ? row : max, timeRes.rows[0])
            : null;

        // Compute fatality rate
        const totalAccidents = parseInt(totalRes.rows[0]?.total) || 0;
        const fatalCount = severityRes.rows.find(s => s.severity === 'Fatal')?.count || 0;
        const fatalityRate = totalAccidents > 0 ? ((fatalCount / totalAccidents) * 100).toFixed(1) : '0';

        res.json({
            success: true,
            total_accidents: totalAccidents,
            severity: severityRes.rows,
            time_analysis: timeRes.rows,
            top_causes: causeRes.rows,
            age_distribution: ageRes.rows,
            vehicle_types: vehicleRes.rows,
            monthly_trend: monthlyRes.rows,
            avg_confidence: parseFloat(confidenceRes.rows[0]?.avg_confidence) || 0,
            recent_accidents: recentRes.rows,
            total_victims: victimCountRes.rows[0]?.total || 0,
            fatality_rate: parseFloat(fatalityRate),
            peak_hour: peakHour ? { hour: peakHour.hour, count: peakHour.count } : null,
        });
    } catch (err) {
        console.error('❌ getStats error:', err.message);
        res.json({
            success: true,
            total_accidents: 0,
            severity: [],
            time_analysis: [],
            top_causes: [],
            age_distribution: [],
            vehicle_types: [],
            monthly_trend: [],
            avg_confidence: 0,
            recent_accidents: [],
            total_victims: 0,
            fatality_rate: 0,
            peak_hour: null,
        });
    }
};

// ========================================================================
// DELETE /api/accidents/:id — Delete an accident record
// ========================================================================

exports.deleteAccident = async (req, res) => {
    try {
        const { id } = req.params;

        // Get file path/url before deleting
        const fileRes = await db.query('SELECT pdf_url FROM accidents WHERE id = $1', [id]);
        
        if (fileRes.rows.length === 0) {
            return res.status(404).json({ error: 'Accident not found' });
        }

        const pdfUrl = fileRes.rows[0].pdf_url;

        // Delete from DB
        await db.query('DELETE FROM accidents WHERE id = $1', [id]);

        // Cleanup file
        if (pdfUrl) {
            if (pdfUrl.includes('r2.cloudflarestorage.com') || (process.env.R2_PUBLIC_URL && pdfUrl.includes(process.env.R2_PUBLIC_URL))) {
                // It's an R2 URL — extract key
                // Key format: .../fir-pdfs/timestamp-filename.pdf
                const parts = pdfUrl.split('/fir-pdfs/');
                if (parts.length > 1) {
                    const key = `fir-pdfs/${parts[1]}`;
                    await deleteFromR2(key);
                }
            } else {
                // It's a local file path
                if (fs.existsSync(pdfUrl)) {
                    fs.unlink(pdfUrl, (err) => {
                        if (err) console.error('❌ Failed to delete local file:', err);
                        else console.log('🗑️  Deleted local file:', pdfUrl);
                    });
                }
            }
        }

        res.json({ success: true, message: `Accident ${id} deleted` });
    } catch (err) {
        console.error('❌ deleteAccident error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ========================================================================
// GET /api/search?q=keyword — Search across FIR data
// ========================================================================

exports.searchAccidents = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim().length < 2) {
            return res.status(400).json({ error: 'Search query must be at least 2 characters' });
        }

        const searchTerm = `%${q.trim()}%`;
        const result = await db.query(`
            SELECT DISTINCT a.id, a.fir_number, a.incident_date, a.cause, a.severity,
                   a.confidence_score, a.created_at,
                   l.address, l.area, l.city
            FROM accidents a
            LEFT JOIN locations l ON l.accident_id = a.id
            LEFT JOIN victims v ON v.accident_id = a.id
            LEFT JOIN vehicles vh ON vh.accident_id = a.id
            WHERE 
                a.fir_number ILIKE $1 OR
                a.cause ILIKE $1 OR
                a.severity ILIKE $1 OR
                l.address ILIKE $1 OR
                l.area ILIKE $1 OR
                l.city ILIKE $1 OR
                vh.vehicle_number ILIKE $1 OR
                vh.vehicle_type ILIKE $1
            ORDER BY a.created_at DESC
            LIMIT 50
        `, [searchTerm]);

        res.json({ success: true, count: result.rows.length, query: q, data: result.rows });
    } catch (err) {
        console.error('❌ searchAccidents error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ========================================================================
// GET /api/trends — Trend analysis data
// ========================================================================

exports.getTrends = async (req, res) => {
    try {
        const [monthlyRes, dayOfWeekRes, severityMonthlyRes] = await Promise.all([
            // Monthly accidents
            db.query(`
                SELECT TO_CHAR(incident_date, 'YYYY-MM') as month, 
                       TO_CHAR(incident_date, 'Mon YYYY') as label,
                       COUNT(*)::int as count
                FROM accidents WHERE incident_date IS NOT NULL
                GROUP BY month, label ORDER BY month
            `),
            // Day of week distribution
            db.query(`
                SELECT EXTRACT(DOW FROM incident_date)::int as day_num,
                       TO_CHAR(incident_date, 'Day') as day_name,
                       COUNT(*)::int as count
                FROM accidents WHERE incident_date IS NOT NULL
                GROUP BY day_num, day_name ORDER BY day_num
            `),
            // Monthly severity breakdown
            db.query(`
                SELECT TO_CHAR(incident_date, 'YYYY-MM') as month,
                       TO_CHAR(incident_date, 'Mon YYYY') as label,
                       severity,
                       COUNT(*)::int as count
                FROM accidents WHERE incident_date IS NOT NULL AND severity IS NOT NULL
                GROUP BY month, label, severity ORDER BY month
            `)
        ]);

        // Process severity monthly data into stacked format
        const severityByMonth = {};
        severityMonthlyRes.rows.forEach((row) => {
            if (!severityByMonth[row.month]) {
                severityByMonth[row.month] = { month: row.month, label: row.label.trim(), Fatal: 0, Grievous: 0, Simple: 0, 'Non-Injury': 0 };
            }
            const key = row.severity;
            if (key in severityByMonth[row.month]) {
                severityByMonth[row.month][key] = row.count;
            }
        });

        res.json({
            success: true,
            monthly: monthlyRes.rows.map((r) => ({ name: r.label.trim(), count: r.count })),
            day_of_week: dayOfWeekRes.rows.map((r) => ({ name: r.day_name.trim(), count: r.count })),
            severity_monthly: Object.values(severityByMonth),
        });
    } catch (err) {
        console.error('❌ getTrends error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

let isBulkProcessingStopped = false;

// ========================================================================
// POST /api/bulk/stop — Stop the active bulk process
// ========================================================================
exports.stopBulkProcess = (req, res) => {
    isBulkProcessingStopped = true;
    console.log('🛑 Bulk processing stop requested');
    res.json({ success: true, message: 'Processing will stop after the current file finishes.' });
};

// ========================================================================
// GET /api/bulk/list — List all PDFs in R2 bucket (preview before processing)
// ========================================================================
exports.listR2FIRs = async (req, res) => {
    try {
        const prefix = req.query.prefix || 'fir-pdfs/';
        const files = await listR2Files(prefix);

        // Check which ones are already processed
        const existingRes = await db.query('SELECT pdf_url FROM accidents');
        const existingUrls = new Set(existingRes.rows.map(r => r.pdf_url));

        const enriched = files.map(f => ({
            ...f,
            already_processed: existingUrls.has(f.key) || 
                [...existingUrls].some(url => url && url.includes(path.basename(f.key))),
        }));

        const unprocessed = enriched.filter(f => !f.already_processed);

        res.json({
            success: true,
            total: files.length,
            already_processed: files.length - unprocessed.length,
            to_process: unprocessed.length,
            files: enriched,
        });
    } catch (err) {
        console.error('❌ listR2FIRs error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ========================================================================
// POST /api/bulk/process — Bulk process all unprocessed PDFs from R2
// ========================================================================
exports.bulkProcessFromR2 = async (req, res) => {
    try {
        const prefix = req.body.prefix || 'fir-pdfs/';
        const batchSize = Math.min(parseInt(req.body.batch_size) || 50, 1000); // 1000 limit for 8GB server
        const delayMs = parseInt(req.body.delay_ms) || 2000; // Delay between files (rate limiting)

        console.log(`\n${'='.repeat(60)}`);
        console.log(`🚀 BULK PROCESSING — Fetching PDFs from R2 (prefix: ${prefix})`);
        console.log(`   Batch size: ${batchSize}, Delay: ${delayMs}ms`);
        console.log(`${'='.repeat(60)}\n`);

        // Initialize stop flag
        isBulkProcessingStopped = false;

        // Step 1: List all PDFs in bucket
        const allFiles = await listR2Files(prefix);
        if (allFiles.length === 0) {
            return res.json({ success: true, message: 'No PDFs found in R2 bucket', total: 0 });
        }

        // Step 2: Get already processed files
        const existingRes = await db.query('SELECT pdf_url FROM accidents');
        const existingUrls = new Set(existingRes.rows.map(r => r.pdf_url));

        const unprocessed = allFiles.filter(f => {
            const basename = path.basename(f.key);
            // Strict check: Is this specific key already in DB?
            if (existingUrls.has(f.key)) return false;

            // Check if any existing URL *ends with* this basename
            // (handling case where DB stores full URL but we only have key, or vice versa)
            // The previous .includes() was too broad (e.g. "Report.pdf" matched "Final Report.pdf")
            return ![...existingUrls].some(url => {
                if (!url) return false;
                const urlBasename = path.basename(url);
                return urlBasename === basename;
            });
        });

        console.log(`📊 Total PDFs: ${allFiles.length}, Already processed: ${allFiles.length - unprocessed.length}, To process: ${unprocessed.length}`);

        if (unprocessed.length === 0) {
            return res.json({ 
                success: true, 
                message: 'All PDFs are already processed!',
                total: allFiles.length,
                already_processed: allFiles.length,
                newly_processed: 0,
            });
        }

        // Step 3: Process in batches
        const batch = unprocessed.slice(0, batchSize);
        const results = { processed: 0, failed: 0, errors: [] };
        const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000/process_fir';

        // Send initial response that processing has started
        // For large batches, we'll process async and return immediately
        if (batch.length > 10) {
            res.json({
                success: true,
                message: `Processing ${batch.length} FIRs in background. Check /api/stats for progress.`,
                total_in_bucket: allFiles.length,
                queued: batch.length,
                already_processed: allFiles.length - unprocessed.length,
            });
        }

        for (let i = 0; i < batch.length; i++) {
            if (isBulkProcessingStopped) {
                console.log('🛑 Bulk processing HAMMER STOPPED');
                break;
            }
            const file = batch[i];
            const progress = `[${i + 1}/${batch.length}]`;
            
            try {
                console.log(`\n${progress} 📄 Processing: ${file.key}`);

                // Download from R2 to temp
                const download = await downloadR2ToLocal(file.key, path.join(__dirname, '../temp'));
                if (!download.success) {
                    results.failed++;
                    results.errors.push({ file: file.key, error: 'Download failed' });
                    continue;
                }

                // Send to AI service
                const FormData = require('form-data');
                const form = new FormData();
                form.append('file', fs.createReadStream(download.localPath));

                console.log(`${progress} 🤖 Sending to AI service...`);
                try {
                    const aiResponse = await axios.post(aiServiceUrl, form, {
                        headers: { ...form.getHeaders() },
                        timeout: 120000,
                    });
                    data = aiResponse.data;
                    console.log(`${progress} ✅ AI extracted: FIR#${data.fir_number}, Severity: ${data.severity}`);
                } catch (aiErr) {
                    console.error(`${progress} ❌ AI extraction failed for ${file.key}: ${aiErr.message}`);
                    results.failed++;
                    results.errors.push({ file: file.key, error: `AI extraction failed: ${aiErr.message}` });
                    continue; // Skip this file
                }

                // DEBUG LOGGING
                console.log(`${progress} 🔍 Raw Text Length: ${data.raw_text ? data.raw_text.length : 'UNDEFINED'}`);
                if (!data.raw_text) {
                     console.error(`${progress} ❌ MISSING RAW TEXT! Skipping LLM analysis.`);
                }

                if (data.fir_number === 'INVALID_FILE') {
                    console.error(`${progress} ❌ Invalid file detected (HTML/Error Page). Skipping.`);
                    results.failed++;
                    results.errors.push({ file: file.key, error: 'Invalid file (HTML/Error Page)' });
                    continue; // Skip without saving
                }

                // Enhance with Llama-3
                const enhancedData = await analyzeFIRText(data.raw_text);
                if (enhancedData) {
                    data = { ...data, ...enhancedData };
                    data.victims = Array.isArray(enhancedData.victims) ? enhancedData.victims : data.victims;
                    data.vehicles = Array.isArray(enhancedData.vehicles) ? enhancedData.vehicles : data.vehicles;
                    data.confidence_score = 0.95;
                    console.log(`${progress} ✨ Llama-3 enhanced`);
                } else {
                    console.error(`${progress} ⚠️ LLM returned null. Fallback used.`);
                }

                // --- SEVERITY NORMALIZATION (BULK) ---
                const validSeverities = ['Fatal', 'Grievous', 'Non-Fatal', 'Unknown'];
                if (data.severity) {
                     const s = data.severity.toLowerCase();
                     if (s.includes('fatal') && !s.includes('non')) data.severity = 'Fatal';
                     else if (s.includes('grievous') || s.includes('serious')) data.severity = 'Grievous';
                     else if (s.includes('simple') || s.includes('minor') || s.includes('non-injury') || s.includes('no injury')) data.severity = 'Non-Fatal';
                     else if (!validSeverities.includes(data.severity)) data.severity = 'Unknown';
                } else {
                     data.severity = 'Unknown';
                }

                // --- TRUNCATION SAFETY ---
                // Ensure strings fit in DB columns
                if (data.fir_number && data.fir_number.length > 100) data.fir_number = data.fir_number.substring(0, 100);
                if (data.location) {
                    if (data.location.city && data.location.city.length > 100) data.location.city = data.location.city.substring(0, 100);
                    if (data.location.area && data.location.area.length > 200) data.location.area = data.location.area.substring(0, 200);
                }
                if (data.victims) {
                    data.victims.forEach(v => {
                        if (v.injury && v.injury.length > 100) v.injury = v.injury.substring(0, 100);
                        if (v.name && v.name.length > 200) v.name = v.name.substring(0, 200);
                        // Sanitize Age
                        if (v.age) {
                             const ageStr = String(v.age);
                             const match = ageStr.match(/\d+/);
                             if (match) v.age = parseInt(match[0]);
                             else v.age = null;
                        }
                    });
                }
                if (data.vehicles) {
                    data.vehicles.forEach(v => {
                        if (v.type && v.type.length > 50) v.type = v.type.substring(0, 50);
                        if (v.number && v.number.length > 30) v.number = v.number.substring(0, 30);
                        if (v.driver_name && v.driver_name.length > 200) v.driver_name = v.driver_name.substring(0, 200);
                    });
                }

                // --- FINAL SAFETY CHECK: Reject form headers as data ---
                const boilerplateBlacklist = [
                    "reasons for delay in reporting", "s for delay in reporting", "informant", 
                    "delay in reporting", "complainant", "ion report", "first information report",
                    "p.s.", "police station", "date and time", "landmark"
                ];
                
                if (data.cause) {
                    const causeLower = data.cause.toLowerCase().trim();
                    if (boilerplateBlacklist.some(bp => causeLower === bp || (causeLower.length < 50 && causeLower.startsWith(bp)))) {
                        data.cause = "Under Investigation";
                    }
                }
                
                if (data.location && data.location.address) {
                    const locLower = data.location.address.toLowerCase().trim();
                    if (boilerplateBlacklist.some(bp => locLower === bp || (locLower.length < 50 && locLower.startsWith(bp)))) {
                        data.location.address = data.location.area || "NTR District";
                    }
                }

                // Build R2 public URL
                const publicUrl = process.env.R2_PUBLIC_URL
                    ? `${process.env.R2_PUBLIC_URL}/${file.key}`
                    : file.key;

                // Save to database
                const client = await db.pool.connect();
                try {
                    await client.query('BEGIN');

                    const accResult = await client.query(`
                        INSERT INTO accidents 
                            (fir_number, incident_date, cause, severity, pdf_url, status, confidence_score, ai_analysis, raw_text)
                        VALUES ($1, $2, $3, $4, $5, 'Processed', $6, $7, $8)
                        RETURNING id
                    `, [
                        data.fir_number,
                        data.date_time !== 'UNKNOWN' ? parseDate(data.date_time) : null,
                        data.cause,
                        data.severity,
                        publicUrl,
                        data.confidence_score,
                        data.ai_analysis || null,
                        data.raw_text || null
                    ]);
                    const accidentId = accResult.rows[0].id;

                    // Geocode and insert location
                    if (data.location) {
                        let geoLat = null;
                        let geoLng = null;

                        const fullAddress = [
                            data.location.address,
                            data.location.area,
                            data.location.city
                        ].filter(Boolean).join(', ');

                        if (fullAddress.length > 3) {
                            console.log(`${progress} 📍 Geocoding: "${fullAddress}"`);
                            const geo = await geocodeAddress(fullAddress);
                            if (geo) {
                                geoLat = geo.lat;
                                geoLng = geo.lng;
                                console.log(`${progress}    ✅ [${geoLat}, ${geoLng}]`);
                            }
                        }

                        await client.query(`
                            INSERT INTO locations (accident_id, address, area, city, latitude, longitude)
                            VALUES ($1, $2, $3, $4, $5, $6)
                        `, [
                            accidentId,
                            data.location.address,
                            data.location.area,
                            data.location.city || 'NTR District',
                            geoLat,
                            geoLng
                        ]);
                    }

                    // Insert victims
                    if (data.victims && data.victims.length > 0) {
                        for (const v of data.victims) {
                            await client.query(`
                                INSERT INTO victims (accident_id, age, gender, injury_severity, is_fatality, victim_name)
                                VALUES ($1, $2, $3, $4, $5, $6)
                            `, [accidentId, v.age, v.gender, v.injury, data.severity === 'Fatal', v.name || null]);
                        }
                    }

                    // Insert vehicles
                    if (data.vehicles && data.vehicles.length > 0) {
                        for (const v of data.vehicles) {
                            await client.query(`
                                INSERT INTO vehicles (accident_id, vehicle_type, vehicle_number, driver_name)
                                VALUES ($1, $2, $3, $4)
                            `, [accidentId, v.type, v.number, v.driver_name]);
                        }
                    }

                    await client.query('COMMIT');
                    results.processed++;
                    console.log(`${progress} 💾 Saved: accident_id=${accidentId}`);
                } catch (dbErr) {
                    await client.query('ROLLBACK');
                    results.failed++;
                    results.errors.push({ file: file.key, error: `DB error: ${dbErr.message}` });
                    console.error(`${progress} ❌ DB error: ${dbErr.message}`);
                } finally {
                    client.release();
                }

                // Clean up temp file
                try { fs.unlinkSync(download.localPath); } catch (e) {}

                // Rate limit delay
                if (i < batch.length - 1) {
                    await new Promise(r => setTimeout(r, delayMs));
                }

            } catch (fileErr) {
                results.failed++;
                results.errors.push({ file: file.key, error: fileErr.message });
                console.error(`${progress} ❌ Failed: ${fileErr.message || fileErr}`);
                if (fileErr.response) console.error('   Response:', fileErr.response.data);
                if (fileErr.code) console.error('   Code:', fileErr.code);
            }
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log(`🏁 BULK PROCESSING COMPLETE`);
        console.log(`   ✅ Processed: ${results.processed}`);
        console.log(`   ❌ Failed: ${results.failed}`);
        console.log(`${'='.repeat(60)}\n`);

        // If we haven't already sent response (small batch)
        if (batch.length <= 10) {
            res.json({
                success: true,
                total_in_bucket: allFiles.length,
                already_processed: allFiles.length - unprocessed.length,
                newly_processed: results.processed,
                failed: results.failed,
                errors: results.errors.slice(0, 20), // Only show first 20 errors
                remaining: unprocessed.length - batch.length,
            });
        }

    } catch (err) {
        console.error('❌ bulkProcessFromR2 error:', err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
};

// ========================================================================
// HELPERS
// ========================================================================

function parseDate(dateStr) {
    if (!dateStr || dateStr === 'UNKNOWN') return null;
    // Try DD-MM-YYYY or DD/MM/YYYY format
    const match = dateStr.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\s*(\d{1,2}):?(\d{2})?/);
    if (match) {
        let [, day, month, year, hour, minute] = match;
        if (year.length === 2) year = '20' + year;
        return new Date(year, month - 1, day, hour || 0, minute || 0);
    }
    // Fallback: let JS try
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
}
