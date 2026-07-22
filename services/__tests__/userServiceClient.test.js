const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock("axios", () => ({
  create: jest.fn(() => ({ get: mockGet, post: mockPost })),
}));

const userServiceClient = require("../userServiceClient");

describe("userServiceClient", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  describe("findUserByEmail", () => {
    it("returns user data when found", async () => {
      mockGet.mockResolvedValue({ data: { id: "1", email: "test@example.com" } });
      const result = await userServiceClient.findUserByEmail("test@example.com");
      expect(mockGet).toHaveBeenCalledWith("/internal/users/by-email/test%40example.com");
      expect(result).toEqual({ id: "1", email: "test@example.com" });
    });

    it("returns null on 404", async () => {
      mockGet.mockRejectedValue({ response: { status: 404 } });
      const result = await userServiceClient.findUserByEmail("missing@example.com");
      expect(result).toBeNull();
    });

    it("throws on non-404 error", async () => {
      const error = { response: { status: 500 } };
      mockGet.mockRejectedValue(error);
      await expect(userServiceClient.findUserByEmail("test@example.com")).rejects.toEqual(error);
    });

    it("throws when error has no response", async () => {
      const error = new Error("network error");
      mockGet.mockRejectedValue(error);
      await expect(userServiceClient.findUserByEmail("test@example.com")).rejects.toThrow("network error");
    });
  });

  describe("createUser", () => {
    it("posts and returns created user", async () => {
      mockPost.mockResolvedValue({ data: { id: "2", email: "new@example.com", name: "New" } });
      const result = await userServiceClient.createUser({ email: "new@example.com", name: "New" });
      expect(mockPost).toHaveBeenCalledWith("/internal/users", { email: "new@example.com", name: "New" });
      expect(result).toEqual({ id: "2", email: "new@example.com", name: "New" });
    });
  });

  describe("getUserById", () => {
    it("returns user data when found", async () => {
      mockGet.mockResolvedValue({ data: { id: "1", email: "test@example.com" } });
      const result = await userServiceClient.getUserById("1");
      expect(mockGet).toHaveBeenCalledWith("/internal/users/1");
      expect(result).toEqual({ id: "1", email: "test@example.com" });
    });

    it("returns null on 404", async () => {
      mockGet.mockRejectedValue({ response: { status: 404 } });
      const result = await userServiceClient.getUserById("missing");
      expect(result).toBeNull();
    });

    it("throws on non-404 error", async () => {
      const error = { response: { status: 500 } };
      mockGet.mockRejectedValue(error);
      await expect(userServiceClient.getUserById("1")).rejects.toEqual(error);
    });
  });
});
