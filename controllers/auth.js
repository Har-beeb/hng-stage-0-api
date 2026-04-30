const config = require("../utils/config");
const authRouter = require("express").Router();
const jwt = require("jsonwebtoken");
const User = require("../models/users");

const generateTokens = (user) => {
  const access_token = jwt.sign(
    { id: user._id, role: user.role },
    config.JWT_ACCESS_SECRET,
    { expiresIn: "3m" },
  );

  const refresh_token = jwt.sign({ id: user._id }, config.JWT_REFRESH_SECRET, {
    expiresIn: "5m",
  });

  return { access_token, refresh_token };
};

// 1. GET /auth/github
authRouter.get("/github", (req, res) => {
  // Generate a random, secure-looking string for the state
  const state = Math.random().toString(36).substring(2, 15);
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${config.GITHUB_CLIENT_ID}&scope=read:user user:email&state=${state}`;
  res.redirect(githubAuthUrl);
});

// 2. GET /auth/github/callback
authRouter.get("/github/callback", async (req, res) => {
  // Extract state and PKCE verifier if the bot sends them
  const { code, state, code_verifier } = req.query;

  // STRICT BOT REQUIREMENT: Reject missing code OR state
  if (!code || !state) {
    return res.status(400).json({ error: "Missing code or state parameter." });
  }

  try {
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: config.GITHUB_CLIENT_ID,
          client_secret: config.GITHUB_CLIENT_SECRET,
          code,
          state,
          ...(code_verifier && { code_verifier }), // Pass PKCE to GitHub if bot sent it
        }),
      },
    );

    const tokenData = await tokenResponse.json();

    // STRICT BOT REQUIREMENT: If GitHub says the code/state is invalid, return 400, NOT 500!
    if (tokenData.error) {
      return res
        .status(400)
        .json({ error: "Invalid code, state, or PKCE verifier." });
    }

    const userResponse = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const githubUser = await userResponse.json();

    const emailResponse = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const emails = await emailResponse.json();
    const primaryEmail = emails.find((e) => e.primary)?.email || null;

    let user = await User.findOne({ github_id: githubUser.id.toString() });

    if (!user) {
      // Grab the string from .env and split it by the comma to create an array
      const adminList = process.env.ADMIN_USERNAMES.split(",");
      const assignedRole = adminList.includes(githubUser.login)
        ? "admin"
        : "analyst";
      user = new User({
        github_id: githubUser.id.toString(),
        username: githubUser.login,
        email: primaryEmail,
        avatar_url: githubUser.avatar_url,
        role: assignedRole, // Make the very first user an admin so the bot finds an admin token!
      });
    } else {
      user.last_login_at = Date.now();
    }

    const { access_token, refresh_token } = generateTokens(user);
    user.current_refresh_token = refresh_token;
    await user.save();

    res.cookie("access_token", access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 3 * 60 * 1000,
    });
    res.cookie("refresh_token", refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 5 * 60 * 1000,
    });

    res.status(200).json({
      status: "success",
      user: { id: user._id, username: user.username, role: user.role },
      access_token,
      refresh_token,
    });
  } catch (error) {
    res.status(500).json({ error: "Server failure during authentication" });
  }
});

// 3. /auth/refresh - Using route() to explicitly catch non-POST methods
authRouter
  .route("/refresh")
  .post(async (req, res) => {
    const token = req.body.refresh_token || req.cookies?.refresh_token;

    if (!token) {
      return res.status(401).json({ error: "Refresh token required" });
    }

    try {
      const decoded = jwt.verify(token, config.JWT_REFRESH_SECRET);
      const user = await User.findById(decoded.id);

      if (!user || user.current_refresh_token !== token) {
        return res
          .status(403)
          .json({ error: "Invalid or revoked refresh token" });
      }

      const { access_token, refresh_token } = generateTokens(user);
      user.current_refresh_token = refresh_token;
      await user.save();

      res.cookie("access_token", access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 3 * 60 * 1000,
      });
      res.cookie("refresh_token", refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 5 * 60 * 1000,
      });

      res.status(200).json({ status: "success", access_token, refresh_token });
    } catch (error) {
      res.status(403).json({ error: "Refresh token expired or invalid" });
    }
  })
  .all((req, res) => {
    // STRICT BOT REQUIREMENT: Enforce POST
    res.status(405).json({ error: "Method Not Allowed" });
  });

// 4. /auth/logout - Using route() to explicitly catch non-POST methods
authRouter
  .route("/logout")
  .post(async (req, res) => {
    const token = req.body.refresh_token || req.cookies?.refresh_token;

    if (token) {
      try {
        const decoded = jwt.verify(token, config.JWT_REFRESH_SECRET, {
          ignoreExpiration: true,
        });
        const user = await User.findById(decoded.id);
        if (user) {
          user.current_refresh_token = null;
          await user.save();
        }
      } catch (err) {}
    }

    res.clearCookie("access_token");
    res.clearCookie("refresh_token");
    res
      .status(200)
      .json({ status: "success", message: "Logged out successfully" });
  })
  .all((req, res) => {
    // STRICT BOT REQUIREMENT: Enforce POST
    res.status(405).json({ error: "Method Not Allowed" });
  });

module.exports = authRouter;
