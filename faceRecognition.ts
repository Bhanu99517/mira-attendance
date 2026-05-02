/**
 * faceRecognition.ts
 *
 * Client-side face recognition using face-api.js with local models.
 * Models are served from /public/models (bundled with the app).
 *
 * Pipeline:
 *  1. loadModels()        — load SSD MobileNet, Face Landmarks, Face Recognition
 *  2. computeDescriptor() — compute 128-float descriptor from an image/video frame
 *  3. compareFaces()      — compare two descriptors using Euclidean distance
 *  4. verifyFace()        — high-level: reference image vs live capture
 */

import * as faceapi from 'face-api.js';

const MODEL_URL = '/models';
const MATCH_THRESHOLD = 0.55; // Lower = stricter. 0.55 is a good balance.

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

// ─── Model Loading ────────────────────────────────────────────────────────────

export const loadFaceModels = async (): Promise<void> => {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      modelsLoaded = true;
      console.log('[FaceRecognition] Models loaded successfully.');
    } catch (err) {
      loadingPromise = null; // Allow retry
      throw new Error(`Failed to load face recognition models: ${err}`);
    }
  })();

  return loadingPromise;
};

export const areFaceModelsLoaded = () => modelsLoaded;

// ─── Descriptor Computation ───────────────────────────────────────────────────

/**
 * Compute a 128-float face descriptor from an image source.
 * Returns null if no face is detected.
 */
export const computeFaceDescriptor = async (
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageData | string
): Promise<Float32Array | null> => {
  await loadFaceModels();

  let element: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageData;

  if (typeof input === 'string') {
    // It's a URL — load into an img element
    element = await loadImageFromUrl(input);
  } else {
    element = input;
  }

  const detection = await faceapi
    .detectSingleFace(element as any, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;
  return detection.descriptor;
};

/**
 * Compute descriptor from a Blob (e.g., canvas.toBlob result).
 */
export const computeDescriptorFromBlob = async (blob: Blob): Promise<Float32Array | null> => {
  const url = URL.createObjectURL(blob);
  try {
    return await computeFaceDescriptor(url);
  } finally {
    URL.revokeObjectURL(url);
  }
};

// ─── Comparison ───────────────────────────────────────────────────────────────

/**
 * Compute Euclidean distance between two face descriptors.
 * Distance < MATCH_THRESHOLD means same person.
 */
export const euclideanDistance = (d1: Float32Array | number[], d2: Float32Array | number[]): number => {
  return faceapi.euclideanDistance(d1 as Float32Array, d2 as Float32Array);
};

export interface FaceVerificationResult {
  isMatch: boolean;
  distance: number;
  confidence: number; // 0–100
  quality: 'GOOD' | 'POOR';
  reason: string;
}

/**
 * Compare two descriptors and return a structured result.
 */
export const compareDescriptors = (
  referenceDescriptor: Float32Array | number[],
  liveDescriptor: Float32Array | number[]
): FaceVerificationResult => {
  const distance = euclideanDistance(referenceDescriptor, liveDescriptor);
  const isMatch = distance < MATCH_THRESHOLD;
  // Confidence: linearly maps 0→100% (distance 0) to 0% (distance >= 1)
  const confidence = Math.max(0, Math.round((1 - distance) * 100));

  return {
    isMatch,
    distance,
    confidence,
    quality: confidence >= 60 ? 'GOOD' : 'POOR',
    reason: isMatch
      ? `Face matched with ${confidence}% confidence.`
      : `Face did not match (distance: ${distance.toFixed(3)}, threshold: ${MATCH_THRESHOLD}).`,
  };
};

// ─── High-Level API ───────────────────────────────────────────────────────────

/**
 * Full verification pipeline:
 *  - referenceDescriptor: stored in DB (from user registration)
 *  - liveBlob: captured from webcam canvas
 */
export const verifyFaceAgainstDescriptor = async (
  referenceDescriptor: number[],
  liveBlob: Blob
): Promise<FaceVerificationResult> => {
  await loadFaceModels();

  const liveDescriptor = await computeDescriptorFromBlob(liveBlob);
  if (!liveDescriptor) {
    return {
      isMatch: false,
      distance: 1,
      confidence: 0,
      quality: 'POOR',
      reason: 'No face detected in the captured photo. Please ensure your face is clearly visible.',
    };
  }

  return compareDescriptors(referenceDescriptor, liveDescriptor);
};

/**
 * Compute descriptor from a reference image URL and compare with live blob.
 * Use this when no descriptor is stored in DB yet.
 */
export const verifyFaceAgainstUrl = async (
  referenceImageUrl: string,
  liveBlob: Blob
): Promise<FaceVerificationResult> => {
  await loadFaceModels();

  const [refDescriptor, liveDescriptor] = await Promise.all([
    computeFaceDescriptor(referenceImageUrl),
    computeDescriptorFromBlob(liveBlob),
  ]);

  if (!refDescriptor) {
    return {
      isMatch: false,
      distance: 1,
      confidence: 0,
      quality: 'POOR',
      reason: 'No face found in the reference image. Please re-upload a clear photo during registration.',
    };
  }

  if (!liveDescriptor) {
    return {
      isMatch: false,
      distance: 1,
      confidence: 0,
      quality: 'POOR',
      reason: 'No face detected in the captured photo. Please ensure good lighting and face the camera directly.',
    };
  }

  return compareDescriptors(refDescriptor, liveDescriptor);
};

// ─── Utilities ────────────────────────────────────────────────────────────────

const loadImageFromUrl = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });

/**
 * Convert Float32Array descriptor to number[] for Supabase storage.
 */
export const descriptorToArray = (descriptor: Float32Array): number[] =>
  Array.from(descriptor);

/**
 * Convert number[] from Supabase back to Float32Array for comparison.
 */
export const arrayToDescriptor = (arr: number[]): Float32Array =>
  new Float32Array(arr);
