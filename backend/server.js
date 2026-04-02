const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mysql = require("mysql2/promise");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto-js");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

// MySQL connection
let db;
async function connectDB() {
  try {
    db = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "chatapp",
    });
    console.log("MySQL connected");

    // Create tables if they don't exist
    await createTables();
  } catch (err) {
    console.error("MySQL connection error:", err);
  }
}

async function createTables() {
  try {
    // Users table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        isOnline BOOLEAN DEFAULT FALSE,
        lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Messages table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender VARCHAR(255) NOT NULL,
        receiver VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        isRead BOOLEAN DEFAULT FALSE,
        isDeletedBySender BOOLEAN DEFAULT FALSE,
        isDeletedByReceiver BOOLEAN DEFAULT FALSE,
        INDEX idx_sender_receiver (sender, receiver),
        INDEX idx_timestamp (timestamp)
      )
    `);

    // Add columns if missing (migration)
    const [columns] = await db.execute("SHOW COLUMNS FROM messages");
    const colNames = columns.map((col) => col.Field);
    if (!colNames.includes("isDeletedBySender")) {
      await db.execute(
        "ALTER TABLE messages ADD COLUMN isDeletedBySender BOOLEAN DEFAULT FALSE",
      );
    }
    if (!colNames.includes("isDeletedByReceiver")) {
      await db.execute(
        "ALTER TABLE messages ADD COLUMN isDeletedByReceiver BOOLEAN DEFAULT FALSE",
      );
    }

    console.log("Tables created successfully");
  } catch (err) {
    console.error("Error creating tables:", err);
  }
}

// --- Retry logic for MySQL connection ---
async function connectWithRetry(retries = 10, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      await connectDB();
      return;
    } catch (err) {
      console.error(
        `MySQL connection failed (attempt ${i + 1}/${retries}):`,
        err.message,
      );
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(
          "Could not connect to MySQL after multiple attempts. Exiting.",
        );
        process.exit(1);
      }
    }
  }
}

// Use retry logic instead of direct connectDB()
connectWithRetry();

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Access denied" });

  try {
    const verified = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key",
    );
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ message: "Invalid token" });
  }
};

// Routes
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check if user exists
    const [existingUser] = await db.execute(
      "SELECT id FROM users WHERE username = ?",
      [username],
    );
    if (existingUser.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    await db.execute("INSERT INTO users (username, password) VALUES (?, ?)", [
      username,
      hashedPassword,
    ]);

    res.status(201).json({ message: "User created successfully" });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check if user exists
    const [users] = await db.execute(
      "SELECT id, username, password FROM users WHERE username = ?",
      [username],
    );
    if (users.length === 0) {
      return res.status(400).json({ message: "User not found" });
    }

    const user = users[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: "Invalid password" });
    }

    // Create token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET || "your-secret-key",
    );

    res.json({ token, user: { username: user.username } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/users", authenticateToken, async (req, res) => {
  try {
    const [users] = await db.execute(
      "SELECT username, isOnline, lastSeen FROM users",
    );
    res.json(users);
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/messages/:username", authenticateToken, async (req, res) => {
  try {
    const { username } = req.params;
    const currentUser = req.user.username;

    // Show all messages between both users unless deleted by either user
    const [messages] = await db.execute(
      `SELECT sender, receiver, content, timestamp, isRead
       FROM messages
       WHERE ((sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?))
         AND isDeletedBySender = FALSE
         AND isDeletedByReceiver = FALSE
       ORDER BY timestamp ASC`,
      [currentUser, username, username, currentUser],
    );
    res.json(messages);
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete all messages between two users
app.delete("/api/messages/:username", authenticateToken, async (req, res) => {
  try {
    const { username } = req.params;
    const currentUser = req.user.username;
    // When either user deletes, set both flags to TRUE for all messages between them
    await db.execute(
      `UPDATE messages SET 
        isDeletedBySender = TRUE,
        isDeletedByReceiver = TRUE
      WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?)`,
      [currentUser, username, username, currentUser],
    );

    // Debug logging
    console.log(
      "[DELETE CHAT] currentUser:",
      currentUser,
      "username:",
      username,
    );
    console.log(
      "[DELETE CHAT] connectedUsers:",
      Array.from(connectedUsers.entries()),
    );

    // Emit chat_cleared event to both users if online
    const senderSocketId = connectedUsers.get(currentUser);
    const receiverSocketId = connectedUsers.get(username);
    const eventPayload = { sender: currentUser, receiver: username };
    console.log(
      "[DELETE CHAT] senderSocketId:",
      senderSocketId,
      "receiverSocketId:",
      receiverSocketId,
    );
    if (senderSocketId) {
      io.to(senderSocketId).emit("chat_cleared", eventPayload);
      console.log("[DELETE CHAT] Emitted chat_cleared to sender");
    }
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("chat_cleared", eventPayload);
      console.log("[DELETE CHAT] Emitted chat_cleared to receiver");
    }

    res.json({ message: "Chat hidden for both users" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Socket.IO connection handling
const connectedUsers = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // User joins with their username
  socket.on("join", async (username) => {
    connectedUsers.set(username, socket.id);
    socket.username = username;

    // Update user online status
    await db.execute("UPDATE users SET isOnline = TRUE WHERE username = ?", [
      username,
    ]);

    // Broadcast user online status
    io.emit("user_status", { username, isOnline: true });

    console.log(`${username} joined the chat`);
  });

  // Handle private messages
  socket.on("private_message", async (data) => {
    const { receiver, content } = data;
    const sender = socket.username;

    if (!sender || !receiver || !content) return;

    // Encrypt message content
    const encryptedContent = content;
    // const encryptedContent = crypto.AES.encrypt(
    //   content,
    //   process.env.ENCRYPTION_KEY || "default-encryption-key",
    // ).toString();

    // Save message to database
    const [result] = await db.execute(
      "INSERT INTO messages (sender, receiver, content) VALUES (?, ?, ?)",
      [sender, receiver, encryptedContent],
    );

    // Get the inserted message with timestamp
    const [messages] = await db.execute(
      "SELECT sender, receiver, content, timestamp FROM messages WHERE id = ?",
      [result.insertId],
    );
    const message = messages[0];

    // Send to receiver if online
    const receiverSocketId = connectedUsers.get(receiver);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("private_message", {
        sender,
        content: encryptedContent,
        timestamp: message.timestamp,
      });
    }

    // Send back to sender
    socket.emit("private_message", {
      sender,
      receiver,
      content: encryptedContent,
      timestamp: message.timestamp,
    });
  });

  // Handle typing indicator
  socket.on("typing", (data) => {
    const { receiver, isTyping } = data;
    const sender = socket.username;

    const receiverSocketId = connectedUsers.get(receiver);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing", { sender, isTyping });
    }
  });

  // Handle message read status
  socket.on("message_read", async (data) => {
    const { sender } = data;
    const receiver = socket.username;

    await db.execute(
      "UPDATE messages SET isRead = TRUE WHERE sender = ? AND receiver = ? AND isRead = FALSE",
      [sender, receiver],
    );
  });

  // Handle disconnect
  socket.on("disconnect", async () => {
    const username = socket.username;
    if (username) {
      connectedUsers.delete(username);

      // Update user offline status
      await db.execute(
        "UPDATE users SET isOnline = FALSE, lastSeen = NOW() WHERE username = ?",
        [username],
      );

      // Broadcast user offline status
      io.emit("user_status", { username, isOnline: false });
    }

    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5001;
const HOST = "0.0.0.0";
server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
