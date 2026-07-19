const request = require("supertest");
const app = require("../app");

describe("authentication-service app", () => {
  it("GET /health should return status OK", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.service).toBe("authentication-service");
  });

  it("GET /metrics should return prometheus metrics", async () => {
    const res = await request(app).get("/metrics");
    expect(res.status).toBe(200);
  });

  it("unknown route should 404", async () => {
    const res = await request(app).get("/does-not-exist");
    expect(res.status).toBe(404);
  });
});
