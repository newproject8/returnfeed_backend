import React, { useState, useEffect, useRef } from 'react';
import { Slider } from '@mui/material';
import { WifiOff, Wifi, SignalWifi4Bar } from '@mui/icons-material';

interface AdaptiveBitrateControlProps {
  peerConnection: RTCPeerConnection | null;
  onBitrateChange?: (bitrate: number) => void;
}

interface NetworkStats {
  packetsLost: number;
  packetsReceived: number;
  bytesReceived: number;
  timestamp: number;
  jitter?: number;
  roundTripTime?: number;
}

export const AdaptiveBitrateControl: React.FC<AdaptiveBitrateControlProps> = ({
  peerConnection,
  onBitrateChange
}) => {
  const [currentBitrate, setCurrentBitrate] = useState(1000000); // 1 Mbps default
  const [targetBitrate, setTargetBitrate] = useState(1000000);
  const [networkQuality, setNetworkQuality] = useState<'poor' | 'fair' | 'good'>('good');
  const [autoAdjust, setAutoAdjust] = useState(true);
  const [stats, setStats] = useState<NetworkStats | null>(null);
  
  const minBitrate = 100000;  // 0.1 Mbps
  const maxBitrate = 1000000; // 1 Mbps
  const statsInterval = useRef<NodeJS.Timeout | null>(null);
  const lastStats = useRef<NetworkStats | null>(null);

  // 비트레이트 조절 함수 (레이턴시 영향 없음)
  const adjustBitrate = async (newBitrate: number) => {
    if (!peerConnection) return;

    // 범위 제한
    newBitrate = Math.max(minBitrate, Math.min(maxBitrate, newBitrate));

    try {
      const transceivers = peerConnection.getTransceivers();
      
      for (const transceiver of transceivers) {
        if (transceiver.sender && transceiver.sender.track?.kind === 'video') {
          const params = transceiver.sender.getParameters();
          
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }

          // WebRTC 레벨에서 비트레이트 조절 (재협상 없이)
          params.encodings[0].maxBitrate = newBitrate;
          
          await transceiver.sender.setParameters(params);
          setCurrentBitrate(newBitrate);
          
          console.log(`비트레이트 조정: ${(newBitrate / 1000).toFixed(0)}kbps`);
          
          if (onBitrateChange) {
            onBitrateChange(newBitrate);
          }
        }
      }
    } catch (error) {
      console.error('비트레이트 조정 실패:', error);
    }
  };

  // 네트워크 통계 수집
  const collectNetworkStats = async () => {
    if (!peerConnection) return;

    try {
      const stats = await peerConnection.getStats();
      let newStats: NetworkStats = {
        packetsLost: 0,
        packetsReceived: 0,
        bytesReceived: 0,
        timestamp: Date.now()
      };

      stats.forEach(report => {
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          newStats.packetsLost = report.packetsLost || 0;
          newStats.packetsReceived = report.packetsReceived || 0;
          newStats.bytesReceived = report.bytesReceived || 0;
          newStats.jitter = report.jitter;
          newStats.roundTripTime = report.roundTripTime;
        }
      });

      setStats(newStats);

      // 자동 조절 로직
      if (autoAdjust && lastStats.current) {
        const timeDiff = (newStats.timestamp - lastStats.current.timestamp) / 1000;
        const packetsLostDiff = newStats.packetsLost - lastStats.current.packetsLost;
        const packetsReceivedDiff = newStats.packetsReceived - lastStats.current.packetsReceived;
        
        if (packetsReceivedDiff > 0) {
          const lossRate = packetsLostDiff / packetsReceivedDiff;
          
          // 네트워크 품질 판단
          if (lossRate > 0.05) {
            setNetworkQuality('poor');
            // 5% 이상 손실: 비트레이트 20% 감소
            await adjustBitrate(currentBitrate * 0.8);
          } else if (lossRate > 0.02) {
            setNetworkQuality('fair');
            // 2-5% 손실: 비트레이트 10% 감소
            await adjustBitrate(currentBitrate * 0.9);
          } else if (lossRate < 0.01) {
            setNetworkQuality('good');
            // 1% 미만 손실: 비트레이트 10% 증가 (최대치까지)
            if (currentBitrate < maxBitrate) {
              await adjustBitrate(Math.min(currentBitrate * 1.1, maxBitrate));
            }
          }
        }
      }

      lastStats.current = newStats;
    } catch (error) {
      console.error('네트워크 통계 수집 실패:', error);
    }
  };

  // 수동 비트레이트 조절
  const handleManualAdjust = async (event: Event, value: number | number[]) => {
    const newBitrate = value as number;
    setTargetBitrate(newBitrate);
    setAutoAdjust(false);
    await adjustBitrate(newBitrate);
  };

  // 자동 조절 토글
  const toggleAutoAdjust = () => {
    setAutoAdjust(!autoAdjust);
    if (!autoAdjust) {
      // 자동 조절 재활성화 시 현재 비트레이트로 시작
      setTargetBitrate(currentBitrate);
    }
  };

  useEffect(() => {
    if (peerConnection) {
      // 초기 비트레이트 설정
      adjustBitrate(targetBitrate);

      // 통계 수집 시작
      statsInterval.current = setInterval(collectNetworkStats, 2000);

      return () => {
        if (statsInterval.current) {
          clearInterval(statsInterval.current);
        }
      };
    }
  }, [peerConnection]);

  const getNetworkIcon = () => {
    switch (networkQuality) {
      case 'poor':
        return <WifiOff color="error" />;
      case 'fair':
        return <Wifi color="warning" />;
      case 'good':
        return <SignalWifi4Bar color="success" />;
    }
  };

  const formatBitrate = (bitrate: number) => {
    if (bitrate >= 1000000) {
      return `${(bitrate / 1000000).toFixed(1)} Mbps`;
    }
    return `${(bitrate / 1000).toFixed(0)} kbps`;
  };

  return (
    <div className="adaptive-bitrate-control" style={{
      padding: '16px',
      backgroundColor: '#f5f5f5',
      borderRadius: '8px',
      marginTop: '16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, flex: 1 }}>비트레이트 조절</h4>
        {getNetworkIcon()}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>현재: {formatBitrate(currentBitrate)}</span>
          <button 
            onClick={toggleAutoAdjust}
            style={{
              padding: '4px 12px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              backgroundColor: autoAdjust ? '#4CAF50' : '#fff',
              color: autoAdjust ? '#fff' : '#000',
              cursor: 'pointer'
            }}
          >
            {autoAdjust ? '자동 조절 ON' : '자동 조절 OFF'}
          </button>
        </div>

        <Slider
          value={targetBitrate}
          onChange={handleManualAdjust}
          min={minBitrate}
          max={maxBitrate}
          step={50000}
          disabled={autoAdjust}
          marks={[
            { value: 100000, label: '0.1' },
            { value: 500000, label: '0.5' },
            { value: 1000000, label: '1.0' }
          ]}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => formatBitrate(value)}
        />
      </div>

      {stats && (
        <div style={{ fontSize: '12px', color: '#666' }}>
          <div>패킷 손실: {stats.packetsLost} / {stats.packetsReceived}</div>
          {stats.jitter && <div>지터: {(stats.jitter * 1000).toFixed(1)}ms</div>}
          {stats.roundTripTime && <div>RTT: {(stats.roundTripTime * 1000).toFixed(1)}ms</div>}
        </div>
      )}
    </div>
  );
};

// 사용 예시
export const VideoPlayer: React.FC = () => {
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // WebRTC 연결 설정
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peerConnection.ontrack = (event) => {
      if (videoRef.current && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0];
      }
    };

    setPc(peerConnection);

    return () => {
      peerConnection.close();
    };
  }, []);

  return (
    <div>
      <video ref={videoRef} autoPlay playsInline style={{ width: '100%' }} />
      <AdaptiveBitrateControl 
        peerConnection={pc}
        onBitrateChange={(bitrate) => {
          console.log('비트레이트 변경됨:', bitrate);
        }}
      />
    </div>
  );
};