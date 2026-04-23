require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { MongoClient} = require('mongodb');

// Fallback to the explicit replica set URL because Node's DNS resolving is failing on your network
// const url = "mongodb+srv://russeljeoff143:russeljeoff143@cluster0.4sgdrfh.mongodb.net/?retryWrites=true&w=majority";
const url = process.env.MONGO_URI || "mongodb://localhost:27017/";
const client = new MongoClient(url);

let studentGradesCollection;
let usersCollection;
let adminsCollection;

async function connectToMongo() {
  try {
    await client.connect();
    const db = client.db("school_data");
    studentGradesCollection = db.collection("studentGrades");
    usersCollection = db.collection("users");
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

const server = http.createServer((req, res) => {
  // Parse URL and query string parameters
  const parsedUrl = require('url').parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // --- API ROUTES ---
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
        const existingStudent = await usersCollection.findOne({ studentId: gradeData.idNum, role: 'student' });
        
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
        
        // Safely build the query to check if the user exists
        let queryOptions = [];
        if (userData.email) queryOptions.push({ email: userData.email });
        if (userData.studentId) queryOptions.push({ studentId: userData.studentId });
        
        let existingUser = null;
        if (queryOptions.length > 0) {
            existingUser = await usersCollection.findOne({ $or: queryOptions });
        }
        
        if (existingUser) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'User already exists' }));
        }
        await usersCollection.insertOne(userData);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'User registered successfully' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }

  if (pathname === '/api/users' && req.method === 'GET') {
    if (!usersCollection) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Database not initialized yet' }));
    }

    const roleFilter = parsedUrl.query.role;
    const query = roleFilter === 'teacher' || roleFilter === 'student'
      ? { role: roleFilter }
      : { role: { $in: ['teacher', 'student'] } };

    return usersCollection.find(query).toArray()
      .then(users => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(users));
      })
      .catch(err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
  }

  if (req.url === '/api/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    return req.on('end', async () => {
      try {
        const { identifier, password, role } = JSON.parse(body);

        if (role === 'admin') {
          if (!adminsCollection) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Database not initialized yet' }));
          }

          const query = {
            password: password,
            $or: [
              { adminId: identifier },
              { email: identifier }
            ]
          };

          const admin = await adminsCollection.findOne(query);
          if (admin) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(admin));
          }
        } else {
          let queryOptions = [];
          if (identifier) {
            queryOptions.push({ email: identifier });
            queryOptions.push({ studentId: identifier });
          }

          const user = await usersCollection.findOne({ 
            $or: queryOptions.length > 0 ? queryOptions : [{}], 
            password: password,
            role: role 
          });

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





