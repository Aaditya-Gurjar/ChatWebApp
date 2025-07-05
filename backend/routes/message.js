const express = require("express");
const router = express.Router();
const wrapAsync = require("../middlewares/wrapAsync");
const { authorization } = require("../middlewares/authorization");
const messageController = require("../controllers/message");
 

// Multer setup
const multer = require("multer");
const Chat = require("../models/chat");
const Message = require("../models/message");
const User = require("../models/user");
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Cloudinary setup
const cloudinary = require("cloudinary").v2;
cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload image to cloudinary and send message
router.post(
	"/upload",
	authorization,
	upload.single("image"),
	async (req, res) => {
		try {
			const { message, chatId } = req.body;
			if ((!message || !message.trim()) && !req.file) {
				return res.status(400).json({ error: "Message or image required" });
			}

			let imageUrl = "";
			if (req.file) {
				const result = await cloudinary.uploader.upload_stream(
					{ resource_type: "image", folder: "chat_images" },
					async (error, result) => {
						if (error) {
							console.error(error);
							return res
								.status(500)
								.json({ error: "Cloudinary upload failed" });
						}
						imageUrl = result.secure_url;
						console.log("imageUrl", imageUrl)
						const newMessage = {
							sender: req.user._id,
							message: message?.trim() || "",
							chat: chatId,
							image: imageUrl,
						};
						let msg = await Message.create(newMessage);

						msg = await msg.populate("sender", "name pic email");
						msg = await msg.populate("chat");
						msg = await User.populate(msg, {
							path: "chat.users",
							select: "name pic email",
						});

						await Chat.findByIdAndUpdate(chatId, { latestMessage: msg });

						res.status(201).json({ data: msg });
					}
				);
				result.end(req.file.buffer);
			} else {
				const newMessage = {
					sender: req.user._id,
					message: message?.trim() || "",
					chat: chatId,
				};
				let msg = await Message.create(newMessage);

				msg = await msg.populate("sender", "name pic email");
				msg = await msg.populate("chat");
				msg = await User.populate(msg, {
					path: "chat.users",
					select: "name pic email",
				});

				await Chat.findByIdAndUpdate(chatId, { latestMessage: msg });

				res.status(201).json({ data: msg });
			}
		} catch (err) {
			console.error(err);
			res.status(500).json({ error: "Failed to send message" });
		}
	}
);

router.post("/", authorization, wrapAsync(messageController.createMessage));
router.get("/:chatId", authorization, wrapAsync(messageController.allMessage));
router.get(
	"/clearChat/:chatId",
	authorization,
	wrapAsync(messageController.clearChat)
);

module.exports = router;
