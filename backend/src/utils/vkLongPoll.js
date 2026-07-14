const fetch = require("node-fetch");
const { handleVkUpdate } = require("../controllers/vkLongPollController");
const { isVkConfigured, normalizeVkGroupId, vkApi } = require("./vk");

let running = false;

async function startVkLongPoll() {
  if (running) return;
  if (process.env.VK_LONG_POLL_ENABLED === "false") {
    console.warn("VK Long Poll disabled: VK_LONG_POLL_ENABLED=false");
    return;
  }
  if (!isVkConfigured()) {
    console.warn(
      "VK Long Poll disabled: VK_BOT_TOKEN or VK_GROUP_ID is missing",
    );
    return;
  }
  running = true;
  const groupId = normalizeVkGroupId(process.env.VK_GROUP_ID);
  let server = null;

  async function refreshServer() {
    server = await vkApi("groups.getLongPollServer", { group_id: groupId });
    if (!server?.server || !server?.key || !server?.ts) {
      throw new Error("VK returned invalid Long Poll server settings");
    }
  }

  await refreshServer();
  console.log("VK Long Poll started");

  while (running) {
    try {
      const url = `${server.server}?act=a_check&key=${encodeURIComponent(server.key)}&ts=${encodeURIComponent(server.ts)}&wait=25`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.failed) {
        await refreshServer();
        continue;
      }
      server.ts = data.ts;
      for (const update of data.updates || []) {
        await handleVkUpdate(update.type, update.object);
      }
    } catch (e) {
      console.error("VK Long Poll error:", e.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      try {
        await refreshServer();
      } catch (refreshError) {
        console.error("VK Long Poll refresh error:", refreshError.message);
      }
    }
  }
}

module.exports = { startVkLongPoll };
