/**
 * AI Insight Engine — LLM-Powered Accident Pattern Analysis
 * ==========================================================
 * Generates natural language accident pattern analysis and policy
 * recommendations using Groq and OpenRouter APIs with automatic fallback.
 *
 * Fallback Order:
 *   1. Groq (Key 1)  →  2. Groq (Key 2)  →  3. OpenRouter (Key 1)  →  4. OpenRouter (Key 2)
 *
 * Models:
 *   - Groq       → llama-3.3-70b-versatile
 *   - OpenRouter  → meta-llama/llama-3.1-8b-instruct:free
 */

const axios = require('axios');

// ========================================================================
// PROVIDER CONFIGURATIONS
// ========================================================================

const PROVIDERS = [
  {
    name: 'Groq (Key 1)',
    envKey: 'GROQ_KEY_1',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    type: 'groq',
  },
  {
    name: 'Groq (Key 2)',
    envKey: 'GROQ_KEY_2',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    type: 'groq',
  },
  {
    name: 'OpenRouter (Key 1)',
    envKey: 'OPENROUTER_KEY_1',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'meta-llama/llama-3.1-8b-instruct:free',
    type: 'openrouter',
  },
  {
    name: 'OpenRouter (Key 2)',
    envKey: 'OPENROUTER_KEY_2',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'meta-llama/llama-3.1-8b-instruct:free',
    type: 'openrouter',
  },
];

const REQUEST_TIMEOUT_MS = 10000; // 10 seconds
const MAX_RETRIES_PER_KEY = 1;

// ========================================================================
// SYSTEM PROMPT
// ========================================================================

const SYSTEM_PROMPT = `You are a Senior Strategic Analyst for the NTR Police Commissionerate, specializing in traffic safety and accident reconstruction.

INPUT DATA:
You will receive aggregated accident statistics and a list of recent accident narratives (summaries). 

YOUR GOAL:
Generate a "Deep Consolidated Analysis" that goes beyond surface-level numbers. You must identify *patterns*, *underlying behaviors*, and *systemic issues*.

CRITICAL INSTRUCTIONS:
1. **Root Cause Grouping:** The raw data may have repetitive causes like "Rash and negligence...", "Rash driving", etc. You MUST GROUP these into broader, insightful categories (e.g., "Aggressive Driving Behaviors", "Infrastructure Failures", "Visibility Issues"). Do NOT just list the raw labels.
2. **Deep Analysis:** Do not just say "Speeding is high." Explain *why* based on the time/location patterns (e.g., "High speeding fatalites at night suggest empty roads and lack of enforcement").
3. **Actionable Solutions:** Policy recommendations MUST be specific. 
   - BAD: "Increase patrolling."
   - GOOD: "Deploy interceptor vehicles at [Hotspot Area] between [Peak Time] to deter speeding."
4. **Tone:** Professional, authoritative, urgent, and data-driven.

RESPONSE FORMAT (Strict JSON):
{
  "summary": "A powerful executive summary (4-5 sentences) synthesizing the most critical risks. Mention the dominant accident pattern and the most vulnerable demographic.",
  "key_insights": [
    "Insight 1: Focus on the specific *behavior* driving the top cause (e.g., 'Overtaking blindly on highways...').",
    "Insight 2: Correlation between Time and Severity (e.g., 'Night accidents have 2x higher fatality rate...').",
    "Insight 3: Infrastructure or Location specific observation.",
    "Insight 4: Demographic risk pattern."
  ],
  "policy_recommendations": [
    "Specific Engineering Fix (e.g., 'Install rumblers/lighting at...').",
    "Specific Enforcement Action (e.g., 'Special drive for...').",
    "Specific Preventative Measure."
  ],
  "public_awareness_suggestions": [
    "Targeted message for the high-risk group.",
    "Specific behavioral change campaign.",
    "Community action."
  ]
}`;

// ========================================================================
// CORE LLM CALL
// ========================================================================

/**
 * Makes a single LLM API call to a given provider.
 * @param {Object} provider - Provider config object
 * @param {string} userPrompt - The user message (accident data)
 * @returns {Object} Parsed JSON response
 */
async function callLLM(provider, userPrompt) {
  const apiKey = process.env[provider.envKey];

  if (!apiKey) {
    throw new Error(`API key not set: ${provider.envKey}`);
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  // OpenRouter requires additional headers
  if (provider.type === 'openrouter') {
    headers['HTTP-Referer'] = 'https://fir-analysis.local';
    headers['X-Title'] = 'FIR Analysis System';
  }

  const payload = {
    model: provider.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.4,
    max_tokens: 2048,
    response_format: provider.type === 'groq' ? { type: 'json_object' } : undefined,
  };

  const response = await axios.post(provider.url, payload, {
    headers,
    timeout: REQUEST_TIMEOUT_MS,
  });

  // Extract the LLM text response
  const content = response.data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Empty response from LLM');
  }

  // Parse JSON from the response (handle markdown code blocks if any)
  const parsed = parseJSONFromLLM(content);
  return parsed;
}

