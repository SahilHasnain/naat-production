/**
 * Add Missing Naat Attributes Script
 *
 * This script adds the missing attributes to the existing Naats collection:
 * - audioId (optional string)
 * - cutAudio (optional string)
 * - createdAt (datetime)
 * - updatedAt (datetime)
 *
 * Usage: node scripts/setup/add-missing-naat-attributes.js
 */

const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", "..", "apps", "mobile", ".env"),
});
const { Client, Databases } = require("node-appwrite");

// Configuration from environment variables
const config = {
  endpoint: process.env.APPWRITE_ENDPOINT || "",
  projectId: process.env.APPWRITE_PROJECT_ID || "",
  apiKey: process.env.APPWRITE_API_KEY || "",
  databaseId: process.env.APPWRITE_DATABASE_ID || "",
  naatsCollectionId: process.env.APPWRITE_NAATS_COLLECTION_ID || "naats",
};

// Validate configuration
function validateConfig() {
  const missing = [];
  if (!config.endpoint) missing.push("APPWRITE_ENDPOINT");
  if (!config.projectId) missing.push("APPWRITE_PROJECT_ID");
  if (!config.apiKey) missing.push("APPWRITE_API_KEY");
  if (!config.databaseId) missing.push("APPWRITE_DATABASE_ID");

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((v) => console.error(`   - ${v}`));
    process.exit(1);
  }
}

// Initialize Appwrite client
function initializeClient() {
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);

  return new Databases(client);
}

// Helper function to wait for attribute creation
async function waitForAttribute(
  databases,
  databaseId,
  collectionId,
  attributeKey,
) {
  console.log(`   ⏳ Waiting for attribute '${attributeKey}' to be ready...`);
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    try {
      const collection = await databases.getCollection(
        databaseId,
        collectionId,
      );
      const attribute = collection.attributes.find(
        (attr) => attr.key === attributeKey,
      );

      if (attribute && attribute.status === "available") {
        console.log(`   ✅ Attribute '${attributeKey}' is ready`);
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;
    } catch (error) {
      console.error(`   ⚠️  Error checking attribute status: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;
    }
  }

  throw new Error(
    `Attribute '${attributeKey}' did not become available in time`,
  );
}

// Check if attribute already exists
async function attributeExists(databases, attributeKey) {
  try {
    const collection = await databases.getCollection(
      config.databaseId,
      config.naatsCollectionId,
    );
    return collection.attributes.some((attr) => attr.key === attributeKey);
  } catch (error) {
    console.error(`Error checking attribute: ${error.message}`);
    return false;
  }
}

// Create missing attributes
async function createMissingAttributes(databases) {
  console.log("\n📝 Adding missing attributes...");

  const attributes = [
    {
      name: "audioId",
      type: "string",
      size: 100,
      required: false,
      create: () =>
        databases.createStringAttribute(
          config.databaseId,
          config.naatsCollectionId,
          "audioId",
          100,
          false,
        ),
    },
    {
      name: "cutAudio",
      type: "string",
      size: 100,
      required: false,
      create: () =>
        databases.createStringAttribute(
          config.databaseId,
          config.naatsCollectionId,
          "cutAudio",
          100,
          false,
        ),
    },
    {
      name: "createdAt",
      type: "datetime",
      required: false,
      create: () =>
        databases.createDatetimeAttribute(
          config.databaseId,
          config.naatsCollectionId,
          "createdAt",
          false,
        ),
    },
    {
      name: "updatedAt",
      type: "datetime",
      required: false,
      create: () =>
        databases.createDatetimeAttribute(
          config.databaseId,
          config.naatsCollectionId,
          "updatedAt",
          false,
        ),
    },
  ];

  let added = 0;
  let skipped = 0;

  for (const attr of attributes) {
    try {
      // Check if attribute already exists
      const exists = await attributeExists(databases, attr.name);

      if (exists) {
        console.log(
          `\n   ⏭️  Attribute '${attr.name}' already exists, skipping`,
        );
        skipped++;
        continue;
      }

      console.log(`\n   Creating ${attr.type} attribute: ${attr.name}`);
      await attr.create();
      console.log(`   ✅ Attribute '${attr.name}' created`);

      // Wait for attribute to be ready before creating the next one
      await waitForAttribute(
        databases,
        config.databaseId,
        config.naatsCollectionId,
        attr.name,
      );
      added++;
    } catch (error) {
      console.error(
        `   ❌ Failed to create attribute '${attr.name}': ${error.message}`,
      );
      throw error;
    }
  }

  console.log(`\n✅ Completed: ${added} added, ${skipped} skipped`);
}

// Main setup function
async function setup() {
  console.log("🚀 Adding Missing Naat Attributes\n");
  console.log("═══════════════════════════════════════════════════════════");

  try {
    // Validate configuration
    validateConfig();
    console.log("✅ Configuration validated");

    // Initialize client
    const databases = initializeClient();
    console.log("✅ Appwrite client initialized");

    // Create missing attributes
    await createMissingAttributes(databases);

    console.log(
      "\n═══════════════════════════════════════════════════════════",
    );
    console.log("🎉 Setup completed successfully!\n");
    console.log("📋 Summary:");
    console.log(`   Database ID: ${config.databaseId}`);
    console.log(`   Collection ID: ${config.naatsCollectionId}`);
    console.log(`   Collection Name: Naats`);
    console.log("\n📝 Added Attributes:");
    console.log(
      "   - audioId (string, optional): Appwrite Storage file ID for audio",
    );
    console.log(
      "   - cutAudio (string, optional): Storage file ID for cut/processed audio",
    );
    console.log(
      "   - createdAt (datetime, optional): Document creation timestamp",
    );
    console.log(
      "   - updatedAt (datetime, optional): Document update timestamp",
    );
    console.log("\n📝 Next steps:");
    console.log("   1. Verify the attributes in your Appwrite console");
    console.log("   2. Update existing documents with timestamps if needed");
    console.log(
      "   3. Start uploading audio files and linking them to naats\n",
    );
  } catch (error) {
    console.error(
      "\n═══════════════════════════════════════════════════════════",
    );
    console.error("❌ Setup failed:", error.message);
    console.error("\nPlease check the error above and try again.");
    process.exit(1);
  }
}

// Run setup
setup();
