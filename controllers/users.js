const usersRouter = require("express").Router();

// GET /api/users/me - Returns the authenticated user's profile
usersRouter.get("/me", async (req, res) => {
  // req.user is already populated by the requireAuth middleware!
  res.status(200).json({
    status: "success",
    data: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
      avatar_url: req.user.avatar_url,
      created_at: req.user.created_at,
    },
  });
});

module.exports = usersRouter;
