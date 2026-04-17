const app = require("./app"); // the actual Express application
const config = require("./utils/config");
const logger = require("./utils/logger");
const mongoose = require("mongoose");


logger.info("connecting to MongoDB...");
mongoose
  .connect(config.MONGODB_URI)
  .then(() => {
    logger.info("Connected to MongoDB");
    app.listen(config.PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    logger.error("Error connecting to MongoDB:", error.message);
  });

// // Fallback to process.env directly just in case config.js fails on Vercel
// const MONGODB_URI = config.MONGODB_URI || process.env.MONGODB_URI;

// if (!MONGODB_URI) {
//   logger.error("FATAL ERROR: MONGODB_URI is not defined in the environment!");
// } else {
//   logger.info("connecting to MongoDB...");
//   mongoose
//     .connect(MONGODB_URI)
//     .then(() => {
//       logger.info("Connected to MongoDB");
//     })
//     .catch((error) => {
//       logger.error("Error connecting to MongoDB:", error.message);
//     });
// }

// // Local fallback: Only run app.listen if we are NOT on Vercel
// if (process.env.NODE_ENV !== "production") {
//   const PORT = process.env.PORT || 3000;
//   app.listen(PORT, () => {
//     logger.info(`Server running on port ${PORT}`);
//   });
// }

// // CRITICAL FOR VERCEL: Export the app directly
// module.exports = app;
