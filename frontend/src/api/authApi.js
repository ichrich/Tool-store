import client from "./client";

export async function loginApi(data) {
  const res = await client.post("/auth/login", data);
  return res.data;
}

export async function registerApi(data) {
  const res = await client.post("/auth/register", data);
  return res.data;
}

export async function getMeApi() {
  const res = await client.get("/auth/me");
  return res.data;
}

export async function updateProfileApi(data) {
  const res = await client.put("/auth/me", data);
  return res.data;
}

export async function getVkLinkCodeApi() {
  const res = await client.get("/auth/vk/link-code");
  return res.data;
}

export async function unlinkVkApi() {
  const res = await client.delete("/auth/vk/link");
  return res.data;
}

export async function createBlockedAppealApi(data) {
  const res = await client.post("/auth/blocked-appeal", data);
  return res.data;
}
