const profilesRouter = require("express").Router();
const Profile = require("../models/profiles");
const countryDictionary = require("../utils/dictionary");
const { extractAgeGroup, getAgeGroup, generatePaginationLinks, buildQueryOptions } = require('../utils/helpers');
const { requireAdmin } = require("../utils/middleware");

const { normalizeQuery } = require("../utils/normalizer"); // The new normalizer we built
const redisClient = require("../config/redis");
const multer = require("multer");
const { processCSV } = require("../services/ingestionService"); // Import your service!
const fs = require("fs");

// Vercel only allows writing to the /tmp directory
const upload = multer({ dest: path.join(os.tmpdir(), 'uploads') });


// POST /api/profiles
profilesRouter.post("/", requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;

    // 1. Guard Clause: Missing or empty name (400)
    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({
        status: "error",
        message: "Missing or empty name parameter",
      });
    }

    const normalizedName = name.trim().toLowerCase();

    // 2. Idempotency Check: Does this name already exist?
    const existingProfile = await Profile.findOne({ name: normalizedName });
    if (existingProfile) {
      return res.status(200).json({
        status: "success",
        message: "Profile already exists",
        data: existingProfile,
      });
    }

    // 3. Parallel External API Integration
    // We use Promise.all to fetch from all 3 APIs at the EXACT same time!
    const [genderRes, ageRes, natRes] = await Promise.all([
      fetch(`https://api.genderize.io?name=${normalizedName}`),
      fetch(`https://api.agify.io?name=${normalizedName}`),
      fetch(`https://api.nationalize.io?name=${normalizedName}`),
    ]);

    if (!genderRes.ok || !ageRes.ok || !natRes.ok) {
      return res
        .status(502)
        .json({ status: "error", message: "Upstream or server failure" });
    }

    const genderData = await genderRes.json();
    const ageData = await ageRes.json();
    const natData = await natRes.json();

    // 4. Edge Cases (502 Invalid Responses)
    if (genderData.gender === null || genderData.count === 0) {
      return res.status(502).json({
        status: "error",
        message: "Genderize returned an invalid response",
      });
    }
    if (ageData.age === null) {
      return res.status(502).json({
        status: "error",
        message: "Agify returned an invalid response",
      });
    }
    if (!natData.country || natData.country.length === 0) {
      return res.status(502).json({
        status: "error",
        message: "Nationalize returned an invalid response",
      });
    }

    // 5. Data Transformation & Classification Logic
    const age_group = getAgeGroup(ageData.age);

    // Find the country with the highest probability
    const highestProbCountry = natData.country.reduce((prev, current) => {
      return prev.probability > current.probability ? prev : current;
    });

    // Convert 2-letter ID (e.g., 'NG') into full name (e.g., 'Nigeria') using Node's native API
    let fullCountryName = highestProbCountry.country_id; // Default fallback
    try {
      const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
      fullCountryName = regionNames.of(highestProbCountry.country_id);
    } catch (error) {
      // If the ID is completely invalid, it gracefully falls back to the ID
      console.error("Could not parse country name:", error);
    }

    // 6. Save to Database
    const newProfile = new Profile({
      name: normalizedName,
      gender: genderData.gender,
      gender_probability: genderData.probability,
      sample_size: genderData.count, // Maps Genderize "count" to "sample_size"
      age: ageData.age,
      age_group: age_group,
      country_id: highestProbCountry.country_id,
      country_name: fullCountryName,
      country_probability: highestProbCountry.probability,
    });

    const savedProfile = await newProfile.save();

    // 7. Success Response
    res.status(201).json({
      status: "success",
      data: savedProfile,
    });
  } catch (error) {
    // Catch-all for database errors or fetch crashes
    res
      .status(500)
      .json({ status: "error", message: "Upstream or server failure" });
  }
});

