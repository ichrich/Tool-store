import { http, HttpResponse } from "msw";

const API = "http://localhost:3001/api";

export const handlers = [
  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = await request.json();
    if (body.email === "blocked@example.com") {
      return HttpResponse.json(
        { error: "Аккаунт заблокирован" },
        { status: 403 },
      );
    }
    if (body.email !== "buyer@example.com" || body.password !== "Secret123") {
      return HttpResponse.json(
        { error: "Неверный email или пароль" },
        { status: 401 },
      );
    }
    return HttpResponse.json({
      token: "test.jwt.token",
      user: { id: 1, email: body.email, role: "user", first_name: "Иван" },
    });
  }),

  http.post(`${API}/auth/register`, async ({ request }) => {
    const body = await request.json();
    if (body.email === "exists@example.com") {
      return HttpResponse.json(
        { error: "Email уже занят", fields: { email: "Email уже занят" } },
        { status: 409 },
      );
    }
    return HttpResponse.json(
      {
        token: "registered.jwt.token",
        user: {
          id: 2,
          email: body.email,
          role: "user",
          first_name: body.first_name || "",
        },
      },
      { status: 201 },
    );
  }),

  http.get(`${API}/auth/me`, ({ request }) => {
    const auth = request.headers.get("authorization");
    if (!auth)
      return HttpResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 },
      );
    return HttpResponse.json({
      id: 1,
      email: "buyer@example.com",
      role: "user",
      first_name: "Иван",
    });
  }),

  http.get(`${API}/categories`, () =>
    HttpResponse.json([
      { id: 1, name: "Электроинструмент", slug: "elektroinstrument" },
    ]),
  ),

  http.get(`${API}/categories/:slug/recommended-products`, () =>
    HttpResponse.json({
      items: [],
      total: 0,
    }),
  ),

  http.get(`${API}/brands`, () =>
    HttpResponse.json({
      brands: [{ id: 1, name: "Bosch", slug: "bosch", products_count: 2 }],
      models: [
        {
          id: 10,
          brand_id: 1,
          brand_name: "Bosch",
          brand_slug: "bosch",
          name: "GSR 18V-50",
          slug: "gsr-18v-50",
        },
      ],
    }),
  ),

  http.get(`${API}/products`, ({ request }) => {
    const url = new URL(request.url);
    const models = url.searchParams.get("models");
    const items =
      models === "10"
        ? [
            {
              id: 1,
              name: "Bosch GSR 18V-50",
              slug: "bosch-gsr-18v-50",
              price: 21990,
              stock: 5,
            },
          ]
        : [
            {
              id: 1,
              name: "Bosch GSR 18V-50",
              slug: "bosch-gsr-18v-50",
              price: 21990,
              stock: 5,
            },
            {
              id: 2,
              name: "Makita DDF485Z",
              slug: "makita-ddf485z",
              price: 12990,
              stock: 3,
            },
          ];
    return HttpResponse.json({
      items,
      total: items.length,
      page: 1,
      limit: 12,
    });
  }),

  http.get(`${API}/recommendations`, () =>
    HttpResponse.json({ type: "popular", items: [] }),
  ),
];
