// services/ingestionService.js
const fs = require("fs");
const csv = require("csv-parser");
const Profile = require("../models/profiles"); // Adjust path to your model

async function processCSV(filePath) {
  const stats = {
    status: "success",
    total_rows: 0,
    inserted: 0,
    skipped: 0,
    reasons: { duplicate_name: 0, invalid_age: 0, missing_fields: 0 },
  };

  const BATCH_SIZE = 1000;
  let batch = [];

  const processBatch = async (currentBatch) => {
    try {
      const insertedDocs = await Profile.insertMany(currentBatch, {
        ordered: false,
      });
      stats.inserted += insertedDocs.length;
    } catch (error) {
      if (error.writeErrors) {
        const successfulInserts =
          currentBatch.length - error.writeErrors.length;
        stats.inserted += successfulInserts;
        stats.skipped += error.writeErrors.length;
        error.writeErrors.forEach((err) => {
          if (err.err.code === 11000) stats.reasons.duplicate_name++;
        });
      }
    }
  };

  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath).pipe(csv());

    stream
      .on("data", async (row) => {
        stats.total_rows++;

        // Validation
        if (!row.name || !row.gender || !row.country_id) {
          stats.skipped++;
          stats.reasons.missing_fields++;
          return;
        }
        const age = Number(row.age);
        if (isNaN(age) || age < 0) {
          stats.skipped++;
          stats.reasons.invalid_age++;
          return;
        }

        batch.push(row);

        // Handle batch limit (Pause stream, insert, resume)
        if (batch.length >= BATCH_SIZE) {
          stream.pause();
          await processBatch(batch);
          batch = [];
          stream.resume();
        }
      })
      .on("end", async () => {
        if (batch.length > 0) await processBatch(batch);
        resolve(stats);
      })
      .on("error", reject);
  });
}

module.exports = { processCSV };
