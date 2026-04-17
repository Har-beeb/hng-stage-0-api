const profilesRouter = require("express").Router();
const Profile = require("../models/profiles");

// Helper function for the age classification rule
const getAgeGroup = (age) => {
  if (age >= 0 && age <= 12) return "child";
  if (age >= 13 && age <= 19) return "teenager";
  if (age >= 20 && age <= 59) return "adult";
  if (age >= 60) return "senior";
  return null;
};

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
      return res
        .status(502)
        .json({
          status: "error",
          message: "Genderize returned an invalid response",
        });
    }
    if (ageData.age === null) {
      return res
        .status(502)
        .json({
          status: "error",
          message: "Agify returned an invalid response",
        });
    }
    if (!natData.country || natData.country.length === 0) {
      return res
        .status(502)
        .json({
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

    // 6. Save to Database
    const newProfile = new Profile({
      name: normalizedName,
      gender: genderData.gender,
      gender_probability: genderData.probability,
      sample_size: genderData.count, // Maps Genderize "count" to "sample_size"
      age: ageData.age,
      age_group: age_group,
      country_id: highestProbCountry.country_id,
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

//--------//
// GET /api/profiles (Get all profiles with optional filtering)
profilesRouter.get('/', async (req, res) => {
    try {
        const filter = {};
        
        // Handle case-insensitive query parameters using RegExp
        if (req.query.gender) {
            filter.gender = new RegExp(`^${req.query.gender}$`, 'i');
        }
        if (req.query.country_id) {
            filter.country_id = new RegExp(`^${req.query.country_id}$`, 'i');
        }
        if (req.query.age_group) {
            filter.age_group = new RegExp(`^${req.query.age_group}$`, 'i');
        }

        const profiles = await Profile.find(filter);
        
        res.status(200).json({
            status: "success",
            count: profiles.length,
            data: profiles
        });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Server failure" });
    }
});

// GET /api/profiles/:id (Get a single profile)
profilesRouter.get('/:id', async (req, res) => {
    try {
        const profile = await Profile.findById(req.params.id);
        
        if (!profile) {
            return res.status(404).json({ status: "error", message: "Profile not found" });
        }
        
        res.status(200).json({
            status: "success",
            data: profile
        });
    } catch (error) {
        // If the ID format is invalid, Mongoose throws an error. We treat this as a 404.
        res.status(404).json({ status: "error", message: "Profile not found" });
    }
});

// DELETE /api/profiles/:id (Delete a profile)
profilesRouter.delete('/:id', async (req, res) => {
    try {
        const deletedProfile = await Profile.findByIdAndDelete(req.params.id);
        
        if (!deletedProfile) {
            return res.status(404).json({ status: "error", message: "Profile not found" });
        }
        
        // 204 means "No Content" (Success, but no JSON body to return)
        res.status(204).end();
    } catch (error) {
        res.status(404).json({ status: "error", message: "Profile not found" });
    }
});

module.exports = profilesRouter;
