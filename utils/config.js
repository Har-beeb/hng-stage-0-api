require("dotenv").config();

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/hng_stage_1";

// Add .trim() to ensure NO hidden spaces or newlines ruin the signature
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ? process.env.JWT_ACCESS_SECRET.trim() : null;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ? process.env.JWT_REFRESH_SECRET.trim() : null;

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

module.exports = {
  PORT,
  MONGODB_URI,
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
};
