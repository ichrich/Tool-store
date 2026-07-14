import { describe, expect, test } from "vitest";
import { http, HttpResponse } from "msw";
import client from "../client";
import { server } from "../../test/server";

const API = "http://localhost:3001/api";

describe("axios client error handling", () => {
  test("maps 422 response to validation userMessage", async () => {
    server.use(
      http.post(`${API}/validation-error`, () =>
        HttpResponse.json({ error: "Ошибка проверки формы" }, { status: 422 }),
      ),
    );

    await expect(client.post("/validation-error", {})).rejects.toMatchObject({
      userMessage: "Ошибка проверки формы",
    });
  });
});
