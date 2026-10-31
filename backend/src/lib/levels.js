// Proficiency scale used everywhere (1..5)
const LEVELS = { 1: 'Beginner', 2: 'Elementary', 3: 'Intermediate', 4: 'Advanced', 5: 'Expert' };

/** Map a 0..100 assessment score to a proficiency level. */
function scoreToLevel(score) {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  return 1;
}
module.exports = { LEVELS, scoreToLevel };
