import React, { createContext, useContext } from 'react';
import { useCallManager } from '../hooks/useCallManager';

// Create context
const CallContext = createContext(null);

// Provider component
export const CallProvider = ({ children }) => {
    const callManager = useCallManager(); // ← Called ONCE for entire app

    return (
        <CallContext.Provider value={callManager}>
            {children}
        </CallContext.Provider>
    );
};

// Custom hook to access call manager
export const useCall = () => {
    const context = useContext(CallContext);
    if (!context) {
        throw new Error('useCall must be used within CallProvider');
    }
    return context;
};
