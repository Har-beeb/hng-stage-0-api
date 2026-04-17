const express = require("express");
const cors = require("cors");
const profilesRouter = require("./controllers/profiles");

const app = express();
app.use(express.json());
app.use(cors());

app.use("/api/profiles", profilesRouter);

app.get("/", (req, res) => {
  res.status(200).json({ message: "Welcome to the HNG Stage 1 API!" });
});

module.exports = app;
