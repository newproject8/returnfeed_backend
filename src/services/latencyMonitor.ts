/**
 * 실시간 레이턴시 모니터링 서비스 (패스스루 모드)
 * 
 * 목표: End-to-End 레이턴시 < 75ms 달성 확인
 * 모니터링 구간:
 *   1. PD 인코딩: ~23ms
 *   2. SRT 전송: ~7ms
 *   3. MediaMTX 패스스루: ~2ms
 *   4. WebRTC 전송: ~13ms
 *   5. 브라우저 디코딩: ~7ms
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { performance } from 'perf_hooks';
import axios from 'axios';

export interface LatencySegment {
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  target: number;  // 목표 레이턴시 (ms)
  optimal: boolean;
}

export interface LatencyTrace {
  traceId: string;
  sessionId: string;
  cameraId: string;
  startTime: number;
  endTime: number;
  totalLatency: number;
  segments: LatencySegment[];
  passthroughMode: boolean;
  codecInfo: {
    video: string;
    audio: string;
  };
  networkInfo: {
    rtt: number;
    jitter: number;
    packetLoss: number;
  };
}

export interface LatencyAlert {
  type: 'warning' | 'critical';
  message: string;
  segment: string;
  actualLatency: number;
  targetLatency: number;
  timestamp: number;
}

export class LatencyMonitor extends EventEmitter {
  // 레이턴시 목표 (패스스루 모드)
  private readonly TARGETS = {
    pdEncoding: 25,        // PD 인코딩 목표
    srtTransmit: 8,        // SRT 전송 목표
    mediamtxPass: 3,       // MediaMTX 패스스루 목표
    webrtcTransmit: 15,    // WebRTC 전송 목표
    browserDecode: 10,     // 브라우저 디코딩 목표
    total: 75              // 전체 목표
  };

  // 경고 임계값
  private readonly WARNING_THRESHOLD = 1.2;  // 목표의 120%
  private readonly CRITICAL_THRESHOLD = 1.5; // 목표의 150%

  // 데이터 저장
  private traces: Map<string, LatencyTrace[]> = new Map();
  private activeTraces: Map<string, Partial<LatencyTrace>> = new Map();
  private alerts: LatencyAlert[] = [];

  // 연결 관리
  private pdSoftwareWs: WebSocket | null = null;
  private clientConnections: Map<string, WebSocket> = new Map();
  private mediamtxApiUrl: string;

  // 통계
  private readonly MAX_TRACE_HISTORY = 1000;
  private readonly STATS_INTERVAL = 1000; // 1초
  private readonly CLEANUP_INTERVAL = 60000; // 1분

  constructor(mediamtxApiUrl: string = 'http://localhost:9997') {
    super();
    this.mediamtxApiUrl = mediamtxApiUrl;
    this.initializeConnections();
    this.startPeriodicTasks();
  }

  /**
   * 연결 초기화
   */
  private initializeConnections(): void {
    // PD 소프트웨어 연결은 BitrateManager와 공유
    // 여기서는 MediaMTX 모니터링만 처리
    this.monitorMediaMTX();
  }

  /**
   * MediaMTX 모니터링
   */
  private async monitorMediaMTX(): Promise<void> {
    try {
      // MediaMTX 메트릭 API 호출
      const response = await axios.get(`${this.mediamtxApiUrl}/metrics`);
      
      // Prometheus 형식 메트릭 파싱
      const metrics = this.parsePrometheusMetrics(response.data);
      
      // 패스스루 관련 메트릭 추출
      const passthroughMetrics = {
        activeStreams: metrics['mediamtx_paths_count'] || 0,
        bytesReceived: metrics['mediamtx_paths_bytes_received'] || 0,
        bytesSent: metrics['mediamtx_paths_bytes_sent'] || 0,
        // 패스스루 모드에서는 트랜스코딩 메트릭이 0이어야 함
        transcodingActive: metrics['mediamtx_transcoding_active'] || 0
      };

      if (passthroughMetrics.transcodingActive > 0) {
        this.createAlert('warning', 'MediaMTX transcoding detected', 'mediamtx', 
          passthroughMetrics.transcodingActive, 0);
      }

      this.emit('mediamtx_metrics', passthroughMetrics);
    } catch (error) {
      console.error('MediaMTX 모니터링 오류:', error);
    }
  }

  /**
   * 레이턴시 추적 시작
   */
  public startTrace(sessionId: string, cameraId: string, metadata?: any): string {
    const traceId = `${sessionId}_${cameraId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const trace: Partial<LatencyTrace> = {
      traceId,
      sessionId,
      cameraId,
      startTime: performance.now(),
      segments: [],
      passthroughMode: true,
      codecInfo: {
        video: 'h264_baseline',
        audio: 'opus'
      },
      networkInfo: {
        rtt: 0,
        jitter: 0,
        packetLoss: 0
      }
    };

    this.activeTraces.set(traceId, trace);

    // 타임아웃 설정 (10초 후 자동 정리)
    setTimeout(() => {
      if (this.activeTraces.has(traceId)) {
        this.completeTrace(traceId, 'timeout');
      }
    }, 10000);

    return traceId;
  }

  /**
   * 레이턴시 세그먼트 기록
   */
  public recordSegment(traceId: string, segmentName: string, duration: number): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;

    const target = this.TARGETS[segmentName as keyof typeof this.TARGETS] || 10;
    const optimal = duration <= target;

    const segment: LatencySegment = {
      name: segmentName,
      startTime: trace.segments?.length ? 
        trace.segments[trace.segments.length - 1].endTime : trace.startTime!,
      endTime: trace.startTime! + duration,
      duration,
      target,
      optimal
    };

    trace.segments!.push(segment);

    // 경고 확인
    if (duration > target * this.WARNING_THRESHOLD) {
      const severity = duration > target * this.CRITICAL_THRESHOLD ? 'critical' : 'warning';
      this.createAlert(severity, `High latency in ${segmentName}`, segmentName, duration, target);
    }

    this.emit('segment_recorded', { traceId, segment });
  }

  /**
   * 레이턴시 추적 완료
   */
  public completeTrace(traceId: string, reason: string = 'completed'): LatencyTrace | null {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return null;

    // 완성된 추적 생성
    const completedTrace: LatencyTrace = {
      ...trace as LatencyTrace,
      endTime: performance.now(),
      totalLatency: trace.segments?.reduce((sum, seg) => sum + seg.duration, 0) || 0
    };

    // 저장
    const key = `${trace.sessionId}_${trace.cameraId}`;
    if (!this.traces.has(key)) {
      this.traces.set(key, []);
    }

    const traceList = this.traces.get(key)!;
    traceList.push(completedTrace);

    // 히스토리 크기 제한
    if (traceList.length > this.MAX_TRACE_HISTORY) {
      traceList.shift();
    }

    // 정리
    this.activeTraces.delete(traceId);

    // 전체 레이턴시 확인
    if (completedTrace.totalLatency > this.TARGETS.total) {
      const severity = completedTrace.totalLatency > this.TARGETS.total * this.CRITICAL_THRESHOLD ? 
        'critical' : 'warning';
      this.createAlert(severity, 'Total latency exceeded target', 'total', 
        completedTrace.totalLatency, this.TARGETS.total);
    }

    this.emit('trace_completed', completedTrace);

    return completedTrace;
  }

  /**
   * 경고 생성
   */
  private createAlert(
    type: 'warning' | 'critical', 
    message: string, 
    segment: string, 
    actualLatency: number, 
    targetLatency: number
  ): void {
    const alert: LatencyAlert = {
      type,
      message,
      segment,
      actualLatency,
      targetLatency,
      timestamp: Date.now()
    };

    this.alerts.push(alert);
    
    // 최근 100개만 유지
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    this.emit('latency_alert', alert);

    console.warn(`[LATENCY ALERT] ${type.toUpperCase()}: ${message} - ` +
      `${segment}: ${actualLatency}ms (target: ${targetLatency}ms)`);
  }

  /**
   * 실시간 통계 계산
   */
  public getRealtimeStats(sessionId: string, cameraId: string): any {
    const key = `${sessionId}_${cameraId}`;
    const traces = this.traces.get(key) || [];
    
    if (traces.length === 0) {
      return this.getEmptyStats();
    }

    // 최근 100개 추적만 사용
    const recentTraces = traces.slice(-100);
    
    // 세그먼트별 통계
    const segmentStats: any = {};
    Object.keys(this.TARGETS).forEach(segment => {
      if (segment === 'total') return;
      
      const durations = recentTraces
        .flatMap(t => t.segments)
        .filter(s => s.name === segment)
        .map(s => s.duration);
      
      if (durations.length > 0) {
        segmentStats[segment] = {
          current: durations[durations.length - 1],
          average: durations.reduce((a, b) => a + b, 0) / durations.length,
          min: Math.min(...durations),
          max: Math.max(...durations),
          p50: this.percentile(durations, 50),
          p95: this.percentile(durations, 95),
          p99: this.percentile(durations, 99),
          target: this.TARGETS[segment as keyof typeof this.TARGETS],
          samples: durations.length
        };
      }
    });

    // 전체 통계
    const totalLatencies = recentTraces.map(t => t.totalLatency);
    const overallStats = {
      current: totalLatencies[totalLatencies.length - 1],
      average: totalLatencies.reduce((a, b) => a + b, 0) / totalLatencies.length,
      min: Math.min(...totalLatencies),
      max: Math.max(...totalLatencies),
      p50: this.percentile(totalLatencies, 50),
      p95: this.percentile(totalLatencies, 95),
      p99: this.percentile(totalLatencies, 99),
      target: this.TARGETS.total,
      samples: totalLatencies.length,
      successRate: (totalLatencies.filter(l => l <= this.TARGETS.total).length / totalLatencies.length) * 100
    };

    // 패스스루 모드 확인
    const passthroughRate = (recentTraces.filter(t => t.passthroughMode).length / recentTraces.length) * 100;

    return {
      sessionId,
      cameraId,
      timestamp: Date.now(),
      segments: segmentStats,
      overall: overallStats,
      passthroughMode: passthroughRate === 100,
      passthroughRate,
      recentAlerts: this.alerts.slice(-10)
    };
  }

  /**
   * 빈 통계 반환
   */
  private getEmptyStats(): any {
    const emptySegments: any = {};
    Object.keys(this.TARGETS).forEach(segment => {
      if (segment === 'total') return;
      emptySegments[segment] = {
        current: 0,
        average: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        target: this.TARGETS[segment as keyof typeof this.TARGETS],
        samples: 0
      };
    });

    return {
      timestamp: Date.now(),
      segments: emptySegments,
      overall: {
        current: 0,
        average: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        target: this.TARGETS.total,
        samples: 0,
        successRate: 0
      },
      passthroughMode: true,
      passthroughRate: 100,
      recentAlerts: []
    };
  }

  /**
   * 백분위수 계산
   */
  private percentile(values: number[], percentile: number): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    
    if (Math.floor(index) === index) {
      return sorted[index];
    } else {
      const lower = sorted[Math.floor(index)];
      const upper = sorted[Math.ceil(index)];
      const weight = index % 1;
      return lower * (1 - weight) + upper * weight;
    }
  }

  /**
   * Prometheus 메트릭 파싱
   */
  private parsePrometheusMetrics(data: string): Record<string, number> {
    const metrics: Record<string, number> = {};
    const lines = data.split('\n');
    
    lines.forEach(line => {
      if (line.startsWith('#') || !line.trim()) return;
      
      const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\s+(\d+(?:\.\d+)?)/);
      if (match) {
        metrics[match[1]] = parseFloat(match[2]);
      }
    });
    
    return metrics;
  }

  /**
   * 주기적 작업 시작
   */
  private startPeriodicTasks(): void {
    // 통계 브로드캐스트
    setInterval(() => {
      this.broadcastStats();
    }, this.STATS_INTERVAL);

    // MediaMTX 모니터링
    setInterval(() => {
      this.monitorMediaMTX();
    }, 5000);

    // 오래된 데이터 정리
    setInterval(() => {
      this.cleanupOldData();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * 통계 브로드캐스트
   */
  private broadcastStats(): void {
    this.traces.forEach((_, key) => {
      const [sessionId, cameraId] = key.split('_');
      const stats = this.getRealtimeStats(sessionId, cameraId);
      
      const message = {
        type: 'latency_stats',
        stats
      };
      
      this.clientConnections.forEach((ws, clientId) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
        }
      });
    });
  }

  /**
   * 오래된 데이터 정리
   */
  private cleanupOldData(): void {
    const now = Date.now();
    
    // 1시간 이상 된 경고 제거
    this.alerts = this.alerts.filter(alert => 
      (now - alert.timestamp) < 3600000
    );
    
    // 활성 추적 중 타임아웃된 것 제거
    this.activeTraces.forEach((trace, traceId) => {
      if (trace.startTime && (performance.now() - trace.startTime) > 60000) {
        this.activeTraces.delete(traceId);
      }
    });
  }

  /**
   * 클라이언트 연결 등록
   */
  public registerClient(clientId: string, ws: WebSocket): void {
    this.clientConnections.set(clientId, ws);
    
    ws.on('close', () => {
      this.clientConnections.delete(clientId);
    });
  }

  /**
   * 정리
   */
  public cleanup(): void {
    this.clientConnections.forEach(ws => ws.close());
    this.clientConnections.clear();
    this.traces.clear();
    this.activeTraces.clear();
    this.alerts = [];
  }
}

export default LatencyMonitor;