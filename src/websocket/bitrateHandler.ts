/**
 * 비트레이트 및 레이턴시 관리 WebSocket 핸들러
 */
import WebSocket from 'ws';
import { BitrateManager } from '../services/bitrateManager';
import { v4 as uuidv4 } from 'uuid';
import { performance } from 'perf_hooks';

export interface ClientConnection {
    id: string;
    ws: WebSocket;
    sessionId?: string;
    cameraId?: string;
    role: 'staff' | 'pd' | 'admin';
    joinedAt: Date;
    lastActivity: Date;
    isAlive: boolean;
}

export class BitrateWebSocketHandler {
    private bitrateManager: BitrateManager;
    private clients: Map<string, ClientConnection> = new Map();
    private heartbeatInterval: NodeJS.Timer;
    
    constructor(bitrateManager: BitrateManager) {
        this.bitrateManager = bitrateManager;
        this.startHeartbeat();
        this.setupBitrateManagerListeners();
    }
    
    /**
     * 새로운 WebSocket 연결 처리
     */
    public handleConnection(ws: WebSocket, request: any): void {
        const clientId = uuidv4();
        const client: ClientConnection = {
            id: clientId,
            ws,
            role: 'staff',
            joinedAt: new Date(),
            lastActivity: new Date(),
            isAlive: true
        };
        
        this.clients.set(clientId, client);
        
        console.log(`클라이언트 연결됨: ${clientId}`);
        
        // 비트레이트 매니저에 클라이언트 등록
        this.bitrateManager.registerClient(clientId, ws);
        
        // 연결 확인 메시지
        ws.send(JSON.stringify({
            type: 'connection_confirmed',
            clientId,
            timestamp: Date.now()
        }));
        
        // 메시지 핸들러 설정
        ws.on('message', (data) => {
            this.handleMessage(clientId, data);
        });
        
        // 퐁 핸들러 설정
        ws.on('pong', () => {
            const client = this.clients.get(clientId);
            if (client) {
                client.isAlive = true;
                client.lastActivity = new Date();
            }
        });
        
        // 연결 종료 핸들러
        ws.on('close', () => {
            this.handleDisconnection(clientId);
        });
        
        // 오류 핸들러
        ws.on('error', (error) => {
            console.error(`클라이언트 ${clientId} 오류:`, error);
            this.handleDisconnection(clientId);
        });
    }
    
    /**
     * 메시지 처리
     */
    private handleMessage(clientId: string, data: WebSocket.Data): void {
        try {
            const message = JSON.parse(data.toString());
            const client = this.clients.get(clientId);
            
            if (!client) {
                console.warn(`알 수 없는 클라이언트: ${clientId}`);
                return;
            }
            
            // 활동 시간 업데이트
            client.lastActivity = new Date();
            
            switch (message.type) {
                case 'register_client':
                    this.handleClientRegistration(clientId, message);
                    break;
                    
                case 'bitrate_change_request':
                    this.handleBitrateChangeRequest(clientId, message);
                    break;
                    
                case 'latency_measurement_response':
                    this.handleLatencyMeasurementResponse(clientId, message);
                    break;
                    
                case 'quality_metrics_report':
                    this.handleQualityMetricsReport(clientId, message);
                    break;
                    
                case 'ping':
                    this.handlePing(clientId, message);
                    break;
                    
                case 'heartbeat':
                    this.handleHeartbeat(clientId, message);
                    break;
                    
                default:
                    console.warn(`알 수 없는 메시지 타입: ${message.type}`);
            }
        } catch (error) {
            console.error(`메시지 처리 오류 (클라이언트 ${clientId}):`, error);
        }
    }
    
    /**
     * 클라이언트 등록 처리
     */
    private handleClientRegistration(clientId: string, message: any): void {
        const client = this.clients.get(clientId);
        if (!client) return;
        
        // 클라이언트 정보 업데이트
        client.sessionId = message.sessionId;
        client.cameraId = message.cameraId;
        client.role = message.role || 'staff';
        
        console.log(`클라이언트 등록: ${clientId} (${client.role}) - 세션: ${client.sessionId}, 카메라: ${client.cameraId}`);
        
        // 등록 확인 응답
        client.ws.send(JSON.stringify({
            type: 'registration_confirmed',
            clientId,
            sessionId: client.sessionId,
            cameraId: client.cameraId,
            role: client.role,
            timestamp: Date.now()
        }));
        
        // 현재 비트레이트 설정 전송
        this.sendCurrentBitrateSettings(clientId);
    }
    
