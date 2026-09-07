import React from 'react';

/**
 * TransitionRouter: Provides instantaneous zero-latency navigation
 * between panel views without artificial unmount delays or blank screen flashes.
 */
const TransitionRouter: React.FC = ({ children }) => {
    return <>{children}</>;
};

export default TransitionRouter;
