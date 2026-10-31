// Organization-level settings with safe defaults. Stored in Organization.settings (JSON).
const DEFAULTS = {
  matchingWeights: { skillMatch: 40, practical: 25, experience: 15, feedback: 10, availability: 10 },
  nearlyReadyMaxGap: 2, // total missing levels across critical skills to count as "close to ready"
  minReadinessToRecommend: 50,
  hiringAssumptions: {
    // Configurable planning assumptions, NOT market statistics. HR edits these in Settings.
    currency: 'INR',
    externalHireCost: 600000,
    externalTimeToFillDays: 45,
    internalRedeployCost: 80000,
    internalTimeToDeployDays: 10,
  },
  geminiExplanations: true,
};

function getSettings(org) {
  const s = (org && org.settings) || {};
  return {
    ...DEFAULTS,
    ...s,
    matchingWeights: { ...DEFAULTS.matchingWeights, ...(s.matchingWeights || {}) },
    hiringAssumptions: { ...DEFAULTS.hiringAssumptions, ...(s.hiringAssumptions || {}) },
  };
}
module.exports = { DEFAULTS, getSettings };
