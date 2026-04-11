// // 1. Mandatory CORS Header Middleware
// app.use((req, res, next) => {
//   res.setHeader("Access-Control-Allow-Origin", "*");
//   next();
// });

// app.get("/api/classify", async (req, res) => {
//   try {
//     const name = req.query.name;

//     // 2. Missing Input Check (400 Error)
//     if (!name) {
//       return res.status(400).json({
//         status: "error",
//         message: "Missing or empty name parameter",
//       });
//     }

//     // 3. The Risky Network Call
//     const response = await fetch(`https://api.genderize.io/?name=${name}`);
//     const rawData = await response.json();

//     // 4. Genderize Edge Case (400 Error)
//     if (rawData.gender === null || rawData.count === 0) {
//       return res.status(400).json({
//         status: "error",
//         message: "No prediction available for the provided name",
//       });
//     }

//     // 5. Data Processing & Success (200 OK)
//     const probability = rawData.probability;
//     const sample_size = rawData.count;
//     const is_confident = probability >= 0.7 && sample_size >= 100;

//     res.status(200).json({
//       status: "success",
//       data: {
//         name: name,
//         gender: rawData.gender,
//         probability: probability,
//         sample_size: sample_size,
//         is_confident: is_confident,
//         processed_at: new Date().toISOString(),
//       },
//     });
//   } catch (error) {
//     // 6. Upstream / Network Failure (500 Error)
//     console.error("Fetch failed:", error);
//     res.status(500).json({
//       status: "error",
//       message: "Upstream or server failure",
//     });
//   }
// });

const app = require("./app"); // the actual Express application
const config = require("./utils/config");
const logger = require("./utils/logger");

app.listen(config.PORT, () => {
  logger.info(`Server running on port ${config.PORT}`);
});