/**
 * Robustly parses JSON from LLM output.
 * Handles cases where LLM wraps JSON in markdown code blocks.
 */
function parseJSONFromLLM(text) {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Strip markdown code blocks
    const cleaned = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      // Try to find JSON object in the text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error(`Failed to parse LLM output as JSON: ${text.substring(0, 200)}`);
    }
  }
}

// ========================================================================
// FALLBACK ENGINE
// ========================================================================

/**
 * Generates AI insights with automatic provider fallback.
 * Tries each provider in order. Each provider gets MAX_RETRIES_PER_KEY retries.
 *
 * @param {Object} accidentStats - Aggregated accident statistics JSON
 * @returns {Object} { insights, provider, latencyMs }
 */
async function generateInsights(accidentStats) {
  const userPrompt = `Accident Data:\n${JSON.stringify(accidentStats, null, 2)}`;

  const errors = [];

  for (const provider of PROVIDERS) {
    // Check if key exists before attempting
    if (!process.env[provider.envKey]) {
      console.log(`⏭️  [AI Engine] Skipping ${provider.name} — key not configured`);
      errors.push({ provider: provider.name, error: 'API key not configured' });
      continue;
    }

    for (let attempt = 1; attempt <= MAX_RETRIES_PER_KEY + 1; attempt++) {
      try {
        console.log(`🤖 [AI Engine] Trying ${provider.name} (attempt ${attempt})...`);
        const startTime = Date.now();

        const insights = await callLLM(provider, userPrompt);
        const latencyMs = Date.now() - startTime;

        // Validate response structure
        validateInsightsStructure(insights);

        console.log(`✅ [AI Engine] Success via ${provider.name} (${latencyMs}ms)`);

        return {
          insights,
          provider: provider.name,
          model: provider.model,
          latencyMs,
        };
      } catch (err) {
        const status = err.response?.status;
        const errMsg = err.response?.data?.error?.message || err.message;

        console.error(`❌ [AI Engine] ${provider.name} attempt ${attempt} failed: ${status || ''} ${errMsg}`);

        errors.push({
          provider: provider.name,
          attempt,
          status,
          error: errMsg,
        });

        // Only retry on rate limit (429) or server error (500+) or timeout
        const isRetryable = status === 429 || status >= 500 || err.code === 'ECONNABORTED';
        if (!isRetryable || attempt > MAX_RETRIES_PER_KEY) {
          break; // Move to next provider
        }

        // Brief delay before retry
        await sleep(1000);
      }
    }
  }

  // All providers failed
  console.error('🚨 [AI Engine] All providers exhausted. Returning fallback response.');
  return {
    insights: generateFallbackInsights(accidentStats),
    provider: 'fallback (no LLM)',
    model: 'rule-based',
    latencyMs: 0,
    errors,
  };
}

// ========================================================================
// VALIDATION
// ========================================================================

function validateInsightsStructure(insights) {
  const required = ['summary', 'key_insights', 'policy_recommendations', 'public_awareness_suggestions'];
  for (const field of required) {
    if (!insights[field]) {
      throw new Error(`Missing required field in LLM response: "${field}"`);
    }
  }
  // Ensure arrays are actually arrays
  for (const field of ['key_insights', 'policy_recommendations', 'public_awareness_suggestions']) {
    if (!Array.isArray(insights[field])) {
      insights[field] = [insights[field]]; // Wrap in array if string
    }
  }
}

// ========================================================================
// FALLBACK (when all LLM calls fail)
// ========================================================================

function generateFallbackInsights(stats) {
  return {
    summary: `Analysis of accident data from Vijayawada Commissionerate reveals that "${stats.most_common_cause || 'Unknown'}" is the primary cause of accidents. The age group ${stats.high_risk_age_group || 'Unknown'} is most affected, with a fatality rate of ${stats.fatality_percentage || 0}%.`,
    key_insights: [
      `Peak accident time: ${stats.peak_time || 'Unknown'}`,
      `Highest risk vehicle type: ${stats.most_risky_vehicle || 'Unknown'}`,
      `Hotspot location: ${stats.hotspot_location || 'Unknown'}`,
      `Fatality percentage: ${stats.fatality_percentage || 0}%`,
    ],
    policy_recommendations: [
      `Increase patrolling during ${stats.peak_time || 'peak hours'}`,
      `Deploy speed cameras near ${stats.hotspot_location || 'identified hotspots'}`,
      `Target enforcement for ${stats.most_risky_vehicle || 'high-risk vehicle'} violations`,
      'Conduct regular drunk driving checkpoints',
    ],
    public_awareness_suggestions: [
      `Awareness campaigns targeting ${stats.high_risk_age_group || 'high-risk'} age group`,
      `Road safety signage near ${stats.hotspot_location || 'hotspot areas'}`,
      'Promote helmet and seatbelt usage through social media',
      'Community workshops on defensive driving',
    ],
  };
}