// GET /api/profiles (Advanced Filtering, Sorting, and Pagination)
profilesRouter.get("/", async (req, res) => {
  // NEW: 1. Generate the deterministic cache key using the full req.query
  const cacheKey = `profiles:${normalizeQuery(req.query)}`;

  try {
    // NEW: 2. Check Redis FIRST before doing any heavy lifting
    const cachedResponse = await redisClient.get(cacheKey);
    if (cachedResponse) {
      // If we have a hit, parse it, flag it as cached, and return it instantly
      const parsedData = JSON.parse(cachedResponse);
      parsedData.source = "cache";
      return res.status(200).json(parsedData);
    }

    // ==========================================
    // YOUR EXACT STAGE 3 LOGIC REMAINS UNTOUCHED
    // ==========================================
    const { filter, sortOptions } = buildQueryOptions(req.query);
    const { page, limit } = req.query;

    const pageNumber = Number(page) || 1;
    let limitNumber = Number(limit) || 10;
    if (limitNumber > 50) limitNumber = 50;
    const skipNumber = (pageNumber - 1) * limitNumber;

    const totalMatchingProfiles = await Profile.countDocuments(filter);
    const totalPages = Math.ceil(totalMatchingProfiles / limitNumber) || 1;
    const paginationLinks = generatePaginationLinks(
      req,
      pageNumber,
      limitNumber,
      totalPages,
    );

    const profiles = await Profile.find(filter)
      .sort(sortOptions)
      .skip(skipNumber)
      .limit(limitNumber);

    // NEW: 3. Structure the response into a variable so we can cache it
    const finalResponse = {
      status: "success",
      source: "database", // Flag it so you know it came from the DB
      total: totalMatchingProfiles,
      page: pageNumber,
      limit: limitNumber,
      total_pages: totalPages,
      links: paginationLinks,
      data: profiles,
    };

    // NEW: 4. Save this entire response to Redis for 1 hour (3600 seconds)
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(finalResponse));

    // NEW: 5. Send the response to the user
    res.status(200).json(finalResponse);
  } catch (error) {
    res.status(500).json({ status: "error", message: "Server failure" });
  }
});

