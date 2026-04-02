/**
 * Fixed Appwrite Setup Script
 * 
 * Creates the complete Appwrite structure for naat-production
 * Based on postmortem analysis of naat-collection
 * 
 * Usage: node scripts/setup/setup-appwrite-fixed.js
 */

const { Client, Databases, Storage, ID, Permission, Role, IndexType } = require("node-appwrite");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", "..", "apps", "mobile", ".env.local") });

const config = {
  endpoint: process.env.APPWRITE_ENDPOINT || process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  projectId: process.env.APPWRITE_PROJECT_ID || process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
  apiKey: process.env.APPWRITE_API_KEY || process.env.APPWRITE_SECRET_KEY,
};

// Validate configuration
function validateConfig() {
  const missing = [];
  if (!config.endpoint) missing.push("APPWRITE_ENDPOINT");
  if (!config.projectId) missing.push("APPWRITE_PROJECT_ID");
  if (!config.apiKey) missing.push("APPWRITE_API_KEY");

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((v) => console.error(`   - ${v}`));
    process.exit(1);
  }
}

// Initialize clients
function initializeClients() {
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);

  return {
    databases: new Databases(client),
    storage: new Storage(client),
  };
}

// Helper to wait for attribute
async function waitForAttribute(databases, databaseId, collectionId, attributeKey) {
  console.log(`   ⏳ Waiting for attribute '${attributeKey}' to be ready...`);
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    try {
      const collection = await databases.getCollection(databaseId, collectionId);
      const attribute = collection.attributes.find((attr) => attr.key === attributeKey);

      if (attribute && attribute.status === "available") {
        console.log(`   ✅ Attribute '${attributeKey}' is ready`);
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;
    }
  }

  throw new Error(`Attribute '${attributeKey}' did not become available in time`);
}

// Create database
async function createDatabase(databases) {
  console.log("\n📊 Creating database...");
  
  try {
    const databaseId = ID.unique();
    await databases.create(databaseId, "naatDB");
    console.log(`✅ Database created: ${databaseId}`);
    return databaseId;
  } catch (error) {
    console.error(`❌ Failed to create database: ${error.message}`);
    throw error;
  }
}

// Create Naats collection
async function createNaatsCollection(databases, databaseId) {
  console.log("\n📦 Creating Naats collection...");
  
  try {
    const collectionId = ID.unique();
    
    await databases.createCollection(
      databaseId,
      collectionId,
      "Naats",
      [Permission.read(Role.any())],
      false
    );
    console.log(`✅ Collection created: ${collectionId}`);
    
    console.log("   Creating attributes...");
    
    // Required string attributes
    await databases.createStringAttribute(databaseId, collectionId, "title", 500, true);
    await waitForAttribute(databases, databaseId, collectionId, "title");
    
    await databases.createStringAttribute(databaseId, collectionId, "videoUrl", 1000, true);
    await waitForAttribute(databases, databaseId, collectionId, "videoUrl");
    
    await databases.createStringAttribute(databaseId, collectionId, "thumbnailUrl", 1000, true);
    await waitForAttribute(databases, databaseId, collectionId, "thumbnailUrl");
    
    await databases.createStringAttribute(databaseId, collectionId, "channelName", 200, true);
    await waitForAttribute(databases, databaseId, collectionId, "channelName");
    
    await databases.createStringAttribute(databaseId, collectionId, "channelId", 100, true);
    await waitForAttribute(databases, databaseId, collectionId, "channelId");
    
    await databases.createStringAttribute(databaseId, collectionId, "youtubeId", 50, true);
    await waitForAttribute(databases, databaseId, collectionId, "youtubeId");
    
    // Optional string attributes
    await databases.createStringAttribute(databaseId, collectionId, "audioId", 100, false);
    await waitForAttribute(databases, databaseId, collectionId, "audioId");
    
    await databases.createStringAttribute(databaseId, collectionId, "cutAudio", 255, false);
    await waitForAttribute(databases, databaseId, collectionId, "cutAudio");
    
    await databases.createStringAttribute(databaseId, collectionId, "cutSegments", 5000, false);
    await waitForAttribute(databases, databaseId, collectionId, "cutSegments");
    
    await databases.createStringAttribute(databaseId, collectionId, "cutStatus", 50, false);
    await waitForAttribute(databases, databaseId, collectionId, "cutStatus");
    
    await databases.createStringAttribute(databaseId, collectionId, "aiProcessing", 50, false);
    await waitForAttribute(databases, databaseId, collectionId, "aiProcessing");
    
    // Integer attributes
    await databases.createIntegerAttribute(databaseId, collectionId, "duration", true, 0);
    await waitForAttribute(databases, databaseId, collectionId, "duration");
    
    await databases.createIntegerAttribute(databaseId, collectionId, "views", true);
    await waitForAttribute(databases, databaseId, collectionId, "views");
    
    await databases.createIntegerAttribute(databaseId, collectionId, "cutDuration", false);
    await waitForAttribute(databases, databaseId, collectionId, "cutDuration");
    
    // Datetime attributes
    await databases.createDatetimeAttribute(databaseId, collectionId, "uploadDate", true);
    await waitForAttribute(databases, databaseId, collectionId, "uploadDate");
    
    // Boolean attributes
    await databases.createBooleanAttribute(databaseId, collectionId, "exclude", false);
    await waitForAttribute(databases, databaseId, collectionId, "exclude");
    
    await databases.createBooleanAttribute(databaseId, collectionId, "radio", false);
    await waitForAttribute(databases, databaseId, collectionId, "radio");
    
    await databases.createBooleanAttribute(databaseId, collectionId, "isAiCut", false);
    await waitForAttribute(databases, databaseId, collectionId, "isAiCut");
    
    await databases.createBooleanAttribute(databaseId, collectionId, "aiTrain", false, false);
    await waitForAttribute(databases, databaseId, collectionId, "aiTrain");
    
    console.log("   ✅ All attributes created");
    
    // Create indexes
    console.log("   Creating indexes...");
    
    await databases.createIndex(databaseId, collectionId, "title_search", IndexType.Fulltext, ["title"]);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    await databases.createIndex(databaseId, collectionId, "youtubeId_unique", IndexType.Unique, ["youtubeId"]);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    await databases.createIndex(databaseId, collectionId, "uploadDate_desc", IndexType.Key, ["uploadDate"], ["DESC"]);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    await databases.createIndex(databaseId, collectionId, "reciterId_index", IndexType.Key, ["channelId"]);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    console.log("   ✅ All indexes created");
    
    return collectionId;
  } catch (error) {
    console.error(`❌ Failed to create Naats collection: ${error.message}`);
    throw error;
  }
}

