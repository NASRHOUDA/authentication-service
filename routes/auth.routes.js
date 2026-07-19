const express = require('express');
const passport = require('passport');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);

router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { id: req.user.id, email: req.user.email, provider: req.user.provider },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    const redirectUrl = process.env.FRONTEND_URL + '/home?token=' + token;
    res.redirect(redirectUrl);
  }
);

router.put('/change-password', authMiddleware, authController.changePassword);

module.exports = router;