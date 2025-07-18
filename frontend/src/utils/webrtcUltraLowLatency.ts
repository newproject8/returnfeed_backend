/**
 * WebRTC Ultra-Low Latency Configuration for ReturnFeed v4.0
 * 목표: End-to-End 레이턴시 < 75ms (패스스루 모드)
 * 
 * 핵심 변경사항:
 * - H.264 baseline 프로파일 강제
 * - 트랜스코딩 회피를 위한 SDP 최적화
 * - Opus 오디오 코덱 우선 선택
 */

export interface UltraLowLatencyConfig {
  iceServers: RTCIceServer[];
  rtcConfiguration: RTCConfiguration;
  mediaConstraints: MediaStreamConstraints;
  statsInterval: number;
}

/**
 * 초저지연 WebRTC 설정
 */
export const ultraLowLatencyConfig: UltraLowLatencyConfig = {
  // ICE 서버 설정 - 로컬 우선
  iceServers: [
    // 로컬 STUN 서버가 있다면 우선 사용
    // { urls: 'stun:192.168.0.242:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],

  // RTC 설정 - 레이턴시 최소화
  rtcConfiguration: {
    iceServers: [],  // 위의 iceServers로 동적 설정
    bundlePolicy: 'max-bundle',           // 미디어 번들링
    rtcpMuxPolicy: 'require',            // RTCP 멀티플렉싱
    iceCandidatePoolSize: 0,             // 빠른 연결을 위해 0
    iceTransportPolicy: 'all',           // 모든 후보 사용
    
    // 추가 최적화 옵션
    // @ts-ignore - 브라우저별 확장 옵션
    encodedInsertableStreams: false,      // 인코딩 스트림 처리 비활성화
    // @ts-ignore
    forceEncodedAudioInsertableStreams: false,
    // @ts-ignore
    forceEncodedVideoInsertableStreams: false,
  },

  // 미디어 제약사항 - 레이턴시 최소화
  mediaConstraints: {
    video: {
      width: { ideal: 1920, max: 1920 },
      height: { ideal: 1080, max: 1080 },
      frameRate: { ideal: 30, max: 30 },
      facingMode: 'user',
      
      // 고급 제약사항
      // @ts-ignore
      googNoiseReduction: false,
      // @ts-ignore
      googEchoCancellation: false,
      // @ts-ignore
      googAutoGainControl: false,
      // @ts-ignore
      googHighpassFilter: false,
    },
    audio: {
      echoCancellation: false,          // 에코 제거 비활성화 (레이턴시 감소)
      noiseSuppression: false,          // 노이즈 억제 비활성화
      autoGainControl: false,           // 자동 게인 비활성화
      sampleRate: 48000,                // 48kHz 샘플레이트
      channelCount: 2,                  // 스테레오
      
      // 고급 오디오 설정
      // @ts-ignore
      googEchoCancellation: false,
      // @ts-ignore
      googAutoGainControl: false,
      // @ts-ignore
      googNoiseSuppression: false,
      // @ts-ignore
      googHighpassFilter: false,
      // @ts-ignore
      googTypingNoiseDetection: false,
    }
  },

  // 통계 수집 간격 (ms)
  statsInterval: 1000,
};

/**
 * WebRTC PeerConnection 생성 헬퍼
 */
export function createUltraLowLatencyPeerConnection(): RTCPeerConnection {
  const config = { ...ultraLowLatencyConfig.rtcConfiguration };
  config.iceServers = ultraLowLatencyConfig.iceServers;
  
  const pc = new RTCPeerConnection(config);
  
  // 추가 최적화 설정 (패스스루 모드)
  if ('setConfiguration' in pc) {
    try {
      // @ts-ignore
      pc.setConfiguration({
        ...config,
        sdpSemantics: 'unified-plan',
        // 패스스루 모드를 위한 추가 설정
        encodedInsertableStreams: false,
        forceEncodedAudioInsertableStreams: false,
        forceEncodedVideoInsertableStreams: false,
      });
    } catch (e) {
      console.warn('Failed to set additional configuration:', e);
    }
  }
  
  // 코덱 협상 이벤트 리스너 추가
  pc.addEventListener('negotiationneeded', async () => {
    const offer = await pc.createOffer();
    // H.264 baseline 강제
    offer.sdp = optimizeSDPForLowLatency(offer.sdp || '');
    await pc.setLocalDescription(offer);
  });
  
  return pc;
}

/**
 * WebRTC 통계 모니터링
 */
export async function getWebRTCStats(pc: RTCPeerConnection): Promise<{
  latency: number;
  jitter: number;
  packetLoss: number;
  bitrate: number;
  codec: string;
  passthroughMode: boolean;
}> {
  const stats = await pc.getStats();
  let latency = 0;
  let jitter = 0;
  let packetLoss = 0;
  let bitrate = 0;
  let packetsReceived = 0;
  let packetsLost = 0;
  let bytesReceived = 0;
  let timestamp = 0;
  
  stats.forEach(report => {
    if (report.type === 'inbound-rtp' && report.kind === 'video') {
      // 레이턴시 계산 (RTT / 2)
      if (report.roundTripTime) {
        latency = (report.roundTripTime * 1000) / 2;
      }
      
      // 지터
      if (report.jitter) {
        jitter = report.jitter * 1000; // 초를 밀리초로 변환
      }
      
      // 패킷 손실
      packetsReceived = report.packetsReceived || 0;
      packetsLost = report.packetsLost || 0;
      if (packetsReceived + packetsLost > 0) {
        packetLoss = (packetsLost / (packetsReceived + packetsLost)) * 100;
      }
      
      // 비트레이트
      bytesReceived = report.bytesReceived || 0;
      timestamp = report.timestamp || 0;
    }
  });
  
  // 이전 통계와 비교하여 비트레이트 계산
  if (window.lastWebRTCStats && timestamp > window.lastWebRTCStats.timestamp) {
    const timeDiff = (timestamp - window.lastWebRTCStats.timestamp) / 1000;
    const bytesDiff = bytesReceived - window.lastWebRTCStats.bytesReceived;
    bitrate = (bytesDiff * 8) / timeDiff; // bits per second
  }
  
  // 현재 통계 저장
  window.lastWebRTCStats = {
    bytesReceived,
    timestamp,
  };
  
  // 코덱 정보 추출
  let codec = 'unknown';
  let passthroughMode = false;
  
  stats.forEach(report => {
    if (report.type === 'codec' && report.mimeType) {
      if (report.mimeType.includes('H264')) {
        codec = 'H264';
        // baseline 프로파일 확인
        if (report.sdpFmtpLine && report.sdpFmtpLine.includes('profile-level-id=42e01f')) {
          codec = 'H264-baseline';
          passthroughMode = true; // baseline은 패스스루 호환
        }
      } else if (report.mimeType.includes('opus')) {
        // 오디오 코덱도 확인
      }
    }
  });
  
  return {
    latency: Math.round(latency),
    jitter: Math.round(jitter * 100) / 100,
    packetLoss: Math.round(packetLoss * 100) / 100,
    bitrate: Math.round(bitrate),
    codec,
    passthroughMode,
  };
}

/**
 * SDP 최적화 - H.264 baseline 강제 및 패스스루 최적화
 * 
 * 패스스루 모드에서는 MediaMTX가 코덱을 통과시키므로
 * 브라우저에서 H.264 baseline을 강제하여 호환성을 보장합니다.
 */
export function optimizeSDPForLowLatency(sdp: string): string {
  let optimizedSDP = sdp;
  
  // H.264 baseline 프로파일 찾기 및 강제
  optimizedSDP = preferH264BaselineProfile(optimizedSDP);
  
  // Opus 오디오 코덱 우선 설정
  optimizedSDP = preferOpusCodec(optimizedSDP);
  
  // 비트레이트 제한 설정 (패스스루 모드에서는 PD 소프트웨어가 결정)
  // MediaMTX는 트랜스코딩하지 않으므로 소스 비트레이트 유지
  if (!optimizedSDP.includes('b=AS:')) {
    optimizedSDP = optimizedSDP.replace(
      /m=video (\d+)/g,
      'm=video $1\r\nb=AS:10000'  // 10 Mbps (최대 허용)
    );
  }
  
  // FEC (Forward Error Correction) 비활성화 - 레이턴시 감소
  optimizedSDP = optimizedSDP.replace(/a=rtpmap:(\d+) ulpfec\/90000\r\n/g, '');
  optimizedSDP = optimizedSDP.replace(/a=rtpmap:(\d+) red\/90000\r\n/g, '');
  
  // NACK 재전송 간격 최소화
  optimizedSDP = optimizedSDP.replace(
    /a=rtcp-fb:(\d+) nack/g,
    'a=rtcp-fb:$1 nack pli'
  );
  
  // Jitter buffer 최소화 힌트 추가
  if (!optimizedSDP.includes('a=googReducedJitterBufferSize')) {
    optimizedSDP = optimizedSDP.replace(
      /m=video (\d+)(.+?)(?=m=|$)/gs,
      (match) => match + 'a=googReducedJitterBufferSize:true\r\n'
    );
  }
  
  // 패스스루 모드 플래그 추가
  optimizedSDP = optimizedSDP.replace(
    /a=mid:video/g,
    'a=mid:video\r\na=x-google-flag:passthrough_mode'
  );
  
  return optimizedSDP;
}

/**
 * H.264 baseline 프로파일 강제 함수
 */
function preferH264BaselineProfile(sdp: string): string {
  // 모든 H.264 프로파일 찾기
  const h264PayloadTypes: number[] = [];
  const lines = sdp.split('\r\n');
  
  // H.264 페이로드 타입 찾기
  lines.forEach(line => {
    const rtpmapMatch = line.match(/^a=rtpmap:(\d+) H264\/90000/);
    if (rtpmapMatch) {
      h264PayloadTypes.push(parseInt(rtpmapMatch[1]));
    }
  });
  
  // baseline 프로파일 찾기 (42e01f = baseline level 3.1)
  let baselinePayload: number | null = null;
  h264PayloadTypes.forEach(pt => {
    const fmtpLine = lines.find(line => 
      line.startsWith(`a=fmtp:${pt}`) && 
      line.includes('profile-level-id=42e01f')
    );
    if (fmtpLine) {
      baselinePayload = pt;
    }
  });
  
  // baseline이 없으면 첫 번째 H.264를 baseline으로 수정
  if (!baselinePayload && h264PayloadTypes.length > 0) {
    baselinePayload = h264PayloadTypes[0];
    // fmtp 라인 수정
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith(`a=fmtp:${baselinePayload}`)) {
        lines[i] = `a=fmtp:${baselinePayload} level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f`;
        break;
      }
    }
  }
  
  // m=video 라인에서 baseline을 첫 번째로 이동
  if (baselinePayload) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('m=video')) {
        const parts = lines[i].split(' ');
        const formats = parts.slice(3);
        const baselineIdx = formats.indexOf(baselinePayload.toString());
        if (baselineIdx > 0) {
          formats.splice(baselineIdx, 1);
          formats.unshift(baselinePayload.toString());
          lines[i] = parts.slice(0, 3).concat(formats).join(' ');
        }
        break;
      }
    }
  }
  
  return lines.join('\r\n');
}

