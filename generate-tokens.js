require("dotenv").config();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("./models/users"); // Adjust path if your models folder is somewhere else
const config = require("./utils/config");

mongoose.connect(config.MONGODB_URI).then(async () => {
  console.log("Connected to Database. Generating tokens...\n");

  try {
    // 1. Create or Find an Admin User
    let admin = await User.findOne({ role: "admin" });
    if (!admin) {
      admin = await User.create({
        github_id: "seed-admin-999",
        username: "hng_bot_admin",
        role: "admin",
      });
    }

    // 2. Create or Find an Analyst User
    let analyst = await User.findOne({ role: "analyst" });
    if (!analyst) {
      analyst = await User.create({
        github_id: "seed-analyst-999",
        username: "hng_bot_analyst",
        role: "analyst",
      });
    }

    // 3. Generate the Tokens (We give them 1 day expiration so they don't expire while grading)
    const adminAccessToken = jwt.sign(
      { id: admin._id, role: admin.role },
      config.JWT_ACCESS_SECRET,
      { expiresIn: "1d" },
    );
    const adminRefreshToken = jwt.sign(
      { id: admin._id },
      config.JWT_REFRESH_SECRET,
      { expiresIn: "1d" },
    );

    const analystAccessToken = jwt.sign(
      { id: analyst._id, role: analyst.role },
      config.JWT_ACCESS_SECRET,
      { expiresIn: "1d" },
    );

    // 4. Save the refresh token to the admin user in the database
    admin.current_refresh_token = adminRefreshToken;
    await admin.save();

    console.log("=== PASTE THESE INTO THE SUBMISSION FORM ===");
    console.log("\nAdmin Test Token:");
    console.log(adminAccessToken);

    console.log("\nAnalyst Test Token:");
    console.log(analystAccessToken);

    console.log("\nRefresh Test Token:");
    console.log(adminRefreshToken);
    console.log("\n============================================");
  } catch (error) {
    console.error("Error generating tokens:", error);
  } finally {
    process.exit(0);
  }
});
