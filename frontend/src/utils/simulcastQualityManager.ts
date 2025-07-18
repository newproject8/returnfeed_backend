/**
 * 시뮬캐스트 품질 관리자
 * 네트워크 상태에 따라 1Mbps와 0.1Mbps 사이를 자동 전환
 */

export interface QualityMetrics {
  packetLoss: number;      // 패킷 손실률 (0-1)
  rtt: number;            // Round Trip Time (ms)
  jitter: number;         // 지터 (ms)
  bandwidth: number;      // 예상 대역폭 (bps)
  framesDropped: number;  // 드롭된 프레임 수
}

export interface QualityDecision {
  targetQuality: 'high' | 'low';
  confidence: number;     // 0-1, 결정 신뢰도
  reason: string;
}

export class SimulcastQualityManager {
  private metricsHistory: QualityMetrics[] = [];
  private currentQuality: 'high' | 'low' = 'high';
  private lastSwitchTime: number = Date.now();
  private switchCount: number = 0;
  
  // 임계값 설정
  private readonly THRESHOLDS = {
    // High → Low 전환 임계값
    highToLow: {
      packetLoss: 0.03,      // 3% 이상 패킷 손실
      rtt: 150,              // 150ms 이상 RTT
      bandwidth: 200000,     // 200kbps 미만 대역폭
      framesDropped: 10      // 10 프레임 이상 드롭
    },
    // Low → High 전환 임계값 (히스테리시스 적용)
    lowToHigh: {
      packetLoss: 0.01,      // 1% 미만 패킷 손실
      rtt: 100,              // 100ms 미만 RTT
      bandwidth: 1500000,    // 1.5Mbps 이상 대역폭
      framesDropped: 2       // 2 프레임 미만 드롭
    }
  };
  
  // 설정
  private readonly CONFIG = {
    historySize: 10,             // 메트릭 히스토리 크기
    minSwitchInterval: 5000,     // 최소 전환 간격 (5초)
    maxSwitchesPerMinute: 6,     // 분당 최대 전환 횟수
    smoothingFactor: 0.7         // 지수 이동 평균 계수
  };

  constructor() {
    // 1분마다 전환 카운터 리셋
    setInterval(() => {
      this.switchCount = 0;
    }, 60000);
  }

  /**
   * 새로운 메트릭 추가 및 품질 결정
   */
  public addMetrics(metrics: QualityMetrics): QualityDecision {
    // 메트릭 히스토리 업데이트
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > this.CONFIG.historySize) {
      this.metricsHistory.shift();
    }

    // 평활화된 메트릭 계산
    const smoothedMetrics = this.calculateSmoothedMetrics();
    
