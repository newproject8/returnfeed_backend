/**
 * WebRTC 최적화 유틸리티
 * 실시간 리턴 신호를 위한 최소 레이턴시 구성
 */

export interface WebRTCOptimizationConfig {
  /** 레이턴시 우선순위 모드 */
  lowLatencyMode: boolean;
  /** 적응적 비트레이트 활성화 */
  adaptiveBitrate: boolean;
  /** 타겟 비트레이트 (bps) */
  targetBitrate: number;
  /** 최소 비트레이트 (bps) */
  minBitrate: number;
  /** 최대 비트레이트 (bps) */
  maxBitrate: number;
  /** 품질 프리셋 */
  qualityPreset: 'ultra_low_latency' | 'low_latency' | 'balanced' | 'quality';
}

export class WebRTCOptimizer {
  private peerConnection: RTCPeerConnection | null = null;
  private config: WebRTCOptimizationConfig;
  private statsInterval: NodeJS.Timeout | null = null;
  private onStatsUpdate?: (stats: RTCStatsReport) => void;

  constructor(config: WebRTCOptimizationConfig) {
    this.config = config;
  }

  /**
   * 최적화된 WebRTC 구성 생성
   */
  createOptimizedConfiguration(): RTCConfiguration {
    const baseConfig: RTCConfiguration = {
      iceServers: [
        // Google STUN 서버 (빠른 연결용)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        // Cloudflare STUN 서버 (백업)
        { urls: 'stun:stun.cloudflare.com:3478' }
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    };

    // 저지연 모드 최적화
    if (this.config.lowLatencyMode) {
      baseConfig.iceCandidatePoolSize = 20; // 더 많은 ICE 후보
      baseConfig.iceTransportPolicy = 'all'; // 모든 전송 방식 허용
    }

    return baseConfig;
  }

  /**
   * 미디어 제약 조건 생성
   */
  createMediaConstraints(): MediaStreamConstraints {
    const constraints: MediaStreamConstraints = {
      video: {
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 },
        frameRate: { ideal: 30, max: 60 },
        facingMode: 'user'
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    };

    // 품질 프리셋에 따른 조정
    switch (this.config.qualityPreset) {
      case 'ultra_low_latency':
        constraints.video = {
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
          frameRate: { ideal: 30, max: 30 }
        };
        break;
      case 'low_latency':
        constraints.video = {
          width: { ideal: 1600, max: 1600 },
          height: { ideal: 900, max: 900 },
          frameRate: { ideal: 30, max: 30 }
        };
        break;
      case 'balanced':
        // 기본 설정 유지
        break;
      case 'quality':
        constraints.video = {
          width: { ideal: 1920, max: 3840 },
          height: { ideal: 1080, max: 2160 },
          frameRate: { ideal: 30, max: 60 }
        };
        break;
    }

    return constraints;
  }

  /**
   * WebRTC 연결 최적화
   */
  async optimizeConnection(peerConnection: RTCPeerConnection): Promise<void> {
    this.peerConnection = peerConnection;

    // 트랜시버 설정 최적화
    await this.optimizeTransceivers();

    // 통계 모니터링 시작
    this.startStatsMonitoring();

    // 연결 상태 모니터링
    this.setupConnectionMonitoring();
  }

  /**
   * 트랜시버 최적화
   */
  private async optimizeTransceivers(): Promise<void> {
    if (!this.peerConnection) return;

    const transceivers = this.peerConnection.getTransceivers();
    
    for (const transceiver of transceivers) {
      if (transceiver.direction === 'sendrecv' || transceiver.direction === 'sendonly') {
        const sender = transceiver.sender;
        
        if (sender && sender.track) {
          // 비디오 트랙 최적화
          if (sender.track.kind === 'video') {
            await this.optimizeVideoSender(sender);
          }
          // 오디오 트랙 최적화
          else if (sender.track.kind === 'audio') {
            await this.optimizeAudioSender(sender);
          }
        }
      }
    }
  }

  /**
   * 비디오 전송 최적화
   */
  private async optimizeVideoSender(sender: RTCRtpSender): Promise<void> {
    const params = sender.getParameters();
    
    if (params.encodings && params.encodings.length > 0) {
      // 비트레이트 설정
      params.encodings[0].maxBitrate = this.config.maxBitrate;
      params.encodings[0].minBitrate = this.config.minBitrate;
      
      // 저지연 모드 최적화
      if (this.config.lowLatencyMode) {
        params.encodings[0].maxFramerate = 30;
        params.encodings[0].scaleResolutionDownBy = 1;
        params.encodings[0].priority = 'high';
      }

      // 적응적 비트레이트 설정
      if (this.config.adaptiveBitrate) {
        params.encodings[0].adaptivePtime = true;
      }

      await sender.setParameters(params);
    }
  }

  /**
   * 오디오 전송 최적화
   */
  private async optimizeAudioSender(sender: RTCRtpSender): Promise<void> {
    const params = sender.getParameters();
    
    if (params.encodings && params.encodings.length > 0) {
      // 오디오 비트레이트 최적화
      params.encodings[0].maxBitrate = 128000; // 128 kbps
      params.encodings[0].priority = 'high';

      await sender.setParameters(params);
    }
  }

  /**
   * 통계 모니터링 시작
   */
  private startStatsMonitoring(): void {
    if (!this.peerConnection) return;

    this.statsInterval = setInterval(async () => {
      if (this.peerConnection) {
        const stats = await this.peerConnection.getStats();
        
        // 통계 분석 및 최적화
        this.analyzeStats(stats);
        
        // 콜백 호출
        if (this.onStatsUpdate) {
          this.onStatsUpdate(stats);
        }
      }
    }, 1000);
  }

  /**
   * 통계 분석 및 동적 최적화
   */
  private analyzeStats(stats: RTCStatsReport): void {
    let totalPacketsSent = 0;
    let totalPacketsLost = 0;
    let totalBytesReceived = 0;
    let totalBytesReceivedPerSecond = 0;
    let currentRoundTripTime = 0;
    let jitter = 0;

    stats.forEach((report) => {
      // 인바운드 RTP 통계
      if (report.type === 'inbound-rtp') {
        totalBytesReceived += report.bytesReceived || 0;
        totalPacketsLost += report.packetsLost || 0;
        jitter = report.jitter || 0;
      }
      
      // 아웃바운드 RTP 통계
      if (report.type === 'outbound-rtp') {
        totalPacketsSent += report.packetsSent || 0;
        totalBytesReceivedPerSecond = report.bytesSent || 0;
      }
      
      // 연결 통계
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        currentRoundTripTime = report.currentRoundTripTime || 0;
      }
    });

    // 패킷 손실률 계산
    const packetLossRate = totalPacketsSent > 0 ? totalPacketsLost / totalPacketsSent : 0;

    // 동적 비트레이트 조정
    if (this.config.adaptiveBitrate) {
      this.adjustBitrateBasedOnStats(packetLossRate, currentRoundTripTime, jitter);
    }

    // 성능 메트릭 로깅
    console.log(`WebRTC 성능: 패킷손실=${(packetLossRate * 100).toFixed(2)}%, RTT=${(currentRoundTripTime * 1000).toFixed(1)}ms, 지터=${(jitter * 1000).toFixed(1)}ms`);
  }

