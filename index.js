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