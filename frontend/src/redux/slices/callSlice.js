import { createSlice } from "@reduxjs/toolkit";

const initialState = {
	// Call session data
	activeCall: null, // Current call object
	callStatus: "idle", // 'idle' | 'initiating' | 'ringing' | 'connecting' | 'connected' | 'ended'
	callType: null, // 'audio' | 'video'

	// Participants
	caller: null, // { _id, firstName, lastName, image }
	recipient: null, // { _id, firstName, lastName, image }

	// Incoming call
	incomingCall: null, // { from: user, callId, type, offer }

	// Media streams (stored as objects, not the actual MediaStream)
	localStream: null,
	remoteStream: null,

	// Call controls state
	isMuted: false,
	isVideoEnabled: true,
	isSpeakerOn: true,

	// Call metadata
	callStartTime: null,
	callDuration: 0,
	connectionQuality: "good", // 'excellent' | 'good' | 'poor' | 'disconnected'

	// Error handling
	error: null,
};

const callSlice = createSlice({
	name: "call",
	initialState,
	reducers: {
		// Initiate outgoing call
		initiateCall: (state, action) => {
			state.callStatus = "initiating";
			state.callType = action.payload.type;
			state.recipient = action.payload.recipient;
			state.activeCall = {
				callId: action.payload.callId,
				isOutgoing: true,
			};
		},

		// Receive incoming call
		receiveIncomingCall: (state, action) => {
			state.incomingCall = action.payload;
			state.callStatus = "ringing";
		},

		// Accept call
		acceptCall: (state) => {
			state.callStatus = "connecting";
			state.caller = state.incomingCall.from;
			state.callType = state.incomingCall.type;
			state.activeCall = {
				callId: state.incomingCall.callId,
				isOutgoing: false,
			};
			state.incomingCall = null;
		},

		// Reject call
		rejectCall: (state) => {
			state.incomingCall = null;
			state.callStatus = "idle";
		},

		// Call connected
		callConnected: (state) => {
			state.callStatus = "connected";
			state.callStartTime = Date.now();
		},

		// End call
		endCall: (state) => {
			return {
				...initialState,
				callStatus: "ended",
			};
		},

		// Reset to idle
		resetCall: (state) => {
			return initialState;
		},

		// Media streams (store reference flag, not actual stream)
		setLocalStream: (state, action) => {
			state.localStream = action.payload ? true : null;
		},

		setRemoteStream: (state, action) => {
			state.remoteStream = action.payload ? true : null;
		},

		// Call controls
		toggleMute: (state) => {
			state.isMuted = !state.isMuted;
		},

		toggleVideo: (state) => {
			state.isVideoEnabled = !state.isVideoEnabled;
		},

		toggleSpeaker: (state) => {
			state.isSpeakerOn = !state.isSpeakerOn;
		},

		// Connection quality
		updateConnectionQuality: (state, action) => {
			state.connectionQuality = action.payload;
		},

		// Error handling
		setCallError: (state, action) => {
			state.error = action.payload;
			state.callStatus = "idle";
		},
	},
});

export const {
	initiateCall,
	receiveIncomingCall,
	acceptCall,
	rejectCall,
	callConnected,
	endCall,
	resetCall,
	setLocalStream,
	setRemoteStream,
	toggleMute,
	toggleVideo,
	toggleSpeaker,
	updateConnectionQuality,
	setCallError,
} = callSlice.actions;

export default callSlice.reducer;
