import React from 'react';

interface StatusIndicatorProps {
  backendStatus: string;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ backendStatus }) => {
  return (
    <div className="mt-2 p-2 bg-gray-800 rounded-md text-sm">
      Backend Status: <span className="font-semibold text-yellow-300">{backendStatus}</span>
    </div>
  );
};
export default StatusIndicator;
