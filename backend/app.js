const http = require('http'); //traffic controller for websites
const fs = require('fs');   //file manager. Lets Node read/write/delete files.
const path = require('path'); //Helps build file paths safely

const server = http.createServer((req, res) => {

  let filePath = path.join(__dirname, '../index.html');

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      return res.end("Error loading page");
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(data); //sends output + close connection
   
  });

});

server.listen(3000, () => {
  console.log("Server running on port 3000");
  
});