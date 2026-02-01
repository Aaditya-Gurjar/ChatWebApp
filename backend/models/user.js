const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
	{
		firstName: {
			type: String,
			required: true,
		},
		lastName: {
			type: String,
			required: true,
		},
		password: {
			type: String,
			required: true,
		},
		email: {
			type: String,
			required: true,
			unique: true,
		},
		image: {
			type: String,
			default:
				"https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg",
		},
		// FCM tokens for push notifications (supports multiple devices)
		fcmTokens: [{
			token: { type: String, required: true },
			device: { type: String }, // User agent or device identifier
			createdAt: { type: Date, default: Date.now }
		}],
	},
	{
		timestamps: true,
	}
);

const User = mongoose.model("User", userSchema);
module.exports = User;
