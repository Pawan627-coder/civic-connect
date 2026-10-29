/**
 * ========================================================
 * CIVIC CONNECT - GOOGLE GEMINI AI SERVICE (geminiService.js)
 * Stage 10: Official Google GenAI SDK (Gemini 2.5 Flash)
 * ========================================================
 * 
 * As a beginner in AI engineering, this service provides:
 * 1. analyzeComplaint(): Multimodal danger assessment & dangerScore calculation.
 * 2. checkDuplicateWithGemini(): Semantic duplicate detection against nearby complaints.
 * 3. Graceful Fallbacks: If API key is not configured or network fails, rule-based
 *    fallback ensures citizen reports are NEVER rejected.
 */

const { GoogleGenAI } = require('@google/genai');

/**
 * Helper: Parse JSON safely even if wrapped in markdown code blocks
 */
function extractJsonFromResponse(rawText) {
  if (!rawText) return null;
  try {
    let clean = rawText.trim();
    if (clean.startsWith('```json')) {
      clean = clean.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```\s*/, '').replace(/```\s*$/i, '');
    }
    return JSON.parse(clean);
  } catch (err) {
    // Attempt regex extraction of first JSON object
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e) {
        return null;
      }
    }
    return null;
  }
}

/**
 * 1. Analyze Complaint Danger Level & Severity
 * Generates: dangerLevel, dangerScore (0-100), reason, keywords
 */
async function analyzeComplaint({ title, category, description, image, latitude, longitude }) {
  const apiKey = process.env.GEMINI_API_KEY;

  // Rule-based fallback if no Gemini API key is configured
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_gemini_api_key')) {
    return getFallbackDangerAnalysis(category, title, description);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const promptText = `
You are the AI Safety Assessment engine for Civic Connect, a civic problem reporting platform.
Analyze the following civic problem report and assess its immediate danger and physical risk to citizens:

- Problem Category: "${category}"
- Title: "${title}"
- Detailed Description: "${description}"
- Coordinates: Lat ${latitude}, Lng ${longitude}

Assess the risk based on potential for vehicle accidents, pedestrian injury, structural collapse, or contamination:
- Low (Score 0-30): Minor nuisance (e.g. uncollected leaf pile, faded street sign, small crack on footpath).
- Medium (Score 31-55): Moderate disturbance (e.g. single streetlight out, slow drain, minor pothole on low-speed alley).
- High (Score 56-75): Significant hazard (e.g. deep pothole on high-speed road, dead traffic light at 4-way junction, open sewer trench).
- Critical (Score 76-100): Imminent life threat (e.g. caved-in bridge slab, exposed live high-voltage power lines, deep open manhole on active traffic lane).

Return ONLY valid raw JSON with this exact structure:
{
  "dangerLevel": "Low | Medium | High | Critical",
  "dangerScore": 65,
  "reason": "Concise 1-2 sentence civic engineering justification of the danger level.",
  "keywords": ["pothole", "traffic", "swerving"],
  "duplicateLikelihood": 20
}
`.trim();

    const contents = [{ text: promptText }];

    // If an image is provided as base64 data URL, add inline data part
    if (image && typeof image === 'string' && image.startsWith('data:image/')) {
      const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        contents.push({
          inlineData: {
            mimeType: match[1],
            data: match[2]
          }
        });
      }
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents
    });

    const parsed = extractJsonFromResponse(response.text);

    if (parsed && parsed.dangerScore !== undefined) {
      const level = ['Low', 'Medium', 'High', 'Critical'].includes(parsed.dangerLevel)
        ? parsed.dangerLevel
        : getDangerLevelFromScore(parsed.dangerScore);

      return {
        dangerLevel: level,
        dangerScore: Math.min(100, Math.max(0, parseInt(parsed.dangerScore, 10) || 50)),
        reason: parsed.reason || 'AI analysis completed.',
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        duplicateLikelihood: parsed.duplicateLikelihood || 0,
        analyzedAt: new Date()
      };
    }

    throw new Error('Could not parse structured JSON from Gemini response');
  } catch (error) {
    console.warn(`[Gemini AI Notice]: Could not complete live AI assessment (${error.message}). Using rule-based fallback.`);
    return getFallbackDangerAnalysis(category, title, description);
  }
}

/**
 * 2. Semantic Duplicate Complaint Matching
 * Asks Gemini if the new complaint refers to the same underlying physical issue
 */
