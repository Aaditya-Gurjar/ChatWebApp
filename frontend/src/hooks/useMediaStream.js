import { useState, useCallback, useRef } from "react";
import {
    audioConstraints,
    videoConstraints,
} from "../utils/webrtc/mediaConstraints";

export const useMediaStream = () => {
    const [localStream, setLocalStream] = useState(null);
    const [error, setError] = useState(null);
    // Use ref to maintain stable reference for callbacks (prevents stale closure)
    const streamRef = useRef(null);

    const getMediaStream = useCallback(async (type = "audio") => {
        try {
            const constraints =
                type === "video" ? videoConstraints : audioConstraints;
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            setLocalStream(stream);
            return stream;
        } catch (err) {
            console.error("Error accessing media devices:", err);
            setError(err.message);
            throw err;
        }
    }, []);

    const stopMediaStream = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            setLocalStream(null);
        }
    }, []);

    const toggleAudio = useCallback(() => {
        if (streamRef.current) {
            const audioTrack = streamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                return audioTrack.enabled;
            }
        }
        return false;
    }, []);

    const toggleVideo = useCallback(() => {
        if (streamRef.current) {
            const videoTrack = streamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                return videoTrack.enabled;
            }
        }
        return false;
    }, []);

    return {
        localStream,
        error,
        getMediaStream,
        stopMediaStream,
        toggleAudio,
        toggleVideo,
    };
};
