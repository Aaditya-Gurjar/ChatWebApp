import { useState, useCallback, useRef } from "react";
import SimplePeer from "simple-peer";
import { iceServers } from "../utils/webrtc/iceServers";

export const useWebRTC = () => {
    const [peer, setPeer] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const peerRef = useRef(null);

    // Create peer connection (initiator = caller)
    const createPeer = useCallback((localStream, initiator = false) => {
        const newPeer = new SimplePeer({
            initiator,
            stream: localStream,
            trickle: true,
            config: iceServers,
        });

        peerRef.current = newPeer;
        setPeer(newPeer);
        return newPeer;
    }, []);

    // Clean up peer connection
    const destroyPeer = useCallback(() => {
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
            setPeer(null);
            setRemoteStream(null);
        }
    }, []);

    return {
        peer,
        peerRef,  // Expose ref for stable access in callbacks
        remoteStream,
        setRemoteStream,
        createPeer,
        destroyPeer,
    };
};