// Create Channels collection
async function createChannelsCollection(databases, databaseId) {
  console.log("\n📦 Creating Channels collection...");
  
  try {
    const collectionId = "channels";
    
    await databases.createCollection(
      databaseId,
      collectionId,
      "Channels",
      [Permission.read(Role.any())],
      false
    );
    console.log(`✅ Collection created: ${collectionId}`);
    
    console.log("   Creating attributes...");
    
    await databases.createStringAttribute(databaseId, collectionId, "channelId", 255, true);
    await waitForAttribute(databases, databaseId, collectionId, "channelId");
    
    await databases.createStringAttribute(databaseId, collectionId, "channelName", 255, true);
    await waitForAttribute(databases, databaseId, collectionId, "channelName");
    
    await databases.createStringAttribute(databaseId, collectionId, "type", 20, false, "channel");
    await waitForAttribute(databases, databaseId, collectionId, "type");
    
    await databases.createStringAttribute(databaseId, collectionId, "playlistId", 255, false);
    await waitForAttribute(databases, databaseId, collectionId, "playlistId");
    
    await databases.createIntegerAttribute(databaseId, collectionId, "naatCount", false, 0, undefined, 0);
    await waitForAttribute(databases, databaseId, collectionId, "naatCount");
    
    await databases.createDatetimeAttribute(databaseId, collectionId, "lastUpdated", false);
    await waitForAttribute(databases, databaseId, collectionId, "lastUpdated");
    
    await databases.createBooleanAttribute(databaseId, collectionId, "isOfficial", false, true);
    await waitForAttribute(databases, databaseId, collectionId, "isOfficial");
    
    await databases.createBooleanAttribute(databaseId, collectionId, "isOther", false, false);
    await waitForAttribute(databases, databaseId, collectionId, "isOther");
    
    await databases.createBooleanAttribute(databaseId, collectionId, "isOWQ", true);
    await waitForAttribute(databases, databaseId, collectionId, "isOWQ");
    
    await databases.createBooleanAttribute(databaseId, collectionId, "isSpeech", true);
    await waitForAttribute(databases, databaseId, collectionId, "isSpeech");
    
    console.log("   ✅ All attributes created");
    
    console.log("   Creating indexes...");
    
    await databases.createIndex(databaseId, collectionId, "channelId_unique", IndexType.Unique, ["channelId"]);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    await databases.createIndex(databaseId, collectionId, "channelName_index", IndexType.Key, ["channelName"], ["ASC"]);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    console.log("   ✅ All indexes created");
    
    return collectionId;
  } catch (error) {
    console.error(`❌ Failed to create Channels collection: ${error.message}`);
    throw error;
  }
}

