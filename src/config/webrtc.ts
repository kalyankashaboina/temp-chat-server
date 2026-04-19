/**
 * WebRTC Configuration - FREE STUN Servers
 *
 * OK - 100% FREE - No TURN servers needed for most connections
 * OK - Works for 80-90% of users (direct peer-to-peer)
 * OK - Google's public STUN servers (free forever)
 *
 * Why this works:
 * - STUN helps discover public IP addresses
 * - Most users can connect directly (peer-to-peer)
 * - Only restrictive corporate/symmetric NATs need TURN
 * - For render.com free tier: Perfect balance of cost vs functionality
 */

export const webrtcConfig = {
  iceServers: [
    // Google's free STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },

    // Additional reliable free STUN servers
    { urls: 'stun:stun.stunprotocol.org:3478' },
    { urls: 'stun:stun.voipbuster.com' },
    { urls: 'stun:stun.voipstunt.com' },
  ],

  // Optimization for render.com free tier
  iceCandidatePoolSize: 10,

  // Connection constraints
  iceTransportPolicy: 'all', // Try all methods

  // Performance settings
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

/**
 * Media constraints for audio/video calls
 */
export const mediaConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: {
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 30, max: 60 },
    facingMode: 'user',
  },
};

/**
 * Audio-only call constraints (lower bandwidth)
 */
export const audioOnlyConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    channelCount: 1,
  },
  video: false,
};

/**
 * Video-only constraints (screen share, etc.)
 */
export const videoOnlyConstraints = {
  audio: false,
  video: {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 },
  },
};

/**
 * Low-bandwidth constraints (for slow connections)
 */
export const lowBandwidthConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: {
    width: { ideal: 640, max: 640 },
    height: { ideal: 480, max: 480 },
    frameRate: { ideal: 15, max: 15 },
  },
};

/**
 * Screen sharing constraints
 */
export const screenShareConstraints = {
  audio: false,
  video: {
    cursor: 'always',
    displaySurface: 'monitor',
  },
};

/**
 * Connection quality settings
 */
export const qualitySettings = {
  high: {
    video: { width: 1280, height: 720, framerate: 30 },
    audio: { sampleRate: 48000 },
  },
  medium: {
    video: { width: 640, height: 480, framerate: 24 },
    audio: { sampleRate: 44100 },
  },
  low: {
    video: { width: 320, height: 240, framerate: 15 },
    audio: { sampleRate: 22050 },
  },
};

export default webrtcConfig;
