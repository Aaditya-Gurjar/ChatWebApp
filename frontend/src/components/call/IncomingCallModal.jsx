import React from "react";
import { useSelector } from "react-redux";
import { useCall } from "../../context/CallContext";
import { MdCall, MdCallEnd, MdVideocam } from "react-icons/md";

const IncomingCallModal = () => {
    const { incomingCall } = useSelector((store) => store.call);
    const { handleAcceptCall, handleRejectCall } = useCall();

    if (!incomingCall) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-8 max-w-md w-full mx-4 border border-slate-600 shadow-2xl">
                <div className="text-center">
                    <img
                        src={incomingCall.from.image}
                        alt={incomingCall.from.firstName}
                        className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-blue-500 animate-pulse"
                    />
                    <h2 className="text-2xl font-bold text-white mb-2">
                        {incomingCall.from.firstName} {incomingCall.from.lastName}
                    </h2>
                    <p className="text-slate-300 mb-6">
                        Incoming {incomingCall.type} call...
                    </p>
                </div>

                <div className="flex gap-4 justify-center">
                    {/* Reject Button */}
                    <button
                        onClick={handleRejectCall}
                        className="bg-red-600 hover:bg-red-700 text-white rounded-full p-6 transition-all shadow-lg hover:shadow-red-500/50"
                        title="Reject Call"
                    >
                        <MdCallEnd fontSize={32} />
                    </button>
                    {/* Accept Button */}
                    <button
                        onClick={handleAcceptCall}
                        className="bg-green-600 hover:bg-green-700 text-white rounded-full p-6 transition-all shadow-lg hover:shadow-green-500/50 animate-bounce"
                        title="Accept Call"
                    >
                        {incomingCall.type === "video" ? (
                            <MdVideocam fontSize={32} />
                        ) : (
                            <MdCall fontSize={32} />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default IncomingCallModal;
