/**
 * ========================================================
 * CIVIC CONNECT - PRIORITY & GEOLOCATION UTILITIES
 * backend/utils/priorityCalculator.js
 * ========================================================
 * 
 * As a beginner in civic-tech algorithms:
 * 1. calculateCommunityScore(): Combines independent reports (60%) and citizen votes (40%).
 * 2. calculatePriority(): Combines AI danger score (60%) and community score (40%).
 * 3. getPriorityLevel(): Maps scores into accessible labels (LOW, MEDIUM, HIGH, CRITICAL).
 * 4. calculateDistanceMeters(): Haversine distance formula for duplicate radius checking.
 */

/**
 * Calculates normalized community score (0-100) from independent reports and community votes
 * Formula specified in Stage 10:
 * - Community Contribution: report count = 60%, vote count = 40%
 */
function calculateCommunityScore(reportCount = 1, voteCount = 0) {
  // Safe bounds check
  const reports = Math.max(1, parseInt(reportCount, 10) || 1);
  const votes = Math.max(0, parseInt(voteCount, 10) || 0);

  // Normalize report count (1 report = 15, 4 reports = 60, 7+ reports = 100)
  const reportScore = Math.min(100, Math.round(reports * 15));

  // Normalize vote count (1 vote = 5, 10 votes = 50, 20+ votes = 100)
  const voteScore = Math.min(100, Math.round(votes * 5));

  // Combined community score (0-100)
  const communityScore = Math.min(100, Math.max(0, Math.round((reportScore * 0.60) + (voteScore * 0.40))));

  return communityScore;
}

/**
 * Determines text level from numeric score (0-100)
 * 0–30: LOW, 31–55: MEDIUM, 56–75: HIGH, 76–100: CRITICAL
 */
function getPriorityLevel(score) {
  if (score <= 30) return 'Low';
  if (score <= 55) return 'Medium';
  if (score <= 75) return 'High';
  return 'Critical';
}

/**
 * Calculates final complaint priority object
 * Formula specified in Stage 10:
 * - danger contribution = 60%
 * - community contribution = 40%
 * final score = (dangerScore * 0.60) + (communityScore * 0.40)
 */
function calculatePriority(arg1 = 50, arg2 = 1, arg3 = 0) {
  let dangerScore = 50;
  let reportCount = 1;
  let voteCount = 0;

  if (typeof arg1 === 'object' && arg1 !== null) {
    dangerScore = arg1.dangerScore !== undefined ? arg1.dangerScore : 50;
    reportCount = arg1.reportCount !== undefined ? arg1.reportCount : 1;
    voteCount = arg1.voteCount !== undefined ? arg1.voteCount : 0;
  } else {
    dangerScore = arg1;
    reportCount = arg2;
    voteCount = arg3;
  }

  const safeDanger = Math.min(100, Math.max(0, parseInt(dangerScore, 10) || 0));
  const communityScore = calculateCommunityScore(reportCount, voteCount);

  const finalScore = Math.min(100, Math.max(0, Math.round(
    (safeDanger * 0.60) + (communityScore * 0.40)
  )));

  const level = getPriorityLevel(finalScore);

  return {
    score: finalScore,
    level,
    dangerScore: safeDanger,
    communityScore,
    calculatedAt: new Date()
  };
}

/**
 * Haversine formula to compute great-circle distance between two GPS coordinates in meters
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return Infinity;
  }

  const R = 6371000; // Earth's mean radius in meters
  const toRad = deg => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance);
}

module.exports = {
  calculateCommunityScore,
  getPriorityLevel,
  calculatePriority,
  calculateDistanceMeters
};
