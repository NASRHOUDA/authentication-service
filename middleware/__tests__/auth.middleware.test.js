const jwt = require("jsonwebtoken");
const authMiddleware = require("../auth.middleware");

jest.mock("jsonwebtoken");
jest.mock("../../models", () => ({
  User: {
    findByPk: jest.fn(),
  },
}));

const { User } = require("../../models");

describe("authMiddleware (DB-lookup version)", () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  it("should return 401 if no authorization header is present", async () => {
    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Authentication required" });
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 if token is invalid or expired", async () => {
    req.headers.authorization = "Bearer badtoken";
    jwt.verify.mockImplementation(() => {
      throw new Error("jwt expired");
    });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 if user is not found in DB", async () => {
    req.headers.authorization = "Bearer goodtoken";
    jwt.verify.mockReturnValue({ id: "user-1" });
    User.findByPk.mockResolvedValue(null);

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "User not found" });
    expect(next).not.toHaveBeenCalled();
  });

  it("should set req.user and call next when token and user are valid", async () => {
    req.headers.authorization = "Bearer goodtoken";
    const fakeUser = { id: "user-1", email: "test@example.com" };
    jwt.verify.mockReturnValue({ id: "user-1" });
    User.findByPk.mockResolvedValue(fakeUser);

    await authMiddleware(req, res, next);

    expect(req.user).toBe(fakeUser);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
