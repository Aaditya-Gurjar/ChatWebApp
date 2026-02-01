const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

const corsOptions = {
	origin: process.env.FRONTEND_URL,
	methods: ["GET", "POST", "DELETE"],
	allowedHeaders: ["Content-Type", "Authorization"],
	credentials: true,
};

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const PORT = process.env.PORT || 3000;

// All routers
const authRouter = require("./routes/auth");
const userRouter = require("./routes/user");
const chatRouter = require("./routes/chat");
const messageRouter = require("./routes/message");
const fcmRouter = require("./routes/fcm");

// FCM Service for push notifications
const { sendMessageNotification, sendCallNotification, sendMissedCallNotification } = require("./services/fcmService");
const { initializeFirebaseAdmin } = require("./config/firebase");

// Initialize Firebase Admin SDK
initializeFirebaseAdmin();

// ============ CALL RINGING MANAGER ============
// Sends repeated notifications for incoming calls (for iOS Safari PWA)
// Uses same notification tag so they replace each other (not stack)
const activeCallRings = new Map(); // callId -> { interval, timeout, recipientId, callerInfo }

function startCallRinging(recipientId, callData) {
	const { callId } = callData;

	// Don't start if already ringing
	if (activeCallRings.has(callId)) {
		return;
	}

	console.log(`📞 Starting call ringing for ${callId}`);

	// Send first notification immediately
	sendCallNotification(recipientId, callData)
		.catch(err => console.log('FCM call notification error:', err));

	// Repeat notification every 3 seconds
	const ringInterval = setInterval(() => {
		console.log(`📞 Ring repeat for ${callId}`);
		sendCallNotification(recipientId, callData)
			.catch(err => console.log('FCM call ring error:', err));
	}, 3000);

	// Auto-stop after 30 seconds and send missed call
	const ringTimeout = setTimeout(() => {
		console.log(`📵 Call ${callId} timed out - missed call`);
		stopCallRinging(callId);
		sendMissedCallNotification(recipientId, callData)
			.catch(err => console.log('FCM missed call error:', err));
	}, 30000);

	activeCallRings.set(callId, {
		interval: ringInterval,
		timeout: ringTimeout,
		recipientId,
		callerInfo: callData
	});
}

function stopCallRinging(callId) {
	const ring = activeCallRings.get(callId);
	if (ring) {
		console.log(`🔕 Stopping call ringing for ${callId}`);
		clearInterval(ring.interval);
		clearTimeout(ring.timeout);
		activeCallRings.delete(callId);
	}
}

// Connect to Database
main()
	.then(() => console.log("Database Connection established"))
	.catch((err) => console.log(err));

async function main() {
	await mongoose.connect(process.env.MONGODB_URI);
}

// Root route
app.get("/", (req, res) => {
	res.json({
		message: "Welcome to Chat Application!",
		frontend_url: process.env.FRONTEND_URL,
	});
});

// All routes
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/chat", chatRouter);
app.use("/api/message", messageRouter);
app.use("/api/fcm", fcmRouter);

// Invaild routes
app.all("*", (req, res) => {
	res.json({ error: "Invaild Route" });
});

// Error handling middleware
app.use((err, req, res, next) => {
	const errorMessage = err.message || "Something Went Wrong!";
	res.status(500).json({ message: errorMessage });
});

// Start the server
const server = app.listen(PORT, async () => {
	console.log(`Server listening on ${PORT}`);
});

// Socket.IO setup
const { Server } = require("socket.io");
const io = new Server(server, {
	pingTimeout: 60000,
	transports: ["websocket"],
	cors: corsOptions,
});

// Track online users (userId -> Set of socket IDs)
// This is used to determine if user is actively connected (don't send FCM if they're online)
const onlineUsers = new Map();

