const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8082 }); // WebSocket server on port 8080

// Store connected clients
const clients = new Map();

wss.on('connection', (ws, req) => {
  const userId = req.url.split('?userId=')[1]; // Extract userId from query params
  if (userId) {
    clients.set(userId, ws); // Map userId to WebSocket connection
  }

  console.log(`Client connected: ${userId}`);

  ws.on('message', (message) => {
    console.log(`Received message from ${userId}:`, message);
  });

  ws.on('close', () => {
    console.log(`Client disconnected: ${userId}`);
    clients.delete(userId); // Remove client from map
  });
});

// Emit order status updates
exports.emitOrderStatusUpdate = (userId, orderId, status) => {
  const ws = clients.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ orderId, status }));
  }
};

// Broadcast message to participants
exports.broadcastMessage = (participants, message) => {
  participants.forEach(participantId => {
    const ws = clients.get(participantId.toString());
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });
};