const jwt = require('jsonwebtoken');
const authMiddleware = require('../auth.middleware');

jest.mock('jsonwebtoken');

describe('authMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  it('should return 401 if no authorization header is present', () => {
    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if token is invalid or expired', () => {
    req.headers.authorization = 'Bearer badtoken';
    jwt.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should set req.user and call next when token is valid', () => {
    req.headers.authorization = 'Bearer goodtoken';
    const decoded = { id: 'user-1', email: 'test@example.com' };
    jwt.verify.mockReturnValue(decoded);

    authMiddleware(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('goodtoken', 'test-secret');
    expect(req.user).toBe(decoded);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