// ========================================================================
// HELPERS
// ========================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================================================
// EXPORTS
// ========================================================================

// ========================================================================
// TREND ANALYSIS PROMPT
// ========================================================================

const TREND_SYSTEM_PROMPT = `You are a Senior Strategic Analyst for the NTR Police Commissionerate.

INPUT DATA:
You will receive temporal accident statistics (Monthly Trends, Day-of-Week patterns, Severity over time).

YOUR GOAL:
Generate a "Strategic Trend Report" focusing on *when* accidents happen and *how* severity is shifting.

CRITICAL INSTRUCTIONS:
1. **Identify Seasonality:** Look for spikes in specific months. Hypothesize reasons (e.g., "May spike due to summer travel", "Monsoon impact in July").
2. **Day-of-Week Analysis:** Explain the peak day. (e.g., "Sunday peak suggests increased leisure travel/drunk driving").
3. **Severity Shifts:** Are fatal accidents increasing or decreasing relative to total accidents?
4. **Operational Recs:** Suggest *timing-based* interventions (e.g., "Increase Friday night checkpoints").

RESPONSE FORMAT (Strict JSON):
{
  "executive_summary": "Concise 3-sentence summary of the most critical temporal patterns.",
  "seasonal_analysis": "Paragraph analyzing monthly trends and seasonal impacts.",
  "day_of_week_analysis": "Paragraph explaining weekly patterns and peak days.",
  "operational_recommendations": [
    "Specific deployment instruction (Time/Day focused).",
    "Seasonal preparation strategy.",
    "Long-term trend intervention."
  ]
}`;

// ========================================================================
// TREND ANALYSIS ENGINE
// ========================================================================

/**
 * Generates Trend Analysis using the same fallback logic.
 * @param {Object} trendStats - Monthly, Weekly, Severity stats
 */
