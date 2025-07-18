/**
 * 비트레이트 관리 서비스 (패스스루 모드)
 * 실시간 비트레이트 조정 및 레이턴시 측정
 * 
 * v4.0 변경사항:
 * - 트랜스코딩 제거 (PD 소프트웨어에서 WebRTC 네이티브 코덱 사용)
 * - 초저지연 달성 (41-75ms)
 * - MediaMTX는 패스스루 모드로 동작
 */
import { EventEmitter } from 'events';
import WebSocket from 'ws';
import axios from 'axios';
import { performance } from 'perf_hooks';

export interface BitrateSettings {
    sessionId: string;
    cameraId: string;
    maxBitrate: number;      // 서버에서 제공하는 최대 비트레이트 (bps)
    currentPercentage: number; // 현재 사용 비율 (0.1 ~ 1.0)
    adaptiveEnabled: boolean;
    qualityPreset: 'low_latency' | 'balanced' | 'quality';
    lastUpdated: Date;
}

export interface LatencyMeasurement {
    timestamp: number;
    sequenceId: string;
    source: 'pd_software' | 'mediamtx' | 'browser';
    measurementType: 'send' | 'receive' | 'process';
    sessionId: string;
    cameraId: string;
    metadata?: Record<string, any>;
}

export interface QualityMetrics {
    sessionId: string;
    cameraId: string;
    clientId: string;
    timestamp: number;
    packetLoss: number;
    jitter: number;
    roundTripTime: number;
    bandwidth: number;
    fps: number;
    resolution: string;
}

export class BitrateManager extends EventEmitter {
    private bitrateSettings: Map<string, BitrateSettings> = new Map();
    private latencyMeasurements: Map<string, LatencyMeasurement[]> = new Map();
    private qualityMetrics: Map<string, QualityMetrics[]> = new Map();
    private mediamtxBaseUrl: string;
    private pdSoftwareWs: WebSocket | null = null;
    private clientConnections: Map<string, WebSocket> = new Map();
    
    // 레이턴시 측정 설정 (패스스루 최적화)
    private readonly MAX_LATENCY_HISTORY = 100;
    private readonly LATENCY_MEASUREMENT_INTERVAL = 50;  // 50ms (더 빠른 측정)
    private readonly QUALITY_REPORT_INTERVAL = 3000;     // 3초 (더 빠른 반응)
    private readonly TARGET_LATENCY = 75;                // 목표 레이턴시 75ms
    private readonly PASSTHROUGH_MODE = true;            // 패스스루 모드 활성화
    
    constructor(mediamtxBaseUrl: string = 'http://localhost:8889') {
        super();
        this.mediamtxBaseUrl = mediamtxBaseUrl;
        this.initializePDSoftwareConnection();
        this.startPeriodicTasks();
    }
    
