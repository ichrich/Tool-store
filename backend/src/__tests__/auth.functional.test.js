process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const express = require("express");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

jest.mock("../models/userModel", () => ({
  findByEmail: jest.fn(),
  findById: jest.fn(),
  findByIdWithPassword: jest.fn(),
  emailExists: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
}));

jest.mock("../models/suspensionModel", () => ({
  getReviewRestrictionSummary: jest.fn().mockResolvedValue({ active: false }),
}));

jest.mock("../config/database", () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock("../utils/vk", () => ({
  makeVkCode: jest.fn(() => "code-123"),
  makeVkStartLink: jest.fn(() => "https://vk.com/test"),
  normalizeVkGroupId: jest.fn(() => "123"),
}));

const authRoutes = require("../routes/authRoutes");
const userModel = require("../models/userModel");
const { pool } = require("../config/database");
const { errorHandler, notFoundHandler } = require("../middleware/errorHandler");

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe("auth REST API", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = makeApp();
    pool.query.mockResolvedValue([[{ is_active: 1 }]]);
  });

  test("register creates user and returns JWT", async () => {
    userModel.emailExists.mockResolvedValue(false);
    userModel.create.mockResolvedValue(10);
    userModel.findById.mockResolvedValue({
      id: 10,
      email: "new@example.com",
      role: "user",
      first_name: "Ivan",
      last_name: "Petrov",
      phone: null,
      vk_user_id: null,
    });

    const res = await request(app).post("/api/auth/register").send({
      email: "new@example.com",
      password: "Secret123",
      first_name: "Ivan",
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe("new@example.com");
    expect(userModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: "user" }),
    );
  });

  test("register rejects duplicated email", async () => {
    userModel.emailExists.mockResolvedValue(true);

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "exists@example.com", password: "Secret123" });

    expect(res.status).toBe(409);
    expect(res.body.fields.email).toBeTruthy();
  });

  test("register validates input on server", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "bad-email", password: "123" });

    expect(res.status).toBe(400);
    expect(res.body.fields.email).toBeTruthy();
    expect(res.body.fields.password).toBeTruthy();
  });

  test("login returns JWT for valid credentials", async () => {
    const password_hash = await bcrypt.hash("Secret123", 4);
    userModel.findByEmail.mockResolvedValue({
      id: 1,
      email: "buyer@example.com",
      password_hash,
      role: "user",
      is_active: 1,
      first_name: "Ivan",
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "buyer@example.com", password: "Secret123" });

    expect(res.status).toBe(200);
    expect(jwt.verify(res.body.token, process.env.JWT_SECRET).sub).toBe(1);
    expect(res.body.user.role).toBe("user");
  });

  test("login rejects wrong password", async () => {
    const password_hash = await bcrypt.hash("Secret123", 4);
    userModel.findByEmail.mockResolvedValue({
      id: 1,
      email: "buyer@example.com",
      password_hash,
      role: "user",
      is_active: 1,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "buyer@example.com", password: "bad-password" });

    expect(res.status).toBe(401);
  });

  test("protected route rejects request without token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  test("protected route accepts valid JWT and returns current user", async () => {
    const token = jwt.sign(
      { sub: 1, email: "buyer@example.com", role: "user" },
      process.env.JWT_SECRET,
    );
    userModel.findById.mockResolvedValue({
      id: 1,
      email: "buyer@example.com",
      role: "user",
      first_name: "Ivan",
      is_active: 1,
    });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe("buyer@example.com");
  });
});