async function checkDuplicateWithGemini(newReport, candidates) {
  if (!candidates || candidates.length === 0) {
    return { isDuplicate: false, confidence: 0, matchedComplaintId: null, reason: 'No candidates within proximity' };
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // Fallback to text similarity if no Gemini API key configured
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_gemini_api_key')) {
    return getFallbackDuplicateCheck(newReport, candidates);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const candidateSummaries = candidates.map(c => `
Candidate Ticket [${c.id}]:
- Category: "${c.category}"
- Title: "${c.title}"
- Description: "${c.description}"
- Distance from new report: approximately ${c.distanceMeters || 'near'} meters
`).join('\n---\n');

    const promptText = `
You are the Duplicate Complaint Detection engine for Civic Connect.
A citizen has just submitted a new civic problem report:
- Category: "${newReport.category}"
- Title: "${newReport.title}"
- Description: "${newReport.description}"

Existing verified complaints in the immediate geographic vicinity (within 100 meters):
${candidateSummaries}

Determine whether the new report describes the EXACT SAME physical hazard or infrastructure issue as one of the existing candidate tickets.
If it is the same problem, identify which ticket it matches and assign a confidence score (0-100).
A confidence of 80+ should mean you are confident they are describing the same physical problem (e.g. same pothole, same broken signal, same leaking drain).

Return ONLY valid raw JSON with this exact structure:
{
  "isDuplicate": true,
  "confidence": 88,
  "matchedComplaintId": "CC-1001",
  "reason": "Both reports describe a large pothole causing vehicle swerving at the same location."
}
If no candidate matches, return:
{
  "isDuplicate": false,
  "confidence": 10,
  "matchedComplaintId": null,
  "reason": "The report describes a distinct civic problem."
}
`.trim();

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: promptText }]
    });

    const parsed = extractJsonFromResponse(response.text);

    if (parsed && typeof parsed.isDuplicate === 'boolean') {
      return {
        isDuplicate: parsed.isDuplicate,
        confidence: Math.min(100, Math.max(0, parseInt(parsed.confidence, 10) || 0)),
        matchedComplaintId: parsed.matchedComplaintId || null,
        reason: parsed.reason || 'AI evaluated candidate comparison.'
      };
    }

    throw new Error('Invalid JSON format from duplicate comparison');
  } catch (error) {
    console.warn(`[Gemini AI Notice]: Duplicate check fallback invoked (${error.message}).`);
    return getFallbackDuplicateCheck(newReport, candidates);
  }
}


/* ========================================================
 * RULE-BASED FALLBACK UTILITIES
 * ======================================================== */

function getDangerLevelFromScore(score) {
  if (score <= 30) return 'Low';
  if (score <= 55) return 'Medium';
  if (score <= 75) return 'High';
  return 'Critical';
}

function getFallbackDangerAnalysis(category, title, description) {
  const text = `${title} ${description}`.toLowerCase();

  let score = 50;
  let reason = 'AI analysis temporarily offline. Standard category risk assigned.';

  if (category === 'Road/Pothole') {
    if (text.includes('open') || text.includes('deep') || text.includes('swerve') || text.includes('accident') || text.includes('crack')) {
      score = 78;
      reason = 'Deep road fracture or pothole in high-traffic lane poses significant vehicle collision risk.';
    } else {
      score = 55;
      reason = 'Surface road defect requires asphalt repaving.';
    }
  } else if (category === 'Sewage' || category === 'Waterlogging') {
    if (text.includes('flood') || text.includes('overflow') || text.includes('subway') || text.includes('block')) {
      score = 70;
      reason = 'Drainage blockage causing water stagnation and pedestrian health hazards.';
    } else {
      score = 45;
      reason = 'Municipal drainage maintenance requested.';
    }
  } else if (category === 'Traffic' || category === 'Accident') {
    score = 82;
    reason = 'Traffic disruption or signal failure creates high collision probability.';
  } else if (category === 'Street Light') {
    score = 40;
    reason = 'Non-operational street lighting reduces night visibility.';
  } else if (category === 'Garbage/Waste') {
    score = 35;
    reason = 'Solid municipal waste requires collection schedule dispatch.';
  }

  const level = getDangerLevelFromScore(score);

  return {
    dangerLevel: level,
    dangerScore: score,
    reason: `(AI-assisted estimate): ${reason}`,
    keywords: [category.toLowerCase()],
    duplicateLikelihood: 10,
    analyzedAt: new Date()
  };
}

/**
 * Text similarity & proximity duplicate fallback
 * Used when GEMINI_API_KEY is not configured or network call is unavailable
 */
