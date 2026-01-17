import { useState, useCallback } from "react";
import {
    audioConstraints,
    videoConstraints,
} from "../utils/webrtc/mediaConstraints";

export const useMediaStream = () => {
    const [localStream, setLocalStream] = useState(null);
    const [error, setError] = useState(null);

    const getMediaStream = useCallback(async (type = "audio") => {
        try {
            const constraints =
                type === "video" ? videoConstraints : audioConstraints;
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            setLocalStream(stream);
            return stream;
        } catch (err) {
            console.error("Error accessing media devices:", err);
            setError(err.message);
            throw err;
        }
    }, []);

    const stopMediaStream = useCallback(() => {
        if (localStream) {
            localStream.getTracks().forEach((track) => track.stop());
            setLocalStream(null);
        }
    }, [localStream]);

    const toggleAudio = useCallback(() => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                return audioTrack.enabled;
            }
        }
        return false;
    }, [localStream]);

    const toggleVideo = useCallback(() => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                return videoTrack.enabled;
            }
        }
        return false;
    }, [localStream]);

    return {
        localStream,
        error,
        getMediaStream,
        stopMediaStream,
        toggleAudio,
        toggleVideo,
    };
};
