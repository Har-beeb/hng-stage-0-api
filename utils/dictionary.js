// utils/dictionary.js
const profilesData = require("../data/seed_profiles.json").profiles;

const countryDictionary = {};

profilesData.forEach((profile) => {
  if (profile.country_name && profile.country_id) {
    countryDictionary[profile.country_name.toLowerCase()] = profile.country_id;
  }
});

// Export
module.exports = countryDictionary;