// Create Live Radio collection
async function createLiveRadioCollection(databases, databaseId) {
  console.log("\n📦 Creating Live Radio collection...");
  
  try {
    const collectionId = "live_radio";
    
    await databases.createCollection(
      databaseId,
      collectionId,
      "Live Radio",
      [Permission.read(Role.any())],
      false
    );
    console.log(`✅ Collection created: ${collectionId}`);
    
    console.log("   Creating attributes...");
    
    await databases.createStringAttribute(databaseId, collectionId, "playlist", 10000, true, undefined, true);
    await waitForAttribute(databases, databaseId, collectionId, "playlist");
    
    await databases.createStringAttribute(databaseId, collectionId, "updatedAt", 255, true);
    await waitForAttribute(databases, databaseId, collectionId, "updatedAt");
    
    await databases.createIntegerAttribute(databaseId, collectionId, "currentTrackIndex", true, 0);
    await waitForAttribute(databases, databaseId, collectionId, "currentTrackIndex");
    
    console.log("   ✅ All attributes created");
    
    return collectionId;
  } catch (error) {
    console.error(`❌ Failed to create Live Radio collection: ${error.message}`);
    throw error;
  }
}

// Create User Radio States collection
async function createUserRadioStatesCollection(databases, databaseId) {
  console.log("\n📦 Creating User Radio States collection...");
  
  try {
    const collectionId = "user_radio_states";
    
    await databases.createCollection(
      databaseId,
      collectionId,
      "User Radio States",
      [Permission.read(Role.any())],
      false
    );
    console.log(`✅ Collection created: ${collectionId}`);
    
    console.log("   Creating attributes...");
    
    await databases.createStringAttribute(databaseId, collectionId, "userId", 255, true);
    await waitForAttribute(databases, databaseId, collectionId, "userId");
    
    await databases.createStringAttribute(databaseId, collectionId, "updatedAt", 255, true);
    await waitForAttribute(databases, databaseId, collectionId, "updatedAt");
    
    await databases.createStringAttribute(databaseId, collectionId, "playlist", 10000, true, undefined, true);
    await waitForAttribute(databases, databaseId, collectionId, "playlist");
    
    await databases.createStringAttribute(databaseId, collectionId, "watchHistory", 10000, true, undefined, true);
    await waitForAttribute(databases, databaseId, collectionId, "watchHistory");
    
    await databases.createIntegerAttribute(databaseId, collectionId, "currentTrackIndex", false, 0, undefined, 0);
    await waitForAttribute(databases, databaseId, collectionId, "currentTrackIndex");
    
    console.log("   ✅ All attributes created");
    
    return collectionId;
  } catch (error) {
    console.error(`❌ Failed to create User Radio States collection: ${error.message}`);
    throw error;
  }
}

// Create Live Radio Listeners collection
async function createLiveRadioListenersCollection(databases, databaseId) {
  console.log("\n📦 Creating Live Radio Listeners collection...");
  
  try {
    const collectionId = "live_radio_listeners";
    
    await databases.createCollection(
      databaseId,
      collectionId,
      "Live Radio Listeners",
      [Permission.read(Role.any())],
      false
    );
    console.log(`✅ Collection created: ${collectionId}`);
    
    console.log("   Creating attributes...");
    
    await databases.createStringAttribute(databaseId, collectionId, "lastHeartbeat", 255, true);
    await waitForAttribute(databases, databaseId, collectionId, "lastHeartbeat");
    
    await databases.createStringAttribute(databaseId, collectionId, "deviceInfo", 500, false);
    await waitForAttribute(databases, databaseId, collectionId, "deviceInfo");
    
    console.log("   ✅ All attributes created");
    
    console.log("   Creating indexes...");
    
    await databases.createIndex(databaseId, collectionId, "lastHeartbeat_index", IndexType.Key, ["lastHeartbeat"], ["ASC"]);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    console.log("   ✅ All indexes created");
    
    return collectionId;
  } catch (error) {
    console.error(`❌ Failed to create Live Radio Listeners collection: ${error.message}`);
    throw error;
  }
}

