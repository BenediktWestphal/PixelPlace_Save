// import React from 'react'; // React is not explicitly needed in scope for JSX in modern React versions

const Timer = ({ timeLeft }: { timeLeft: number }) => {
  return (
    <div className="p-4 bg-gray-700 rounded text-center">
      {timeLeft > 0 ? (
        <p className="text-lg">Cooldown: <span className="font-bold text-xl">{timeLeft}s</span></p>
      ) : (
        <p className="text-lg text-green-400">Ready to place a pixel!</p>
      )}
    </div>
  );
};
export default Timer;
