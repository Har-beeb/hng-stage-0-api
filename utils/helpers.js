// Stage 2: Translates a sentence word into an age group string
const extractAgeGroup = (sentence) => {
  if (/\b(child|children)\b/.test(sentence)) return "child";
  if (/\b(teenager|teenagers)\b/.test(sentence)) return "teenager";
  if (/\b(adult|adults)\b/.test(sentence)) return "adult";
  if (/\b(senior|seniors)\b/.test(sentence)) return "senior";

  return null;
};

// Stage 1: Translates an exact number into an age group string
const getAgeGroup = (age) => {
  if (age >= 0 && age <= 12) return "child";
  if (age >= 13 && age <= 19) return "teenager";
  if (age >= 20 && age <= 59) return "adult";
  if (age >= 60) return "senior";
  return null;
};

module.exports = {
  extractAgeGroup,
  getAgeGroup,
};
