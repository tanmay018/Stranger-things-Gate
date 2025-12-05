import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { handStateRef } from '../store';

const WebcamController: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let handLandmarker: HandLandmarker | null = null;
    let animationFrameId: number;

    const setupMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          // Use a recent stable version for WASM to avoid version mismatches
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });

        setIsLoaded(true);
        startCamera();
      } catch (err) {
        console.error("Failed to load MediaPipe:", err);
        setError("Failed to load vision models.");
      }
    };

    const startCamera = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' }
          });
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            // Use onloadeddata to ensure we don't try to predict before data exists
            videoRef.current.onloadeddata = () => {
                predictWebcam();
            };
          }
        } catch (err) {
          console.error("Camera access denied:", err);
          setError("Camera access required for interaction.");
        }
      } else {
         setError("Camera API not supported.");
      }
    };

    const predictWebcam = () => {
      if (!handLandmarker || !videoRef.current) return;
      
      // Ensure video is ready and has dimensions
      if (videoRef.current.readyState < 2) {
          animationFrameId = requestAnimationFrame(predictWebcam);
          return;
      }

      const nowInMs = Date.now();
      const results = handLandmarker.detectForVideo(videoRef.current, nowInMs);

      if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        
        // Calculate "openness"
        const wrist = landmarks[0];
        const tips = [landmarks[4], landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
        
        // Average distance of tips from wrist
        const avgDist = tips.reduce((acc, tip) => {
             return acc + Math.sqrt(Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2));
        }, 0) / 5;

        // Thresholds derived empirically for normalized coordinates
        const minVal = 0.2;
        const maxVal = 0.45;
        const rawOpenness = Math.min(Math.max((avgDist - minVal) / (maxVal - minVal), 0), 1);

        // Update global store
        if (handStateRef.current) {
          handStateRef.current.openness = rawOpenness;
          handStateRef.current.isOpen = rawOpenness > 0.5;
          // Invert X because webcam is mirrored visually
          handStateRef.current.position = { 
            x: (1 - landmarks[9].x) * 2 - 1, // Map 0..1 to -1..1 centered
            y: -(landmarks[9].y * 2 - 1),   // Invert Y
            z: landmarks[9].z 
          };
        }
      } else {
        // No hand detected, slowly close
        if (handStateRef.current) {
             handStateRef.current.openness = Math.max(0, handStateRef.current.openness - 0.05);
             handStateRef.current.isOpen = handStateRef.current.openness > 0.5;
        }
      }

      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    setupMediaPipe();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
      cancelAnimationFrame(animationFrameId);
      if (handLandmarker) handLandmarker.close();
    };
  }, []);

  return (
    <div className="absolute top-4 right-4 z-50 opacity-50 hover:opacity-100 transition-opacity pointer-events-none">
      <video 
        ref={videoRef} 
        className="w-32 h-24 object-cover rounded border border-red-900 bg-black" 
        autoPlay 
        playsInline 
        muted
        style={{ transform: 'scaleX(-1)' }} // Mirror visual
      />
      {!isLoaded && !error && <div className="text-red-500 text-xs mt-1 font-bold animate-pulse">Initializing Vision...</div>}
      {error && <div className="text-red-500 text-xs mt-1 font-bold bg-black/80 p-1 rounded">{error}</div>}
    </div>
  );
};

export default WebcamController;