// Create AI Jobs collection
async function createAIJobsCollection(databases, databaseId) {
  console.log("\n📦 Creating AI Jobs collection...");
  
  try {
    const collectionId = "ai_jobs";
    
    await databases.createCollection(
      databaseId,
      collectionId,
      "AI Jobs",
      [Permission.read(Role.any())],
      false
    );
    console.log(`✅ Collection created: ${collectionId}`);
    
    console.log("   Creating attributes...");
    
    await databases.createStringAttribute(databaseId, collectionId, "type", 64, true);
    await waitForAttribute(databases, databaseId, collectionId, "type");
    
    await databases.createStringAttribute(databaseId, collectionId, "naatId", 64, true);
    await waitForAttribute(databases, databaseId, collectionId, "naatId");
    
    await databases.createStringAttribute(databaseId, collectionId, "audioId", 64, true);
    await waitForAttribute(databases, databaseId, collectionId, "audioId");
    
    await databases.createStringAttribute(databaseId, collectionId, "status", 32, true);
    await waitForAttribute(databases, databaseId, collectionId, "status");
    
    await databases.createStringAttribute(databaseId, collectionId, "workerId", 128, false);
    await waitForAttribute(databases, databaseId, collectionId, "workerId");
    
    await databases.createStringAttribute(databaseId, collectionId, "error", 5000, false);
    await waitForAttribute(databases, databaseId, collectionId, "error");
    
    await databases.createStringAttribute(databaseId, collectionId, "resultJson", 50000000, false);
    await waitForAttribute(databases, databaseId, collectionId, "resultJson");
    
    await databases.createIntegerAttribute(databaseId, collectionId, "progress", false, 0, 100, 0);
    await waitForAttribute(databases, databaseId, collectionId, "progress");
    
    await databases.createIntegerAttribute(databaseId, collectionId, "attempts", false, 0, undefined, 0);
    await waitForAttribute(databases, databaseId, collectionId, "attempts");
    
    await databases.createDatetimeAttribute(databaseId, collectionId, "leaseUntil", false);
    await waitForAttribute(databases, databaseId, collectionId, "leaseUntil");
    
    await databases.createDatetimeAttribute(databaseId, collectionId, "startedAt", false);
    await waitForAttribute(databases, databaseId, collectionId, "startedAt");
    
    await databases.createDatetimeAttribute(databaseId, collectionId, "finishedAt", false);
    await waitForAttribute(databases, databaseId, collectionId, "finishedAt");
    
    console.log("   ✅ All attributes created");
    
    console.log("   Creating indexes...");
    
    await databases.createIndex(databaseId, collectionId, "type_status_created", IndexType.Key, ["type", "status", "$createdAt"], ["ASC", "ASC", "ASC"]);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    await databases.createIndex(databaseId, collectionId, "naatId_idx", IndexType.Key, ["naatId"], ["ASC"]);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    await databases.createIndex(databaseId, collectionId, "status_lease_idx", IndexType.Key, ["status", "leaseUntil"], ["ASC", "ASC"]);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    console.log("   ✅ All indexes created");
    
    return collectionId;
  } catch (error) {
    console.error(`❌ Failed to create AI Jobs collection: ${error.message}`);
    throw error;
  }
}

// Create Audio Files bucket
async function createAudioFilesBucket(storage) {
  console.log("\n🪣 Creating Audio Files bucket...");
  
  try {
    const bucketId = "audio-files";
    
    await storage.createBucket(
      bucketId,
      "Audio Files",
      [Permission.read(Role.any())],
      false,
      true,
      200 * 1024 * 1024, // 200MB
      undefined,
      "none",
      false,
      true
    );
    
    console.log(`✅ Bucket created: ${bucketId}`);
    return bucketId;
  } catch (error) {
    if (error.code === 409) {
      console.log(`ℹ️  Bucket '${bucketId}' already exists`);
      return bucketId;
    }
    console.error(`❌ Failed to create Audio Files bucket: ${error.message}`);
    throw error;
  }
}

// Create temp-bucket
async function createTempBucket(storage) {
  console.log("\n🪣 Creating temp-bucket...");
  
  try {
    const bucketId = "tempbucket";
    
    await storage.createBucket(
      bucketId,
      "temp-bucket",
      [Permission.read(Role.any())],
      false,
      true,
      5000000000, // 5GB (max allowed)
      ["m4a", "mp3", "mp4", "aac", "wav"],
      "none",
      true,
      true
    );
    
    console.log(`✅ Bucket created: ${bucketId}`);
    return bucketId;
  } catch (error) {
    if (error.code === 409) {
      console.log(`ℹ️  Bucket '${bucketId}' already exists`);
      return bucketId;
    }
    console.error(`❌ Failed to create temp-bucket: ${error.message}`);
    throw error;
  }
}

