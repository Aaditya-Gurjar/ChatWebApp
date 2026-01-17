import { useCallback, useEffect, useRef } from "react";
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
    setRemoteStream,
    setCallError,
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
    const { peer, remoteStream, createPeer, destroyPeer } = useWebRTC();

    // Store ringtone audio
    const ringtoneAudioRef = useRef(null);

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
                    dispatch(setRemoteStream(stream));
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
                dispatch(setRemoteStream(stream));
                dispatch(callConnected());
            });

            newPeer.on("error", (err) => {
                console.error("🔴 PEER ERROR (Receiver):", err);
                dispatch(setCallError(err.message));
                toast.error("Connection error");
                stopRingtone();
                stopMediaStream();
                destroyPeer();
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
    ]);

    // ========== HANDLE CALL ACCEPTED ==========
    useEffect(() => {
        const handleCallAccepted = ({ answer }) => {
            console.log("🔵 CALL ACCEPTED - Answer received:", answer);
            if (peer) {
                console.log("🔵 SIGNALING ANSWER to peer");
                peer.signal(answer);
            } else {
                console.error("🔴 NO PEER to signal answer to!");
            }
        };

        socket.on("call:accepted", handleCallAccepted);

        return () => {
            socket.off("call:accepted", handleCallAccepted);
        };
    }, [peer]);

    // ========== HANDLE CALL REJECTED ==========
    useEffect(() => {
        const handleCallRejected = () => {
            toast.info("Call was rejected");
            stopRingtone();
            stopMediaStream();
            destroyPeer();
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
            if (peer) {
                try {
                    peer.signal(candidate);
                } catch (err) {
                    console.error("Error processing ICE candidate:", err);
                }
            }
        };

        socket.on("call:ice-candidate", handleIceCandidate);

        return () => {
            socket.off("call:ice-candidate", handleIceCandidate);
        };
    }, [peer]);

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

    return {
        startCall,
        handleAcceptCall,
        handleRejectCall,
        handleEndCall,
        toggleAudio,
        toggleVideo,
        callStatus,
        localStream,
        remoteStream,
    };
};
