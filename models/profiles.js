const mongoose = require("mongoose");
const { v7: uuidv7 } = require("uuid");

const profileSchema = new mongoose.Schema({
  // 1. Force MongoDB to use UUID v7 instead of its default ObjectId
  _id: {
    type: String,
    default: uuidv7,
  },
  name: {
    type: String,
    required: true,
    unique: true, // Safety net for idempotency
    lowercase: true, // Normalizes names so "Ella" and "ella" are treated the same
  },
  gender: String,
  gender_probability: Number,
  sample_size: Number,
  age: Number,
  age_group: String,
  country_id: String,
  country_probability: Number,
  created_at: {
    type: Date,
    default: Date.now,
  },
});

// 2. The FullStackOpen Magic Trick (Formatting the Output)
profileSchema.set("toJSON", {
  transform: (document, returnedObject) => {
    // Mongoose creates an _id field by default. HNG strictly wants "id".
    returnedObject.id = returnedObject._id;

    // Delete the MongoDB specific fields so Thanos bot doesn't fail you
    delete returnedObject._id;
    delete returnedObject.__v;
  },
});

module.exports = mongoose.model("Profile", profileSchema);
