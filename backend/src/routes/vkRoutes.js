const { Router } = require("express");
const { isVkConfigured, normalizeVkGroupId } = require("../utils/vk");

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    vkConfigured: isVkConfigured(),
    transport: "long_poll",
    longPollEnabled: process.env.VK_LONG_POLL_ENABLED !== "false",
    groupIdConfigured: Boolean(normalizeVkGroupId(process.env.VK_GROUP_ID)),
    botTokenConfigured: Boolean(process.env.VK_BOT_TOKEN),
    callbackApiEnabled: false,
  });
});

module.exports = router;
