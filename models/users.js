// models/users.js
const mongoose = require('mongoose');
const { v7: uuidv7 } = require('uuid');

const userSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: uuidv7,
    },
    github_id: {
      type: String,
      required: true,
      unique: true,
    },
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String, // GitHub sometimes hides emails, so this isn't strictly required
    },
    avatar_url: {
      type: String,
    },
    role: {
      type: String,
      enum: ["admin", "analyst"],
      default: "analyst", // Default role per instructions
    },
    is_active: {
      type: Boolean,
      default: true, // If false -> 403 Forbidden on all requests
    },
    current_refresh_token: {
      type: String,
      default: null,
    },
    last_login_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Automatically handles the created_at timestamp required by instructions
    timestamps: { createdAt: "created_at", updatedAt: false },
    toJSON: {
      transform: (document, returnedObject) => {
        returnedObject.id = returnedObject._id;
        delete returnedObject._id;
        delete returnedObject.__v;
      },
    },
  },
);

module.exports = mongoose.model('User', userSchema);