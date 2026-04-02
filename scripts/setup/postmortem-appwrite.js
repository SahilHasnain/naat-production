/**
 * Appwrite Postmortem Script
 * 
 * Analyzes an existing Appwrite project to document its complete structure:
 * - Databases
 * - Collections with attributes and indexes
 * - Storage buckets
 * - Functions
 * 
 * This helps understand the current setup and create migration/setup scripts.
 * 
 * Usage: node scripts/setup/postmortem-appwrite.js
 */

const { Client, Databases, Storage, Functions } = require("node-appwrite");
const fs = require("fs");
const path = require("path");

// Load environment from naat-collection
const envPath = path.join(__dirname, "..", "..", "..", "naat-collection", "apps", "mobile", ".env");
require("dotenv").config({ path: envPath });

const config = {
  endpoint: process.env.APPWRITE_ENDPOINT,
  projectId: process.env.APPWRITE_PROJECT_ID,
  apiKey: process.env.APPWRITE_API_KEY,
  databaseId: process.env.APPWRITE_DATABASE_ID,
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
    console.error(`\n📁 Looking for .env at: ${envPath}`);
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
    functions: new Functions(client),
  };
}

// Analyze database structure
async function analyzeDatabase(databases) {
  console.log("\n📊 DATABASE ANALYSIS");
  console.log("═══════════════════════════════════════════════════════════\n");

  try {
    const database = await databases.get(config.databaseId);
    console.log(`Database Name: ${database.name}`);
    console.log(`Database ID: ${database.$id}`);
    console.log(`Created: ${database.$createdAt}`);
    console.log(`Updated: ${database.$updatedAt}`);

    return database;
  } catch (error) {
    console.error(`❌ Failed to get database: ${error.message}`);
    throw error;
  }
}

// Analyze collections
async function analyzeCollections(databases) {
  console.log("\n\n📚 COLLECTIONS ANALYSIS");
  console.log("═══════════════════════════════════════════════════════════\n");

  const collectionsData = [];

  try {
    const collections = await databases.listCollections(config.databaseId);
    console.log(`Total Collections: ${collections.total}\n`);

    for (const collection of collections.collections) {
      console.log(`\n┌─ ${collection.name} (${collection.$id})`);
      console.log(`│  Created: ${collection.$createdAt}`);
      console.log(`│  Updated: ${collection.$updatedAt}`);
      console.log(`│  Document Security: ${collection.documentSecurity}`);

      // Get full collection details
      const fullCollection = await databases.getCollection(
        config.databaseId,
        collection.$id
      );

      // Attributes
      console.log(`│`);
      console.log(`│  📝 Attributes (${fullCollection.attributes.length}):`);
      fullCollection.attributes.forEach((attr) => {
        const required = attr.required ? "required" : "optional";
        const array = attr.array ? "[]" : "";
        let details = `${attr.type}${array}`;
        
        if (attr.size) details += ` (size: ${attr.size})`;
        if (attr.min !== undefined) details += ` (min: ${attr.min})`;
        if (attr.max !== undefined) details += ` (max: ${attr.max})`;
        if (attr.default !== undefined && attr.default !== null) details += ` (default: ${attr.default})`;
        if (attr.format) details += ` (format: ${attr.format})`;
        
        console.log(`│     • ${attr.key}: ${details} [${required}]`);
      });

      // Indexes
      console.log(`│`);
      console.log(`│  🔍 Indexes (${fullCollection.indexes.length}):`);
      fullCollection.indexes.forEach((index) => {
        const orders = index.orders && index.orders.length > 0 
          ? ` [${index.orders.join(", ")}]` 
          : "";
        console.log(`│     • ${index.key} (${index.type}): ${index.attributes.join(", ")}${orders}`);
      });

      console.log(`└─`);

      collectionsData.push({
        id: collection.$id,
        name: collection.name,
        documentSecurity: collection.documentSecurity,
        attributes: fullCollection.attributes,
        indexes: fullCollection.indexes,
        permissions: fullCollection.$permissions,
      });
    }

    return collectionsData;
  } catch (error) {
    console.error(`❌ Failed to analyze collections: ${error.message}`);
    throw error;
  }
}

