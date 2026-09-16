/**
 * Full Appwrite Project Setup Script
 *
 * Creates the entire Appwrite backend from scratch:
 *   - Database
 *   - Naats collection (with attributes + indexes)
 *   - Channels collection (with attributes + indexes)
 *   - AudioCache collection (with attributes + indexes)
 *   - AI Jobs collection (with attributes + indexes)
 *   - Live Radio collection (with attributes)
 *   - Live Radio Listeners collection (with attributes)
 *   - Audio Files storage bucket
 *   - Cut Audio Files storage bucket
 *
 * Prerequisites:
 *   1. Create an Appwrite project at https://cloud.appwrite.io
 *   2. Generate an API key with scopes:
 *      databases.read, databases.write,
 *      collections.read, collections.write,
 *      attributes.read, attributes.write,
 *      indexes.read, indexes.write,
 *      files.read, files.write,
 *      buckets.read, buckets.write
 *   3. Create a database in the Appwrite console (or this script will create one)
 *
 * Usage:
 *   Set environment variables then run:
 *     node scripts/setup/setup-full-project.js
 *
 * Required env vars:
 *   APPWRITE_ENDPOINT        - e.g. https://sgp.cloud.appwrite.io/v1
 *   APPWRITE_PROJECT_ID      - Your project ID
 *   APPWRITE_API_KEY         - API key with admin scopes
 *
 * Optional env vars (will be auto-created if not set):
 *   APPWRITE_DATABASE_ID     - Database ID (default: "main-db")
 */

const sdk = require("node-appwrite");

// ─── Configuration ───────────────────────────────────────────────────────────

const ENDPOINT = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "main-db";

// Collection IDs
const NAATS_COLLECTION_ID = "naats";
const CHANNELS_COLLECTION_ID = "channels";
const AUDIO_CACHE_COLLECTION_ID = "audio-cache";
const AI_JOBS_COLLECTION_ID = "ai_jobs";
const LIVE_RADIO_COLLECTION_ID = "live_radio";
const LIVE_RADIO_LISTENERS_COLLECTION_ID = "live_radio_listeners";

// Bucket IDs
const AUDIO_BUCKET_ID = "audio-files";
const CUT_AUDIO_BUCKET_ID = "cut-audio-files";

// ─── Helpers ─────────────────────────────────────────────────────────────────

let client, databases, storage;

function initClient() {
  client = new sdk.Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);
  databases = new sdk.Databases(client);
  storage = new sdk.Storage(client);
}

function validate() {
  const missing = [];
  if (!ENDPOINT) missing.push("APPWRITE_ENDPOINT");
  if (!PROJECT_ID) missing.push("APPWRITE_PROJECT_ID");
  if (!API_KEY) missing.push("APPWRITE_API_KEY");
  if (missing.length > 0) {
    console.error("Missing required environment variables:");
    missing.forEach((v) => console.error(`  - ${v}`));
    process.exit(1);
  }
}

