// STUN/TURN server configuration for WebRTC
export const iceServers = {
    iceServers: [
        // Google STUN servers
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },

        // Mozilla STUN server
        { urls: "stun:stun.services.mozilla.com" },

        // Optional: Add your TURN server here for better connectivity
        // {
        //   urls: 'turn:your-turn-server.com:3478',
        //   username: 'your-username',
        //   credential: 'your-password',
        // },
    ],
    iceCandidatePoolSize: 10,
};