  /**
   * 통계 기반 비트레이트 동적 조정
   */
  private async adjustBitrateBasedOnStats(packetLossRate: number, rtt: number, jitter: number): Promise<void> {
    if (!this.peerConnection) return;

    const transceivers = this.peerConnection.getTransceivers();
    
    for (const transceiver of transceivers) {
      const sender = transceiver.sender;
      
      if (sender && sender.track && sender.track.kind === 'video') {
        const params = sender.getParameters();
        
        if (params.encodings && params.encodings.length > 0) {
          const currentBitrate = params.encodings[0].maxBitrate || this.config.targetBitrate;
          let newBitrate = currentBitrate;

          // 패킷 손실률 기반 조정
          if (packetLossRate > 0.02) { // 2% 이상 패킷 손실
            newBitrate = Math.max(this.config.minBitrate, newBitrate * 0.8);
          } else if (packetLossRate < 0.005) { // 0.5% 미만 패킷 손실
            newBitrate = Math.min(this.config.maxBitrate, newBitrate * 1.2);
          }

          // RTT 기반 조정
          if (rtt > 0.1) { // 100ms 이상 RTT
            newBitrate = Math.max(this.config.minBitrate, newBitrate * 0.9);
          }

          // 지터 기반 조정
          if (jitter > 0.05) { // 50ms 이상 지터
            newBitrate = Math.max(this.config.minBitrate, newBitrate * 0.85);
          }

          // 비트레이트 업데이트
          if (Math.abs(newBitrate - currentBitrate) > currentBitrate * 0.1) {
            params.encodings[0].maxBitrate = newBitrate;
            await sender.setParameters(params);
            
            console.log(`비트레이트 자동 조정: ${Math.round(currentBitrate/1000)}kbps -> ${Math.round(newBitrate/1000)}kbps`);
          }
        }
      }
    }
  }

