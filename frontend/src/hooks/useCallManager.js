import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { v4 as uuidv4 } from "uuid";
import socket from "../socket/socket";
import { useMediaStream } from "./useMediaStream";
import { useWebRTC } from "./useWebRTC";
import {
    initiateCall,
    receiveIncomingCall,
    acceptCall,
    rejectCall,
    callConnected,
    endCall,
    resetCall,
    setLocalStream,
    setRemoteStream as setRemoteStreamAction,
    setCallError,
    toggleSpeaker as toggleSpeakerAction,
} from "../redux/slices/callSlice";
import { toast } from "react-toastify";

export const useCallManager = () => {
    const dispatch = useDispatch();
    const authUser = useSelector((store) => store.auth);
    const { activeCall, callStatus, incomingCall, recipient, caller } =
        useSelector((store) => store.call);

    const {
        localStream,
        getMediaStream,
        stopMediaStream,
        toggleAudio,
        toggleVideo,
    } = useMediaStream();
    const { peer, peerRef, remoteStream, setRemoteStream, createPeer, destroyPeer } = useWebRTC();

    // Store ringtone audio
    const ringtoneAudioRef = useRef(null);

    // ICE candidate queue for handling race conditions
    // Candidates that arrive before peer is ready are queued here
    const pendingCandidatesRef = useRef([]);
    // Track if peer is ready to receive ICE candidates (after answer is signaled for caller)
    const peerReadyForCandidatesRef = useRef(false);

    // Audio element ref for speaker toggle
    const audioElementRef = useRef(null);
    // Available audio output devices
    const [audioOutputs, setAudioOutputs] = useState([]);
    // Current speaker mode (true = speaker, false = default/earpiece)
    const [isSpeakerMode, setIsSpeakerMode] = useState(false);

    // Ringtone helpers
    const playRingtone = useCallback(() => {
        // Ringtone disabled to avoid 404 errors
        // Uncomment when ringtone.mp3 is added to public/sounds/
        /*
        try {
            ringtoneAudioRef.current = new Audio("/sounds/ringtone.mp3");
            ringtoneAudioRef.current.loop = true;
            ringtoneAudioRef.current.play().catch((err) => {
                console.log("Ringtone play failed:", err);
            });
        } catch (err) {
            console.log("Ringtone error:", err);
        }
        */
    }, []);

    const stopRingtone = useCallback(() => {
        if (ringtoneAudioRef.current) {
            ringtoneAudioRef.current.pause();
            ringtoneAudioRef.current = null;
        }
    }, []);

    // ========== OUTGOING CALL ==========
    const startCall = useCallback(
        async (recipientUser, type = "audio") => {
            try {
                // Check if user is already on a call
                if (callStatus !== "idle") {
                    toast.warning("Already on a call");
                    return;
                }

                // Get media stream
                const stream = await getMediaStream(type);
                dispatch(setLocalStream(stream));

                // Generate call ID
                const callId = uuidv4();

                // Update Redux state
                dispatch(
                    initiateCall({
                        callId,
                        type,
                        recipient: recipientUser,
                    })
                );

                // Create peer connection (initiator)
                const newPeer = createPeer(stream, true);

                console.log("🔵 PEER CREATED (Caller):", newPeer);

                // Handle peer events
                newPeer.on("signal", (data) => {
                    console.log("🔵 SIGNAL EVENT:", data);

                    if (data.type === "offer") {
                        console.log("🔵 SENDING OFFER");
                        // Send offer to recipient via socket
                        socket.emit("call:initiate", {
                            to: recipientUser._id,
                            from: {
                                _id: authUser._id,
                                firstName: authUser.firstName,
                                lastName: authUser.lastName,
                                image: authUser.image,
                            },
                            callId,
                            type,
                            offer: data,
                        });
                        console.log("🔵 EMITTED call:initiate TO:", recipientUser._id);
                    } else if (data.type === "candidate") {
                        console.log("🔵 SENDING ICE CANDIDATE");
                        // Send ICE candidate separately
                        socket.emit("call:ice-candidate", {
                            to: recipientUser._id,
                            candidate: data,
                            callId,
                        });
                    }
                });

                newPeer.on("stream", (stream) => {
                    console.log("🟢 REMOTE STREAM RECEIVED:", stream);
                    console.log("🟢 Stream has audio tracks:", stream.getAudioTracks().length);
                    console.log("🟢 Stream has video tracks:", stream.getVideoTracks().length);
                    setRemoteStream(stream); // Update useWebRTC state
                    dispatch(setRemoteStreamAction(stream)); // Update Redux state
                    dispatch(callConnected());
                    stopRingtone();
                });

                newPeer.on("error", (err) => {
                    console.error("🔴 PEER ERROR:", err);
                    dispatch(setCallError(err.message));
                    toast.error("Connection error");
                    stopRingtone();
                    stopMediaStream();
                    destroyPeer();

                    // Reset ICE candidate queue and peer ready flag
                    pendingCandidatesRef.current = [];
                    peerReadyForCandidatesRef.current = false;

                    dispatch(endCall());
                    setTimeout(() => dispatch(resetCall()), 2000);
                });

                newPeer.on("close", () => {
                    console.log("🟠 PEER CONNECTION CLOSED");
                });

                newPeer.on("connect", () => {
                    console.log("🟢 PEER CONNECTED!");
                });

                // Play ringback tone
                playRingtone();
            } catch (err) {
                console.error("🔴 Error starting call:", err);
                if (err.name === "NotAllowedError") {
                    toast.error("Please allow camera/microphone access");
                } else {
                    toast.error("Failed to start call");
                }
                dispatch(setCallError(err.message));
            }
        },
        [
            authUser,
            callStatus,
            getMediaStream,
            createPeer,
            dispatch,
            playRingtone,
            stopRingtone,
            setRemoteStream,
        ]
    );

    // ========== INCOMING CALL ==========
    useEffect(() => {
        const handleIncomingCall = (data) => {
            const { from, callId, type, offer } = data;

            // Store incoming call data
            dispatch(
                receiveIncomingCall({
                    from,
                    callId,
                    type,
                    offer,
                })
            );

            // Play ringtone
            playRingtone();

            // Show notification
            toast.info(`Incoming ${type} call from ${from.firstName}`);
        };

        socket.on("call:incoming", handleIncomingCall);

        return () => {
            socket.off("call:incoming", handleIncomingCall);
        };
    }, [dispatch, playRingtone]);

    // ========== ACCEPT CALL ==========
    const handleAcceptCall = useCallback(async () => {
        try {
            if (!incomingCall) return;

            console.log("🟢 ACCEPTING CALL:", incomingCall);

            // Get media stream
            const stream = await getMediaStream(incomingCall.type);
            console.log("🟢 GOT MEDIA STREAM:", stream);
            dispatch(setLocalStream(stream));
            dispatch(acceptCall());

            // Create peer connection (not initiator)
            const newPeer = createPeer(stream, false);
            console.log("🟢 PEER CREATED (Receiver):", newPeer);

            // Process the offer
            console.log("🟢 SIGNALING OFFER:", incomingCall.offer);
            newPeer.signal(incomingCall.offer);

            // Receiver is ready for ICE candidates immediately after signaling offer
            peerReadyForCandidatesRef.current = true;
            console.log("🟢 Receiver peer marked as ready for ICE candidates");

            // Flush any ICE candidates that arrived while call was ringing
            if (pendingCandidatesRef.current.length > 0) {
                console.log(`🟢 Flushing ${pendingCandidatesRef.current.length} queued ICE candidates (Receiver)`);
                pendingCandidatesRef.current.forEach((candidate) => {
                    try {
                        newPeer.signal(candidate);
                        console.log("🟢 Queued ICE candidate signaled (Receiver)");
                    } catch (err) {
                        console.error("🔴 Error signaling queued ICE candidate (Receiver):", err);
                    }
                });
                pendingCandidatesRef.current = [];
            }

            // Handle peer events
            newPeer.on("signal", (data) => {
                console.log("🟢 SIGNAL EVENT:", data);

                if (data.type === "answer") {
                    console.log("🟢 SENDING ANSWER");
                    // Send answer to caller
                    socket.emit("call:accept", {
                        to: incomingCall.from._id,
                        answer: data,
                        callId: incomingCall.callId,
                    });
                    console.log("🟢 EMITTED call:accept TO:", incomingCall.from._id);
                } else if (data.type === "candidate") {
                    console.log("🟢 SENDING ICE CANDIDATE");
                    // Send ICE candidate separately
                    socket.emit("call:ice-candidate", {
                        to: incomingCall.from._id,
                        candidate: data,
                        callId: incomingCall.callId,
                    });
                }
            });

            newPeer.on("stream", (stream) => {
                console.log("🟢 REMOTE STREAM RECEIVED:", stream);
                console.log("🟢 Stream has audio tracks:", stream.getAudioTracks().length);
                console.log("🟢 Stream has video tracks:", stream.getVideoTracks().length);
                setRemoteStream(stream); // Update useWebRTC state
                dispatch(setRemoteStreamAction(stream)); // Update Redux state
                dispatch(callConnected());
            });

            newPeer.on("error", (err) => {
                console.error("🔴 PEER ERROR (Receiver):", err);
                dispatch(setCallError(err.message));
                toast.error("Connection error");
                stopRingtone();
                stopMediaStream();
                destroyPeer();

                // Reset ICE candidate queue and peer ready flag
                pendingCandidatesRef.current = [];
                peerReadyForCandidatesRef.current = false;

                dispatch(endCall());
                setTimeout(() => dispatch(resetCall()), 2000);
            });

            newPeer.on("close", () => {
                console.log("🟠 PEER CONNECTION CLOSED (Receiver)");
            });

            newPeer.on("connect", () => {
                console.log("🟢 PEER CONNECTED! (Receiver)");
            });

            stopRingtone();
        } catch (err) {
            console.error("🔴 Error accepting call:", err);
            if (err.name === "NotAllowedError") {
                toast.error("Please allow camera/microphone access");
            } else {
                toast.error("Failed to accept call");
            }
            dispatch(setCallError(err.message));
            stopRingtone();
            dispatch(rejectCall());
        }
    }, [
        incomingCall,
        getMediaStream,
        createPeer,
        dispatch,
        stopRingtone,
        setRemoteStream,
    ]);

    // ========== HANDLE CALL ACCEPTED ==========
    useEffect(() => {
        console.log("🔵 Setting up call:accepted listener, peerRef exists:", !!peerRef.current);

        const handleCallAccepted = ({ answer, callId }) => {
            console.log("🔵 CALL ACCEPTED EVENT RECEIVED!");
            console.log("🔵 Answer:", answer);
            console.log("🔵 Call ID:", callId);
            console.log("🔵 PeerRef.current exists:", !!peerRef.current);

            if (peerRef.current) {
                console.log("🔵 SIGNALING ANSWER to peer");
                try {
                    peerRef.current.signal(answer);
                    console.log("🔵 Answer signaled successfully");

                    // Now peer is ready to receive ICE candidates
                    peerReadyForCandidatesRef.current = true;

                    // Flush any queued ICE candidates
                    if (pendingCandidatesRef.current.length > 0) {
                        console.log(`🔵 Flushing ${pendingCandidatesRef.current.length} queued ICE candidates`);
                        pendingCandidatesRef.current.forEach((candidate) => {
                            try {
                                peerRef.current.signal(candidate);
                                console.log("🔵 Queued ICE candidate signaled");
                            } catch (err) {
                                console.error("🔴 Error signaling queued ICE candidate:", err);
                            }
                        });
                        pendingCandidatesRef.current = [];
                    }
                } catch (err) {
                    console.error("🔴 Error signaling answer:", err);
                }
            } else {
                console.error("🔴 NO PEER to signal answer to!");
            }
        };

        socket.on("call:accepted", handleCallAccepted);

        console.log("🔵 call:accepted listener registered");

        return () => {
            console.log("🔵 Removing call:accepted listener");
            socket.off("call:accepted", handleCallAccepted);
        };
    }, [peerRef]);

    // ========== HANDLE CALL REJECTED ==========
    useEffect(() => {
        const handleCallRejected = () => {
            toast.info("Call was rejected");
            stopRingtone();
            stopMediaStream();
            destroyPeer();

            // Reset ICE candidate queue and peer ready flag
            pendingCandidatesRef.current = [];
            peerReadyForCandidatesRef.current = false;

            dispatch(endCall());
            setTimeout(() => {
                dispatch(resetCall());
            }, 2000);
        };

        socket.on("call:rejected", handleCallRejected);

        return () => {
            socket.off("call:rejected", handleCallRejected);
        };
    }, [stopRingtone, stopMediaStream, destroyPeer, dispatch]);

    // ========== ICE CANDIDATES ==========
    useEffect(() => {
        const handleIceCandidate = ({ candidate }) => {
            console.log("🔵 ICE CANDIDATE received, peerReady:", peerReadyForCandidatesRef.current);

            if (peerRef.current && peerReadyForCandidatesRef.current) {
                // Peer is ready, signal immediately
                try {
                    peerRef.current.signal(candidate);
                    console.log("🔵 ICE candidate signaled immediately");
                } catch (err) {
                    console.error("Error processing ICE candidate:", err);
                }
            } else if (peerRef.current) {
                // Peer exists but not ready yet (waiting for answer to be signaled)
                // Queue the candidate for later
                console.log("🔵 Queuing ICE candidate (peer not ready yet)");
                pendingCandidatesRef.current.push(candidate);
            } else {
                console.warn("🔵 No peer to handle ICE candidate, queuing anyway");
                pendingCandidatesRef.current.push(candidate);
            }
        };

        socket.on("call:ice-candidate", handleIceCandidate);

        return () => {
            socket.off("call:ice-candidate", handleIceCandidate);
        };
    }, [peerRef]);

    // ========== REJECT CALL ==========
    const handleRejectCall = useCallback(() => {
        if (!incomingCall) return;

        socket.emit("call:reject", {
            to: incomingCall.from._id,
            callId: incomingCall.callId,
        });

        dispatch(rejectCall());
        stopRingtone();
    }, [incomingCall, dispatch, stopRingtone]);

    // ========== END CALL ==========
    const handleEndCall = useCallback(() => {
        if (activeCall) {
            const recipientId = activeCall.isOutgoing
                ? recipient?._id
                : caller?._id;

            if (recipientId) {
                socket.emit("call:end", {
                    to: recipientId,
                    callId: activeCall.callId,
                });
            }
        }

        // Clean up
        stopRingtone();
        stopMediaStream();
        destroyPeer();

        // Reset ICE candidate queue and peer ready flag
        pendingCandidatesRef.current = [];
        peerReadyForCandidatesRef.current = false;

        dispatch(endCall());

        // Reset after showing "ended" status
        setTimeout(() => {
            dispatch(resetCall());
        }, 2000);
    }, [
        activeCall,
        recipient,
        caller,
        stopRingtone,
        stopMediaStream,
        destroyPeer,
        dispatch,
    ]);

    // ========== HANDLE CALL ENDED BY OTHER USER ==========
    useEffect(() => {
        const handleCallEnded = () => {
            toast.info("Call ended");
            stopRingtone();
            stopMediaStream();
            destroyPeer();

            // Reset ICE candidate queue and peer ready flag
            pendingCandidatesRef.current = [];
            peerReadyForCandidatesRef.current = false;

            dispatch(endCall());
            setTimeout(() => {
                dispatch(resetCall());
            }, 2000);
        };

        socket.on("call:ended", handleCallEnded);

        return () => {
            socket.off("call:ended", handleCallEnded);
        };
    }, [stopRingtone, stopMediaStream, destroyPeer, dispatch]);

    // ========== SPEAKER TOGGLE ==========
    // Set the audio element reference (called from CallWindow)
    const setAudioElement = useCallback((element) => {
        audioElementRef.current = element;
        console.log("🔊 Audio element registered:", !!element);

        // Enumerate available audio outputs when element is set
        if (element && navigator.mediaDevices?.enumerateDevices) {
            navigator.mediaDevices.enumerateDevices()
                .then((devices) => {
                    const outputs = devices.filter(d => d.kind === "audiooutput");
                    setAudioOutputs(outputs);
                    console.log("🔊 Available audio outputs:", outputs.map(d => d.label || d.deviceId));
                })
                .catch((err) => {
                    console.warn("🔊 Could not enumerate devices:", err);
                });
        }
    }, []);

    // Toggle between speaker and default audio output
    const toggleSpeaker = useCallback(async () => {
        const audioElement = audioElementRef.current;

        if (!audioElement) {
            console.warn("🔊 No audio element available for speaker toggle");
            toast.info("Audio not ready yet");
            return;
        }

        // Check if setSinkId is supported
        if (typeof audioElement.setSinkId !== "function") {
            console.warn("🔊 setSinkId not supported in this browser");
            // Still update the state for visual feedback
            setIsSpeakerMode(!isSpeakerMode);
            dispatch(toggleSpeakerAction());
            toast.info(isSpeakerMode ? "Earpiece mode (visual only)" : "Speaker mode (visual only)");
            return;
        }

        try {
            if (isSpeakerMode) {
                // Switch back to default output (earpiece/default)
                await audioElement.setSinkId("");
                setIsSpeakerMode(false);
                dispatch(toggleSpeakerAction());
                console.log("🔊 Switched to default audio output");
                toast.success("Earpiece mode");
            } else {
                // Try to find and switch to speakers
                // Look for a device with "speaker" in the label, or use default
                const speakerDevice = audioOutputs.find(
                    (d) => d.label.toLowerCase().includes("speaker")
                ) || audioOutputs.find(
                    (d) => d.deviceId === "default" || d.deviceId === ""
                ) || audioOutputs[0];

                if (speakerDevice) {
                    await audioElement.setSinkId(speakerDevice.deviceId);
                    setIsSpeakerMode(true);
                    dispatch(toggleSpeakerAction());
                    console.log("🔊 Switched to speaker:", speakerDevice.label || speakerDevice.deviceId);
                    toast.success("Speaker mode");
                } else {
                    // No specific speaker found, just toggle state
                    setIsSpeakerMode(true);
                    dispatch(toggleSpeakerAction());
                    toast.info("Speaker mode enabled");
                }
            }
        } catch (err) {
            console.error("🔊 Error toggling speaker:", err);
            // Still update state for visual feedback
            setIsSpeakerMode(!isSpeakerMode);
            dispatch(toggleSpeakerAction());
            toast.info(isSpeakerMode ? "Earpiece mode" : "Speaker mode");
        }
    }, [isSpeakerMode, audioOutputs, dispatch]);

    return {
        startCall,
        handleAcceptCall,
        handleRejectCall,
        handleEndCall,
        toggleAudio,
        toggleVideo,
        toggleSpeaker,
        setAudioElement,
        isSpeakerMode,
        callStatus,
        localStream,
        remoteStream,
    };
};