// Create Live Stream bucket
async function createLiveStreamBucket(storage) {
  console.log("\n🪣 Creating Live Stream bucket...");
  
  try {
    const bucketId = "live-stream";
    
    await storage.createBucket(
      bucketId,
      "Live Stream",
      [Permission.read(Role.any())],
      false,
      true,
      5000000000, // 5GB (max allowed)
      ["ts", "m3u8", "m4s"],
      "none",
      true,
      true
    );
    
    console.log(`✅ Bucket created: ${bucketId}`);
    return bucketId;
  } catch (error) {
    if (error.code === 409) {
      console.log(`ℹ️  Bucket '${bucketId}' already exists`);
      return bucketId;
    }
    console.error(`❌ Failed to create Live Stream bucket: ${error.message}`);
    throw error;
  }
}

// Update .env.local file
function updateEnvFile(databaseId, naatsCollectionId) {
  console.log("\n📝 Updating .env.local file...");
  
  try {
    const envPath = path.join(__dirname, "..", "..", "apps", "mobile", ".env.local");
    let envContent = fs.readFileSync(envPath, "utf8");
    
    envContent = envContent.replace(/APPWRITE_DATABASE_ID=.*/, `APPWRITE_DATABASE_ID=${databaseId}`);
    envContent = envContent.replace(/EXPO_PUBLIC_APPWRITE_DATABASE_ID=.*/, `EXPO_PUBLIC_APPWRITE_DATABASE_ID=${databaseId}`);
    envContent = envContent.replace(/APPWRITE_NAATS_COLLECTION_ID=.*/, `APPWRITE_NAATS_COLLECTION_ID=${naatsCollectionId}`);
    envContent = envContent.replace(/EXPO_PUBLIC_APPWRITE_NAATS_COLLECTION_ID=.*/, `EXPO_PUBLIC_APPWRITE_NAATS_COLLECTION_ID=${naatsCollectionId}`);
    
    fs.writeFileSync(envPath, envContent);
    console.log("✅ .env.local updated");
  } catch (error) {
    console.error(`❌ Failed to update .env.local: ${error.message}`);
    console.log(`\n⚠️  Please manually update:`);
    console.log(`   APPWRITE_DATABASE_ID=${databaseId}`);
    console.log(`   APPWRITE_NAATS_COLLECTION_ID=${naatsCollectionId}`);
  }
}

// Main setup function
async function setup() {
  console.log("🚀 Starting Appwrite Setup\n");
  console.log("═══════════════════════════════════════════════════════════");

  try {
    validateConfig();
    console.log("✅ Configuration validated");

    const { databases, storage } = initializeClients();
    console.log("✅ Clients initialized");

    // Create database
    const databaseId = await createDatabase(databases);

    // Create collections
    const naatsId = await createNaatsCollection(databases, databaseId);
    const channelsId = await createChannelsCollection(databases, databaseId);
    const liveRadioId = await createLiveRadioCollection(databases, databaseId);
    const userRadioStatesId = await createUserRadioStatesCollection(databases, databaseId);
    const liveRadioListenersId = await createLiveRadioListenersCollection(databases, databaseId);
    const aiJobsId = await createAIJobsCollection(databases, databaseId);

    // Create buckets
    const audioFilesBucketId = await createAudioFilesBucket(storage);
    const tempBucketId = await createTempBucket(storage);
    const liveStreamBucketId = await createLiveStreamBucket(storage);

    // Update .env.local
    updateEnvFile(databaseId, naatsId);

    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("🎉 Setup completed successfully!\n");
    console.log("📋 Summary:");
    console.log(`   Database ID: ${databaseId}`);
    console.log(`   Naats Collection ID: ${naatsId}`);
    console.log(`   Channels Collection ID: ${channelsId}`);
    console.log(`   Live Radio Collection ID: ${liveRadioId}`);
    console.log(`   User Radio States Collection ID: ${userRadioStatesId}`);
    console.log(`   Live Radio Listeners Collection ID: ${liveRadioListenersId}`);
    console.log(`   AI Jobs Collection ID: ${aiJobsId}`);
    console.log(`   Audio Files Bucket ID: ${audioFilesBucketId}`);
    console.log(`   Temp Bucket ID: ${tempBucketId}`);
    console.log(`   Live Stream Bucket ID: ${liveStreamBucketId}`);
    console.log("\n📝 Next steps:");
    console.log("   1. Verify the setup in Appwrite console");
    console.log("   2. Check the updated .env.local file");
    console.log("   3. Deploy your functions");
    console.log("   4. Test your application");
    console.log("\n");
  } catch (error) {
    console.error("\n═══════════════════════════════════════════════════════════");
    console.error("❌ Setup failed:", error.message);
    console.error("\nStack trace:", error.stack);
    process.exit(1);
  }
}

// Run setup
setup();
