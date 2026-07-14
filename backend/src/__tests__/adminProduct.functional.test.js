process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../config/database", () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock("../models/productModel", () => ({
  listPublic: jest.fn(),
  countList: jest.fn(),
  getById: jest.fn(),
  slugExists: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
}));

jest.mock("../models/categoryModel", () => ({
  getById: jest.fn(),
}));

jest.mock("../models/brandModel", () => ({
  listBrands: jest.fn().mockResolvedValue([]),
  listModels: jest.fn().mockResolvedValue([]),
  getModelById: jest.fn(),
  createModel: jest.fn(),
}));

jest.mock("../controllers/uploadController", () => ({
  uploadImage: jest.fn((_req, res) => res.json({ path: "/uploads/test.jpg" })),
}));

jest.mock("../models/notificationModel", () => ({
  create: jest.fn(),
  createForAdmins: jest.fn(),
}));

jest.mock("../utils/vk", () => ({
  sendVkNotification: jest.fn(),
}));

const adminRoutes = require("../routes/adminRoutes");
const productModel = require("../models/productModel");
const categoryModel = require("../models/categoryModel");
const brandModel = require("../models/brandModel");
const { pool } = require("../config/database");
const { errorHandler, notFoundHandler } = require("../middleware/errorHandler");

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

function token(role = "admin") {
  return jwt.sign(
    { sub: role === "admin" ? 1 : 2, email: `${role}@example.com`, role },
    process.env.JWT_SECRET,
  );
}

describe("admin product REST API", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = makeApp();
    pool.query.mockResolvedValue([[{ is_active: 1 }]]);
  });

  test("admin route rejects user role", async () => {
    const res = await request(app)
      .get("/api/admin/products")
      .set("Authorization", `Bearer ${token("user")}`);

    expect(res.status).toBe(403);
  });

  test("lists products for admin", async () => {
    productModel.listPublic.mockResolvedValue([{ id: 1, name: "Bosch GSR" }]);
    productModel.countList.mockResolvedValue(1);

    const res = await request(app)
      .get("/api/admin/products")
      .set("Authorization", `Bearer ${token("admin")}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  test("creates product with selected model of selected brand", async () => {
    categoryModel.getById.mockResolvedValue({ id: 1, name: "Tools" });
    brandModel.getModelById.mockResolvedValue({
      id: 10,
      brand_id: 3,
      name: "GSR 18V-50",
    });
    productModel.slugExists.mockResolvedValue(false);
    productModel.create.mockResolvedValue(100);

    const res = await request(app)
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${token("admin")}`)
      .send({
        name: "Bosch GSR 18V-50",
        category_id: 1,
        brand_id: 3,
        brand_model_id: 10,
        price: 21990,
        stock: 5,
      });

    expect(res.status).toBe(201);
    expect(productModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ brand_model_id: 10 }),
    );
  });

  test("rejects model from another brand", async () => {
    categoryModel.getById.mockResolvedValue({ id: 1, name: "Tools" });
    brandModel.getModelById.mockResolvedValue({
      id: 10,
      brand_id: 99,
      name: " чужая модель",
    });

    const res = await request(app)
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${token("admin")}`)
      .send({
        name: "Wrong model",
        category_id: 1,
        brand_id: 3,
        brand_model_id: 10,
        price: 100,
        stock: 1,
      });

    expect(res.status).toBe(400);
    expect(productModel.create).not.toHaveBeenCalled();
  });

  test("validates product payload", async () => {
    const res = await request(app)
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${token("admin")}`)
      .send({ price: -1 });

    expect(res.status).toBe(400);
    expect(res.body.fields.name).toBeTruthy();
    expect(res.body.fields.category_id).toBeTruthy();
  });

  test("returns 500 when controller dependency throws", async () => {
    productModel.listPublic.mockRejectedValue(new Error("database is down"));

    const res = await request(app)
      .get("/api/admin/products")
      .set("Authorization", `Bearer ${token("admin")}`);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("database is down");
  });
});