    // 품질 결정
    return this.makeQualityDecision(smoothedMetrics);
  }

  /**
   * 지수 이동 평균을 사용한 메트릭 평활화
   */
  private calculateSmoothedMetrics(): QualityMetrics {
    if (this.metricsHistory.length === 0) {
      return {
        packetLoss: 0,
        rtt: 0,
        jitter: 0,
        bandwidth: 1000000,
        framesDropped: 0
      };
    }

    const alpha = this.CONFIG.smoothingFactor;
    let smoothed = { ...this.metricsHistory[0] };

    for (let i = 1; i < this.metricsHistory.length; i++) {
      const current = this.metricsHistory[i];
      smoothed.packetLoss = alpha * current.packetLoss + (1 - alpha) * smoothed.packetLoss;
      smoothed.rtt = alpha * current.rtt + (1 - alpha) * smoothed.rtt;
      smoothed.jitter = alpha * current.jitter + (1 - alpha) * smoothed.jitter;
      smoothed.bandwidth = alpha * current.bandwidth + (1 - alpha) * smoothed.bandwidth;
      smoothed.framesDropped = alpha * current.framesDropped + (1 - alpha) * smoothed.framesDropped;
    }

    return smoothed;
  }

  /**
   * 품질 전환 결정
   */
  private makeQualityDecision(metrics: QualityMetrics): QualityDecision {
    const now = Date.now();
    const timeSinceLastSwitch = now - this.lastSwitchTime;

    // 전환 간격 제한 확인
    if (timeSinceLastSwitch < this.CONFIG.minSwitchInterval) {
      return {
        targetQuality: this.currentQuality,
        confidence: 0.5,
        reason: '최소 전환 간격 미충족'
      };
    }

    // 전환 빈도 제한 확인
    if (this.switchCount >= this.CONFIG.maxSwitchesPerMinute) {
      return {
        targetQuality: this.currentQuality,
        confidence: 0.5,
        reason: '분당 최대 전환 횟수 초과'
      };
    }

    // 현재 품질에 따른 임계값 선택
    const thresholds = this.currentQuality === 'high' 
      ? this.THRESHOLDS.highToLow 
      : this.THRESHOLDS.lowToHigh;

    // 각 메트릭별 점수 계산 (0-1)
    const scores = {
      packetLoss: this.calculateScore(metrics.packetLoss, thresholds.packetLoss, true),
      rtt: this.calculateScore(metrics.rtt, thresholds.rtt, true),
      bandwidth: this.calculateScore(metrics.bandwidth, thresholds.bandwidth, false),
      framesDropped: this.calculateScore(metrics.framesDropped, thresholds.framesDropped, true)
    };

    // 가중 평균 점수 계산
    const weights = {
      packetLoss: 0.35,
      rtt: 0.25,
      bandwidth: 0.30,
      framesDropped: 0.10
    };

    const totalScore = Object.entries(scores).reduce((sum, [key, score]) => {
      return sum + score * weights[key as keyof typeof weights];
    }, 0);

    // 품질 전환 결정
    let targetQuality = this.currentQuality;
    let reason = '현재 품질 유지';
    let confidence = totalScore;

    if (this.currentQuality === 'high' && totalScore > 0.7) {
      // 고품질 → 저품질 전환
      targetQuality = 'low';
      reason = this.getDowngradeReason(metrics);
      confidence = totalScore;
    } else if (this.currentQuality === 'low' && totalScore < 0.3) {
      // 저품질 → 고품질 전환
      targetQuality = 'high';
      reason = this.getUpgradeReason(metrics);
      confidence = 1 - totalScore;
    }

    // 품질 변경 시 업데이트
    if (targetQuality !== this.currentQuality) {
      this.currentQuality = targetQuality;
      this.lastSwitchTime = now;
      this.switchCount++;
      
      console.log(`[SIMULCAST] 품질 전환: ${this.currentQuality} → ${targetQuality} (${reason})`);
    }

    return {
      targetQuality,
      confidence,
      reason
    };
  }

  /**
   * 점수 계산 (0-1, 0이 좋음)
   */
  private calculateScore(value: number, threshold: number, higherIsBad: boolean): number {
    if (higherIsBad) {
      return Math.min(1, value / threshold);
    } else {
      return Math.max(0, 1 - (value / threshold));
    }
  }

  /**
   * 다운그레이드 이유 생성
   */
  private getDowngradeReason(metrics: QualityMetrics): string {
    const reasons = [];
    
    if (metrics.packetLoss > this.THRESHOLDS.highToLow.packetLoss) {
      reasons.push(`패킷 손실 ${(metrics.packetLoss * 100).toFixed(1)}%`);
    }
    if (metrics.rtt > this.THRESHOLDS.highToLow.rtt) {
      reasons.push(`높은 RTT ${metrics.rtt.toFixed(0)}ms`);
    }
    if (metrics.bandwidth < this.THRESHOLDS.highToLow.bandwidth) {
      reasons.push(`낮은 대역폭 ${(metrics.bandwidth / 1000).toFixed(0)}kbps`);
    }
    if (metrics.framesDropped > this.THRESHOLDS.highToLow.framesDropped) {
      reasons.push(`프레임 드롭 ${metrics.framesDropped}개`);
    }

    return reasons.length > 0 ? reasons.join(', ') : '네트워크 품질 저하';
  }

  /**
   * 업그레이드 이유 생성
   */
  private getUpgradeReason(metrics: QualityMetrics): string {
    return `네트워크 품질 개선 (패킷 손실 ${(metrics.packetLoss * 100).toFixed(1)}%, RTT ${metrics.rtt.toFixed(0)}ms)`;
  }

  /**
   * 현재 품질 상태 조회
   */
  public getCurrentQuality(): 'high' | 'low' {
    return this.currentQuality;
  }

  /**
   * 품질 히스토리 조회
   */
  public getQualityHistory(): {
    timestamp: number;
    quality: 'high' | 'low';
    metrics: QualityMetrics;
  }[] {
    return this.metricsHistory.map((metrics, index) => ({
      timestamp: Date.now() - (this.metricsHistory.length - index - 1) * 1000,
      quality: this.currentQuality,
      metrics
    }));
  }

  /**
   * 통계 정보 조회
   */
  public getStatistics() {
    const avgMetrics = this.calculateSmoothedMetrics();
    
    return {
      currentQuality: this.currentQuality,
      switchCount: this.switchCount,
      timeSinceLastSwitch: Date.now() - this.lastSwitchTime,
      averageMetrics: avgMetrics,
      qualityDistribution: this.calculateQualityDistribution()
    };
  }

  /**
   * 품질 분포 계산
   */
  private calculateQualityDistribution(): { high: number; low: number } {
    // 최근 1분간의 품질 분포 추정
    const totalTime = 60000; // 1분
    const highTime = this.currentQuality === 'high' 
      ? Date.now() - this.lastSwitchTime 
      : 0;
    const lowTime = totalTime - highTime;

    return {
      high: (highTime / totalTime) * 100,
      low: (lowTime / totalTime) * 100
    };
  }

  /**
   * 수동 품질 설정
   */
  public setManualQuality(quality: 'high' | 'low') {
    this.currentQuality = quality;
    this.lastSwitchTime = Date.now();
    console.log(`[SIMULCAST] 수동 품질 설정: ${quality}`);
  }

  /**
   * 리셋
   */
  public reset() {
    this.metricsHistory = [];
    this.currentQuality = 'high';
    this.lastSwitchTime = Date.now();
    this.switchCount = 0;
  }
}