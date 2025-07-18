import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Hls from 'hls.js';

interface VideoPlayerProps {
  hlsUrl?: string;
  webrtcUrl?: string;
  streamPath?: string;
  authToken?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  hlsUrl: propHlsUrl, 
  webrtcUrl: propWebrtcUrl,
  streamPath,
  authToken
}) => {
  const { username } = useParams<{ username: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);

  // Get auth token from localStorage if not provided
  const token = authToken || localStorage.getItem('token') || '';
  
  // Determine stream path
  const path = streamPath || username || 'pgm_srt_raw';
  
  // Build URLs with authentication
  const hlsUrl = propHlsUrl || `/ws/mediamtx/${path}/index.m3u8?token=${token}`;
  const webrtcUrl = propWebrtcUrl || `/ws/mediamtx/${path}/whep?token=${token}`;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let peerConnection: RTCPeerConnection | null = null;
    let hls: Hls | null = null;
    let isDestroyed = false;

    const playHls = () => {
      if (isDestroyed) return;
      console.log('Falling back to HLS...');
      
      if (Hls.isSupported()) {
        hls = new Hls({
          xhrSetup: (xhr, url) => {
            // Add authorization header for HLS segments
            if (token) {
              xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
          }
        });
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(e => console.error('HLS Auto-play failed', e));
        });
        
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS error:', data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('Fatal network error encountered, trying to recover');
                hls?.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('Fatal media error encountered, trying to recover');
                hls?.recoverMediaError();
                break;
              default:
                console.error('Fatal error, cannot recover');
                hls?.destroy();
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // For Safari native HLS support
        video.src = hlsUrl;
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(e => console.error('HLS Auto-play failed', e));
        });
      }
    };

    const connectWebRTC = async () => {
      try {
        console.log('Attempting WebRTC connection to:', path);
        
        // Configure ICE servers
        const iceServers = [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ];
        
        // Add TURN server if available
        if (process.env.REACT_APP_TURN_SERVER) {
          iceServers.push({
            urls: process.env.REACT_APP_TURN_SERVER,
            username: process.env.REACT_APP_TURN_USER || '',
            credential: process.env.REACT_APP_TURN_PASS || ''
          });
        }

        peerConnection = new RTCPeerConnection({ iceServers });

        // Add transceivers for video and audio
        peerConnection.addTransceiver('video', { direction: 'recvonly' });
        peerConnection.addTransceiver('audio', { direction: 'recvonly' });

        // Handle incoming tracks
        peerConnection.ontrack = (event) => {
          console.log('Received track:', event.track.kind);
          if (video.srcObject !== event.streams[0]) {
            video.srcObject = event.streams[0];
            console.log('WebRTC stream attached');
          }
        };

        // Monitor connection state
        peerConnection.onconnectionstatechange = () => {
          console.log('Connection state:', peerConnection?.connectionState);
          if (peerConnection?.connectionState === 'failed') {
            console.error('WebRTC connection failed, switching to HLS');
            if (peerConnection) {
              peerConnection.close();
              peerConnection = null;
            }
            playHls();
          }
        };

        // Create and set offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Send offer to server with authentication
        const response = await fetch(webrtcUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/sdp',
            'Authorization': token ? `Bearer ${token}` : ''
          },
          body: peerConnection.localDescription?.sdp,
        });

        if (!response.ok) {
          if (response.status === 401) {
            console.error('Authentication failed. Please log in.');
            throw new Error('Unauthorized');
          }
          throw new Error(`Server responded with ${response.status}`);
        }

        const answerSdp = await response.text();
        await peerConnection.setRemoteDescription({
          type: 'answer',
          sdp: answerSdp,
        });
        
        console.log('WebRTC connection established.');
        
        // Auto-play with user interaction fallback
        video.play().catch(e => {
          console.warn('Auto-play failed, waiting for user interaction', e);
          // Show play button overlay if needed
        });

      } catch (error) {
        console.error('WebRTC connection failed:', error);
        if (peerConnection) {
          peerConnection.close();
          peerConnection = null;
        }
        // Fall back to HLS
        playHls();
      }
    };

    // Start with WebRTC for lowest latency
    connectWebRTC();

    // Cleanup function
    return () => {
      isDestroyed = true;
      if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
      }
      if (hls) {
        hls.destroy();
        hls = null;
      }
      if (video.srcObject) {
        const tracks = (video.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
      }
    };
  }, [hlsUrl, webrtcUrl, path, token]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <video
        ref={videoRef}
        controls
        autoPlay
        muted
        playsInline
        style={{ 
          width: '100%', 
          height: '100%', 
          objectFit: 'contain',
          backgroundColor: '#000'
        }}
      />
      {/* Optional: Add loading/error overlay */}
    </div>
  );
};

export default VideoPlayer;