    /**
     * 비트레이트 변경 요청 처리
     */
    private async handleBitrateChangeRequest(clientId: string, message: any): Promise<void> {
        const client = this.clients.get(clientId);
        if (!client) return;
        
        try {
            const { sessionId, cameraId, percentage } = message;
            
            // 비트레이트 변경 적용
            await this.bitrateManager.setBitratePercentage(sessionId, cameraId, percentage);
            
            // 응답 전송
            client.ws.send(JSON.stringify({
                type: 'bitrate_change_response',
                success: true,
                sessionId,
                cameraId,
                percentage,
                timestamp: Date.now()
            }));
            
            console.log(`비트레이트 변경 요청 처리: ${clientId} -> ${sessionId}/${cameraId} @ ${(percentage * 100).toFixed(1)}%`);
            
        } catch (error) {
            console.error(`비트레이트 변경 오류 (클라이언트 ${clientId}):`, error);
            
            client.ws.send(JSON.stringify({
                type: 'bitrate_change_response',
                success: false,
                error: error instanceof Error ? error.message : '비트레이트 변경 실패',
                timestamp: Date.now()
            }));
        }
    }
    
    /**
     * 레이턴시 측정 응답 처리
     */
    private handleLatencyMeasurementResponse(clientId: string, message: any): void {
        const client = this.clients.get(clientId);
        if (!client) return;
        
        try {
            const { sequenceId, receiveTimestamp, sessionId, cameraId } = message;
            
            // 비트레이트 매니저에 레이턴시 응답 전달
            this.bitrateManager.handleBrowserLatencyResponse(clientId, {
                sequenceId,
                receiveTimestamp,
                sessionId,
                cameraId
            });
            
            console.log(`레이턴시 측정 응답 처리: ${clientId} -> ${sequenceId}`);
            
        } catch (error) {
            console.error(`레이턴시 측정 응답 오류 (클라이언트 ${clientId}):`, error);
        }
    }
    
    /**
     * 품질 메트릭 리포트 처리
     */
    private handleQualityMetricsReport(clientId: string, message: any): void {
        const client = this.clients.get(clientId);
        if (!client) return;
        
        try {
            const metrics = {
                sessionId: message.sessionId,
                cameraId: message.cameraId,
                clientId,
                timestamp: Date.now(),
                packetLoss: message.packetLoss || 0,
                jitter: message.jitter || 0,
                roundTripTime: message.roundTripTime || 0,
                bandwidth: message.bandwidth || 0,
                fps: message.fps || 0,
                resolution: message.resolution || 'unknown'
            };
            
            // 비트레이트 매니저에 품질 메트릭 전달
            this.bitrateManager.handleQualityMetrics(clientId, metrics);
            
            console.log(`품질 메트릭 리포트: ${clientId} -> 패킷손실: ${metrics.packetLoss.toFixed(3)}, 지터: ${metrics.jitter.toFixed(3)}`);
            
        } catch (error) {
            console.error(`품질 메트릭 리포트 오류 (클라이언트 ${clientId}):`, error);
        }
    }
    