/**
 * Opus 오디오 코덱 우선 설정
 */
function preferOpusCodec(sdp: string): string {
  const lines = sdp.split('\r\n');
  let opusPayload: number | null = null;
  
  // Opus 페이로드 타입 찾기
  lines.forEach(line => {
    const match = line.match(/^a=rtpmap:(\d+) opus\/48000\/2/);
    if (match) {
      opusPayload = parseInt(match[1]);
    }
  });
  
  // m=audio 라인에서 Opus를 첫 번째로 이동
  if (opusPayload) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('m=audio')) {
        const parts = lines[i].split(' ');
        const formats = parts.slice(3);
        const opusIdx = formats.indexOf(opusPayload.toString());
        if (opusIdx > 0) {
          formats.splice(opusIdx, 1);
          formats.unshift(opusPayload.toString());
          lines[i] = parts.slice(0, 3).concat(formats).join(' ');
        }
        break;
      }
    }
  }
  
  return lines.join('\r\n');
}

/**
 * 비디오 엘리먼트 최적화 설정
 */
export function optimizeVideoElement(video: HTMLVideoElement): void {
  // 버퍼링 최소화
  video.preload = 'none';
  
  // 자동 재생 설정
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;  // 자동 재생을 위해 필요
  
  // 추가 최적화 속성
  if ('disablePictureInPicture' in video) {
    // @ts-ignore
    video.disablePictureInPicture = true;
  }
  
  if ('disableRemotePlayback' in video) {
    // @ts-ignore
    video.disableRemotePlayback = true;
  }
  
  // 버퍼 크기 최소화 (실험적)
  try {
    // @ts-ignore
    if (video.buffered && 'mozFragmentEnd' in video) {
      // @ts-ignore
      video.mozFragmentEnd = 0.5;  // Firefox
    }
  } catch (e) {
    // 무시
  }
}

// TypeScript 확장
declare global {
  interface Window {
    lastWebRTCStats?: {
      bytesReceived: number;
      timestamp: number;
    };
  }
}