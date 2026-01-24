import React, { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { useCall } from "../../context/CallContext";
import CallControls from "./CallControls";
import CallTimer from "./CallTimer";

const CallWindow = () => {
    const {
        callStatus,
        callType,
        caller,
        recipient,
        activeCall,
    } = useSelector((store) => store.call);
    const { localStream, remoteStream } = useCall();
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const remoteAudioRef = useRef(null); // For audio playback

    // Attach local stream to video element
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    // Attach remote stream to video/audio elements
    useEffect(() => {
        if (remoteStream) {
            console.log("🔊 ATTACHING REMOTE STREAM:", remoteStream);

            // For video calls, attach to video element
            if (remoteVideoRef.current && callType === "video") {
                remoteVideoRef.current.srcObject = remoteStream;
                console.log("🔊 ATTACHED TO VIDEO ELEMENT");
            }

            // Always attach to audio element for reliable playback
            if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = remoteStream;
                console.log("🔊 ATTACHED TO AUDIO ELEMENT");
                console.log("🔊 Audio tracks:", remoteStream.getAudioTracks());

                // Use async function with user gesture fallback for autoplay policy
                const playAudio = async () => {
                    try {
                        await remoteAudioRef.current.play();
                        console.log("🔊 Audio playback started successfully");
                    } catch (err) {
                        console.warn("🔊 Autoplay blocked, will play on user interaction:", err.name);
                        // Add one-time click listener to resume audio
                        const resumeAudio = () => {
                            remoteAudioRef.current?.play().catch(console.error);
                        };
                        document.addEventListener("click", resumeAudio, { once: true });
                    }
                };
                playAudio();
            }
        }
    }, [remoteStream, callType]);

    if (callStatus === "idle") return null;

    console.log("📱 CallWindow render - callStatus:", callStatus);
    console.log("📱 activeCall:", activeCall);
    console.log("📱 remoteStream exists:", !!remoteStream);

    const otherUser = activeCall?.isOutgoing ? recipient : caller;
    const isConnecting =
        callStatus === "initiating" || callStatus === "connecting";

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
            {/* Remote Video/Avatar */}
            <div className="flex-1 relative">
                {callType === "video" && remoteStream ? (
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                        <img
                            src={otherUser?.image}
                            alt={otherUser?.firstName}
                            className={`w-32 h-32 rounded-full mb-4 border-4 ${isConnecting
                                ? "border-yellow-500 animate-pulse"
                                : "border-blue-500"
                                }`}
                        />
                        <h2 className="text-3xl font-bold text-white mb-2">
                            {otherUser?.firstName} {otherUser?.lastName}
                        </h2>
                        <p className="text-slate-300 text-lg">
                            {isConnecting ? (
                                <span className="animate-pulse">
                                    {callStatus === "initiating"
                                        ? "Calling..."
                                        : "Connecting..."}
                                </span>
                            ) : (
                                <CallTimer />
                            )}
                        </p>
                    </div>
                )}

                {/* Local Video (Picture-in-Picture) */}
                {callType === "video" && localStream && (
                    <div className="absolute top-4 right-4 w-32 h-40 bg-black rounded-lg overflow-hidden border-2 border-white shadow-lg">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                            style={{ transform: "scaleX(-1)" }} // Mirror effect
                        />
                    </div>
                )}
            </div>

            {/* Hidden audio element for remote stream (ensures audio plays) */}
            <audio
                ref={remoteAudioRef}
                autoPlay
                playsInline
                style={{ display: "none" }}
            />

            {/* Call Controls */}
            <CallControls />
        </div>
    );
};

export default CallWindow;
