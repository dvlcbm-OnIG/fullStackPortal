require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/';
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
