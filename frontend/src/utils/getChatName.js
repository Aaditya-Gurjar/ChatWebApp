import GroupLogo from "../assets/group.png";

const getChatName = (chat, authUserId) => {
	// Handle missing users array
	if (!chat?.users || chat.users.length < 2) {
		return chat?.chatName || "Unknown Chat";
	}

	const chatName =
		chat?.chatName == "Messenger"
			? authUserId == chat.users[0]?._id
				? (chat.users[1]?.firstName || "") + " " + (chat.users[1]?.lastName || "")
				: (chat.users[0]?.firstName || "") + " " + (chat.users[0]?.lastName || "")
			: chat?.chatName;
	return chatName || "Unknown";
};

export const getChatImage = (chat, authUserId) => {
	// Handle missing users array
	if (!chat?.users || chat.users.length < 2) {
		return GroupLogo;
	}

	const ImageLogo =
		chat?.chatName == "Messenger"
			? authUserId == chat.users[0]?._id
				? chat.users[1]?.image || GroupLogo
				: chat.users[0]?.image || GroupLogo
			: GroupLogo;
	return ImageLogo;
};

export default getChatName;
