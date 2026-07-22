const bcrypt = require('bcryptjs');
const defineAuthModel = require('../Auth');

jest.mock('bcryptjs');

describe('Auth model', () => {
  let mockDefine, AuthModel, options;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDefine = jest.fn((name, attributes, opts) => {
      options = opts;
      function Auth() {}
      return Auth;
    });
    const sequelize = { define: mockDefine };
    AuthModel = defineAuthModel(sequelize);
  });

  test('defines the Auth model on the sequelize instance', () => {
    expect(mockDefine).toHaveBeenCalledWith('Auth', expect.any(Object), expect.any(Object));
  });

  describe('validatePassword', () => {
    test('returns false if there is no passwordHash', async () => {
      const instance = { passwordHash: null };
      const result = await AuthModel.prototype.validatePassword.call(instance, 'pw');
      expect(result).toBe(false);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    test('compares password against the hash', async () => {
      bcrypt.compare.mockResolvedValue(true);
      const instance = { passwordHash: 'hashed' };
      const result = await AuthModel.prototype.validatePassword.call(instance, 'pw');
      expect(bcrypt.compare).toHaveBeenCalledWith('pw', 'hashed');
      expect(result).toBe(true);
    });
  });

  describe('beforeCreate hook', () => {
    test('hashes the passwordHash when present', async () => {
      bcrypt.hash.mockResolvedValue('newhash');
      const auth = { passwordHash: 'plain' };

      await options.hooks.beforeCreate(auth);

      expect(bcrypt.hash).toHaveBeenCalledWith('plain', 10);
      expect(auth.passwordHash).toBe('newhash');
    });

    test('does nothing when passwordHash is not set', async () => {
      const auth = { passwordHash: null };

      await options.hooks.beforeCreate(auth);

      expect(bcrypt.hash).not.toHaveBeenCalled();
    });
  });

  describe('beforeUpdate hook', () => {
    test('hashes the passwordHash when changed and present', async () => {
      bcrypt.hash.mockResolvedValue('newhash2');
      const auth = { passwordHash: 'plain2', changed: jest.fn().mockReturnValue(true) };

      await options.hooks.beforeUpdate(auth);

      expect(auth.changed).toHaveBeenCalledWith('passwordHash');
      expect(bcrypt.hash).toHaveBeenCalledWith('plain2', 10);
      expect(auth.passwordHash).toBe('newhash2');
    });

    test('does nothing when passwordHash has not changed', async () => {
      const auth = { passwordHash: 'plain2', changed: jest.fn().mockReturnValue(false) };

      await options.hooks.beforeUpdate(auth);

      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    test('does nothing when changed but passwordHash is empty', async () => {
      const auth = { passwordHash: null, changed: jest.fn().mockReturnValue(true) };

      await options.hooks.beforeUpdate(auth);

      expect(bcrypt.hash).not.toHaveBeenCalled();
    });
  });
});
