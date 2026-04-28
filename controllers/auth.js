const config = require("../utils/config");

const authRouter = require("express").Router();
const jwt = require("jsonwebtoken");
const User = require("../models/users");

// Helper to generate both tokens
const generateTokens = (user) => {
  // Access token: 3 minutes, contains roles for authorization
  const access_token = jwt.sign(
    { id: user._id, role: user.role },
    config.JWT_ACCESS_SECRET,
    { expiresIn: "3m" },
  );

  // Refresh token: 5 minutes, only contains ID
  const refresh_token = jwt.sign(
    { id: user._id },
    config.JWT_REFRESH_SECRET,
    { expiresIn: "5m" },
  );

  return { access_token, refresh_token };
};

// 1. GET /auth/github - Redirects to GitHub
authRouter.get("/github", (req, res) => {
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${config.GITHUB_CLIENT_ID}&scope=read:user user:email`;
  res.redirect(githubAuthUrl);
});

// 2. GET /auth/github/callback - GitHub sends the code here
authRouter.get("/github/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res
      .status(400)
      .json({ status: "error", message: "No code provided by GitHub" });
  }

  try {
    // A. Trade the code for a GitHub Access Token
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
        }),
      },
    );

    const tokenData = await tokenResponse.json();
    if (tokenData.error) throw new Error(tokenData.error_description);

    // B. Fetch User Profile from GitHub
    const userResponse = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const githubUser = await userResponse.json();

    // C. Fetch Emails (GitHub often hides the primary email in the main profile)
    const emailResponse = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const emails = await emailResponse.json();
    const primaryEmail = emails.find((e) => e.primary)?.email || null;

    // D. Database Sync (Upsert)
    let user = await User.findOne({ github_id: githubUser.id.toString() });

    if (!user) {
      // First time logging in! (Defaults to 'analyst' role per schema)
      user = new User({
        github_id: githubUser.id.toString(),
        username: githubUser.login,
        email: primaryEmail,
        avatar_url: githubUser.avatar_url,
      });
    } else {
      user.last_login_at = Date.now();
    }

    // E. Generate Insighta Tokens & Save Refresh Token
    const { access_token, refresh_token } = generateTokens(user);
    user.current_refresh_token = refresh_token;
    await user.save();

    // F. Set HTTP-Only cookies for the Web Portal (as required)
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

    // G. Return JSON for the CLI
    res.status(200).json({
      status: "success",
      message: "Authentication successful",
      user: { id: user._id, username: user.username, role: user.role },
      access_token,
      refresh_token,
    });
  } catch (error) {
    console.error("OAuth Error:", error);
    res.status(500).json({ status: "error", message: "Authentication failed" });
  }
});

// 3. POST /auth/refresh - Trade old refresh token for a new pair
authRouter.post("/refresh", async (req, res) => {
  // Fallback: Check body (CLI) or cookies (Web Portal)
  const token = req.body.refresh_token || req.cookies?.refresh_token;

  if (!token) {
    return res
      .status(401)
      .json({ status: "error", message: "Refresh token required" });
  }

  try {
    // Verify it's a real token we signed and it hasn't expired (5 min)
    const decoded = jwt.verify(token, config.JWT_REFRESH_SECRET);

    // Find user and verify this token matches the one in the DB (Server-side invalidation check)
    const user = await User.findById(decoded.id);
    if (!user || user.current_refresh_token !== token) {
      return res
        .status(403)
        .json({ status: "error", message: "Invalid or revoked refresh token" });
    }

    // Generate fresh tokens
    const { access_token, refresh_token } = generateTokens(user);

    // Immediately invalidate the old one by saving the new one
    user.current_refresh_token = refresh_token;
    await user.save();

    // Update Web Cookies
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

    // Return for CLI
    res.status(200).json({
      status: "success",
      access_token,
      refresh_token,
    });
  } catch (error) {
    res
      .status(403)
      .json({ status: "error", message: "Refresh token expired or invalid" });
  }
});

// 4. POST /auth/logout - Destroys session
authRouter.post("/logout", async (req, res) => {
  const token = req.body.refresh_token || req.cookies?.refresh_token;

  if (token) {
    try {
      const decoded = jwt.verify(token, config.JWT_REFRESH_SECRET, {
        ignoreExpiration: true,
      });
      const user = await User.findById(decoded.id);
      if (user) {
        // Invalidate server-side
        user.current_refresh_token = null;
        await user.save();
      }
    } catch (err) {
      // Ignore token decode errors on logout, we still want to clear cookies
    }
  }

  // Clear cookies for Web
  res.clearCookie("access_token");
  res.clearCookie("refresh_token");

  res
    .status(200)
    .json({ status: "success", message: "Logged out successfully" });
});

module.exports = authRouter;
