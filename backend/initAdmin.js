const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');

// Manually load .env file
const envPath = path.resolve(__dirname, '..', '.env');
console.log('Resolved .env path:', envPath);

if (fs.existsSync(envPath)) {
  let envContent = fs.readFileSync(envPath, 'utf8');

  // Remove BOM if present
  if (envContent.charCodeAt(0) === 0xFEFF) {
    envContent = envContent.slice(1);
  }

  console.log('.env file content (clean):', envContent);

  const envLines = envContent.split('\n');
  envLines.forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const cleanKey = key.trim();
        const value = valueParts.join('=').trim();
        process.env[cleanKey] = value;
        console.log(`Set ${cleanKey}=${value}`);
      }
    }
  });
} else {
  console.log('.env file does not exist');
}

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/';
console.log('Using MongoDB URI for admin init:', uri);
const client = new MongoClient(uri);

const adminData = {
  adminId: process.env.ADMIN_ID || 'admin001',
  email: process.env.ADMIN_EMAIL || 'admin@school.edu',
  password: process.env.ADMIN_PASSWORD || 'adminpass123',
  role: 'admin'
};

async function main() {
  try {
    await client.connect();
    const db = client.db('school_data');
    const admins = db.collection('admins');

    const existing = await admins.findOne({ adminId: adminData.adminId });
    if (existing) {
      console.log(`Admin already exists with adminId=${adminData.adminId}`);
    } else {
      await admins.insertOne(adminData);
      console.log('Admin inserted successfully:');
      console.log(adminData);
    }
  } catch (err) {
    console.error('Failed to initialize admin document:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