  /**
   * 연결 상태 모니터링
   */
  private setupConnectionMonitoring(): void {
    if (!this.peerConnection) return;

    // 연결 상태 변경 감지
    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection) {
        console.log(`WebRTC 연결 상태: ${this.peerConnection.connectionState}`);
        
        if (this.peerConnection.connectionState === 'connected') {
          console.log('WebRTC 연결 최적화 완료');
        } else if (this.peerConnection.connectionState === 'failed') {
          console.error('WebRTC 연결 실패 - 재연결 시도');
          this.handleConnectionFailure();
        }
      }
    };

    // ICE 연결 상태 감지
    this.peerConnection.oniceconnectionstatechange = () => {
      if (this.peerConnection) {
        console.log(`ICE 연결 상태: ${this.peerConnection.iceConnectionState}`);
      }
    };
  }

  /**
   * 연결 실패 처리
   */
  private handleConnectionFailure(): void {
    console.log('WebRTC 연결 복구 시도 중...');
    
    // 여기에 재연결 로직 구현
    // 예: ICE 재시작, 새로운 Offer/Answer 생성 등
  }

  /**
   * 통계 업데이트 콜백 설정
   */
  setStatsUpdateCallback(callback: (stats: RTCStatsReport) => void): void {
    this.onStatsUpdate = callback;
  }

  /**
   * 비트레이트 수동 조정
   */
  async setBitrate(bitrate: number): Promise<void> {
    if (!this.peerConnection) return;

    const transceivers = this.peerConnection.getTransceivers();
    
    for (const transceiver of transceivers) {
      const sender = transceiver.sender;
      
      if (sender && sender.track && sender.track.kind === 'video') {
        const params = sender.getParameters();
        
        if (params.encodings && params.encodings.length > 0) {
          params.encodings[0].maxBitrate = bitrate;
          await sender.setParameters(params);
        }
      }
    }
  }

  /**
   * 정리
   */
  cleanup(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    
    this.peerConnection = null;
    this.onStatsUpdate = undefined;
  }
}

/**
 * 저지연 프리셋 구성
 */
export const createLowLatencyConfig = (): WebRTCOptimizationConfig => ({
  lowLatencyMode: true,
  adaptiveBitrate: true,
  targetBitrate: 2000000,    // 2 Mbps
  minBitrate: 500000,        // 500 kbps
  maxBitrate: 5000000,       // 5 Mbps
  qualityPreset: 'low_latency'
});

/**
 * 울트라 저지연 프리셋 구성
 */
export const createUltraLowLatencyConfig = (): WebRTCOptimizationConfig => ({
  lowLatencyMode: true,
  adaptiveBitrate: true,
  targetBitrate: 1000000,    // 1 Mbps
  minBitrate: 300000,        // 300 kbps
  maxBitrate: 2000000,       // 2 Mbps
  qualityPreset: 'ultra_low_latency'
});

export default WebRTCOptimizer;