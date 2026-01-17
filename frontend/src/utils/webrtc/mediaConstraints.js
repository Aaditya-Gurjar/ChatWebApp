// Media constraints for audio and video calls

// Audio-only call constraints
export const audioConstraints = {
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
    },
    video: false,
};

// Video call constraints (includes audio)
export const videoConstraints = {
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
    },
    video: {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 30 },
        facingMode: "user",
    },
};

// Lower quality for poor network connections
export const lowBandwidthConstraints = {
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
    },
    video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 15 },
    },
};
