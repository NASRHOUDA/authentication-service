const jwt = require('jsonwebtoken');
const { Auth } = require('../models');
const userService = require('../services/userServiceClient');
const logger = require('../utils/logger');

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
      logger.warn('Register failed: email already exists', { email });
      return res.status(400).json({ error: "Email already exists" });
    }

    const user = await userService.createUser({ email, name });

    const auth = await Auth.create({
      userId: user.id,
      provider: "local",
      passwordHash: password,
    });

    const token = generateToken(user.id, user.email, auth.provider);
    logger.info('User registered successfully', { userId: user.id, email: user.email });
    res.json({
      message: "User registered successfully",
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    logger.error('Register error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await userService.findUserByEmail(email);
    if (!user) {
      logger.warn('Login failed: user not found', { email });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const auth = await Auth.findOne({ where: { userId: user.id } });
    if (auth?.provider !== "local") {
      logger.warn('Login failed: invalid provider', { email, provider: auth?.provider });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValid = await auth.validatePassword(password);
    if (!isValid) {
      logger.warn('Login failed: invalid password', { email });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = generateToken(user.id, user.email, auth.provider);
    logger.info('Login successful', { userId: user.id, email: user.email });
    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    logger.error('Login error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const auth = await Auth.findOne({ where: { userId: req.user.id } });
    if (!auth) {
      logger.warn('Change password failed: auth record not found', { userId: req.user.id });
      return res.status(404).json({ error: "Auth record not found" });
    }

    if (auth.provider !== "local") {
      logger.warn('Change password failed: non-local provider', { userId: req.user.id, provider: auth.provider });
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
      logger.warn('Change password failed: incorrect current password', { userId: req.user.id });
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    auth.passwordHash = newPassword;
    await auth.save();

    logger.info('Password changed successfully', { userId: req.user.id });
    res.json({ message: "Password changed successfully" });
  } catch (error) {
    logger.error('Change password error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
};

module.exports = { register, login, changePassword };
