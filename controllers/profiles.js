const profilesRouter = require("express").Router();
const Profile = require("../models/profiles");
const countryDictionary = require("../utils/dictionary");
const { extractAgeGroup, getAgeGroup } = require('../utils/helpers');


// POST /api/profiles
profilesRouter.post("/", async (req, res) => {
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
  try {
    // 1. Extract everything the user might ask for from the URL query
    const {
      gender,
      age_group,
      country_id,
      min_age,
      max_age,
      min_gender_probability,
      min_country_probability,
      sort_by,
      order,
      page,
      limit,
    } = req.query;

    // ==========================================
    // BLOCK 1: THE FILTER BUILDER
    // ==========================================
    const filter = {}; // Start with an empty filter (get everything)
    // Exact Matches (ignoring case where necessary)
    if (gender) filter.gender = gender.toLowerCase();
    if (age_group) filter.age_group = age_group.toLowerCase();
    if (country_id) filter.country_id = country_id.toUpperCase();

    // Range Filter (Using MongoDB's $gte and $lte operators)
    if (min_age || max_age) {
      filter.age = {}; // Create an age object
      if (min_age) filter.age.$gte = Number(min_age); // Greater Than or Equal
      if (max_age) filter.age.$lte = Number(max_age); // Less Than or Equal
    }

    // Probability Thresholds
    if (min_gender_probability) {
      filter.gender_probability = { $gte: Number(min_gender_probability) };
    }

    // NEW FILTER FOR COUNTRY PROBABILITY
    if (min_country_probability) {
      filter.country_probability = { $gte: Number(min_country_probability) };
    }

    // ==========================================
    // BLOCK 2: THE SORTING HAT
    // ==========================================
    const sortOptions = {};
    if (sort_by) {
      // If order is 'desc', use -1. Otherwise, use 1 (asc)
      const sortDirection = order === "desc" ? -1 : 1;
      sortOptions[sort_by] = sortDirection;
    }

    // ==========================================
    // BLOCK 3: PAGINATION MATH
    // ==========================================
    // Default to page 1, limit 10 if the user doesn't provide them
    const pageNumber = Number(page) || 1;
    let limitNumber = Number(limit) || 10;

    // Safety check: Max limit should not exceed 50!
    if (limitNumber > 50) limitNumber = 50;

    // The Magic Formula: (Page - 1) * Limit
    const skipNumber = (pageNumber - 1) * limitNumber;

    // ==========================================
    // BLOCK 4: DATABASE EXECUTION & RESPONSE
    // ==========================================
    // 1. Count total documents that match the filter (for the response block)
    const totalMatchingProfiles = await Profile.countDocuments(filter);

    // 2. Fetch the actual profiles with filter, sorting, and pagination
    const profiles = await Profile.find(filter)
      .sort(sortOptions)
      .skip(skipNumber)
      .limit(limitNumber);
    // 3. Send the response with metadata
    res.status(200).json({
      status: "success",
      total: totalMatchingProfiles, // Total profiles that match the filter (ignoring pagination)
      page: pageNumber,
      limit: limitNumber,
      data: profiles,
    });
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
    const profiles = await Profile.find(filter)
      .skip(skipNumber)
      .limit(limitNumber);

    res.status(200).json({
      status: "success",
      page: pageNumber,
      limit: limitNumber,
      total: totalMatchingProfiles,
      data: profiles,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Server failure" });
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
profilesRouter.delete("/:id", async (req, res) => {
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
