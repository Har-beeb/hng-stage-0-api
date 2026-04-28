const express = require("express");
const cors = require("cors");
const profilesRouter = require("./controllers/profiles");
const middleware = require("./utils/middleware");
const authRouter = require("./controllers/auth");

const app = express();
app.use(express.json());
app.use(cors());
app.use(middleware.requestLogger);

const cookieParser = require("cookie-parser");
app.use(cookieParser());

app.use(
  "/api/profiles",
  middleware.apiLimiter,
  middleware.requireAuth,
  middleware.requireApiVersion,
  profilesRouter,
);
app.use("/auth", middleware.authLimiter, authRouter);

app.get("/", (req, res) => {
  res.status(200).json({ message: "Welcome to the HNG Stage 1 API!" });
});

module.exports = app;
