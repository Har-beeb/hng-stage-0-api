const crypto = require("crypto");

/**
 * Normalizes a query object into a unique, deterministic string.
 * This ensures that identical queries in different orders hit the same cache key.
 */
function normalizeQuery(query) {
  if (!query || Object.keys(query).length === 0) return "default_list";

  // 1. Sort the keys alphabetically to ensure order doesn't change the hash
  const sortedKeys = Object.keys(query).sort();

  // 2. Create an array of "key=value" pairs based on sorted keys
  const normalizedArray = sortedKeys.map((key) => {
    const value = query[key];
    // Convert everything to lowercase to avoid case-sensitivity misses
    return `${key.toLowerCase()}=${String(value).toLowerCase()}`;
  });

  // 3. Join them into a single canonical string
  const canonicalString = normalizedArray.join("&");

  // 4. (Optional) Create a short MD5 hash if the query string is too long
  return crypto.createHash("md5").update(canonicalString).digest("hex");
}

module.exports = { normalizeQuery };
