const app = require("./app"); // the actual Express application
const config = require("./utils/config");
const logger = require("./utils/logger");
const mongoose = require("mongoose");

logger.info("connecting to", config.MONGODB_URI);

// 1. Connect to MongoDB (without blocking the app)
mongoose.connect(config.MONGODB_URI)
  .then(() => {
    logger.info('Connected to MongoDB');
  })
  .catch((error) => {
    logger.error('Error connecting to MongoDB:', error.message);
  });

// 2. Local fallback: Only run app.listen if we are NOT on Vercel
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`);
    });
}

// 3. CRITICAL FOR VERCEL: Export the app directly
module.exports = app;