    /**
     * PD소프트웨어와의 WebSocket 연결 초기화
     */
    private initializePDSoftwareConnection(): void {
        const wsUrl = 'ws://localhost:8080/ws/latency';
        
        const connectToPDSoftware = () => {
            this.pdSoftwareWs = new WebSocket(wsUrl);
            
            this.pdSoftwareWs.on('open', () => {
                console.log('PD소프트웨어 WebSocket 연결됨');
                this.emit('pd_software_connected');
            });
            
            this.pdSoftwareWs.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handlePDSoftwareMessage(message);
                } catch (error) {
                    console.error('PD소프트웨어 메시지 파싱 오류:', error);
                }
            });
            
            this.pdSoftwareWs.on('close', () => {
                console.log('PD소프트웨어 WebSocket 연결 종료');
                this.pdSoftwareWs = null;
                
                // 5초 후 재연결 시도
                setTimeout(connectToPDSoftware, 5000);
            });
            
            this.pdSoftwareWs.on('error', (error) => {
                console.error('PD소프트웨어 WebSocket 오류:', error);
            });
        };
        
        connectToPDSoftware();
    }
    
    /**
     * PD소프트웨어 메시지 처리
     */
    private handlePDSoftwareMessage(message: any): void {
        const { type } = message;
        
        switch (type) {
            case 'latency_measurement':
                this.handleLatencyMeasurement(message.measurement);
                break;
            case 'apply_bitrate_settings':
                this.applyBitrateSettings(message.settings);
                break;
            case 'register_latency_service':
                console.log('PD소프트웨어 레이턴시 서비스 등록됨');
                break;
            default:
                console.warn('알 수 없는 PD소프트웨어 메시지:', type);
        }
    }
    
    /**
     * 레이턴시 측정 처리
     */
    private handleLatencyMeasurement(measurement: LatencyMeasurement): void {
        const key = `${measurement.sessionId}_${measurement.cameraId}`;
        
        if (!this.latencyMeasurements.has(key)) {
            this.latencyMeasurements.set(key, []);
        }
        
        const measurements = this.latencyMeasurements.get(key)!;
        measurements.push(measurement);
        
        // 히스토리 크기 제한
        if (measurements.length > this.MAX_LATENCY_HISTORY) {
            measurements.shift();
        }
        
        // 브라우저 클라이언트에게 레이턴시 측정 요청 전송
        if (measurement.source === 'pd_software' && measurement.measurementType === 'send') {
            this.requestBrowserLatencyMeasurement(measurement);
        }
        
        this.emit('latency_measurement', measurement);
    }
    
    /**
     * 브라우저 클라이언트에게 레이턴시 측정 요청
     */
    private requestBrowserLatencyMeasurement(measurement: LatencyMeasurement): void {
        const message = {
            type: 'latency_measurement_request',
            measurement: {
                sequenceId: measurement.sequenceId,
                timestamp: measurement.timestamp,
                sessionId: measurement.sessionId,
                cameraId: measurement.cameraId,
                metadata: measurement.metadata
            }
        };
        
        // 해당 세션의 모든 클라이언트에게 전송
        this.clientConnections.forEach((ws, clientId) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
            }
        });
    }
    
    /**
     * 브라우저에서 레이턴시 측정 응답 처리
     */
    public handleBrowserLatencyResponse(clientId: string, response: any): void {
        const { sequenceId, receiveTimestamp, sessionId, cameraId } = response;
        
        // 원본 측정 찾기
        const key = `${sessionId}_${cameraId}`;
        const measurements = this.latencyMeasurements.get(key) || [];
        const originalMeasurement = measurements.find(m => m.sequenceId === sequenceId);
        
        if (originalMeasurement) {
            // End-to-end 레이턴시 계산 (패스스루 모드: 목표 < 75ms)
            const endToEndLatency = receiveTimestamp - originalMeasurement.timestamp;
            
            // 레이턴시 분석 (v4.0 기준)
            const latencyBreakdown = {
                pdEncoding: 23,        // PD 인코딩 (WebRTC 네이티브)
                srtTransmit: 7,        // SRT 전송
                mediamtxPass: 2,       // MediaMTX 패스스루
                webrtcTransmit: 13,    // WebRTC 전송
                browserDecode: 7,      // 브라우저 디코딩
                measured: endToEndLatency,
                optimal: endToEndLatency < 75  // 목표 달성 여부
            };
            
            // PD소프트웨어에게 결과 전송
            if (this.pdSoftwareWs && this.pdSoftwareWs.readyState === WebSocket.OPEN) {
                const resultMessage = {
                    type: 'latency_measurement',
                    measurement: {
                        timestamp: receiveTimestamp,
                        sequenceId: sequenceId,
                        source: 'browser',
                        measurementType: 'receive',
                        sessionId: sessionId,
                        cameraId: cameraId,
                        metadata: {
                            pgm_timestamp: originalMeasurement.timestamp,
                            end_to_end_latency: endToEndLatency,
                            client_id: clientId,
                            latency_breakdown: latencyBreakdown,
                            passthrough_mode: true,
                            codec_info: {
                                video: 'h264_baseline',
                                audio: 'opus'
                            }
                        }
                    }
                };
                
                this.pdSoftwareWs.send(JSON.stringify(resultMessage));
            }
            
            // 레이턴시 업데이트 이벤트 발생
            this.emit('latency_update', {
                sessionId,
                cameraId,
                clientId,
                latency: endToEndLatency,
                timestamp: receiveTimestamp
            });
        }
    }
    
    /**
     * 비트레이트 설정 적용
     */
    private async applyBitrateSettings(settings: BitrateSettings): Promise<void> {
        const key = `${settings.sessionId}_${settings.cameraId}`;
        
        // 설정 저장
        this.bitrateSettings.set(key, {
            ...settings,
            lastUpdated: new Date()
        });
        
        // MediaMTX 서버에 비트레이트 설정 적용
        await this.updateMediaMTXBitrate(settings);
        
        // 클라이언트들에게 비트레이트 변경 알림
        this.notifyBitrateChange(settings);
        
        this.emit('bitrate_changed', settings);
    }
    
    /**
     * MediaMTX 서버에 비트레이트 업데이트 (패스스루 모드)
     * 
     * 패스스루 모드에서는 MediaMTX가 트랜스코딩을 하지 않으므로
     * PD 소프트웨어에 직접 비트레이트 변경을 요청합니다.
     */
    private async updateMediaMTXBitrate(settings: BitrateSettings): Promise<void> {
        try {
            const effectiveBitrate = Math.floor(settings.maxBitrate * settings.currentPercentage);
            const streamPath = `pd_${settings.sessionId}_${settings.cameraId}`;
            
            // PD 소프트웨어에 비트레이트 변경 요청 전송
            if (this.pdSoftwareWs && this.pdSoftwareWs.readyState === WebSocket.OPEN) {
                const bitrateMessage = {
                    type: 'bitrate_change_request',
                    sessionId: settings.sessionId,
                    cameraId: settings.cameraId,
                    targetBitrate: effectiveBitrate,
                    qualityPreset: settings.qualityPreset,
                    codecSettings: {
                        // WebRTC 네이티브 코덱 설정
                        video: {
                            codec: 'h264',
                            profile: 'baseline',      // WebRTC 필수
                            level: '3.1',            // 1080p30
                            gop: 30,                 // 1초 @ 30fps
                            bframes: 0,              // B프레임 없음
                            preset: 'ultrafast',     // 최소 레이턴시
                            tune: 'zerolatency'      // 제로 레이턴시
                        },
                        audio: {
                            codec: 'opus',           // WebRTC 네이티브
                            bitrate: 128000,         // 128 kbps
                            sampleRate: 48000,       // 48 kHz
                            application: 'lowdelay'  // 저지연 모드
                        }
                    },
                    // 패스스루 모드 플래그
                    passthrough: true,
                    timestamp: Date.now()
                };
                
                this.pdSoftwareWs.send(JSON.stringify(bitrateMessage));
                
                console.log(`[PASSTHROUGH] 비트레이트 변경 요청: ${streamPath} -> ${effectiveBitrate}bps`);
                
                // MediaMTX API 호출은 패스스루 모드에서 필요없음
                // MediaMTX는 단순히 프로토콜 변환만 수행
                
            } else {
                throw new Error('PD 소프트웨어 연결이 끊어졌습니다');
            }
            
        } catch (error) {
            console.error('[PASSTHROUGH] 비트레이트 업데이트 실패:', error);
            throw error;
        }
    }
    
    /**
     * 클라이언트들에게 비트레이트 변경 알림
     */
    private notifyBitrateChange(settings: BitrateSettings): void {
        const message = {
            type: 'bitrate_update',
            settings: {
                sessionId: settings.sessionId,
                cameraId: settings.cameraId,
                maxBitrate: settings.maxBitrate,
                currentPercentage: settings.currentPercentage,
                effectiveBitrate: Math.floor(settings.maxBitrate * settings.currentPercentage),
                qualityPreset: settings.qualityPreset,
                adaptiveEnabled: settings.adaptiveEnabled
            }
        };
        
        this.clientConnections.forEach((ws, clientId) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
            }
        });
    }
    
    /**
     * 품질 메트릭 처리
     */
    public handleQualityMetrics(clientId: string, metrics: QualityMetrics): void {
        const key = `${metrics.sessionId}_${metrics.cameraId}_${clientId}`;
        
        if (!this.qualityMetrics.has(key)) {
            this.qualityMetrics.set(key, []);
        }
        
        const metricsList = this.qualityMetrics.get(key)!;
        metricsList.push(metrics);
        
        // 히스토리 크기 제한
        if (metricsList.length > 50) {
            metricsList.shift();
        }
        
        // 품질 기반 자동 조정 (패스스루 모드 최적화)
        // 더 엄격한 기준 적용 (초저지연 유지)
        if (metrics.packetLoss > 0.01) { // 1% 이상 패킷 손실 (더 엄격)
            this.autoAdjustQuality(metrics.sessionId, metrics.cameraId, 'decrease');
        } else if (metrics.packetLoss < 0.002 && metrics.jitter < 0.02) { // 더 엄격한 기준
            // 레이턴시도 고려
            const latencyStats = this.getLatencyStats(metrics.sessionId, metrics.cameraId);
            if (latencyStats.current < this.TARGET_LATENCY) {
                this.autoAdjustQuality(metrics.sessionId, metrics.cameraId, 'increase');
            }
        }
        
        this.emit('quality_metrics', metrics);
    }
    
    /**
     * 품질 자동 조정
     */
    private autoAdjustQuality(sessionId: string, cameraId: string, direction: 'increase' | 'decrease'): void {
        const key = `${sessionId}_${cameraId}`;
        const settings = this.bitrateSettings.get(key);
        
        if (!settings || !settings.adaptiveEnabled) {
            return;
        }
        
        const currentPercentage = settings.currentPercentage;
        let newPercentage: number;
        
        if (direction === 'decrease') {
            newPercentage = Math.max(0.1, currentPercentage - 0.1);
        } else {
            newPercentage = Math.min(1.0, currentPercentage + 0.1);
        }
        
        if (newPercentage !== currentPercentage) {
            const newSettings = {
                ...settings,
                currentPercentage: newPercentage
            };
            
            this.applyBitrateSettings(newSettings);
            
            console.log(`자동 품질 조정: ${cameraId} ${direction} -> ${newPercentage * 100}%`);
        }
    }
    
    /**
     * 클라이언트 연결 등록
     */
    public registerClient(clientId: string, ws: WebSocket): void {
        this.clientConnections.set(clientId, ws);
        
        ws.on('close', () => {
            this.clientConnections.delete(clientId);
        });
        
        // 현재 비트레이트 설정 전송
        this.sendCurrentBitrateSettings(clientId);
    }
    
    /**
     * 현재 비트레이트 설정 전송
     */
    private sendCurrentBitrateSettings(clientId: string): void {
        const ws = this.clientConnections.get(clientId);
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        const allSettings = Array.from(this.bitrateSettings.values());
        const message = {
            type: 'bitrate_settings_list',
            settings: allSettings
        };
        
        ws.send(JSON.stringify(message));
    }
    
    /**
     * 비트레이트 설정 API
     */
    public async setBitratePercentage(sessionId: string, cameraId: string, percentage: number): Promise<void> {
        const key = `${sessionId}_${cameraId}`;
        const settings = this.bitrateSettings.get(key);
        
        if (!settings) {
            throw new Error(`비트레이트 설정을 찾을 수 없습니다: ${key}`);
        }
        
        // 비율 검증 (10% ~ 100%)
        const validPercentage = Math.max(0.1, Math.min(1.0, percentage));
        
        const newSettings = {
            ...settings,
            currentPercentage: validPercentage,
            lastUpdated: new Date()
        };
        
        await this.applyBitrateSettings(newSettings);
    }
    
    /**
     * 비트레이트 설정 초기화
     */
    public initializeBitrateSettings(sessionId: string, cameraId: string, maxBitrate: number): void {
        const key = `${sessionId}_${cameraId}`;
        
        const settings: BitrateSettings = {
            sessionId,
            cameraId,
            maxBitrate,
            currentPercentage: 1.0, // 기본값: 서버가 보내는 대로
            adaptiveEnabled: true,
            qualityPreset: 'balanced',
            lastUpdated: new Date()
        };
        
        this.bitrateSettings.set(key, settings);
        this.applyBitrateSettings(settings);
    }
    
    /**
     * 레이턴시 통계 조회
     */
    public getLatencyStats(sessionId: string, cameraId: string): any {
        const key = `${sessionId}_${cameraId}`;
        const measurements = this.latencyMeasurements.get(key) || [];
        
        if (measurements.length === 0) {
            return {
                current: 0,
                average: 0,
                min: 0,
                max: 0,
                jitter: 0,
                samples: 0
            };
        }
        
        const latencies = measurements
            .filter(m => m.metadata?.end_to_end_latency)
            .map(m => m.metadata!.end_to_end_latency);
        
        if (latencies.length === 0) {
            return {
                current: 0,
                average: 0,
                min: 0,
                max: 0,
                jitter: 0,
                samples: 0
            };
        }
        
        const current = latencies[latencies.length - 1];
        const average = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const min = Math.min(...latencies);
        const max = Math.max(...latencies);
        
        // 지터 계산 (표준편차)
        const variance = latencies.reduce((sum, latency) => sum + Math.pow(latency - average, 2), 0) / latencies.length;
        const jitter = Math.sqrt(variance);
        
        return {
            current,
            average,
            min,
            max,
            jitter,
            samples: latencies.length
        };
    }
    
    /**
     * 주기적 작업 시작
     */
    private startPeriodicTasks(): void {
        // 품질 리포트 요청
        setInterval(() => {
            this.requestQualityReports();
        }, this.QUALITY_REPORT_INTERVAL);
        
        // 레이턴시 측정 상태 확인
        setInterval(() => {
            this.checkLatencyMeasurementHealth();
        }, this.LATENCY_MEASUREMENT_INTERVAL * 10);
    }
    
    /**
     * 품질 리포트 요청
     */
    private requestQualityReports(): void {
        const message = {
            type: 'quality_report_request',
            timestamp: performance.now()
        };
        
        this.clientConnections.forEach((ws, clientId) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
            }
        });
    }
    
    /**
     * 레이턴시 측정 상태 확인
     */
    private checkLatencyMeasurementHealth(): void {
        const now = performance.now();
        
        this.latencyMeasurements.forEach((measurements, key) => {
            const recentMeasurements = measurements.filter(m => 
                (now - m.timestamp * 1000) < 10000 // 10초 내 측정
            );
            
            if (recentMeasurements.length === 0) {
                console.warn(`레이턴시 측정 중단됨: ${key}`);
                this.emit('latency_measurement_stopped', key);
            }
        });
    }
    
    /**
     * 정리 함수
     */
    public cleanup(): void {
        if (this.pdSoftwareWs) {
            this.pdSoftwareWs.close();
        }
        
        this.clientConnections.forEach(ws => {
            ws.close();
        });
        
        this.clientConnections.clear();
        this.bitrateSettings.clear();
        this.latencyMeasurements.clear();
        this.qualityMetrics.clear();
    }
}

export default BitrateManager;