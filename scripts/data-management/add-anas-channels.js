const { Client, Databases, ID, Query } = require("node-appwrite");

const ENDPOINT = "https://sgp.cloud.appwrite.io/v1";
const PROJECT_ID = "69907afc003b9e3d9152";
const API_KEY = process.env.APPWRITE_API_KEY;
if (!API_KEY) {
  console.error("Set APPWRITE_API_KEY environment variable");
  process.exit(1);
}
const DATABASE_ID = "main-db";
const CHANNELS_COLLECTION_ID = "channels";
const NAATS_COLLECTION_ID = "naats";

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const databases = new Databases(client);

async function countNaatsByChannel(channelId) {
  const resp = await databases.listDocuments(DATABASE_ID, NAATS_COLLECTION_ID, [
    Query.equal("channelId", channelId),
    Query.limit(1),
  ]);
  return resp.total;
}

async function upsertChannel(docId, data) {
  try {
    await databases.getDocument(DATABASE_ID, CHANNELS_COLLECTION_ID, docId);
    await databases.updateDocument(DATABASE_ID, CHANNELS_COLLECTION_ID, docId, data);
    console.log(`  Updated: ${data.channelName}`);
  } catch (e) {
    if (e.code === 404) {
      await databases.createDocument(DATABASE_ID, CHANNELS_COLLECTION_ID, docId, data);
      console.log(`  Created: ${data.channelName}`);
    } else throw e;
  }
}

async function main() {
  console.log("Adding channels...\n");

  // 1. Hafiz Anas Raza Attari (YouTube channel)
  const ch1Id = "UCl5Y4gH0-A7FYisJw8CZb8A";
  const ch1Count = await countNaatsByChannel(ch1Id);
  await upsertChannel("channel_hafiz-anas", {
    channelId: ch1Id,
    channelName: "Hafiz Anas Raza Attari",
    naatCount: ch1Count,
    lastUpdated: new Date().toISOString(),
    isOfficial: true,
    isOther: false,
    type: "channel",
    playlistId: "",
  });
  console.log(`  naatCount: ${ch1Count}\n`);

  // 2. Anas Raza Attari (playlist - Other tab)
  const plId = "PLHuAMgO4JK9g";
  const plCount = await countNaatsByChannel(`pl_${plId.substring(0, 8)}`);
  await upsertChannel("pl_" + plId.substring(0, 8), {
    channelId: `pl_${plId.substring(0, 8)}`,
    channelName: "Anas Raza Attari",
    naatCount: plCount,
    lastUpdated: new Date().toISOString(),
    isOfficial: false,
    isOther: true,
    type: "playlist",
    playlistId: plId,
  });
  console.log(`  naatCount: ${plCount}\n`);

  console.log("Done!");
}

main().catch(e => { console.error(e.message); process.exit(1); });
