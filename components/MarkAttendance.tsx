import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User } from '../src/types';
import {
  getStudentByPin,
  getDistanceInKm,
  CAMPUS_LAT,
  CAMPUS_LON,
  CAMPUS_RADIUS_KM,
  markAttendance as apiMarkAttendance,
  verifyStudentFace,
} from '../src/services';
import { loadFaceModels, areFaceModelsLoaded } from '../src/faceRecognition';

type Step = 'idle' | 'loading-models' | 'ready' | 'verifying-location' | 'verifying-face' | 'marking' | 'success' | 'error';

interface StatusMessage {
  type: 'info' | 'success' | 'error' | 'warning';
  text: string;
}

export default function MarkAttendance() {
  const [pin, setPin] = useState('');
  const [student, setStudent] = useState<User | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [modelsReady, setModelsReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ─── Load face models on mount ────────────────────────────────────────────
  useEffect(() => {
    if (areFaceModelsLoaded()) {
      setModelsReady(true);
      return;
    }
    setStep('loading-models');
    setStatus({ type: 'info', text: 'Loading face recognition models...' });
    loadFaceModels()
      .then(() => {
        setModelsReady(true);
        setStep('idle');
        setStatus({ type: 'success', text: 'Face recognition ready.' });
        setTimeout(() => setStatus(null), 2000);
      })
      .catch(err => {
        setStep('error');
        setStatus({ type: 'error', text: `Failed to load face models: ${err.message}` });
      });
  }, []);

  // ─── Camera ───────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err: any) {
      let message = 'Could not access camera. Please check permissions.';
      if (err?.name === 'NotAllowedError') message = 'Camera access denied. Grant permission in browser settings.';
      else if (err?.name === 'NotFoundError') message = 'No camera found on this device.';
      setStatus({ type: 'error', text: message });
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (student) startCamera();
    return () => stopCamera();
  }, [student, startCamera, stopCamera]);

  // ─── Load Student ─────────────────────────────────────────────────────────
  const loadStudent = async () => {
    if (!pin.trim()) return;
    setStatus({ type: 'info', text: 'Looking up student...' });
    const studentData = await getStudentByPin(pin.trim());
    if (!studentData) {
      setStatus({ type: 'error', text: 'Student PIN not found.' });
      setStudent(null);
    } else if (!studentData.referenceImageUrl) {
      setStatus({ type: 'error', text: 'Student has no reference photo registered. Cannot verify face.' });
      setStudent(null);
    } else {
      setStudent(studentData);
      setStatus({ type: 'success', text: `Found: ${studentData.name}` });
    }
  };

  // ─── Capture Photo ────────────────────────────────────────────────────────
  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (blob) {
        setPhoto(blob);
        setStatus({ type: 'info', text: 'Photo captured. Click "Verify & Mark" to continue.' });
      }
    }, 'image/jpeg', 0.9);
  };

  // ─── Full Attendance Flow ─────────────────────────────────────────────────
  const markAndVerify = async () => {
    if (!student || !photo) return;

    try {
      // Step 1: Geolocation
      setStep('verifying-location');
      setStatus({ type: 'info', text: 'Getting your location...' });

      let coordinates: { latitude: number; longitude: number } | null = null;
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
        );
        coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };

        const distance = getDistanceInKm(coordinates.latitude, coordinates.longitude, CAMPUS_LAT, CAMPUS_LON);
        const onCampus = distance <= CAMPUS_RADIUS_KM;

        if (!onCampus) {
          const distanceMeters = (distance * 1000).toFixed(0);
          const proceed = window.confirm(
            `You are approximately ${distanceMeters}m off-campus (allowed: ${CAMPUS_RADIUS_KM * 1000}m). Proceed anyway?`
          );
          if (!proceed) {
            setStep('ready');
            setStatus({ type: 'warning', text: 'Attendance cancelled: off-campus.' });
            return;
          }
        }
      } catch (err: any) {
        let msg = 'Could not get location. Attendance requires location access.';
        if (err?.code === 1) msg = 'Location access denied. Please grant permission and try again.';
        if (err?.code === 3) msg = 'Location request timed out. Check your connection.';
        setStep('ready');
        setStatus({ type: 'error', text: msg });
        return;
      }

      // Step 2: Face Verification
      setStep('verifying-face');
      setStatus({ type: 'info', text: 'Verifying face... (this may take a moment)' });

      const faceResult = await verifyStudentFace(student, photo);

      if (!faceResult.isMatch) {
        setStep('ready');
        setStatus({
          type: 'error',
          text: `Face verification failed: ${faceResult.reason}`,
        });
        return;
      }

      // Step 3: Mark Attendance
      setStep('marking');
      setStatus({ type: 'info', text: 'Marking attendance...' });

      await apiMarkAttendance(student.id, coordinates);

      setStep('success');
      setStatus({
        type: 'success',
        text: `✅ Attendance marked for ${student.name}! Confidence: ${faceResult.confidence}%`,
      });

      // Reset after success
      setTimeout(() => {
        setPin('');
        setStudent(null);
        setPhoto(null);
        setStep('idle');
        setStatus(null);
      }, 3000);

    } catch (err: any) {
      console.error('Attendance error:', err);
      setStep('error');
      setStatus({ type: 'error', text: `Error: ${err.message || 'Something went wrong.'}` });
    }
  };

  const isProcessing = ['verifying-location', 'verifying-face', 'marking', 'loading-models'].includes(step);

  const statusColors = {
    info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200',
    success: 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200',
    error: 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200',
    warning: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200',
  };

  const inputClass = 'mt-1 block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-slate-900 dark:text-white';
  const btnClass = 'font-semibold py-2 px-4 rounded-lg transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="p-6 text-slate-900 dark:text-white max-w-4xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Mark Attendance</h2>

      {/* Status Banner */}
      {status && (
        <div className={`mb-4 p-3 rounded-lg border text-sm font-medium ${statusColors[status.type]}`}>
          {isProcessing && (
            <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2 align-middle" />
          )}
          {status.text}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: Student lookup + camera */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Student PIN
          </label>
          <div className="flex gap-2 mt-1">
            <input
              placeholder="Enter student PIN"
              value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadStudent()}
              disabled={isProcessing}
              className={inputClass}
            />
            <button
              onClick={loadStudent}
              disabled={isProcessing || !pin.trim()}
              className={`${btnClass} bg-primary-600 text-white hover:bg-primary-700 px-4`}
            >
              Find
            </button>
          </div>

          {student && (
            <div className="mt-4 space-y-3">
              {/* Student info card */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                {student.imageUrl && (
                  <img src={student.imageUrl} alt={student.name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-primary-400" />
                )}
                <div>
                  <p className="font-bold text-lg">{student.name}</p>
                  <p className="text-sm text-slate-500">{student.pin} · {student.branch} · Year {student.year}</p>
                </div>
              </div>

              {/* Camera */}
              <div className="relative">
                <video ref={videoRef} autoPlay playsInline muted
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-black"
                  style={{ maxHeight: '280px', objectFit: 'cover' }} />
                <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  📷 Live Camera
                </div>
              </div>
              <canvas ref={canvasRef} className="hidden" />

              <button
                onClick={capture}
                disabled={isProcessing}
                className={`${btnClass} w-full bg-slate-700 dark:bg-slate-600 text-white hover:bg-slate-800`}
              >
                📸 Capture Photo
              </button>

              {photo && (
                <button
                  onClick={markAndVerify}
                  disabled={isProcessing || !modelsReady}
                  className={`${btnClass} w-full bg-green-600 text-white hover:bg-green-700`}
                >
                  {isProcessing ? '⏳ Processing...' : '✅ Verify & Mark Attendance'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Captured photo preview */}
        <div>
          {photo ? (
            <div>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Captured Photo</p>
              <img
                src={URL.createObjectURL(photo)}
                alt="Captured"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 object-cover"
                style={{ maxHeight: '320px' }}
              />
              <button
                onClick={() => { setPhoto(null); setStatus(null); }}
                disabled={isProcessing}
                className="mt-2 text-sm text-red-500 hover:underline"
              >
                Retake photo
              </button>
            </div>
          ) : (
            <div className="h-full min-h-48 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-400">
              <span className="text-4xl mb-2">🤳</span>
              <p className="text-sm">Captured photo will appear here</p>
            </div>
          )}

          {/* How it works */}
          <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">How it works</p>
            <ol className="text-sm text-slate-600 dark:text-slate-400 space-y-1 list-decimal list-inside">
              <li>Enter student PIN and click <strong>Find</strong></li>
              <li>Click <strong>Capture Photo</strong> from the webcam</li>
              <li>Click <strong>Verify & Mark Attendance</strong></li>
              <li>Location is checked (GPS geofencing)</li>
              <li>Face is matched locally using AI models</li>
              <li>Attendance is saved to the database</li>
            </ol>
            <p className="mt-3 text-xs text-slate-400">
              🔒 Face recognition runs entirely in-browser using local models. No photo is sent to any server.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
