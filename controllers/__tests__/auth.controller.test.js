const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { register, login, changePassword } = require('../auth.controller');
const { User } = require('../../models');

jest.mock('jsonwebtoken');
jest.mock('bcryptjs');
jest.mock('../../models', () => ({
  User: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

describe('Auth Controller', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
      user: null,
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('register', () => {
    test('should register a new user successfully', async () => {
      req.body = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      User.findOne.mockResolvedValue(null);
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        provider: 'local',
      };
      User.create.mockResolvedValue(mockUser);
      jwt.sign.mockReturnValue('fake-token');

      await register(req, res);

      expect(User.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      expect(User.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        provider: 'local',
      });
      expect(res.json).toHaveBeenCalledWith({
        message: 'User registered successfully',
        token: 'fake-token',
        user: { id: 1, email: 'test@example.com', name: 'Test User' },
      });
    });

    test('should return 400 if email already exists', async () => {
      req.body = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Test User',
      };

      User.findOne.mockResolvedValue({ id: 1, email: 'existing@example.com' });

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Email already exists' });
      expect(User.create).not.toHaveBeenCalled();
    });

    test('should handle errors', async () => {
      req.body = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      User.findOne.mockRejectedValue(new Error('Database error'));

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Database error' });
    });
  });

  describe('login', () => {
    test('should login successfully with valid credentials', async () => {
      req.body = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        provider: 'local',
        validatePassword: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(mockUser);
      jwt.sign.mockReturnValue('fake-token');

      await login(req, res);

      expect(User.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      expect(mockUser.validatePassword).toHaveBeenCalledWith('password123');
      expect(res.json).toHaveBeenCalledWith({
        message: 'Login successful',
        token: 'fake-token',
        user: { id: 1, email: 'test@example.com', name: 'Test User' },
      });
    });

    test('should return 401 if user not found', async () => {
      req.body = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      User.findOne.mockResolvedValue(null);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
    });

    test('should return 401 if password is invalid', async () => {
      req.body = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        validatePassword: jest.fn().mockResolvedValue(false),
      };
      User.findOne.mockResolvedValue(mockUser);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
    });

    test('should handle errors', async () => {
      req.body = {
        email: 'test@example.com',
        password: 'password123',
      };

      User.findOne.mockRejectedValue(new Error('Database error'));

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Database error' });
    });
  });

  describe('changePassword', () => {
    test('should change password successfully for local user', async () => {
      req.body = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
      };
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        provider: 'local',
        validatePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };
      req.user = mockUser;
      bcrypt.hash.mockResolvedValue('hashed-new-password');

      await changePassword(req, res);

      expect(mockUser.validatePassword).toHaveBeenCalledWith('oldpassword');
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
      expect(mockUser.password).toBe('hashed-new-password');
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ message: 'Password changed successfully' });
    });

    test('should return 403 for Google users', async () => {
      req.body = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
      };
      req.user = {
        id: 1,
        email: 'test@example.com',
        provider: 'google',
      };

      await changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Password change is not available for accounts authenticated via Google. Manage your password directly in your Google account.',
      });
    });

    test('should return 400 if passwords are missing', async () => {
      req.body = {};
      req.user = { id: 1, provider: 'local' };

      await changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Current and new password are required' });
    });

    test('should return 400 if new password is too short', async () => {
      req.body = {
        currentPassword: 'oldpassword',
        newPassword: '123',
      };
      req.user = { id: 1, provider: 'local' };

      await changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'New password must be at least 6 characters' });
    });

    test('should return 401 if current password is incorrect', async () => {
      req.body = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123',
      };
      const mockUser = {
        id: 1,
        provider: 'local',
        validatePassword: jest.fn().mockResolvedValue(false),
      };
      req.user = mockUser;

      await changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Current password is incorrect' });
    });

    test('should handle errors', async () => {
      req.body = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
      };
      const mockUser = {
        id: 1,
        provider: 'local',
        validatePassword: jest.fn().mockRejectedValue(new Error('Validation error')),
      };
      req.user = mockUser;

      await changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Validation error' });
    });
  });
});
