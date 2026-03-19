"use strict";

/*
╔══════════════════════════════════════════════════════╗
║              PHANTOM BOT v5 (EXTENDED)               ║
║   Ultra Long | Anti Detection | Devil Servant AI     ║
╚══════════════════════════════════════════════════════╝
*/

const mineflayer = require("mineflayer");
const { pathfinder, Movements } = require("mineflayer-pathfinder");
const pvp = require("mineflayer-pvp").plugin;
const OpenAI = require("openai");
const http = require("http");

// ───────────────── CONFIG ─────────────────
const CONFIG = {
  host: process.env.MC_HOST || "yoriinamanviki.falixsrv.me",
  port: parseInt(process.env.MC_PORT || "25565"),
  username: process.env.BOT_NAME || "Phantom",
  version: "1.21.1",

  reconnectBase: 15000,
  reconnectMax: 60000,

  debug: true
};

// ───────────────── STATE ─────────────────
let bot = null;
let reconnectTimer = null;
let reconnectDelay = CONFIG.reconnectBase;

let inFight = false;
let lastAction = Date.now();
let suspicionLevel = 0;

// ───────────────── GROQ ─────────────────
function getAI() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1"
  });
}

// ───────────────── LOGGER ─────────────────
function log(...args) {
  if (CONFIG.debug) console.log("[Phantom]", ...args);
}

// ───────────────── HEALTH SERVER ─────────────────
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Phantom alive\n");
}).listen(process.env.PORT || 3000);

// ───────────────── UTILS ─────────────────
function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function safeChat(msg) {
  try {
    if (bot && bot.entity) bot.chat(msg.slice(0, 250));
  } catch {}
}

// ───────────────── CREATE BOT ─────────────────
function createBot() {
  log("Creating bot...");

  bot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    version: CONFIG.version,
    auth: "offline"
  });

  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);

  bot.once("spawn", async () => {
    log("Spawned.");

    reconnectDelay = CONFIG.reconnectBase;

    setupMovement();

    await delay(2000);
    await goCreative();
    await gearUp();

    startAllSystems();

    safeChat("Phantom rises. The Devil commands all.");
  });

  bot.on("chat", onChat);
  bot.on("entityHurt", onHurt);

  bot.on("end", handleDisconnect);
  bot.on("kicked", handleDisconnect);
  bot.on("error", handleDisconnect);
}

// ───────────────── MOVEMENT ─────────────────
function setupMovement() {
  const mcData = require("minecraft-data")(bot.version);
  bot.pathfinder.setMovements(new Movements(bot, mcData));
}

// ───────────────── MODES ─────────────────
async function goCreative() {
  safeChat(`/gamemode creative ${CONFIG.username}`);
}

async function goSurvival() {
  safeChat(`/gamemode survival ${CONFIG.username}`);
}

// ───────────────── GEAR ─────────────────
async function gearUp() {
  const gear = [
    "netherite_sword",
    "netherite_helmet",
    "netherite_chestplate",
    "netherite_leggings",
    "netherite_boots"
  ];

  for (let item of gear) {
    safeChat(`/give ${CONFIG.username} minecraft:${item}`);
    await delay(300);
  }
}

// ───────────────── MOVEMENT AI ─────────────────
function loopMovement() {
  setInterval(async () => {
    if (!bot || inFight) return;

    const r = Math.random();

    if (r < 0.25) {
      bot.setControlState("forward", true);
      await delay(rand(400, 1400));
      bot.setControlState("forward", false);
    } else if (r < 0.5) {
      bot.setControlState("left", true);
      await delay(rand(300, 1000));
      bot.setControlState("left", false);
    } else if (r < 0.75) {
      bot.setControlState("jump", true);
      await delay(200);
      bot.setControlState("jump", false);
    } else {
      bot.setControlState("sprint", true);
      await delay(rand(200, 800));
      bot.setControlState("sprint", false);
    }

    await bot.look(rand(-Math.PI, Math.PI), rand(-0.5, 0.5), true);

  }, rand(2000, 6000));
}

// ───────────────── FAKE HUMAN ACTIONS ─────────────────
function loopFakeHuman() {
  setInterval(async () => {
    if (!bot || inFight) return;

    try {
      const block = bot.blockAt(bot.entity.position.offset(0, -1, 0));
      if (!block) return;

      await bot.placeBlock(block, { x: 0, y: 1, z: 0 });
      await delay(rand(400, 900));
      await bot.dig(block);
      await delay(rand(400, 900));

      await bot.look(rand(-Math.PI, Math.PI), 0, true);

    } catch {}
  }, rand(20000, 40000));
}

// ───────────────── FIGHT SYSTEM ─────────────────
async function startFight(player) {
  if (inFight) return;

  const target = bot.players[player]?.entity;
  if (!target) return;

  inFight = true;

  safeChat(`${player}. The Devil has marked you.`);

  await goSurvival();
  await delay(1000);

  safeChat(`/tp ${CONFIG.username} ${player}`);
  await delay(800);

  bot.pvp.attack(target);

  setTimeout(endFight, 15000);
}

async function endFight() {
  try { bot.pvp.stop(); } catch {}
  await goCreative();
  inFight = false;
}

// ───────────────── AI CHAT ─────────────────
async function aiReply(user, msg) {
  try {
    const res = await getAI().chat.completions.create({
      model: "llama-3.1-8b-instant",
      max_tokens: 60,
      messages: [
        {
          role: "system",
          content: "You are Phantom, rude servant of Devil. Always insult."
        },
        { role: "user", content: msg }
      ]
    });

    safeChat(res.choices[0].message.content);
  } catch {
    safeChat(`${user}. Silence.`);
  }
}

// ───────────────── CHAT ─────────────────
function onChat(username, message) {
  if (username === CONFIG.username) return;

  if (message.toLowerCase().includes("phantom")) {
    aiReply(username, message);
    startFight(username);
  }
}

// ───────────────── DAMAGE ─────────────────
function onHurt(entity) {
  if (entity === bot.entity) {
    const players = Object.values(bot.players);
    for (let p of players) {
      if (p.entity && p.username !== CONFIG.username) {
        startFight(p.username);
        break;
      }
    }
  }
}

// ───────────────── RECONNECT ─────────────────
function handleDisconnect(reason) {
  log("Disconnected:", reason);

  if (reconnectTimer) return;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;

    reconnectDelay = Math.min(
      reconnectDelay + 5000,
      CONFIG.reconnectMax
    );

    createBot();
  }, reconnectDelay);
}

// ───────────────── START SYSTEMS ─────────────────
function startAllSystems() {
  loopMovement();
  loopFakeHuman();
}

// ───────────────── START ─────────────────
createBot();
