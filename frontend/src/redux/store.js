import { configureStore } from "@reduxjs/toolkit";
import authSlice from "./slices/authSlice";
import conditionSlice from "./slices/conditionSlice";
import myChatSlice from "./slices/myChatSlice";
import messageSlice from "./slices/messageSlice";
import callSlice from "./slices/callSlice";

const store = configureStore({
	reducer: {
		auth: authSlice,
		condition: conditionSlice,
		myChat: myChatSlice,
		message: messageSlice,
		call: callSlice,
	},
	middleware: (getDefaultMiddleware) =>
		getDefaultMiddleware({
			serializableCheck: {
				// Ignore these paths for MediaStream objects
				ignoredActions: ["call/setLocalStream", "call/setRemoteStream"],
				ignoredPaths: ["call.localStream", "call.remoteStream"],
			},
		}),
});

export default store;