// Analyze storage buckets
async function analyzeBuckets(storage) {
  console.log("\n\n🪣 STORAGE BUCKETS ANALYSIS");
  console.log("═══════════════════════════════════════════════════════════\n");

  const bucketsData = [];

  try {
    const buckets = await storage.listBuckets();
    console.log(`Total Buckets: ${buckets.total}\n`);

    for (const bucket of buckets.buckets) {
      console.log(`\n┌─ ${bucket.name} (${bucket.$id})`);
      console.log(`│  Created: ${bucket.$createdAt}`);
      console.log(`│  Updated: ${bucket.$updatedAt}`);
      console.log(`│  Enabled: ${bucket.enabled}`);
      console.log(`│  Max File Size: ${(bucket.maximumFileSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`│  File Security: ${bucket.fileSecurity}`);
      console.log(`│  Compression: ${bucket.compression}`);
      console.log(`│  Encryption: ${bucket.encryption}`);
      console.log(`│  Antivirus: ${bucket.antivirus}`);
      
      if (bucket.allowedFileExtensions && bucket.allowedFileExtensions.length > 0) {
        console.log(`│  Allowed Extensions: ${bucket.allowedFileExtensions.join(", ")}`);
      }
      
      console.log(`└─`);

      bucketsData.push({
        id: bucket.$id,
        name: bucket.name,
        enabled: bucket.enabled,
        maximumFileSize: bucket.maximumFileSize,
        allowedFileExtensions: bucket.allowedFileExtensions,
        fileSecurity: bucket.fileSecurity,
        compression: bucket.compression,
        encryption: bucket.encryption,
        antivirus: bucket.antivirus,
        permissions: bucket.$permissions,
      });
    }

    return bucketsData;
  } catch (error) {
    console.error(`❌ Failed to analyze buckets: ${error.message}`);
    throw error;
  }
}

// Analyze functions
async function analyzeFunctions(functions) {
  console.log("\n\n⚡ FUNCTIONS ANALYSIS");
  console.log("═══════════════════════════════════════════════════════════\n");

  const functionsData = [];

  try {
    const functionsList = await functions.list();
    console.log(`Total Functions: ${functionsList.total}\n`);

    for (const func of functionsList.functions) {
      console.log(`\n┌─ ${func.name} (${func.$id})`);
      console.log(`│  Runtime: ${func.runtime}`);
      console.log(`│  Status: ${func.status}`);
      console.log(`│  Enabled: ${func.enabled}`);
      console.log(`│  Entrypoint: ${func.entrypoint}`);
      console.log(`│  Execute: ${func.execute.join(", ")}`);
      
      if (func.vars && Object.keys(func.vars).length > 0) {
        console.log(`│  Environment Variables: ${Object.keys(func.vars).join(", ")}`);
      }
      
      console.log(`└─`);

      functionsData.push({
        id: func.$id,
        name: func.name,
        runtime: func.runtime,
        status: func.status,
        enabled: func.enabled,
        entrypoint: func.entrypoint,
        execute: func.execute,
        vars: func.vars ? Object.keys(func.vars) : [],
      });
    }

    return functionsData;
  } catch (error) {
    console.error(`❌ Failed to analyze functions: ${error.message}`);
    return [];
  }
}

// Generate setup script
function generateSetupScript(database, collections, buckets, functions) {
  console.log("\n\n📝 GENERATING SETUP SCRIPT");
  console.log("═══════════════════════════════════════════════════════════\n");

  const scriptPath = path.join(__dirname, "generated-setup-appwrite.js");
  
  let script = `/**
 * Generated Appwrite Setup Script
 * 
 * Auto-generated from postmortem analysis of naat-collection
 * Date: ${new Date().toISOString()}
 * 
 * This script recreates the complete Appwrite structure:
 * - Database: ${database.name}
 * - Collections: ${collections.length}
 * - Buckets: ${buckets.length}
 * - Functions: ${functions.length}
 * 
 * Usage: node scripts/setup/generated-setup-appwrite.js
 */

const { Client, Databases, Storage, ID, Permission, Role, IndexType } = require("node-appwrite");
const path = require("path");
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
    missing.forEach((v) => console.error(\`   - \${v}\`));
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
  console.log(\`   ⏳ Waiting for attribute '\${attributeKey}' to be ready...\`);
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    try {
      const collection = await databases.getCollection(databaseId, collectionId);
      const attribute = collection.attributes.find((attr) => attr.key === attributeKey);

      if (attribute && attribute.status === "available") {
        console.log(\`   ✅ Attribute '\${attributeKey}' is ready\`);
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;
    }
  }

  throw new Error(\`Attribute '\${attributeKey}' did not become available in time\`);
}

`;

  // Generate database creation
  script += `// Create database
async function createDatabase(databases) {
  console.log("\\n📊 Creating database...");
  
  try {
    const databaseId = ID.unique();
    await databases.create(databaseId, "${database.name}");
    console.log(\`✅ Database created: \${databaseId}\`);
    return databaseId;
  } catch (error) {
    console.error(\`❌ Failed to create database: \${error.message}\`);
    throw error;
  }
}

`;

  // Generate collections creation
  collections.forEach((collection, index) => {
    script += `// Create ${collection.name} collection
async function create${collection.name.replace(/[^a-zA-Z0-9]/g, "")}Collection(databases, databaseId) {
  console.log("\\n📦 Creating ${collection.name} collection...");
  
  try {
    const collectionId = "${collection.id}";
    
    // Create collection
    await databases.createCollection(
      databaseId,
      collectionId,
      "${collection.name}",
      ${JSON.stringify(collection.permissions, null, 6).replace(/\n/g, "\n      ")},
      ${collection.documentSecurity}
    );
    console.log(\`✅ Collection created: \${collectionId}\`);
    
    // Create attributes
    console.log("   Creating attributes...");
`;

    collection.attributes.forEach((attr) => {
      const attrType = attr.type.charAt(0).toUpperCase() + attr.type.slice(1);
      
      if (attr.type === "string") {
        script += `    await databases.createStringAttribute(databaseId, collectionId, "${attr.key}", ${attr.size}, ${attr.required}${attr.default !== undefined && attr.default !== null ? `, "${attr.default}"` : ""}, ${attr.array || false});
    await waitForAttribute(databases, databaseId, collectionId, "${attr.key}");
`;
      } else if (attr.type === "integer") {
        script += `    await databases.createIntegerAttribute(databaseId, collectionId, "${attr.key}", ${attr.required}${attr.min !== undefined ? `, ${attr.min}` : ""}${attr.max !== undefined ? `, ${attr.max}` : ""}${attr.default !== undefined && attr.default !== null ? `, ${attr.default}` : ""}, ${attr.array || false});
    await waitForAttribute(databases, databaseId, collectionId, "${attr.key}");
`;
      } else if (attr.type === "float") {
        script += `    await databases.createFloatAttribute(databaseId, collectionId, "${attr.key}", ${attr.required}${attr.min !== undefined ? `, ${attr.min}` : ""}${attr.max !== undefined ? `, ${attr.max}` : ""}${attr.default !== undefined && attr.default !== null ? `, ${attr.default}` : ""}, ${attr.array || false});
    await waitForAttribute(databases, databaseId, collectionId, "${attr.key}");
`;
      } else if (attr.type === "boolean") {
        script += `    await databases.createBooleanAttribute(databaseId, collectionId, "${attr.key}", ${attr.required}${attr.default !== undefined && attr.default !== null ? `, ${attr.default}` : ""}, ${attr.array || false});
    await waitForAttribute(databases, databaseId, collectionId, "${attr.key}");
`;
      } else if (attr.type === "datetime") {
        script += `    await databases.createDatetimeAttribute(databaseId, collectionId, "${attr.key}", ${attr.required}${attr.default !== undefined && attr.default !== null ? `, "${attr.default}"` : ""}, ${attr.array || false});
    await waitForAttribute(databases, databaseId, collectionId, "${attr.key}");
`;
      } else if (attr.type === "email") {
        script += `    await databases.createEmailAttribute(databaseId, collectionId, "${attr.key}", ${attr.required}${attr.default !== undefined && attr.default !== null ? `, "${attr.default}"` : ""}, ${attr.array || false});
    await waitForAttribute(databases, databaseId, collectionId, "${attr.key}");
`;
      } else if (attr.type === "url") {
        script += `    await databases.createUrlAttribute(databaseId, collectionId, "${attr.key}", ${attr.required}${attr.default !== undefined && attr.default !== null ? `, "${attr.default}"` : ""}, ${attr.array || false});
    await waitForAttribute(databases, databaseId, collectionId, "${attr.key}");
`;
      } else if (attr.type === "enum") {
        script += `    await databases.createEnumAttribute(databaseId, collectionId, "${attr.key}", ${JSON.stringify(attr.elements)}, ${attr.required}${attr.default !== undefined && attr.default !== null ? `, "${attr.default}"` : ""}, ${attr.array || false});
    await waitForAttribute(databases, databaseId, collectionId, "${attr.key}");
`;
      }
    });

    script += `    console.log("   ✅ All attributes created");
    
    // Create indexes
    console.log("   Creating indexes...");
`;

    collection.indexes.forEach((index) => {
      const orders = index.orders && index.orders.length > 0 
        ? `, ${JSON.stringify(index.orders)}` 
        : "";
      script += `    await databases.createIndex(databaseId, collectionId, "${index.key}", "${index.type}", ${JSON.stringify(index.attributes)}${orders});
    await new Promise((resolve) => setTimeout(resolve, 2000));
`;
    });

    script += `    console.log("   ✅ All indexes created");
    
    return collectionId;
  } catch (error) {
    console.error(\`❌ Failed to create ${collection.name} collection: \${error.message}\`);
    throw error;
  }
}

`;
  });

  // Generate buckets creation
  buckets.forEach((bucket) => {
    const allowedExtensions = bucket.allowedFileExtensions && bucket.allowedFileExtensions.length > 0
      ? JSON.stringify(bucket.allowedFileExtensions)
      : "undefined";
      
    script += `// Create ${bucket.name} bucket
async function create${bucket.name.replace(/[^a-zA-Z0-9]/g, "")}Bucket(storage) {
  console.log("\\n🪣 Creating ${bucket.name} bucket...");
  
  try {
    const bucketId = "${bucket.id}";
    
    await storage.createBucket(
      bucketId,
      "${bucket.name}",
      ${JSON.stringify(bucket.permissions, null, 6).replace(/\n/g, "\n      ")},
      ${bucket.fileSecurity},
      ${bucket.enabled},
      ${bucket.maximumFileSize},
      ${allowedExtensions},
      "${bucket.compression}",
      ${bucket.encryption},
      ${bucket.antivirus}
    );
    
    console.log(\`✅ Bucket created: \${bucketId}\`);
    return bucketId;
  } catch (error) {
    console.error(\`❌ Failed to create ${bucket.name} bucket: \${error.message}\`);
    throw error;
  }
}

`;
  });

  // Generate main setup function
  script += `// Main setup function
async function setup() {
  console.log("🚀 Starting Appwrite Setup\\n");
  console.log("═══════════════════════════════════════════════════════════");

  try {
    validateConfig();
    console.log("✅ Configuration validated");

    const { databases, storage } = initializeClients();
    console.log("✅ Clients initialized");

    // Create database
    const databaseId = await createDatabase(databases);

    // Create collections
`;

  collections.forEach((collection) => {
    const funcName = `create${collection.name.replace(/[^a-zA-Z0-9]/g, "")}Collection`;
    script += `    const ${collection.name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}Id = await ${funcName}(databases, databaseId);
`;
  });

  script += `
    // Create buckets
`;

  buckets.forEach((bucket) => {
    const funcName = `create${bucket.name.replace(/[^a-zA-Z0-9]/g, "")}Bucket`;
    script += `    const ${bucket.name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}BucketId = await ${funcName}(storage);
`;
  });

  script += `
    console.log("\\n═══════════════════════════════════════════════════════════");
    console.log("🎉 Setup completed successfully!\\n");
    console.log("📋 Summary:");
    console.log(\`   Database ID: \${databaseId}\`);
`;

  collections.forEach((collection) => {
    const varName = `${collection.name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}Id`;
    script += `    console.log(\`   ${collection.name} Collection ID: \$\{${varName}}\`);
`;
  });

  buckets.forEach((bucket) => {
    const varName = `${bucket.name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}BucketId`;
    script += `    console.log(\`   ${bucket.name} Bucket ID: \$\{${varName}}\`);
`;
  });

  script += `
    console.log("\\n📝 Next steps:");
    console.log("   1. Update your .env.local file with the new IDs");
    console.log("   2. Verify the setup in Appwrite console");
    console.log("   3. Test your application");
    console.log("\\n");
  } catch (error) {
    console.error("\\n═══════════════════════════════════════════════════════════");
    console.error("❌ Setup failed:", error.message);
    process.exit(1);
  }
}

// Run setup
setup();
`;

  fs.writeFileSync(scriptPath, script);
  console.log(`✅ Setup script generated: ${scriptPath}`);
}

// Generate JSON report
function generateJSONReport(database, collections, buckets, functions) {
  console.log("\n📄 GENERATING JSON REPORT");
  console.log("═══════════════════════════════════════════════════════════\n");

  const reportPath = path.join(__dirname, "appwrite-postmortem.json");
  
  const report = {
    generatedAt: new Date().toISOString(),
    project: {
      id: config.projectId,
      endpoint: config.endpoint,
    },
    database: {
      id: database.$id,
      name: database.name,
      createdAt: database.$createdAt,
      updatedAt: database.$updatedAt,
    },
    collections: collections.map(c => ({
      id: c.id,
      name: c.name,
      documentSecurity: c.documentSecurity,
      attributesCount: c.attributes.length,
      indexesCount: c.indexes.length,
      attributes: c.attributes,
      indexes: c.indexes,
      permissions: c.permissions,
    })),
    buckets: buckets.map(b => ({
      id: b.id,
      name: b.name,
      enabled: b.enabled,
      maximumFileSize: b.maximumFileSize,
      allowedFileExtensions: b.allowedFileExtensions,
      fileSecurity: b.fileSecurity,
      compression: b.compression,
      encryption: b.encryption,
      antivirus: b.antivirus,
      permissions: b.permissions,
    })),
    functions: functions.map(f => ({
      id: f.id,
      name: f.name,
      runtime: f.runtime,
      status: f.status,
      enabled: f.enabled,
      entrypoint: f.entrypoint,
      execute: f.execute,
      environmentVariables: f.vars,
    })),
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`✅ JSON report generated: ${reportPath}`);
}

// Main function
async function main() {
  console.log("🔍 APPWRITE POSTMORTEM ANALYSIS");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`\nProject: ${config.projectId}`);
  console.log(`Endpoint: ${config.endpoint}`);
  console.log(`Database: ${config.databaseId}`);

  try {
    validateConfig();
    const { databases, storage, functions } = initializeClients();

    // Analyze everything
    const database = await analyzeDatabase(databases);
    const collections = await analyzeCollections(databases);
    const buckets = await analyzeBuckets(storage);
    const functionsData = await analyzeFunctions(functions);

    // Generate outputs
    generateSetupScript(database, collections, buckets, functionsData);
    generateJSONReport(database, collections, buckets, functionsData);

    console.log("\n\n═══════════════════════════════════════════════════════════");
    console.log("✅ POSTMORTEM ANALYSIS COMPLETE");
    console.log("═══════════════════════════════════════════════════════════\n");
    console.log("📁 Generated files:");
    console.log("   • generated-setup-appwrite.js - Executable setup script");
    console.log("   • appwrite-postmortem.json - Detailed JSON report");
    console.log("\n");
  } catch (error) {
    console.error("\n❌ Postmortem failed:", error.message);
    process.exit(1);
  }
}

// Run postmortem
main();
