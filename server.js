const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const { evaluate } = require('mathjs');
const XLSX = require('xlsx');
const math = require('mathjs');
const connectDB = require('./db'); // Import MongoDB connection
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Connect to MongoDB Atlas
connectDB();

// Create the HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = socketIo(server);

// Serve static files (HTML, CSS, JS)
app.use(express.static('public'));

// Define a simple route
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Start the server and listen on the specified port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Store data in memory for socket groups
const groupData = {}; 

// Handle socket connections
io.on('connection', (socket) => {
  let currentGroup = '';
  let currentUser = '';

  socket.on('joinGroup', ({ username, group }) => {
    currentGroup = group;
    currentUser = username;
    socket.join(group);

    if (!groupData[group]) groupData[group] = [];

    // Send existing messages to new user
    groupData[group].forEach(entry => {
      socket.emit('message', entry);
    });

    // Send current group total
    const total = groupData[group].reduce((sum, item) => sum + item.total, 0);
    socket.emit('updateTotal', total);
  });

  socket.on('leaveGroup', () => {
    socket.leave(currentGroup);
    currentGroup = '';
    currentUser = '';
  });

  socket.on('newEntry', ({ username, group, workOrderId, expression, plusAmount, timestamp }) => {
    const entry = { username, workOrderId, expression, total: plusAmount, timestamp };

    groupData[group] = groupData[group] || [];
    groupData[group].push(entry);

    io.to(group).emit('message', entry);

    const total = groupData[group].reduce((sum, item) => sum + item.total, 0);
    io.to(group).emit('updateTotal', total);
  });

  socket.on('endGroup', (group) => {
    // Logic to reset the group's total, and any other cleanup needed
    io.to(group).emit('message', {
      username: 'System',
      workOrderId: 'System Reset',
      expression: 'Group reset',
      total: 0,  // Reset total
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('disconnect', () => {
    socket.leave(currentGroup);
  });
});

// Export group data as XLSX file
app.get('/export', (req, res) => {
  const group = req.query.group;

  console.log(`Exporting group: ${group}`); // Debug log

  if (!group) {
    return res.status(400).send('Group parameter is missing.');
  }

  const data = groupData[group] || [];

  if (data.length === 0) {
    return res.status(404).send('No data found for the specified group');
  }

  console.log(`Data for group ${group}:`, data); // Log group data

  // Build worksheet data with cumulative Group Total
  let runningTotal = 0;
  const workSheetData = data.map(entry => {
    runningTotal += entry.total;
    return {
      "Username": entry.username,
      "Work Order ID": entry.workOrderId,
      "Expression": entry.expression,
      "Total": entry.total,
      "Timestamp": entry.timestamp,
      "Group Total": runningTotal // Running total at this point
    };
  });

  // Create Excel worksheet and workbook
  const ws = XLSX.utils.json_to_sheet(workSheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, group);

  const filePath = path.join(__dirname, 'exports', `${group}.xlsx`);

  // Ensure the 'exports' folder exists
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  try {
    // Save the workbook to disk
    XLSX.writeFile(wb, filePath);

    // Send the file as a download
    res.download(filePath, `${group}.xlsx`, (err) => {
      if (err) {
        console.error("Error downloading file:", err);
        res.status(500).send("Failed to download the file.");
      } else {
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) {
            console.error("Error deleting file:", unlinkErr);
          }
        });
      }
    });
  } catch (error) {
    console.error("Error exporting file:", error);
    res.status(500).send("Failed to generate the file.");
  }
});

// Language support (English/Chinese JSON files)
app.get('/lang/:lang', (req, res) => {
  const langFile = path.join(__dirname, 'lang', `${req.params.lang}.json`);
  if (fs.existsSync(langFile)) {
    res.sendFile(langFile);
  } else {
    res.status(404).send({ error: 'Language file not found' });
  }
});
