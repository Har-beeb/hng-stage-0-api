config = require('./utils/config');
const mongoose = require('mongoose');
const Profile = require('./models/profiles');
const profilesData = require('./data/seed_profiles.json').profiles;

const seedDatabase = async () => {
  try {
    // 1. Connect to MongoDB
    console.log("Connecting to MongoDB...");
    await mongoose.connect(config.MONGODB_URI);
    console.log("Connected to MongoDB for seeding");

    // 2. Fetch all existing profile names from the database
    const existingProfiles = await Profile.find({}, "name");
    const existingNames = existingProfiles.map((p) => p.name.toLowerCase());

    // 3. Filter the JSON data to only include profiles that aren't in the DB yet
    const newProfiles = profilesData.filter(
      (profile) => !existingNames.includes(profile.name.toLowerCase()),
    );

    // 4. Insert the data or skip if already seeded
    if (newProfiles.length === 0) {
      console.log("Database is already fully seeded! No duplicates added.");
    } else {
      console.log(
        `Inserting ${newProfiles.length} new profiles. This might take a few seconds...`,
      );
      const insertedProfiles = await Profile.insertMany(newProfiles);
      console.log(
        `Seeding complete! ${insertedProfiles.length} profiles are now in the filing cabinet.`,
      );
    }
  } catch (error) {
    console.error('Error seeding the database:', error.message);
  }
  finally {
    // 5. Close the database connection so the terminal process ends cleanly
    mongoose.connection.close();
    console.log("Database connection closed after seeding");
  }
};

// Run the seeding function
seedDatabase();