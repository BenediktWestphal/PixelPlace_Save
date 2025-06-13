import { useState, useEffect, useCallback } from 'react'; // Removed React
import Cookies from 'js-cookie';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import io, { Socket } from 'socket.io-client';
import './App.css';
import Canvas from './components/Canvas';
import ColorPalette from './components/ColorPalette';
import Timer from './components/Timer';

export interface Pixel {
  x: number;
  y: number;
  color: string;
  // Optional: Add userId and timestamp if you want to display more info later
  // userId?: string;
  // timestamp?: string;
}

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001/api';
const SOCKET_URL = import.meta.env.VITE_BACKEND_URL ?
                     import.meta.env.VITE_BACKEND_URL.replace('/api', '') :
                     'http://localhost:3001';

const CANVAS_WIDTH = 100;
const CANVAS_HEIGHT = 100;
const PIXEL_SIZE = 6;
const COOLDOWN_SECONDS = 1;

function App() {
  const [backendStatus, setBackendStatus] = useState("Loading...");
  const [socketStatus, setSocketStatus] = useState("Disconnected");
  const [selectedColor, setSelectedColor] = useState<string>("#FFFFFF");
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [cooldownTime, setCooldownTime] = useState<number>(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [isPlacingPixel, setIsPlacingPixel] = useState<boolean>(false);
  const [placingPixelError, setPlacingPixelError] = useState<string | null>(null); // Corrected variable name

  // Effect for User ID Initialization:
  // Checks for an existing user ID in cookies on component mount.
  // If not found, generates a new UUID, stores it in cookies, and sets it in state.
  useEffect(() => {
    let currentUserId = Cookies.get('rPlaceCloneUserId');
    if (!currentUserId) {
      currentUserId = uuidv4();
      Cookies.set('rPlaceCloneUserId', currentUserId, { expires: 365 });
    }
    setUserId(currentUserId);
  }, []);

  // Effect for Initial Data Fetching:
  // Fetches backend health status and initial pixel data when the component mounts.
  useEffect(() => {
    axios.get(`${API_BASE_URL}/health`)
      .then(response => setBackendStatus(response.data.message || "Backend connected"))
      .catch(err => {
        console.error("Health check failed:", err);
        setBackendStatus("Backend connection failed.");
      });

    axios.get(`${API_BASE_URL}/pixels`)
      .then(response => {
        setPixels(response.data);
      })
      .catch(err => console.error("Failed to fetch pixels:", err));
  }, []);

  // Effect for Socket.IO Connection and Event Handling:
  // Establishes and manages the Socket.IO connection for real-time updates.
  useEffect(() => {
    if (!SOCKET_URL) {
      console.warn("Socket URL is not defined. Real-time updates disabled.");
      setSocketStatus("Disabled (URL missing)");
      return;
    }

    const socket: Socket = io(SOCKET_URL, {
      reconnectionAttempts: 5,
      transports: ['websocket']
    });

    socket.on('connect', () => {
      // Reconstructing template literals to avoid potential hidden characters
      const socketIdShort = socket.id ? socket.id.substring(0,5) : 'N/A';
      setSocketStatus('Connected (' + socketIdShort + '...)');
      console.log('Socket.io connected:', socket.id);
    });

    socket.on('disconnect', (reason: string) => {
      setSocketStatus('Disconnected (' + reason + ')');
      console.log('Socket.io disconnected:', reason);
    });

    socket.on('connect_error', (error: Error) => {
      const errorMessage = error.message ? error.message.substring(0, 30) : 'Unknown error';
      setSocketStatus('Connection Error: ' + errorMessage + '...');
      console.error('Socket.io connection error:', error);
    });

    socket.on('welcome', (message: string) => {
      console.log('Socket.io welcome message:', message);
    });

    socket.on('pixel_updated', (updatedPixel: Pixel) => {
      setPixels(prevPixels => {
        const newPixels = [...prevPixels];
        const existingPixelIndex = newPixels.findIndex(p => p.x === updatedPixel.x && p.y === updatedPixel.y);
        if (existingPixelIndex > -1) {
          newPixels[existingPixelIndex] = updatedPixel; // Update existing pixel
        } else {
          newPixels.push(updatedPixel); // Add new pixel
        }
        return newPixels;
      });
    });

    // Cleanup function: Disconnects the socket when the component unmounts.
    return () => {
      console.log("Disconnecting socket.io");
      socket.disconnect();
    };
  }, [SOCKET_URL]); // Dependency: SOCKET_URL ensures re-connection if it were to change.

  // Effect for Cooldown Timer:
  // Manages the countdown timer when `cooldownTime` is greater than 0.
  useEffect(() => {
    if (cooldownTime > 0) {
      const timerId = setInterval(() => {
        setCooldownTime(prevTime => prevTime - 1);
      }, 1000);
      // Cleanup function: Clears the interval when the component unmounts or cooldownTime changes.
      return () => clearInterval(timerId);
    }
  }, [cooldownTime]); // Dependency: cooldownTime triggers this effect.

  // Handler for color selection from the palette
  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
  };

  // Handler for clicking a pixel on the canvas
  // Validates user state, cooldown, and then attempts to place a pixel via API.
  const handlePixelClick = useCallback(async (x: number, y: number) => {
    // Ensure user ID is available
    if (!userId) {
      setPlacingPixelError("User ID not available. Please refresh.");
      return;
    }
    // Check if cooldown is active
    if (cooldownTime > 0) {
      setPlacingPixelError("Please wait for the cooldown (" + cooldownTime + "s left).");
      return;
    }
    // Prevent multiple submissions if one is already in progress
    if (isPlacingPixel) {
      return;
    }

    setIsPlacingPixel(true); // Set loading state
    setPlacingPixelError(null); // Clear previous errors

    try {
      // Make API call to place the pixel
      const response = await axios.post(API_BASE_URL + '/pixels', {
        x: x, y: y, color: selectedColor, userId: userId, isAdmin: true,
      });

      // Handle successful pixel placement
      if (response.status === 201) {
        // Optimistic update (also handled by Socket.IO, but good for immediate user feedback)
        setPixels(prevPixels => {
          const newPixels = [...prevPixels];
          const existingPixelIndex = newPixels.findIndex(p => p.x === x && p.y === y);
          if (existingPixelIndex > -1) {
            newPixels[existingPixelIndex] = { x: x, y: y, color: selectedColor };
          } else {
            newPixels.push({ x: x, y: y, color: selectedColor });
          }
          return newPixels;
        });
        setCooldownTime(COOLDOWN_SECONDS); // Start cooldown timer
      }
    } catch (error: any) { // Explicitly type error
      // Handle errors during pixel placement
      console.error('Error placing pixel:', error);
      if (axios.isAxiosError(error) && error.response) {
        if (error.response.status === 429) { // Rate limit error
             const timeLeft = error.response.data.timeLeftSec || COOLDOWN_SECONDS;
             setCooldownTime(timeLeft); // Sync cooldown with server
             setPlacingPixelError(error.response.data.error || "Rate limit exceeded.");
        } else { // Other API errors
            setPlacingPixelError(error.response.data.error || "Failed to place pixel.");
        }
      } else { // Unexpected errors
        setPlacingPixelError("An unexpected error occurred.");
      }
    } finally {
      setIsPlacingPixel(false); // Reset loading state
    }
  }, [userId, selectedColor, cooldownTime, isPlacingPixel, API_BASE_URL, COOLDOWN_SECONDS]); // Ensure all dependencies are listed, including constants used inside.

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 font-sans">
      <header className="w-full max-w-5xl mb-6 text-center">
        <h1 className="text-5xl font-bold text-cyan-400 tracking-tight">PixelPlace</h1>
        <p className="text-lg text-gray-400 mt-1">Collaborate one pixel at a time. (<span className="text-xs text-gray-500">UserID: {userId?.substring(0,8)}...</span>)</p>
        <div className="mt-3 p-2 bg-gray-800 rounded-md text-sm shadow">
          API Status: <span className="font-semibold text-yellow-300">{backendStatus}</span> |
          Socket Status: <span className="font-semibold text-yellow-300">{socketStatus}</span>
        </div>
      </header>

      <main className="w-full max-w-5xl flex flex-col lg:flex-row gap-6">
        <div className="flex-grow flex flex-col items-center justify-start">
          <div className="w-full overflow-x-auto pb-2">
            <Canvas
              pixels={pixels}
              onPixelClick={handlePixelClick}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              pixelSize={PIXEL_SIZE}
              disabled={cooldownTime > 0 || isPlacingPixel}
            />
          </div>
          {placingPixelError && (
            <div className="mt-2 text-center p-2 bg-red-800 text-red-200 rounded-md text-sm">
              {placingPixelError}
            </div>
          )}
           {isPlacingPixel && !placingPixelError && (
            <div className="mt-2 text-center p-2 bg-blue-800 text-blue-200 rounded-md text-sm">
              Placing pixel...
            </div>
          )}
        </div>
        <aside className="w-full lg:w-72 flex flex-col gap-6">
          <div className="bg-gray-800 p-5 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-teal-300 border-b border-gray-700 pb-2">Color Palette</h2>
            <ColorPalette onSelectColor={handleColorSelect} />
            <div className="mt-4 text-sm text-gray-400">
              Selected: <span className="font-bold p-1 rounded" style={{ backgroundColor: selectedColor, color: selectedColor === '#000000' || selectedColor === '#0000FF' || selectedColor === '#800080' ? 'white': 'black' }}>{selectedColor}</span>
            </div>
          </div>
          <div className="bg-gray-800 p-5 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-orange-300 border-b border-gray-700 pb-2">Cooldown</h2>
            <Timer timeLeft={cooldownTime} />
          </div>
        </aside>
      </main>

      <footer className="mt-16 text-center text-gray-500 text-sm">
        <p>&copy; {new Date().getFullYear()} PixelPlace. Inspired by r/place.</p>
        {socketStatus.startsWith("Connected") ?
          <p className="text-green-400">Real-time updates active.</p> :
          <p className="text-yellow-500">Real-time updates connecting or disconnected. Manual refresh might be needed for others' changes.</p>
        }
      </footer>
    </div>
  );
}

export default App;