function getFallbackDuplicateCheck(newReport, candidates) {
  const getWords = str => (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !['there', 'this', 'that', 'with', 'from', 'have', 'were'].includes(w));

  const newWords = new Set([...getWords(newReport.title), ...getWords(newReport.description)]);

  let bestMatch = null;
  let highestConfidence = 0;
  let matchReason = '';

  for (const c of candidates) {
    const candWords = new Set([...getWords(c.title), ...getWords(c.description)]);
    let overlap = 0;
    const commonWords = [];
    for (const w of newWords) {
      if (candWords.has(w)) {
        overlap++;
        commonWords.push(w);
      }
    }

    const minSize = Math.min(newWords.size, candWords.size);
    const overlapRatio = minSize > 0 ? (overlap / minSize) : 0;
    const dist = typeof c.distanceMeters === 'number' ? c.distanceMeters : 50;

    let confidence = 0;

    // If significant common keywords and in close proximity:
    if (overlap >= 2) {
      // Base confidence from overlap ratio
      const baseConfidence = Math.min(70, Math.round(overlapRatio * 85));
      // Proximity bonus (within 100m: 0m = +30, 50m = +15, 100m = 0)
      const proximityBonus = Math.max(0, Math.round((100 - dist) * 0.30));
      // Keyword count bonus
      const countBonus = Math.min(20, overlap * 4);

      confidence = Math.min(99, baseConfidence + proximityBonus + countBonus);
    } else {
      confidence = Math.min(40, Math.round(overlapRatio * 40));
    }

    if (confidence > highestConfidence) {
      highestConfidence = confidence;
      bestMatch = c;
      matchReason = commonWords.length > 0 
        ? `Common hazard keywords [${commonWords.slice(0, 4).join(', ')}] within ${dist}m.`
        : 'Low similarity candidate.';
    }
  }

  const threshold = parseInt(process.env.DUPLICATE_CONFIDENCE_THRESHOLD, 10) || 80;

  if (highestConfidence >= threshold && bestMatch) {
    return {
      isDuplicate: true,
      confidence: highestConfidence,
      matchedComplaintId: bestMatch.id,
      reason: `(AI Rule Fallback): ${matchReason} Both reports refer to the same physical issue.`
    };
  }

  return {
    isDuplicate: false,
    confidence: highestConfidence,
    matchedComplaintId: null,
    reason: highestConfidence > 0 
      ? `Candidate confidence (${highestConfidence}%) did not reach the ${threshold}% duplicate threshold.`
      : 'Descriptions do not indicate the same physical hazard.'
  };
}

/**
 * 3. Generate Factual Emergency Incident Summary (Optional AI Assistant)
 * Formats user-provided facts into a concise dispatcher-ready incident briefing.
 * Never invents injuries, casualties, or vehicles not reported by citizen.
 */
async function generateEmergencyIncidentSummary(reportData) {
  const apiKey = process.env.GEMINI_API_KEY;
  const desc = reportData.description || 'Road accident reported.';
  const casualties = reportData.estimatedCasualties || 'Unspecified';
  const addr = (reportData.location && reportData.location.address) || 'Pinned Coordinates';
  const imgCount = (reportData.images && reportData.images.length) || 0;

  // Immediate rule-based fallback if no Gemini key or fast response needed
  const ruleSummary = `Road accident reported at ${addr}. Observed conditions: ${casualties}. Attached evidence: ${imgCount} photo(s).`;

  if (!apiKey) {
    return {
      summary: ruleSummary,
      suggestedUrgency: casualties.includes('Injuries') || casualties.includes('Critical') ? 'Critical' : 'High',
      extractedKeyDetails: [addr, casualties, `${imgCount} photos`]
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
You are an emergency civic response assistant. Create a 1-sentence strictly factual dispatch summary from this citizen accident report:
- Address: ${addr}
- Citizen Notes: ${desc}
- Casualties/Injuries Reported: ${casualties}
- Photographs: ${imgCount} attached

RULES:
1. Do NOT invent people, vehicle types, or injuries not present in the input.
2. Return ONLY a single concise, professional sentence for emergency dispatch.
`.trim();

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: prompt }]
    });

    const text = response && response.text ? response.text.trim() : ruleSummary;
    return {
      summary: text,
      suggestedUrgency: casualties.includes('Injuries') || casualties.includes('Critical') ? 'Critical' : 'High',
      extractedKeyDetails: [addr, casualties, `${imgCount} photos`]
    };
  } catch (err) {
    console.warn('[Gemini AI Emergency]: AI summary fallback used:', err.message);
    return {
      summary: ruleSummary,
      suggestedUrgency: casualties.includes('Injuries') ? 'Critical' : 'High',
      extractedKeyDetails: [addr, casualties, `${imgCount} photos`]
    };
  }
}

module.exports = {
  analyzeComplaint,
  checkDuplicateWithGemini,
  generateEmergencyIncidentSummary
};
