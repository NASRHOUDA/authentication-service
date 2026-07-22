const jwt = require('jsonwebtoken');
const { register, login, changePassword } = require('../auth.controller');
const { Auth } = require('../../models');
const userService = require('../../services/userServiceClient');

jest.mock('../../models', () => ({
  Auth: {
    create: jest.fn(),
    findOne: jest.fn(),
  },
}));
jest.mock('../../services/userServiceClient', () => ({
  findUserByEmail: jest.fn(),
  createUser: jest.fn(),
  getUserById: jest.fn(),
}));
jest.mock('jsonwebtoken');

describe('Auth Controller', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { body: {}, user: null };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('register', () => {
    test('should register a new user successfully', async () => {
      req.body = { email: 'test@example.com', password: 'password123', name: 'Test User' };
      userService.findUserByEmail.mockResolvedValue(null);
      const mockUser = { id: 1, email: 'test@example.com', name: 'Test User' };
      userService.createUser.mockResolvedValue(mockUser);
      const mockAuth = { provider: 'local' };
      Auth.create.mockResolvedValue(mockAuth);
      jwt.sign.mockReturnValue('fake-token');

      await register(req, res);

      expect(userService.findUserByEmail).toHaveBeenCalledWith('test@example.com');
      expect(userService.createUser).toHaveBeenCalledWith({ email: 'test@example.com', name: 'Test User' });
      expect(Auth.create).toHaveBeenCalledWith({ userId: 1, provider: 'local', passwordHash: 'password123' });
      expect(jwt.sign).toHaveBeenCalledWith(
        { id: 1, email: 'test@example.com', provider: 'local' },
        'test-secret',
        { expiresIn: '7d' }
      );
      expect(res.json).toHaveBeenCalledWith({
        message: 'User registered successfully',
        token: 'fake-token',
        user: { id: 1, email: 'test@example.com', name: 'Test User' },
      });
    });

    test('should return 400 if email already exists', async () => {
      req.body = { email: 'existing@example.com', password: 'password123', name: 'Test User' };
      userService.findUserByEmail.mockResolvedValue({ id: 1, email: 'existing@example.com' });

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Email already exists' });
      expect(Auth.create).not.toHaveBeenCalled();
    });

    test('should handle errors', async () => {
      req.body = { email: 'test@example.com', password: 'password123', name: 'Test User' };
      userService.findUserByEmail.mockRejectedValue(new Error('Database error'));

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Database error' });
    });
  });

  describe('login', () => {
    test('should login successfully with valid credentials', async () => {
      req.body = { email: 'test@example.com', password: 'password123' };
      const mockUser = { id: 1, email: 'test@example.com', name: 'Test User' };
      userService.findUserByEmail.mockResolvedValue(mockUser);
      const mockAuth = { provider: 'local', validatePassword: jest.fn().mockResolvedValue(true) };
      Auth.findOne.mockResolvedValue(mockAuth);
      jwt.sign.mockReturnValue('fake-token');

      await login(req, res);

      expect(userService.findUserByEmail).toHaveBeenCalledWith('test@example.com');
      expect(Auth.findOne).toHaveBeenCalledWith({ where: { userId: 1 } });
      expect(mockAuth.validatePassword).toHaveBeenCalledWith('password123');
      expect(res.json).toHaveBeenCalledWith({
        message: 'Login successful',
        token: 'fake-token',
        user: { id: 1, email: 'test@example.com', name: 'Test User' },
      });
    });

    test('should return 401 if user not found', async () => {
      req.body = { email: 'nonexistent@example.com', password: 'password123' };
      userService.findUserByEmail.mockResolvedValue(null);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
      expect(Auth.findOne).not.toHaveBeenCalled();
    });

    test('should return 401 if auth provider is not local', async () => {
      req.body = { email: 'test@example.com', password: 'password123' };
      userService.findUserByEmail.mockResolvedValue({ id: 1, email: 'test@example.com' });
      Auth.findOne.mockResolvedValue({ provider: 'google' });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
    });

    test('should return 401 if auth record is null', async () => {
      req.body = { email: 'test@example.com', password: 'password123' };
      userService.findUserByEmail.mockResolvedValue({ id: 1, email: 'test@example.com' });
      Auth.findOne.mockResolvedValue(null);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
    });

    test('should return 401 if password is invalid', async () => {
      req.body = { email: 'test@example.com', password: 'wrongpassword' };
      userService.findUserByEmail.mockResolvedValue({ id: 1, email: 'test@example.com' });
      const mockAuth = { provider: 'local', validatePassword: jest.fn().mockResolvedValue(false) };
      Auth.findOne.mockResolvedValue(mockAuth);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
    });

    test('should handle errors', async () => {
      req.body = { email: 'test@example.com', password: 'password123' };
      userService.findUserByEmail.mockRejectedValue(new Error('Database error'));

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Database error' });
    });
  });

  describe('changePassword', () => {
    test('should change password successfully for local user', async () => {
      const mockAuth = {
        provider: 'local',
        validatePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };
      Auth.findOne.mockResolvedValue(mockAuth);
      req.user = { id: 1 };
      req.body = { currentPassword: 'oldpassword', newPassword: 'newpassword123' };

      await changePassword(req, res);

      expect(Auth.findOne).toHaveBeenCalledWith({ where: { userId: 1 } });
      expect(mockAuth.validatePassword).toHaveBeenCalledWith('oldpassword');
      expect(mockAuth.passwordHash).toBe('newpassword123');
      expect(mockAuth.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ message: 'Password changed successfully' });
    });

    test('should return 404 if auth record not found', async () => {
      Auth.findOne.mockResolvedValue(null);
      req.user = { id: 1 };
      req.body = { currentPassword: 'oldpassword', newPassword: 'newpassword123' };

      await changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Auth record not found' });
    });

    test('should return 403 for Google users', async () => {
      Auth.findOne.mockResolvedValue({ provider: 'google' });
      req.user = { id: 1 };
      req.body = { currentPassword: 'oldpassword', newPassword: 'newpassword123' };

      await changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Password change is not available for accounts authenticated via Google. Manage your password directly in your Google account.',
      });
    });

    test('should return 400 if passwords are missing', async () => {
      Auth.findOne.mockResolvedValue({ provider: 'local' });
      req.user = { id: 1 };
      req.body = {};

      await changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Current and new password are required' });
    });

    test('should return 400 if new password is too short', async () => {
      Auth.findOne.mockResolvedValue({ provider: 'local' });
      req.user = { id: 1 };
      req.body = { currentPassword: 'oldpassword', newPassword: '123' };

      await changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'New password must be at least 6 characters' });
    });

    test('should return 401 if current password is incorrect', async () => {
      const mockAuth = { provider: 'local', validatePassword: jest.fn().mockResolvedValue(false) };
      Auth.findOne.mockResolvedValue(mockAuth);
      req.user = { id: 1 };
      req.body = { currentPassword: 'wrongpassword', newPassword: 'newpassword123' };

      await changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Current password is incorrect' });
    });

    test('should handle errors', async () => {
      const mockAuth = { provider: 'local', validatePassword: jest.fn().mockRejectedValue(new Error('Validation error')) };
      Auth.findOne.mockResolvedValue(mockAuth);
      req.user = { id: 1 };
      req.body = { currentPassword: 'oldpassword', newPassword: 'newpassword123' };

      await changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Validation error' });
    });
  });
});
