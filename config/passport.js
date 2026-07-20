const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { Auth } = require('../models');
const userService = require('../services/userServiceClient');

console.log('=== LOADING PASSPORT CONFIG ===');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'EXISTS (length: ' + process.env.GOOGLE_CLIENT_ID.length + ')' : 'MISSING');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'EXISTS (length: ' + process.env.GOOGLE_CLIENT_SECRET.length + ')' : 'MISSING');
console.log('===============================');

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails[0]?.value;
          console.log('Google OAuth callback received for:', email);

          let auth = await Auth.findOne({
            where: { provider: 'google', providerId: profile.id },
          });

          let user;

          if (auth) {
            user = await userService.getUserById(auth.userId);
          } else {
            user = await userService.findUserByEmail(email);

            if (user) {
              auth = await Auth.findOne({ where: { userId: user.id } });
              if (auth) {
                await auth.update({ provider: 'google', providerId: profile.id });
              } else {
                auth = await Auth.create({
                  userId: user.id,
                  provider: 'google',
                  providerId: profile.id,
                });
              }
            } else {
              user = await userService.createUser({
                email,
                name: profile.displayName,
              });
              auth = await Auth.create({
                userId: user.id,
                provider: 'google',
                providerId: profile.id,
              });
            }
          }

          return done(null, user);
        } catch (error) {
          console.error('Google Strategy error:', error);
          return done(error, null);
        }
      }
    )
  );
  console.log('Google OAuth strategy registered');
} else {
  console.warn('Google OAuth not configured - running without Google login');
}

module.exports = passport;