    /**
     * 핑 처리
     */
    private handlePing(clientId: string, message: any): void {
        const client = this.clients.get(clientId);
        if (!client) return;
        
        // 퐁 응답
        client.ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now(),
            clientTimestamp: message.timestamp
        }));
    }
    
    /**
     * 하트비트 처리
     */
    private handleHeartbeat(clientId: string, message: any): void {
        const client = this.clients.get(clientId);
        if (!client) return;
        
        // 하트비트 응답
        client.ws.send(JSON.stringify({
            type: 'heartbeat_response',
            timestamp: Date.now(),
            clientTimestamp: message.timestamp
        }));
    }
    
    /**
     * 연결 해제 처리
     */
    private handleDisconnection(clientId: string): void {
        const client = this.clients.get(clientId);
        if (client) {
            console.log(`클라이언트 연결 해제: ${clientId} (${client.role})`);
            this.clients.delete(clientId);
        }
    }
    
    /**
     * 현재 비트레이트 설정 전송
     */
    private sendCurrentBitrateSettings(clientId: string): void {
        const client = this.clients.get(clientId);
        if (!client || !client.sessionId) return;
        
        // 해당 세션의 모든 카메라 설정 조회
        const sessionSettings = Array.from((this.bitrateManager as any).bitrateSettings.values())
            .filter((settings: any) => settings.sessionId === client.sessionId);
        
        if (sessionSettings.length > 0) {
            client.ws.send(JSON.stringify({
                type: 'bitrate_settings_update',
                settings: sessionSettings.map((settings: any) => ({
                    sessionId: settings.sessionId,
                    cameraId: settings.cameraId,
                    maxBitrate: settings.maxBitrate,
                    currentPercentage: settings.currentPercentage,
                    effectiveBitrate: Math.floor(settings.maxBitrate * settings.currentPercentage),
                    adaptiveEnabled: settings.adaptiveEnabled,
                    qualityPreset: settings.qualityPreset
                })),
                timestamp: Date.now()
            }));
        }
    }
    
    /**
     * 비트레이트 매니저 이벤트 리스너 설정
     */
    private setupBitrateManagerListeners(): void {
        // 레이턴시 업데이트 이벤트
        this.bitrateManager.on('latency_update', (data) => {
            this.broadcastToSession(data.sessionId, {
                type: 'latency_update',
                sessionId: data.sessionId,
                cameraId: data.cameraId,
                latency: data.latency,
                timestamp: data.timestamp
            });
        });
        
        // 비트레이트 변경 이벤트
        this.bitrateManager.on('bitrate_changed', (settings) => {
            this.broadcastToSession(settings.sessionId, {
                type: 'bitrate_changed',
                sessionId: settings.sessionId,
                cameraId: settings.cameraId,
                maxBitrate: settings.maxBitrate,
                currentPercentage: settings.currentPercentage,
                effectiveBitrate: Math.floor(settings.maxBitrate * settings.currentPercentage),
                adaptiveEnabled: settings.adaptiveEnabled,
                qualityPreset: settings.qualityPreset,
                timestamp: Date.now()
            });
        });
        
        // 품질 메트릭 이벤트
        this.bitrateManager.on('quality_metrics', (metrics) => {
            this.broadcastToSession(metrics.sessionId, {
                type: 'quality_metrics_update',
                sessionId: metrics.sessionId,
                cameraId: metrics.cameraId,
                metrics: {
                    packetLoss: metrics.packetLoss,
                    jitter: metrics.jitter,
                    roundTripTime: metrics.roundTripTime,
                    bandwidth: metrics.bandwidth,
                    fps: metrics.fps,
                    resolution: metrics.resolution
                },
                timestamp: metrics.timestamp
            });
        });
    }
    
    /**
     * 특정 세션의 모든 클라이언트에게 브로드캐스트
     */
    private broadcastToSession(sessionId: string, message: any): void {
        this.clients.forEach((client) => {
            if (client.sessionId === sessionId && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify(message));
            }
        });
    }
    
    /**
     * 모든 클라이언트에게 브로드캐스트
     */
    public broadcast(message: any): void {
        this.clients.forEach((client) => {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify(message));
            }
        });
    }
    
    /**
     * 특정 클라이언트에게 메시지 전송
     */
    public sendToClient(clientId: string, message: any): void {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(message));
        }
    }
    
    /**
     * 하트비트 시작
     */
    private startHeartbeat(): void {
        this.heartbeatInterval = setInterval(() => {
            this.clients.forEach((client, clientId) => {
                if (!client.isAlive) {
                    console.log(`클라이언트 ${clientId} 하트비트 타임아웃`);
                    client.ws.terminate();
                    this.clients.delete(clientId);
                    return;
                }
                
                client.isAlive = false;
                
                if (client.ws.readyState === WebSocket.OPEN) {
                    client.ws.ping();
                }
            });
        }, 30000); // 30초마다 하트비트
    }
    
    /**
     * 연결된 클라이언트 상태 조회
     */
    public getClientStats(): any {
        const stats = {
            totalClients: this.clients.size,
            byRole: {
                staff: 0,
                pd: 0,
                admin: 0
            },
            bySessions: new Map<string, number>(),
            averageLatency: 0,
            activeConnections: 0
        };
        
        this.clients.forEach((client) => {
            stats.byRole[client.role]++;
            
            if (client.sessionId) {
                const sessionCount = stats.bySessions.get(client.sessionId) || 0;
                stats.bySessions.set(client.sessionId, sessionCount + 1);
            }
            
            if (client.ws.readyState === WebSocket.OPEN) {
                stats.activeConnections++;
            }
        });
        
        return {
            ...stats,
            bySessions: Object.fromEntries(stats.bySessions)
        };
    }
    
    /**
     * 정리
     */
    public cleanup(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        this.clients.forEach((client) => {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.close();
            }
        });
        
        this.clients.clear();
    }
}

export default BitrateWebSocketHandler;