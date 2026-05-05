const redis = require("redis");

// This tells the Redis client to use the URL from your .env file
const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
});

// These listeners will tell us in the terminal if it works or fails
redisClient.on("error", (err) => console.error("Redis Client Error:", err));
redisClient.on("connect", () =>
  console.log("Successfully connected to Redis Cloud!"),
);

// Connect to the database asynchronously
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error("Failed to connect to Redis during startup:", err);
  }
})();

// Export the client so your profiles.js router can use it
module.exports = redisClient;