// GET /api/profiles/search (The Natural Language Translator)
profilesRouter.get("/search", async (req, res) => {
  try {
    const { q, page, limit } = req.query;

    // If they didn't provide a question, throw an error
    if (!q) {
      return res
        .status(400)
        .json({ status: "error", message: "Missing or empty parameter" });
    }

    const sentence = q.toLowerCase();
    const filter = {};

    // ==========================================
    // THE TRANSLATOR ENGINE
    // ==========================================

    // 1. THE GENDER CHECK (Using \b to mean "exact word boundary")
    const asksForMale = /\b(male|males)\b/.test(sentence);
    const asksForFemale = /\b(female|females)\b/.test(sentence);

    // If they ask for both, do nothing. Otherwise, assign the specific gender.
    if (asksForMale && !asksForFemale) filter.gender = "male";
    if (asksForFemale && !asksForMale) filter.gender = "female";

    // 2. THE AGE GROUP CHECK (Using our new helper)
    const detectedAgeGroup = extractAgeGroup(sentence);
    if (detectedAgeGroup) {
      filter.age_group = detectedAgeGroup;
    }

    // 3. THE "YOUNG" KEYWORD (Strict rule from instructions: 16-24)
    if (/\byoung\b/.test(sentence)) {
      filter.age = { $gte: 16, $lte: 24 };
    }

    // 4. THE COUNTRY CHECK (Loop through our dictionary)
    for (const [countryName, countryCode] of Object.entries(
      countryDictionary,
    )) {
      if (sentence.includes(countryName)) {
        filter.country_id = countryCode;
        break; // Stop looking once we find a match
      }
    }

    // 5. EXACT AGE NUMBERS (e.g., "above 30", "under 18")
    // Check for "above" or "over" followed by a space and some numbers (\d+)
    const minAgeMatch = sentence.match(/\b(above|over)\s+(\d+)\b/);
    if (minAgeMatch) {
      if (!filter.age) filter.age = {}; // Create the age box if it doesn't exist yet
      filter.age.$gte = Number(minAgeMatch[2]); // Extract the actual number
    }

    // Check for "below" or "under" followed by a space and some numbers
    const maxAgeMatch = sentence.match(/\b(below|under)\s+(\d+)\b/);
    if (maxAgeMatch) {
      if (!filter.age) filter.age = {};
      filter.age.$lte = Number(maxAgeMatch[2]);
    }

    // ==========================================
    // VALIDATION & EXECUTION
    // ==========================================

    // If our translator couldn't figure out ANY rules, return the required error
    if (Object.keys(filter).length === 0) {
      return res
        .status(400)
        .json({ status: "error", message: "Unable to interpret query" });
    }

    // Re-use our Pagination math from the Slicer
    const pageNumber = Number(page) || 1;
    let limitNumber = Number(limit) || 10;
    if (limitNumber > 50) limitNumber = 50;
    const skipNumber = (pageNumber - 1) * limitNumber;

    // Fetch the data using our translated filters
    const totalMatchingProfiles = await Profile.countDocuments(filter);

    //Calculate total pages
    const totalPages = Math.ceil(totalMatchingProfiles / limitNumber) || 1;

    const profiles = await Profile.find(filter)
      .skip(skipNumber)
      .limit(limitNumber);

    const paginationLinks = generatePaginationLinks(req, pageNumber, limitNumber, totalPages);

    res.status(200).json({
      status: "success",
      page: pageNumber,
      limit: limitNumber,
      total: totalMatchingProfiles,
      total_pages: totalPages,
      links: paginationLinks,
      data: profiles,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Server failure" });
  }
});

// GET /api/profiles/export (Export to CSV)
profilesRouter.get("/export", async (req, res) => {
  try {
    if (req.query.format !== 'csv') {
      return res.status(400).json({ status: "error", message: "Invalid format requested. Use ?format=csv" });
    }

    // 1. Use the EXACT same helper so the logic is perfectly mirrored!
    const { filter, sortOptions } = buildQueryOptions(req.query);

    // 2. Fetch the data (No pagination for exports)
    const profiles = await Profile.find(filter).sort(sortOptions);

    // 3. Convert to CSV
    const csvHeaders = "id,name,gender,gender_probability,age,age_group,country_id,country_name,country_probability,created_at\n";
    const csvRows = profiles.map(p => {
      return `"${p._id}","${p.name}","${p.gender}",${p.gender_probability},${p.age},"${p.age_group}","${p.country_id}","${p.country_name || ''}",${p.country_probability},"${p.created_at || new Date().toISOString()}"`;
    });
    const csvData = csvHeaders + csvRows.join("\n");

    const timestamp = Date.now();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="profiles_${timestamp}.csv"`);
    res.status(200).send(csvData);

  } catch (error) {
    res.status(500).json({ status: "error", message: "Server failure during export" });
  }
});

// ==========================================
// POST: CSV DATA INGESTION (BATCH & STREAM)
// ==========================================
profilesRouter.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file)
    return res.status(400).json({ error: "Please upload a CSV file" });

  try {
    // Hand the file path off to your dedicated service
    const finalStats = await processCSV(req.file.path);

    // Clean up the temp file
    fs.unlinkSync(req.file.path);

    // Return the required JSON
    return res.status(200).json(finalStats);
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res
      .status(500)
      .json({ status: "error", message: "File processing failed" });
  }
});

// GET /api/profiles/:id (Get a single profile)
profilesRouter.get("/:id", async (req, res) => {
  try {
    const profile = await Profile.findById(req.params.id);

    if (!profile) {
      return res
        .status(404)
        .json({ status: "error", message: "Profile not found" });
    }

    res.status(200).json({
      status: "success",
      data: profile,
    });
  } catch (error) {
    // If the ID format is invalid, Mongoose throws an error. We treat this as a 404.
    res.status(404).json({ status: "error", message: "Profile not found" });
  }
});

// DELETE /api/profiles/:id (Delete a profile)
profilesRouter.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const deletedProfile = await Profile.findByIdAndDelete(req.params.id);

    if (!deletedProfile) {
      return res
        .status(404)
        .json({ status: "error", message: "Profile not found" });
    }

    // 204 means "No Content" (Success, but no JSON body to return)
    res.status(204).end();
  } catch (error) {
    res.status(404).json({ status: "error", message: "Profile not found" });
  }
});

module.exports = profilesRouter;