// Socket connection
io.on("connection", (socket) => {
	console.log("Connected to socket.io:", socket.id);

	// Join user and message send to client
	const setupHandler = (userId) => {
		if (!socket.hasJoined) {
			socket.join(userId);
			socket.hasJoined = true;
			socket.userId = userId; // Store userId on socket for disconnect tracking

			// Track this user as online
			if (!onlineUsers.has(userId)) {
				onlineUsers.set(userId, new Set());
			}
			onlineUsers.get(userId).add(socket.id);
			console.log(`✅ User joined room: ${userId} (socket: ${socket.id}), online sockets: ${onlineUsers.get(userId).size}`);

			socket.emit("connected");
			console.log(`✅ Sent 'connected' event to user: ${userId}`);
		} else {
			console.log(`⚠️ User ${userId} already joined (socket: ${socket.id})`);
		}
	};
	const newMessageHandler = (newMessageReceived) => {
		let chat = newMessageReceived?.chat;
		chat?.users.forEach((user) => {
			if (user._id === newMessageReceived.sender._id) return;
			console.log("Message received by:", user._id);
			socket.in(user._id).emit("message received", newMessageReceived);

			// Extract sender name - try different property names
			const sender = newMessageReceived.sender;
			let senderName = 'Someone';
			if (sender) {
				if (sender.firstName) {
					senderName = `${sender.firstName} ${sender.lastName || ''}`.trim();
				} else if (sender.name) {
					senderName = sender.name;
				}
			}
			console.log('FCM: Sender data:', { firstName: sender?.firstName, lastName: sender?.lastName, name: sender?.name });
			console.log('FCM: Extracted senderName:', senderName);
			console.log('FCM: Message text:', newMessageReceived.message || newMessageReceived.content);

			// Only send FCM push notification if recipient is NOT currently online
			// (if they're online, they'll receive via socket.io and see the message directly)
			const isRecipientOnline = onlineUsers.has(user._id);
			console.log(`FCM: User ${user._id} online status:`, isRecipientOnline);

			if (!isRecipientOnline) {
				// Send FCM push notification for offline users
				sendMessageNotification(user._id, {
					senderName: senderName,
					senderImage: sender?.image || '',
					messageText: newMessageReceived.message || newMessageReceived.content || 'New message',
					chatId: chat._id,
					chatName: chat.chatName || '',
					isGroup: chat.isGroupChat || false
				}).catch(err => console.log('FCM message notification error:', err));
			} else {
				console.log(`FCM: Skipping notification for ${user._id} - user is online`);
			}
		});
	};

	// Join a Chat Room and Typing effect
	const joinChatHandler = (room) => {
		if (socket.currentRoom) {
			if (socket.currentRoom === room) {
				console.log(`User already in Room: ${room}`);
				return;
			}
			socket.leave(socket.currentRoom);
			console.log(`User left Room: ${socket.currentRoom}`);
		}
		socket.join(room);
		socket.currentRoom = room;
		console.log("User joined Room:", room);
	};
	const typingHandler = (room) => {
		socket.in(room).emit("typing");
	};
	const stopTypingHandler = (room) => {
		socket.in(room).emit("stop typing");
	};

	// Clear, Delete and Create chat handlers
	const clearChatHandler = (chatId) => {
		socket.in(chatId).emit("clear chat", chatId);
	};
	const deleteChatHandler = (chat, authUserId) => {
		chat.users.forEach((user) => {
			if (authUserId === user._id) return;
			console.log("Chat delete:", user._id);
			socket.in(user._id).emit("delete chat", chat._id);
		});
	};
	const chatCreateChatHandler = (chat, authUserId) => {
		chat.users.forEach((user) => {
			if (authUserId === user._id) return;
			console.log("Create chat:", user._id);
			socket.in(user._id).emit("chat created", chat);
		});
	};

	socket.on("setup", setupHandler);
	socket.on("new message", newMessageHandler);
	socket.on("join chat", joinChatHandler);
	socket.on("typing", typingHandler);
	socket.on("stop typing", stopTypingHandler);
	socket.on("clear chat", clearChatHandler);
	socket.on("delete chat", deleteChatHandler);
	socket.on("chat created", chatCreateChatHandler);

	// ============ CALL EVENTS ============

	// User initiates a call
	socket.on("call:initiate", ({ to, from, callId, type, offer }) => {
		console.log(`Call initiated from ${from._id} to ${to}`);
		// Forward to recipient via socket
		socket.to(to).emit("call:incoming", {
			from,
			callId,
			type,
			offer,
		});

		// Start repeated call ringing (for iOS Safari PWA)
		// Sends notification every 3 seconds until answered/rejected
		startCallRinging(to, {
			callerName: `${from.firstName} ${from.lastName || ''}`.trim(),
			callerImage: from.image,
			callId: callId,
			callType: type
		});
	});

	// User accepts call
	socket.on("call:accept", ({ to, answer, callId }) => {
		console.log(`Call ${callId} accepted, sending answer to user: ${to}`);
		// Stop call ringing
		stopCallRinging(callId);
		// Forward answer to caller
		socket.to(to).emit("call:accepted", {
			answer,
			callId,
		});
		console.log(`✅ Answer emitted to room: ${to}`);
	});

	// User rejects call
	socket.on("call:reject", ({ to, callId }) => {
		console.log(`Call ${callId} rejected`);
		// Stop call ringing
		stopCallRinging(callId);
		socket.to(to).emit("call:rejected", { callId });
	});

	// Exchange ICE candidates
	socket.on("call:ice-candidate", ({ to, candidate, callId }) => {
		socket.to(to).emit("call:ice-candidate", {
			candidate,
			callId,
		});
	});

	// End call
	socket.on("call:end", ({ to, callId }) => {
		console.log(`Call ${callId} ended`);
		// Stop call ringing (in case call ended before answered)
		stopCallRinging(callId);
		socket.to(to).emit("call:ended", { callId });
	});

	// User is busy (already on another call)
	socket.on("call:busy", ({ to, callId }) => {
		// Stop call ringing
		stopCallRinging(callId);
		socket.to(to).emit("call:busy", { callId });
	});

	socket.on("disconnect", () => {
		console.log("User disconnected:", socket.id);

		// Remove from online users tracking
		if (socket.userId && onlineUsers.has(socket.userId)) {
			onlineUsers.get(socket.userId).delete(socket.id);
			if (onlineUsers.get(socket.userId).size === 0) {
				onlineUsers.delete(socket.userId);
				console.log(`📴 User ${socket.userId} is now fully offline`);
			} else {
				console.log(`📱 User ${socket.userId} still has ${onlineUsers.get(socket.userId).size} active socket(s)`);
			}
		}

		socket.off("setup", setupHandler);
		socket.off("new message", newMessageHandler);
		socket.off("join chat", joinChatHandler);
		socket.off("typing", typingHandler);
		socket.off("stop typing", stopTypingHandler);
		socket.off("clear chat", clearChatHandler);
		socket.off("delete chat", deleteChatHandler);
		socket.off("chat created", chatCreateChatHandler);
	});
});

