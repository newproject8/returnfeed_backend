import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Paper, Typography, Chip, Stack, IconButton, Tooltip } from '@mui/material';
import { 
  SignalCellular4Bar, 
  SignalCellular1Bar,
  AutoMode,
  HighQuality,
  DataSaverOn,
  NetworkCheck
} from '@mui/icons-material';

interface SimulcastVideoPlayerProps {
  sessionKey: string;
  mediamtxUrl?: string;
  onLatencyUpdate?: (latency: number) => void;
}

interface NetworkQuality {
  level: 'high' | 'low' | 'auto';
  bitrate: number;
  packetLoss: number;
  rtt: number;
}

export const SimulcastVideoPlayer: React.FC<SimulcastVideoPlayerProps> = ({
  sessionKey,
  mediamtxUrl = window.location.hostname,
  onLatencyUpdate
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentQuality, setCurrentQuality] = useState<'high' | 'low'>('high');
  const [qualityMode, setQualityMode] = useState<'auto' | 'high' | 'low'>('auto');
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>({
    level: 'high',
    bitrate: 1000000,
    packetLoss: 0,
    rtt: 0
  });
  const [stats, setStats] = useState({
    fps: 0,
    resolution: '',
    bitrate: 0,
    latency: 0
  });

  // 시뮬캐스트 스트림 URL
  const getStreamUrl = useCallback((quality: 'high' | 'low') => {
    const suffix = quality === 'high' ? 'h' : 'l';
    return `http://${mediamtxUrl}:8889/simulcast_${sessionKey}_${suffix}`;
  }, [sessionKey, mediamtxUrl]);

  // WebRTC 연결 생성
  const createPeerConnection = useCallback(async (quality: 'high' | 'low') => {
    // 기존 연결 정리
    if (pcRef.current) {
      pcRef.current.close();
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    });

    pcRef.current = pc;

    // 트랙 수신 시
    pc.ontrack = (event) => {
      if (videoRef.current && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0];
        setIsConnected(true);
      }
    };

    // 연결 상태 모니터링
    pc.onconnectionstatechange = () => {
      console.log(`[SIMULCAST] 연결 상태: ${pc.connectionState}`);
      if (pc.connectionState === 'failed') {
        // 연결 실패 시 낮은 품질로 재시도
        if (quality === 'high' && qualityMode === 'auto') {
          console.log('[SIMULCAST] 고품질 실패, 저품질로 전환');
          createPeerConnection('low');
        }
      }
    };

    // WebRTC 연결 시작
    try {
      const response = await fetch(getStreamUrl(quality), {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const offer = await response.json();
      await pc.setRemoteDescription(offer);

      const answer = await pc.createAnswer();
      
      // 시뮬캐스트 수신 설정
      if (answer.sdp) {
        answer.sdp = optimizeAnswerSDP(answer.sdp, quality);
      }

      await pc.setLocalDescription(answer);

      // Answer 전송
      await fetch(getStreamUrl(quality), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answer)
      });

      setCurrentQuality(quality);
      console.log(`[SIMULCAST] ${quality} 품질 연결 성공`);

    } catch (error) {
      console.error('[SIMULCAST] 연결 오류:', error);
      setIsConnected(false);
    }

    return pc;
  }, [getStreamUrl, qualityMode]);

  // SDP 최적화 (시뮬캐스트용)
  const optimizeAnswerSDP = (sdp: string, quality: 'high' | 'low'): string => {
    let optimized = sdp;

    // H.264 baseline 프로파일 우선
    optimized = optimized.replace(
      /m=video (\d+) ([A-Z/]+) (.+)/g,
      (match, port, proto, codecs) => {
        const codecList = codecs.split(' ');
        const h264Codecs = codecList.filter(c => 
          optimized.includes(`a=rtpmap:${c} H264/90000`)
        );
        
        if (h264Codecs.length > 0) {
          const reordered = [
            ...h264Codecs,
            ...codecList.filter(c => !h264Codecs.includes(c))
          ];
          return `m=video ${port} ${proto} ${reordered.join(' ')}`;
        }
        return match;
      }
    );

    // 비트레이트 제한 설정
    const maxBitrate = quality === 'high' ? 1000000 : 100000;
    if (!optimized.includes('b=AS:')) {
      optimized = optimized.replace(
        /(m=video.*\r\n)/,
        `$1b=AS:${Math.floor(maxBitrate / 1000)}\r\n`
      );
    }

    return optimized;
  };

  // 네트워크 통계 수집
  const collectNetworkStats = useCallback(async () => {
    if (!pcRef.current) return;

    try {
      const stats = await pcRef.current.getStats();
      let videoStats: any = null;
      let candidatePair: any = null;

      stats.forEach(report => {
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          videoStats = report;
        } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          candidatePair = report;
        }
      });

      if (videoStats) {
        // 통계 업데이트
        setStats({
          fps: Math.round(videoStats.framesPerSecond || 0),
          resolution: `${videoStats.frameWidth || 0}x${videoStats.frameHeight || 0}`,
          bitrate: Math.round((videoStats.bytesReceived * 8) / 1000), // kbps
          latency: candidatePair ? Math.round(candidatePair.currentRoundTripTime * 1000) : 0
        });

        // 네트워크 품질 평가
        const packetLoss = videoStats.packetsLost / (videoStats.packetsReceived + videoStats.packetsLost) || 0;
        const rtt = candidatePair ? candidatePair.currentRoundTripTime * 1000 : 0;

        setNetworkQuality({
          level: packetLoss > 0.02 || rtt > 200 ? 'low' : 'high',
          bitrate: stats.bitrate * 1000,
          packetLoss: packetLoss * 100,
          rtt
        });

        // 레이턴시 콜백
        if (onLatencyUpdate && candidatePair) {
          onLatencyUpdate(rtt);
        }

        // 자동 품질 조절
        if (qualityMode === 'auto') {
          if (packetLoss > 0.05 && currentQuality === 'high') {
            // 5% 이상 패킷 손실 시 저품질로 전환
            console.log('[SIMULCAST] 네트워크 품질 저하, 저품질로 전환');
            createPeerConnection('low');
          } else if (packetLoss < 0.01 && currentQuality === 'low' && rtt < 100) {
            // 네트워크 상태 개선 시 고품질로 전환
            console.log('[SIMULCAST] 네트워크 품질 개선, 고품질로 전환');
            createPeerConnection('high');
          }
        }
      }
    } catch (error) {
      console.error('[SIMULCAST] 통계 수집 오류:', error);
    }
  }, [currentQuality, qualityMode, createPeerConnection, onLatencyUpdate]);

  // 수동 품질 전환
  const switchQuality = useCallback((mode: 'auto' | 'high' | 'low') => {
    setQualityMode(mode);
    
    if (mode !== 'auto') {
      const targetQuality = mode === 'high' ? 'high' : 'low';
      if (currentQuality !== targetQuality) {
        createPeerConnection(targetQuality);
      }
    }
  }, [currentQuality, createPeerConnection]);

  // 초기 연결
  useEffect(() => {
    const initialQuality = qualityMode === 'auto' ? 'high' : 
                         qualityMode === 'high' ? 'high' : 'low';
    createPeerConnection(initialQuality);

    return () => {
      if (pcRef.current) {
        pcRef.current.close();
      }
    };
  }, [createPeerConnection, qualityMode]);

  // 통계 수집 타이머
  useEffect(() => {
    const interval = setInterval(collectNetworkStats, 1000);
    return () => clearInterval(interval);
  }, [collectNetworkStats]);

  return (
    <Paper elevation={3} sx={{ p: 2, backgroundColor: '#000' }}>
      <Box sx={{ position: 'relative' }}>
        {/* 비디오 플레이어 */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: 'auto',
            backgroundColor: '#000'
          }}
        />

        {/* 오버레이 정보 */}
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            right: 8,
            display: 'flex',
            justifyContent: 'space-between',
            pointerEvents: 'none'
          }}
        >
          {/* 현재 품질 표시 */}
          <Chip
            icon={currentQuality === 'high' ? <SignalCellular4Bar /> : <SignalCellular1Bar />}
            label={currentQuality === 'high' ? '1Mbps' : '0.1Mbps'}
            size="small"
            color={currentQuality === 'high' ? 'success' : 'warning'}
            sx={{ pointerEvents: 'auto' }}
          />

          {/* 통계 정보 */}
          <Stack direction="row" spacing={1}>
            <Chip 
              label={`${stats.fps} fps`} 
              size="small" 
              variant="outlined"
              sx={{ color: 'white', borderColor: 'white' }}
            />
            <Chip 
              label={stats.resolution} 
              size="small" 
              variant="outlined"
              sx={{ color: 'white', borderColor: 'white' }}
            />
            <Chip 
              label={`${stats.latency}ms`} 
              size="small" 
              variant="outlined"
              sx={{ color: 'white', borderColor: 'white' }}
            />
          </Stack>
        </Box>

        {/* 품질 선택 컨트롤 */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            display: 'flex',
            gap: 1,
            backgroundColor: 'rgba(0,0,0,0.7)',
            borderRadius: 1,
            p: 0.5
          }}
        >
          <Tooltip title="자동 품질">
            <IconButton
              size="small"
              onClick={() => switchQuality('auto')}
              color={qualityMode === 'auto' ? 'primary' : 'default'}
              sx={{ color: qualityMode === 'auto' ? 'primary.main' : 'white' }}
            >
              <AutoMode />
            </IconButton>
          </Tooltip>

          <Tooltip title="고품질 (1Mbps)">
            <IconButton
              size="small"
              onClick={() => switchQuality('high')}
              color={qualityMode === 'high' ? 'primary' : 'default'}
              sx={{ color: qualityMode === 'high' ? 'primary.main' : 'white' }}
            >
              <HighQuality />
            </IconButton>
          </Tooltip>

          <Tooltip title="저품질 (0.1Mbps)">
            <IconButton
              size="small"
              onClick={() => switchQuality('low')}
              color={qualityMode === 'low' ? 'primary' : 'default'}
              sx={{ color: qualityMode === 'low' ? 'primary.main' : 'white' }}
            >
              <DataSaverOn />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* 네트워크 상태 표시 */}
      <Box sx={{ mt: 2, p: 1, backgroundColor: 'background.paper', borderRadius: 1 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <NetworkCheck color={networkQuality.level === 'high' ? 'success' : 'warning'} />
          <Typography variant="body2">
            네트워크: {networkQuality.level === 'high' ? '양호' : '불안정'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            패킷 손실: {networkQuality.packetLoss.toFixed(1)}%
          </Typography>
          <Typography variant="body2" color="text.secondary">
            RTT: {networkQuality.rtt.toFixed(0)}ms
          </Typography>
          <Typography variant="body2" color="text.secondary">
            비트레이트: {(stats.bitrate / 1000).toFixed(1)}Mbps
          </Typography>
        </Stack>
      </Box>
    </Paper>
  );
};