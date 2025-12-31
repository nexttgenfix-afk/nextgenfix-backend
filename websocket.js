// WebSocket server setup for /ws/ endpoint
const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const app = express();

// ...existing Express app setup (routes, middleware, etc.)

const server = http.createServer(app);

// Start Express app on port 5000
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`);
});

// WebSocket server on port 8080
const wss = new WebSocket.Server({ port: 8082, path: '/ws/' });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  ws.on('message', (message) => {
    console.log('Received:', message);
    ws.send(`Echo: ${message}`);
  });
  ws.send('Welcome to Naanly WebSocket server!');
});

module.exports = { app, server, wss };
