const express = require("express");
const app = express();

// 1. Mandatory CORS Header Middleware
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

// 2. The Core Route
app.get("/api/classify", async (req, res) => {
  try {
    const name = req.query.name;

    if (!name) {
      return res.status(400).json({
        status: "error",
        message: "Missing or empty name parameter",
      });
    }

    const response = await fetch(`https://api.genderize.io/?name=${name}`);
    const rawData = await response.json();

    if (rawData.gender === null || rawData.count === 0) {
      return res.status(400).json({
        status: "error",
        message: "No prediction available for the provided name",
      });
    }

    const probability = rawData.probability;
    const sample_size = rawData.count;
    const is_confident = probability >= 0.7 && sample_size >= 100;

    res.status(200).json({
      status: "success",
      data: {
        name: name,
        gender: rawData.gender,
        probability: probability,
        sample_size: sample_size,
        is_confident: is_confident,
        processed_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Fetch failed:", error);
    res.status(500).json({
      status: "error",
      message: "Upstream or server failure",
    });
  }
});

// 3. Export the app
module.exports = app;
