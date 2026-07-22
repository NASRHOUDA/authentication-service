const jwt = require('jsonwebtoken');
const { Auth } = require('../models');
const userService = require('../services/userServiceClient');

const generateToken = (userId, email, provider) => {
  return jwt.sign(
    { id: userId, email, provider },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const existingUser = await userService.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const user = await userService.createUser({ email, name });

    const auth = await Auth.create({
      userId: user.id,
      provider: "local",
      passwordHash: password,
    });

    const token = generateToken(user.id, user.email, auth.provider);
    res.json({
      message: "User registered successfully",
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await userService.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const auth = await Auth.findOne({ where: { userId: user.id } });
    if (auth?.provider !== "local") {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValid = await auth.validatePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = generateToken(user.id, user.email, auth.provider);
    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const auth = await Auth.findOne({ where: { userId: req.user.id } });
    if (!auth) return res.status(404).json({ error: "Auth record not found" });

    if (auth.provider !== "local") {
      return res.status(403).json({
        error: "Password change is not available for accounts authenticated via Google. Manage your password directly in your Google account.",
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const isValid = await auth.validatePassword(currentPassword);
    if (!isValid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    auth.passwordHash = newPassword;
    await auth.save();

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { register, login, changePassword };