async function generateTrendInsights(trendStats) {
  const userPrompt = `Trend Data:\n${JSON.stringify(trendStats, null, 2)}`;
  
  // Reuse the existing fallback loop logic but with a different prompt
  // We'll create a temporary "provider loop" similar to generateInsights
  // or refactor if needed. For simplicity, we'll copy the core loop pattern here
  // or better yet, extract the loop.
  
  // EXTRACTED LOOP LOGIC (Simulated for brevity/safety - reusing existing helper if possible would be better, 
  // but let's just duplicate the loop for safety to avoid refactoring the whole file now).

  const errors = [];

  for (const provider of PROVIDERS) {
     if (!process.env[provider.envKey]) continue;

     for (let attempt = 1; attempt <= MAX_RETRIES_PER_KEY + 1; attempt++) {
        try {
           console.log(`🤖 [Trend Engine] Trying ${provider.name}...`);
           
           // MANUALLY CONSTRUCT PAYLOAD TO USE TREND PROMPT
           const apiKey = process.env[provider.envKey];
           const headers = {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${apiKey}`,
           };
           if (provider.type === 'openrouter') {
             headers['HTTP-Referer'] = 'https://fir-analysis.local';
             headers['X-Title'] = 'FIR Analysis System';
           }

           const payload = {
             model: provider.model,
             messages: [
               { role: 'system', content: TREND_SYSTEM_PROMPT },
               { role: 'user', content: userPrompt },
             ],
             temperature: 0.4,
             max_tokens: 1500,
             response_format: provider.type === 'groq' ? { type: 'json_object' } : undefined,
           };

           const response = await axios.post(provider.url, payload, { headers, timeout: REQUEST_TIMEOUT_MS });
           const content = response.data?.choices?.[0]?.message?.content;
           if (!content) throw new Error('Empty response');

           const insights = parseJSONFromLLM(content);
           
           return {
             insights,
             provider: provider.name,
             model: provider.model,
             latencyMs: 0 // approximate
           };

        } catch (err) {
           console.error(`❌ [Trend Engine] ${provider.name} failed: ${err.message}`);
           const status = err.response?.status;
           if (status !== 429 && status < 500 && err.code !== 'ECONNABORTED') break; 
           await sleep(1000);
        }
     }
  }

  // Fallback
  return {
    insights: {
        executive_summary: "Data indicates consistent accident patterns. Peak volume observed on " + (trendStats.peak_day || "weekends") + ".",
        seasonal_analysis: "Monthly variations follow standard traffic density patterns.",
        day_of_week_analysis: "Weekends show slightly higher incident rates.",
        operational_recommendations: ["Maintain standard patrolling schedules.", "Monitor peak hours closey."]
    },
    provider: 'fallback',
    model: 'rule-based'
  };
}

// ========================================================================
// JURISDICTION ANALYSIS PROMPT
// ========================================================================

const JURISDICTION_SYSTEM_PROMPT = `You are a Senior Strategic Analyst for the NTR Police Commissionerate.

INPUT DATA:
You will receive accident statistics SPECIFIC to a single jurisdiction/area.

YOUR GOAL:
Generate a "Jurisdiction Strategic Report" focusing on local, area-specific issues and hyper-local solutions.

CRITICAL INSTRUCTIONS:
1. **Local Context:** Always refer to the specific area by name in the summary.
2. **Hyper-Local Threats:** Focus on the specific roads, vehicles, and demographics that cause issues in THIS specific area.
3. **Targeted Deployment:** Recommend police deployments and engineering fixes that make sense at a neighborhood/mandal level.

RESPONSE FORMAT (Strict JSON):
{
  "summary": "Concise 3-sentence summary of the jurisdiction's specific risk profile.",
  "key_insights": [
    "Insight 1 (Local behavior/infrastructure issue)",
    "Insight 2 (Specific demographic/vehicle threat)",
    "Insight 3 (Timing pattern)"
  ],
  "policy_recommendations": [
    "Hyper-local engineering fix (e.g. speed breakers on X road).",
    "Specific local enforcement drive.",
    "Community engagement action."
  ]
}`;

// ========================================================================
// JURISDICTION ANALYSIS ENGINE
// ========================================================================

/**
 * Generates Jurisdiction Analysis using the fallback logic.
 * @param {Object} stats - Area stats
 * @param {string} areaName - Name of area
 */
async function generateJurisdictionInsights(stats, areaName) {
  const userPrompt = `Jurisdiction: ${areaName}\nData:\n${JSON.stringify(stats, null, 2)}`;
  
  const errors = [];

  for (const provider of PROVIDERS) {
     if (!process.env[provider.envKey]) continue;

     for (let attempt = 1; attempt <= MAX_RETRIES_PER_KEY + 1; attempt++) {
        try {
           console.log(`🤖 [Jurisdiction Engine] Trying ${provider.name}...`);
           
           const apiKey = process.env[provider.envKey];
           const headers = {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${apiKey}`,
           };
           if (provider.type === 'openrouter') {
             headers['HTTP-Referer'] = 'https://fir-analysis.local';
             headers['X-Title'] = 'FIR Analysis System';
           }

           const payload = {
             model: provider.model,
             messages: [
               { role: 'system', content: JURISDICTION_SYSTEM_PROMPT },
               { role: 'user', content: userPrompt },
             ],
             temperature: 0.4,
             max_tokens: 1500,
             response_format: provider.type === 'groq' ? { type: 'json_object' } : undefined,
           };

           const response = await axios.post(provider.url, payload, { headers, timeout: REQUEST_TIMEOUT_MS });
           const content = response.data?.choices?.[0]?.message?.content;
           if (!content) throw new Error('Empty response');

           const insights = parseJSONFromLLM(content);
           
           return {
             insights,
             provider: provider.name,
             model: provider.model,
             latencyMs: 0
           };

        } catch (err) {
           console.error(`❌ [Jurisdiction Engine] ${provider.name} failed: ${err.message}`);
           const status = err.response?.status;
           if (status !== 429 && status < 500 && err.code !== 'ECONNABORTED') break; 
           await sleep(1000);
        }
     }
  }

  // Fallback
  return {
    insights: {
        summary: `Analysis for ${areaName} indicates significant accident patterns, primarily late at night or early morning. Enforcement is required on key stretch roads.`,
        key_insights: [
           `The primary cause observed in this jurisdiction is ${stats.most_common_cause || 'negligent driving'}.`,
           `The most vulnerable demographic is the ${stats.high_risk_age_group || '18-25'} age group.`,
           `Accidents peak during ${stats.peak_time || 'night hours'}.`
        ],
        policy_recommendations: [
           `Increase nighttime patrolling in ${areaName}.`,
           `Engage local community leaders for awareness programs.`,
           `Identify and rectify blackspots causing frequent collisions.`
        ]
    },
    provider: 'fallback',
    model: 'rule-based'
  };
}

module.exports = {
  generateInsights,
  generateTrendInsights,
  generateJurisdictionInsights,
  PROVIDERS,
};
