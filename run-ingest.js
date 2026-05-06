const path = require("path");
const mongoose = require("mongoose");
// 👇 Make sure this path points to wherever you wrote your CSV processing logic
const { processCSV } = require("./services/ingestionService");
require("dotenv").config();

async function runDirectly() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const filePath = path.join(__dirname, "massive_test.csv");
    console.log(`🚀 Starting direct ingestion for: ${filePath}`);

    // 👉 START THE TIMER
    console.time("⏱️ Total Ingestion Time");

    const stats = await processCSV(filePath);

    console.log("\n✅ Ingestion Complete!");

    // 👉 STOP THE TIMER (This will print the exact milliseconds/seconds it took)
    console.timeEnd("⏱️ Total Ingestion Time");

    console.log(stats);

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Ingestion Failed:", error);
    process.exit(1);
  }
}

runDirectly();