async function waitForAttribute(collectionId, attributeKey) {
  process.stdout.write(`      Waiting for '${attributeKey}'...`);
  for (let i = 0; i < 40; i++) {
    try {
      const col = await databases.getCollection(DATABASE_ID, collectionId);
      const attr = col.attributes.find((a) => a.key === attributeKey);
      if (attr && attr.status === "available") {
        console.log(" ready");
        return;
      }
    } catch (_) {}
    await sleep(1500);
    process.stdout.write(".");
  }
  console.log(" timeout (continuing)");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureAttribute(collectionId, key, createFn) {
  try {
    await createFn();
    console.log(`    + ${key}`);
    await waitForAttribute(collectionId, key);
  } catch (e) {
    if (e.code === 409) {
      console.log(`    = ${key} (exists)`);
    } else {
      console.error(`    ! ${key}: ${e.message}`);
      throw e;
    }
  }
}

async function ensureIndex(collectionId, key, type, attributes, orders = []) {
  try {
    await databases.createIndex(DATABASE_ID, collectionId, key, type, attributes, orders);
    console.log(`    + index: ${key}`);
    await sleep(1000);
  } catch (e) {
    if (e.code === 409) {
      console.log(`    = index: ${key} (exists)`);
    } else {
      console.error(`    ! index ${key}: ${e.message}`);
      throw e;
    }
  }
}

// ─── Database ────────────────────────────────────────────────────────────────

async function createDatabase() {
  console.log("\n[1/8] Database");
  try {
    await databases.get(DATABASE_ID);
    console.log(`  = '${DATABASE_ID}' exists`);
  } catch (e) {
    if (e.code === 404) {
      await databases.create(DATABASE_ID, "Main Database");
      console.log(`  + created '${DATABASE_ID}'`);
    } else {
      throw e;
    }
  }
}

// ─── Naats Collection ────────────────────────────────────────────────────────

async function createNaatsCollection() {
  console.log("\n[2/8] Naats Collection");
  try {
    await databases.getCollection(DATABASE_ID, NAATS_COLLECTION_ID);
    console.log(`  = '${NAATS_COLLECTION_ID}' exists`);
  } catch (e) {
    if (e.code === 404) {
      await databases.createCollection(
        DATABASE_ID,
        NAATS_COLLECTION_ID,
        "Naats",
        [sdk.Permission.read(sdk.Role.any())],
        false
      );
      console.log(`  + created '${NAATS_COLLECTION_ID}'`);
    } else {
      throw e;
    }
  }

  console.log("  Attributes:");
  const attrs = [
    ["title", () => databases.createStringAttribute(DATABASE_ID, NAATS_COLLECTION_ID, "title", 500, true)],
    ["videoUrl", () => databases.createStringAttribute(DATABASE_ID, NAATS_COLLECTION_ID, "videoUrl", 1000, true)],
    ["thumbnailUrl", () => databases.createStringAttribute(DATABASE_ID, NAATS_COLLECTION_ID, "thumbnailUrl", 1000, true)],
    ["duration", () => databases.createIntegerAttribute(DATABASE_ID, NAATS_COLLECTION_ID, "duration", true, 0)],
    ["uploadDate", () => databases.createDatetimeAttribute(DATABASE_ID, NAATS_COLLECTION_ID, "uploadDate", true)],
    ["channelName", () => databases.createStringAttribute(DATABASE_ID, NAATS_COLLECTION_ID, "channelName", 200, true)],
    ["channelId", () => databases.createStringAttribute(DATABASE_ID, NAATS_COLLECTION_ID, "channelId", 100, true)],
    ["youtubeId", () => databases.createStringAttribute(DATABASE_ID, NAATS_COLLECTION_ID, "youtubeId", 50, true)],
    ["views", () => databases.createIntegerAttribute(DATABASE_ID, NAATS_COLLECTION_ID, "views", true, 0)],
    ["audioId", () => databases.createStringAttribute(DATABASE_ID, NAATS_COLLECTION_ID, "audioId", 100, false)],
    ["cutAudio", () => databases.createStringAttribute(DATABASE_ID, NAATS_COLLECTION_ID, "cutAudio", 100, false)],
    ["exclude", () => databases.createBooleanAttribute(DATABASE_ID, NAATS_COLLECTION_ID, "exclude", false, false)],
    ["isRadio", () => databases.createBooleanAttribute(DATABASE_ID, NAATS_COLLECTION_ID, "isRadio", false, false)],
    ["excludeFromAI", () => databases.createBooleanAttribute(DATABASE_ID, NAATS_COLLECTION_ID, "excludeFromAI", false, false)],
  ];

  for (const [name, fn] of attrs) {
    await ensureAttribute(NAATS_COLLECTION_ID, name, fn);
  }

  console.log("  Indexes:");
  await ensureIndex(NAATS_COLLECTION_ID, "title_search", sdk.IndexType.Fulltext, ["title"]);
  await ensureIndex(NAATS_COLLECTION_ID, "youtubeId_unique", sdk.IndexType.Unique, ["youtubeId"]);
  await ensureIndex(NAATS_COLLECTION_ID, "uploadDate_desc", sdk.IndexType.Key, ["uploadDate"], ["DESC"]);
  await ensureIndex(NAATS_COLLECTION_ID, "uploadDate_asc", sdk.IndexType.Key, ["uploadDate"], ["ASC"]);
  await ensureIndex(NAATS_COLLECTION_ID, "views_desc", sdk.IndexType.Key, ["views"], ["DESC"]);
  await ensureIndex(NAATS_COLLECTION_ID, "channelId_idx", sdk.IndexType.Key, ["channelId"]);
}

// ─── Channels Collection ─────────────────────────────────────────────────────

async function createChannelsCollection() {
  console.log("\n[3/8] Channels Collection");
  try {
    await databases.getCollection(DATABASE_ID, CHANNELS_COLLECTION_ID);
    console.log(`  = '${CHANNELS_COLLECTION_ID}' exists`);
  } catch (e) {
    if (e.code === 404) {
      await databases.createCollection(
        DATABASE_ID,
        CHANNELS_COLLECTION_ID,
        "Channels",
        [sdk.Permission.read(sdk.Role.any())],
        false
      );
      console.log(`  + created '${CHANNELS_COLLECTION_ID}'`);
    } else {
      throw e;
    }
  }

  console.log("  Attributes:");
  const attrs = [
    ["channelId", () => databases.createStringAttribute(DATABASE_ID, CHANNELS_COLLECTION_ID, "channelId", 255, true)],
    ["channelName", () => databases.createStringAttribute(DATABASE_ID, CHANNELS_COLLECTION_ID, "channelName", 255, true)],
    ["naatCount", () => databases.createIntegerAttribute(DATABASE_ID, CHANNELS_COLLECTION_ID, "naatCount", false, 0, undefined, 0)],
    ["lastUpdated", () => databases.createDatetimeAttribute(DATABASE_ID, CHANNELS_COLLECTION_ID, "lastUpdated", false)],
    ["isOfficial", () => databases.createBooleanAttribute(DATABASE_ID, CHANNELS_COLLECTION_ID, "isOfficial", false, true)],
    ["isOther", () => databases.createBooleanAttribute(DATABASE_ID, CHANNELS_COLLECTION_ID, "isOther", false, false)],
    ["type", () => databases.createStringAttribute(DATABASE_ID, CHANNELS_COLLECTION_ID, "type", 20, false, "channel", false)],
    ["playlistId", () => databases.createStringAttribute(DATABASE_ID, CHANNELS_COLLECTION_ID, "playlistId", 255, false, undefined, false)],
  ];

  for (const [name, fn] of attrs) {
    await ensureAttribute(CHANNELS_COLLECTION_ID, name, fn);
  }

  console.log("  Indexes:");
  await ensureIndex(CHANNELS_COLLECTION_ID, "channelId_unique", sdk.IndexType.Unique, ["channelId"]);
  await ensureIndex(CHANNELS_COLLECTION_ID, "channelName_index", sdk.IndexType.Key, ["channelName"], ["ASC"]);
}

// ─── AudioCache Collection ───────────────────────────────────────────────────

async function createAudioCacheCollection() {
  console.log("\n[4/8] AudioCache Collection");
  try {
    await databases.getCollection(DATABASE_ID, AUDIO_CACHE_COLLECTION_ID);
    console.log(`  = '${AUDIO_CACHE_COLLECTION_ID}' exists`);
  } catch (e) {
    if (e.code === 404) {
      await databases.createCollection(
        DATABASE_ID,
        AUDIO_CACHE_COLLECTION_ID,
        "AudioCache",
        [
          sdk.Permission.read(sdk.Role.any()),
          sdk.Permission.create(sdk.Role.any()),
          sdk.Permission.update(sdk.Role.any()),
          sdk.Permission.delete(sdk.Role.any()),
        ],
        false
      );
      console.log(`  + created '${AUDIO_CACHE_COLLECTION_ID}'`);
    } else {
      throw e;
    }
  }

  console.log("  Attributes:");
  const attrs = [
    ["youtubeId", () => databases.createStringAttribute(DATABASE_ID, AUDIO_CACHE_COLLECTION_ID, "youtubeId", 50, true)],
    ["audioUrl", () => databases.createStringAttribute(DATABASE_ID, AUDIO_CACHE_COLLECTION_ID, "audioUrl", 2000, true)],
    ["expiresAt", () => databases.createDatetimeAttribute(DATABASE_ID, AUDIO_CACHE_COLLECTION_ID, "expiresAt", true)],
    ["quality", () => databases.createStringAttribute(DATABASE_ID, AUDIO_CACHE_COLLECTION_ID, "quality", 50, false)],
    ["fetchedAt", () => databases.createDatetimeAttribute(DATABASE_ID, AUDIO_CACHE_COLLECTION_ID, "fetchedAt", true)],
    ["title", () => databases.createStringAttribute(DATABASE_ID, AUDIO_CACHE_COLLECTION_ID, "title", 500, false)],
    ["duration", () => databases.createIntegerAttribute(DATABASE_ID, AUDIO_CACHE_COLLECTION_ID, "duration", false, 0)],
  ];

  for (const [name, fn] of attrs) {
    await ensureAttribute(AUDIO_CACHE_COLLECTION_ID, name, fn);
  }

  console.log("  Indexes:");
  await ensureIndex(AUDIO_CACHE_COLLECTION_ID, "youtubeId_unique", sdk.IndexType.Unique, ["youtubeId"]);
  await ensureIndex(AUDIO_CACHE_COLLECTION_ID, "expiresAt_asc", sdk.IndexType.Key, ["expiresAt"], ["ASC"]);
  await ensureIndex(AUDIO_CACHE_COLLECTION_ID, "fetchedAt_desc", sdk.IndexType.Key, ["fetchedAt"], ["DESC"]);
}

// ─── AI Jobs Collection ──────────────────────────────────────────────────────

async function createAiJobsCollection() {
  console.log("\n[5/8] AI Jobs Collection");
  try {
    await databases.getCollection(DATABASE_ID, AI_JOBS_COLLECTION_ID);
    console.log(`  = '${AI_JOBS_COLLECTION_ID}' exists`);
  } catch (e) {
    if (e.code === 404) {
      await databases.createCollection(
        DATABASE_ID,
        AI_JOBS_COLLECTION_ID,
        "AI Jobs",
        [],
        false
      );
      console.log(`  + created '${AI_JOBS_COLLECTION_ID}'`);
    } else {
      throw e;
    }
  }

  console.log("  Attributes:");
  const attrs = [
    ["type", () => databases.createStringAttribute(DATABASE_ID, AI_JOBS_COLLECTION_ID, "type", 64, true)],
    ["naatId", () => databases.createStringAttribute(DATABASE_ID, AI_JOBS_COLLECTION_ID, "naatId", 64, true)],
    ["audioId", () => databases.createStringAttribute(DATABASE_ID, AI_JOBS_COLLECTION_ID, "audioId", 64, true)],
    ["status", () => databases.createStringAttribute(DATABASE_ID, AI_JOBS_COLLECTION_ID, "status", 32, true)],
    ["progress", () => databases.createIntegerAttribute(DATABASE_ID, AI_JOBS_COLLECTION_ID, "progress", false, 0, 100, 0)],
    ["attempts", () => databases.createIntegerAttribute(DATABASE_ID, AI_JOBS_COLLECTION_ID, "attempts", false, 0, undefined, 0)],
    ["workerId", () => databases.createStringAttribute(DATABASE_ID, AI_JOBS_COLLECTION_ID, "workerId", 128, false)],
    ["leaseUntil", () => databases.createDatetimeAttribute(DATABASE_ID, AI_JOBS_COLLECTION_ID, "leaseUntil", false)],
    ["error", () => databases.createStringAttribute(DATABASE_ID, AI_JOBS_COLLECTION_ID, "error", 5000, false)],
    ["resultJson", () => databases.createStringAttribute(DATABASE_ID, AI_JOBS_COLLECTION_ID, "resultJson", 50000, false)],
    ["startedAt", () => databases.createDatetimeAttribute(DATABASE_ID, AI_JOBS_COLLECTION_ID, "startedAt", false)],
    ["finishedAt", () => databases.createDatetimeAttribute(DATABASE_ID, AI_JOBS_COLLECTION_ID, "finishedAt", false)],
  ];

  for (const [name, fn] of attrs) {
    await ensureAttribute(AI_JOBS_COLLECTION_ID, name, fn);
  }

  console.log("  Indexes:");
  await ensureIndex(AI_JOBS_COLLECTION_ID, "type_status_created", sdk.IndexType.Key, ["type", "status", "$createdAt"], ["ASC", "ASC", "ASC"]);
  await ensureIndex(AI_JOBS_COLLECTION_ID, "naatId_idx", sdk.IndexType.Key, ["naatId"], ["ASC"]);
  await ensureIndex(AI_JOBS_COLLECTION_ID, "status_lease_idx", sdk.IndexType.Key, ["status", "leaseUntil"], ["ASC", "ASC"]);
}

// ─── Live Radio Collection ───────────────────────────────────────────────────

async function createLiveRadioCollection() {
  console.log("\n[6/8] Live Radio Collection");
  try {
    await databases.getCollection(DATABASE_ID, LIVE_RADIO_COLLECTION_ID);
    console.log(`  = '${LIVE_RADIO_COLLECTION_ID}' exists`);
  } catch (e) {
    if (e.code === 404) {
      await databases.createCollection(
        DATABASE_ID,
        LIVE_RADIO_COLLECTION_ID,
        "Live Radio",
        [sdk.Permission.read(sdk.Role.any())],
        false
      );
      console.log(`  + created '${LIVE_RADIO_COLLECTION_ID}'`);
    } else {
      throw e;
    }
  }

  console.log("  Attributes:");
  const attrs = [
    ["isLive", () => databases.createBooleanAttribute(DATABASE_ID, LIVE_RADIO_COLLECTION_ID, "isLive", false, false)],
    ["currentNaatId", () => databases.createStringAttribute(DATABASE_ID, LIVE_RADIO_COLLECTION_ID, "currentNaatId", 100, false)],
    ["startedAt", () => databases.createDatetimeAttribute(DATABASE_ID, LIVE_RADIO_COLLECTION_ID, "startedAt", false)],
    ["listenerCount", () => databases.createIntegerAttribute(DATABASE_ID, LIVE_RADIO_COLLECTION_ID, "listenerCount", false, 0, undefined, 0)],
  ];

  for (const [name, fn] of attrs) {
    await ensureAttribute(LIVE_RADIO_COLLECTION_ID, name, fn);
  }
}

// ─── Live Radio Listeners Collection ─────────────────────────────────────────

async function createLiveRadioListenersCollection() {
  console.log("\n[7/8] Live Radio Listeners Collection");
  try {
    await databases.getCollection(DATABASE_ID, LIVE_RADIO_LISTENERS_COLLECTION_ID);
    console.log(`  = '${LIVE_RADIO_LISTENERS_COLLECTION_ID}' exists`);
  } catch (e) {
    if (e.code === 404) {
      await databases.createCollection(
        DATABASE_ID,
        LIVE_RADIO_LISTENERS_COLLECTION_ID,
        "Live Radio Listeners",
        [sdk.Permission.read(sdk.Role.any())],
        false
      );
      console.log(`  + created '${LIVE_RADIO_LISTENERS_COLLECTION_ID}'`);
    } else {
      throw e;
    }
  }

  console.log("  Attributes:");
  const attrs = [
    ["sessionId", () => databases.createStringAttribute(DATABASE_ID, LIVE_RADIO_LISTENERS_COLLECTION_ID, "sessionId", 100, true)],
    ["connectedAt", () => databases.createDatetimeAttribute(DATABASE_ID, LIVE_RADIO_LISTENERS_COLLECTION_ID, "connectedAt", true)],
    ["lastPing", () => databases.createDatetimeAttribute(DATABASE_ID, LIVE_RADIO_LISTENERS_COLLECTION_ID, "lastPing", false)],
    ["userAgent", () => databases.createStringAttribute(DATABASE_ID, LIVE_RADIO_LISTENERS_COLLECTION_ID, "userAgent", 500, false)],
  ];

  for (const [name, fn] of attrs) {
    await ensureAttribute(LIVE_RADIO_LISTENERS_COLLECTION_ID, name, fn);
  }

  console.log("  Indexes:");
  await ensureIndex(LIVE_RADIO_LISTENERS_COLLECTION_ID, "sessionId_unique", sdk.IndexType.Unique, ["sessionId"]);
}

// ─── Storage Buckets ─────────────────────────────────────────────────────────

async function createStorageBuckets() {
  console.log("\n[8/8] Storage Buckets");

  // Audio Files Bucket
  try {
    await storage.getBucket(AUDIO_BUCKET_ID);
    console.log(`  = '${AUDIO_BUCKET_ID}' exists`);
  } catch (e) {
    if (e.code === 404) {
      await storage.createBucket(
        AUDIO_BUCKET_ID,
        "Audio Files",
        [
          sdk.Permission.read(sdk.Role.any()),
          sdk.Permission.create(sdk.Role.users()),
          sdk.Permission.update(sdk.Role.users()),
          sdk.Permission.delete(sdk.Role.users()),
        ],
        false,
        true,
        100 * 1024 * 1024,
        ["audio/m4a", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/aac"],
        "none",
        false,
        true
      );
      console.log(`  + created '${AUDIO_BUCKET_ID}'`);
    } else {
      throw e;
    }
  }

  // Cut Audio Files Bucket
  try {
    await storage.getBucket(CUT_AUDIO_BUCKET_ID);
    console.log(`  = '${CUT_AUDIO_BUCKET_ID}' exists`);
  } catch (e) {
    if (e.code === 404) {
      await storage.createBucket(
        CUT_AUDIO_BUCKET_ID,
        "Cut Audio Files",
        [
          sdk.Permission.read(sdk.Role.any()),
          sdk.Permission.create(sdk.Role.users()),
          sdk.Permission.update(sdk.Role.users()),
          sdk.Permission.delete(sdk.Role.users()),
        ],
        false,
        true,
        100 * 1024 * 1024,
        ["audio/m4a", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/aac"],
        "none",
        false,
        true
      );
      console.log(`  + created '${CUT_AUDIO_BUCKET_ID}'`);
    } else {
      throw e;
    }
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function printSummary() {
  console.log("\n" + "=".repeat(60));
  console.log("SETUP COMPLETE");
  console.log("=".repeat(60));
  console.log("\nAdd these to your .env files:\n");
  console.log(`APPWRITE_ENDPOINT=${ENDPOINT}`);
  console.log(`APPWRITE_PROJECT_ID=${PROJECT_ID}`);
  console.log(`APPWRITE_DATABASE_ID=${DATABASE_ID}`);
  console.log(`APPWRITE_NAATS_COLLECTION_ID=${NAATS_COLLECTION_ID}`);
  console.log(`APPWRITE_CHANNELS_COLLECTION_ID=${CHANNELS_COLLECTION_ID}`);
  console.log(`APPWRITE_AUDIO_CACHE_COLLECTION_ID=${AUDIO_CACHE_COLLECTION_ID}`);
  console.log(`APPWRITE_AI_JOBS_COLLECTION_ID=${AI_JOBS_COLLECTION_ID}`);
  console.log(`APPWRITE_LIVE_RADIO_COLLECTION_ID=${LIVE_RADIO_COLLECTION_ID}`);
  console.log(`APPWRITE_LIVE_RADIO_LISTENERS_COLLECTION_ID=${LIVE_RADIO_LISTENERS_COLLECTION_ID}`);
  console.log(`APPWRITE_AUDIO_BUCKET_ID=${AUDIO_BUCKET_ID}`);
  console.log(`APPWRITE_CUT_AUDIO_BUCKET_ID=${CUT_AUDIO_BUCKET_ID}`);
  console.log("\nFor Expo (mobile) prefix public vars with EXPO_PUBLIC_");
  console.log("For Next.js prefix public vars with NEXT_PUBLIC_");
  console.log("\n" + "=".repeat(60));
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Appwrite Full Project Setup");
  console.log("=".repeat(60));

  validate();
  initClient();

  console.log(`Endpoint:  ${ENDPOINT}`);
  console.log(`Project:   ${PROJECT_ID}`);
  console.log(`Database:  ${DATABASE_ID}`);

  await createDatabase();
  await createNaatsCollection();
  await createChannelsCollection();
  await createAudioCacheCollection();
  await createAiJobsCollection();
  await createLiveRadioCollection();
  await createLiveRadioListenersCollection();
  await createStorageBuckets();

  printSummary();
}

main().catch((err) => {
  console.error("\nSetup failed:", err.message || err);
  process.exit(1);
});
