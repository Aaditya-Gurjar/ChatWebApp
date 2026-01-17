import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { useCallManager } from "../../hooks/useCallManager";
import { toggleMute, toggleVideo } from "../../redux/slices/callSlice";
import {
    MdMic,
    MdMicOff,
    MdVideocam,
    MdVideocamOff,
    MdCallEnd,
} from "react-icons/md";

const CallControls = () => {
    const dispatch = useDispatch();
    const { isMuted, isVideoEnabled, callType } = useSelector(
        (store) => store.call
    );
    const { handleEndCall, toggleAudio, toggleVideo: toggleVideoStream } =
        useCallManager();

    const handleToggleMute = () => {
        toggleAudio();
        dispatch(toggleMute());
    };

    const handleToggleVideo = () => {
        toggleVideoStream();
        dispatch(toggleVideo());
    };

    return (
        <div className="bg-slate-900/90 backdrop-blur-sm p-6 flex justify-center gap-6">
            {/* Mute/Unmute */}
            <button
                onClick={handleToggleMute}
                className={`rounded-full p-4 transition-all text-white ${isMuted
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-slate-700 hover:bg-slate-600"
                    }`}
                title={isMuted ? "Unmute" : "Mute"}
            >
                {isMuted ? <MdMicOff fontSize={24} /> : <MdMic fontSize={24} />}
            </button>

            {/* Video Toggle (only for video calls) */}
            {callType === "video" && (
                <button
                    onClick={handleToggleVideo}
                    className={`rounded-full p-4 transition-all text-white ${!isVideoEnabled
                            ? "bg-red-600 hover:bg-red-700"
                            : "bg-slate-700 hover:bg-slate-600"
                        }`}
                    title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
                >
                    {isVideoEnabled ? (
                        <MdVideocam fontSize={24} />
                    ) : (
                        <MdVideocamOff fontSize={24} />
                    )}
                </button>
            )}

            {/* End Call */}
            <button
                onClick={handleEndCall}
                className="bg-red-600 hover:bg-red-700 rounded-full p-4 transition-all text-white"
                title="End Call"
            >
                <MdCallEnd fontSize={24} />
            </button>
        </div>
    );
};

export default CallControls;
