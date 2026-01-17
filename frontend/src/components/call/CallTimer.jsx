import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";

const CallTimer = () => {
    const { callStartTime } = useSelector((store) => store.call);
    const [duration, setDuration] = useState(0);

    useEffect(() => {
        if (!callStartTime) return;

        const interval = setInterval(() => {
            setDuration(Math.floor((Date.now() - callStartTime) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [callStartTime]);

    const formatTime = (seconds) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
        }
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    return <span className="text-white">{formatTime(duration)}</span>;
};

export default CallTimer;
