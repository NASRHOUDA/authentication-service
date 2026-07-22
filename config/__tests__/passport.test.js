jest.mock('passport', () => ({ use: jest.fn() }));
jest.mock('passport-google-oauth20', () => ({ Strategy: jest.fn() }));
jest.mock('../../models', () => ({
  Auth: { findOne: jest.fn(), create: jest.fn() },
}));
jest.mock('../../services/userServiceClient', () => ({
  findUserByEmail: jest.fn(),
  createUser: jest.fn(),
  getUserById: jest.fn(),
}));

describe('passport config', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test('does not register Google strategy when env vars are missing', () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    const passport = require('passport');
    require('../passport');

    expect(passport.use).not.toHaveBeenCalled();
  });

  test('registers Google strategy with default callback URL when env vars are present', () => {
    process.env.GOOGLE_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
    delete process.env.GOOGLE_CALLBACK_URL;

    const passport = require('passport');
    const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
    require('../passport');

    expect(passport.use).toHaveBeenCalled();
    expect(GoogleStrategy).toHaveBeenCalledWith(
      expect.objectContaining({
        clientID: 'client-id',
        clientSecret: 'client-secret',
        callbackURL: '/api/auth/google/callback',
      }),
      expect.any(Function)
    );
  });

  test('uses GOOGLE_CALLBACK_URL when provided', () => {
    process.env.GOOGLE_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
    process.env.GOOGLE_CALLBACK_URL = '/custom/callback';

    const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
    require('../passport');

    expect(GoogleStrategy).toHaveBeenCalledWith(
      expect.objectContaining({ callbackURL: '/custom/callback' }),
      expect.any(Function)
    );
  });

  describe('verify callback', () => {
    let verifyCallback, Auth, userService, done, profile;

    beforeEach(() => {
      process.env.GOOGLE_CLIENT_ID = 'client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'client-secret';

      const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
      require('../passport');

      verifyCallback = GoogleStrategy.mock.calls[0][1];
      Auth = require('../../models').Auth;
      userService = require('../../services/userServiceClient');
      done = jest.fn();
      profile = { id: 'google-id-1', displayName: 'Test User', emails: [{ value: 'test@example.com' }] };
    });

    test('uses existing google auth record to fetch the user', async () => {
      Auth.findOne.mockResolvedValue({ userId: 1 });
      const mockUser = { id: 1, email: 'test@example.com' };
      userService.getUserById.mockResolvedValue(mockUser);

      await verifyCallback('token', 'refresh', profile, done);

      expect(Auth.findOne).toHaveBeenCalledWith({ where: { provider: 'google', providerId: 'google-id-1' } });
      expect(userService.getUserById).toHaveBeenCalledWith(1);
      expect(done).toHaveBeenCalledWith(null, mockUser);
    });

    test('links an existing auth record to google when user is found by email', async () => {
      Auth.findOne.mockResolvedValueOnce(null);
      const mockUser = { id: 2, email: 'test@example.com' };
      userService.findUserByEmail.mockResolvedValue(mockUser);
      const existingAuth = { update: jest.fn().mockResolvedValue(true) };
      Auth.findOne.mockResolvedValueOnce(existingAuth);

      await verifyCallback('token', 'refresh', profile, done);

      expect(userService.findUserByEmail).toHaveBeenCalledWith('test@example.com');
      expect(existingAuth.update).toHaveBeenCalledWith({ provider: 'google', providerId: 'google-id-1' });
      expect(done).toHaveBeenCalledWith(null, mockUser);
    });

    test('creates a new auth record when user is found by email but has no auth', async () => {
      Auth.findOne.mockResolvedValueOnce(null);
      const mockUser = { id: 3, email: 'test@example.com' };
      userService.findUserByEmail.mockResolvedValue(mockUser);
      Auth.findOne.mockResolvedValueOnce(null);
      Auth.create.mockResolvedValue(true);

      await verifyCallback('token', 'refresh', profile, done);

      expect(Auth.create).toHaveBeenCalledWith({ userId: 3, provider: 'google', providerId: 'google-id-1' });
      expect(done).toHaveBeenCalledWith(null, mockUser);
    });

    test('creates a new user and auth record when no user is found by email', async () => {
      Auth.findOne.mockResolvedValueOnce(null);
      userService.findUserByEmail.mockResolvedValue(null);
      const newUser = { id: 4, email: 'test@example.com' };
      userService.createUser.mockResolvedValue(newUser);
      Auth.create.mockResolvedValue(true);

      await verifyCallback('token', 'refresh', profile, done);

      expect(userService.createUser).toHaveBeenCalledWith({ email: 'test@example.com', name: 'Test User' });
      expect(Auth.create).toHaveBeenCalledWith({ userId: 4, provider: 'google', providerId: 'google-id-1' });
      expect(done).toHaveBeenCalledWith(null, newUser);
    });

    test('calls done with the error when something throws', async () => {
      const err = new Error('boom');
      Auth.findOne.mockRejectedValue(err);

      await verifyCallback('token', 'refresh', profile, done);

      expect(done).toHaveBeenCalledWith(err, null);
    });
  });
});
