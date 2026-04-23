const dotenv = require('dotenv');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { MongoClient} = require('mongodb');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
const url = process.env.MONGO_URI || "mongodb://localhost:27017/";
console.log('Using MongoDB URI:', url);

// MongoDB client with more robust connection options
const client = new MongoClient(url, {
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  maxPoolSize: 10, // Maintain up to 10 socket connections
});

let studentGradesCollection;
let studentsCollection;
let teachersCollection;
let adminsCollection;

// Helper function to safely check database availability
function isDatabaseAvailable() {
  return studentGradesCollection && studentsCollection && teachersCollection && adminsCollection;
}

// Helper function for safe database operations
async function safeDbOperation(operation, fallbackResponse = null) {
  try {
    if (!isDatabaseAvailable()) {
      throw new Error('Database not available');
    }
    return await operation();
  } catch (err) {
    console.error('Database operation failed:', err.message);
    return fallbackResponse;
  }
}

async function connectToMongo() {
  try {
    console.log('Attempting MongoDB connection...');
    await client.connect();
    const db = client.db("school_data");
    studentGradesCollection = db.collection("studentGrades");
    studentsCollection = db.collection("students");
    teachersCollection = db.collection("teachers");
    adminsCollection = db.collection("admins");
    console.log("✓ Connected to MongoDB!");
  } catch (err) {
    console.error("⚠ MongoDB connection failed:", err.message);
    console.error("Database operations will be unavailable until connection is restored.");
    // Don't crash the app - keep the server running
  }
}

connectToMongo().catch(err => {
  console.error("Failed to initialize MongoDB connection:", err);
  // Still start the server
});

// Global error handler to prevent server crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Don't exit the process, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

const server = http.createServer((req, res) => {
  // Parse URL and query string parameters
  const parsedUrl = require('url').parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // --- API ROUTES ---
  if (pathname === '/api/health' && req.method === 'GET') {
    const dbStatus = isDatabaseAvailable() ? 'connected' : 'disconnected';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      server: 'running'
    }));
  }

  if (pathname === '/api/grades' && req.method === 'GET') {
    if (!studentGradesCollection) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Database not initialized yet' }));
    }

    const userEmail = parsedUrl.query.email;
    const studentId = parsedUrl.query.studentId;

    let query = {};
    if (userEmail) {
      query.ownerEmail = userEmail; // Teacher viewing grades they entered
    } else if (studentId) {
      query.idNum = studentId; // Student viewing their own grade
    } else {
      // If neither is provided, deny access
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify([])); 
    }

    return studentGradesCollection.find(query).toArray()
      .then(grades => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(grades));
      })
      .catch(err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
  }

  if (pathname === '/api/grades' && req.method === 'POST') {
    if (!studentGradesCollection) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Database not initialized yet' }));
    }
    let body = '';
    req.on('data', chunk => body += chunk);
    return req.on('end', async () => {
      try {
        const gradeData = JSON.parse(body);
        
        // Before saving the grade, let's verify this Student ID actually exists!
        const existingStudent = await studentsCollection.findOne({ studentId: gradeData.idNum });
        
        if (!existingStudent) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Incorrect Student ID! No registered student found with this ID.' }));
        }

        // Optional: Let's automatically use their registered database name
        gradeData.name = `${existingStudent.firstName} ${existingStudent.lastName}`;

        const result = await studentGradesCollection.insertOne(gradeData);
        gradeData._id = result.insertedId;
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(gradeData));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }

  if (req.url.startsWith('/api/grades/') && req.method === 'DELETE') {
    const id = req.url.split('/')[3];
    // Need ObjectId from mongodb
    const { ObjectId } = require('mongodb');
    return studentGradesCollection.deleteOne({ _id: new ObjectId(id) })
      .then(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Deleted' }));
      })
      .catch(err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
  }

  if (req.url === '/api/register' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    return req.on('end', async () => {
      try {
        const userData = JSON.parse(body);
        
        // Choose collection based on role
        let targetCollection;
        if (userData.role === 'student') {
          targetCollection = studentsCollection;
        } else if (userData.role === 'teacher') {
          targetCollection = teachersCollection;
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Invalid role specified' }));
        }
        
        // Safely build the query to check if the user exists
        let queryOptions = [];
        if (userData.email) queryOptions.push({ email: userData.email });
        if (userData.studentId) queryOptions.push({ studentId: userData.studentId });
        
        let existingUser = null;
        if (queryOptions.length > 0) {
            existingUser = await targetCollection.findOne({ $or: queryOptions });
        }
        
        if (existingUser) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'User already exists' }));
        }
        await targetCollection.insertOne(userData);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'User registered successfully' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }

  if (pathname === '/api/users' && req.method === 'GET') {
    if (!isDatabaseAvailable()) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Database not available' }));
    }

    const roleFilter = parsedUrl.query.role;

    (async () => {
      try {
        let users = [];

        if (roleFilter === 'student') {
          const students = await safeDbOperation(() => studentsCollection.find({}).toArray(), []);
          users = students;
        } else if (roleFilter === 'teacher') {
          const teachers = await safeDbOperation(() => teachersCollection.find({}).toArray(), []);
          users = teachers;
        } else {
          // Get both students and teachers with error handling for each
          const students = await safeDbOperation(() => studentsCollection.find({}).toArray(), []);
          const teachers = await safeDbOperation(() => teachersCollection.find({}).toArray(), []);
          users = users.concat(students, teachers);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(users));
      } catch (err) {
        console.error('Error in /api/users:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Database query failed. Please try again.' }));
      }
    })();
  }

  if (req.url === '/api/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    return req.on('end', async () => {
      try {
        const { identifier, password, role } = JSON.parse(body);

        if (role === 'admin') {
          if (!isDatabaseAvailable()) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Database not available' }));
          }

          const query = {
            password: password,
            $or: [
              { adminId: identifier },
              { email: identifier }
            ]
          };

          const admin = await safeDbOperation(() => adminsCollection.findOne(query));
          if (admin) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(admin));
          }
        } else {
          if (!isDatabaseAvailable()) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Database not available' }));
          }

          let targetCollection;
          if (role === 'student') {
            targetCollection = studentsCollection;
          } else if (role === 'teacher') {
            targetCollection = teachersCollection;
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Invalid role' }));
          }

          let queryOptions = [];
          if (identifier) {
            queryOptions.push({ email: identifier });
            if (role === 'student') {
              queryOptions.push({ studentId: identifier });
            }
          }

          const user = await safeDbOperation(() => targetCollection.findOne({
            $or: queryOptions.length > 0 ? queryOptions : [{}],
            password: password
          }));

          if (user) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(user));
          }
        }

        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid credentials' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
  // --- END API ROUTES ---

  // default page - use pathname which already excludes query strings
  let filePath = pathname === '/' ? 'index.html' : pathname.slice(1);

  // build full path safely
  //value of fullPath is D:\vscode\portalFulStack\index.html
  //                     D:\vscode\portalFulStack\frontend\SetupAccount\style.css
  const fullPath = path.join(__dirname, '..', filePath);

  // get file extension
  // vale if ext is: .html
  //                 .css
  const ext = path.extname(fullPath);

  // default content type
  let contentType = 'text/html';

  if (ext === '.css') contentType = 'text/css';
  if (ext === '.js') contentType = 'text/javascript';
  if (ext === '.png') contentType = 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';

  fs.readFile(fullPath, (err, data) => {

    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 File Not Found');
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
    

  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});





