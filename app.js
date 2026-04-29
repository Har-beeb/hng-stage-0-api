const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const profilesRouter = require("./controllers/profiles");
const authRouter = require("./controllers/auth");
const usersRouter = require("./controllers/users"); // <-- Newly added
const middleware = require("./utils/middleware");

const app = express();

// Trust Vercel's proxy so the rate limiter works on the bot's real IP
app.set("trust proxy", 1);

app.use(express.json());
app.use(cors());
app.use(middleware.requestLogger);
app.use(cookieParser());

// Mount the Auth Router (with rate limiting)
app.use("/auth", middleware.authLimiter, authRouter);

// Mount the API Routers (protected by Auth and API Versioning)
app.use(
  "/api/profiles",
  middleware.apiLimiter,
  middleware.requireAuth,
  middleware.requireApiVersion,
  profilesRouter,
);

app.use(
  "/api/users",
  middleware.apiLimiter,
  middleware.requireAuth,
  middleware.requireApiVersion,
  usersRouter,
);

app.get("/", (req, res) => {
  res.status(200).json({ message: "Welcome to the Insighta Labs API!" });
});

module.exports = app;
