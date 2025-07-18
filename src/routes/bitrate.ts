/**
 * 비트레이트 조정 API 라우트
 */
import express from 'express';
import { BitrateManager } from '../services/bitrateManager';
import { validateRequest } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import { body, param, query } from 'express-validator';

const router = express.Router();
let bitrateManager: BitrateManager;

// 비트레이트 매니저 초기화
export const initializeBitrateManager = (manager: BitrateManager) => {
    bitrateManager = manager;
};

/**
 * 비트레이트 설정 조회
 * GET /api/bitrate/settings/:sessionId/:cameraId
 */
router.get('/settings/:sessionId/:cameraId',
    authenticateToken,
    param('sessionId').notEmpty().withMessage('세션 ID는 필수입니다'),
    param('cameraId').notEmpty().withMessage('카메라 ID는 필수입니다'),
    validateRequest,
    async (req, res) => {
        try {
            const { sessionId, cameraId } = req.params;
            
            // 비트레이트 설정 조회
            const settings = (bitrateManager as any).bitrateSettings.get(`${sessionId}_${cameraId}`);
            
            if (!settings) {
                return res.status(404).json({
                    success: false,
                    error: '비트레이트 설정을 찾을 수 없습니다'
                });
            }
            
            // 레이턴시 통계 조회
            const latencyStats = bitrateManager.getLatencyStats(sessionId, cameraId);
            
            res.json({
                success: true,
                data: {
                    settings: {
                        sessionId: settings.sessionId,
                        cameraId: settings.cameraId,
                        maxBitrate: settings.maxBitrate,
                        currentPercentage: settings.currentPercentage,
                        effectiveBitrate: Math.floor(settings.maxBitrate * settings.currentPercentage),
                        adaptiveEnabled: settings.adaptiveEnabled,
                        qualityPreset: settings.qualityPreset,
                        lastUpdated: settings.lastUpdated
                    },
                    latencyStats
                }
            });
        } catch (error) {
            console.error('비트레이트 설정 조회 오류:', error);
            res.status(500).json({
                success: false,
                error: '비트레이트 설정 조회 중 오류가 발생했습니다'
            });
        }
    }
);

/**
 * 비트레이트 비율 설정
 * PUT /api/bitrate/percentage/:sessionId/:cameraId
 */
router.put('/percentage/:sessionId/:cameraId',
    authenticateToken,
    param('sessionId').notEmpty().withMessage('세션 ID는 필수입니다'),
    param('cameraId').notEmpty().withMessage('카메라 ID는 필수입니다'),
    body('percentage')
        .isFloat({ min: 0.1, max: 1.0 })
        .withMessage('비율은 0.1에서 1.0 사이여야 합니다'),
    validateRequest,
    async (req, res) => {
        try {
            const { sessionId, cameraId } = req.params;
            const { percentage } = req.body;
            
            // 비트레이트 비율 설정
            await bitrateManager.setBitratePercentage(sessionId, cameraId, percentage);
            
            // 업데이트된 설정 조회
            const settings = (bitrateManager as any).bitrateSettings.get(`${sessionId}_${cameraId}`);
            
            res.json({
                success: true,
                data: {
                    sessionId: settings.sessionId,
                    cameraId: settings.cameraId,
                    maxBitrate: settings.maxBitrate,
                    currentPercentage: settings.currentPercentage,
                    effectiveBitrate: Math.floor(settings.maxBitrate * settings.currentPercentage),
                    message: `비트레이트가 ${(percentage * 100).toFixed(1)}%로 설정되었습니다`
                }
            });
        } catch (error) {
            console.error('비트레이트 설정 오류:', error);
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : '비트레이트 설정 중 오류가 발생했습니다'
            });
        }
    }
);

/**
 * 비트레이트 설정 초기화
 * POST /api/bitrate/initialize/:sessionId/:cameraId
 */
router.post('/initialize/:sessionId/:cameraId',
    authenticateToken,
    param('sessionId').notEmpty().withMessage('세션 ID는 필수입니다'),
    param('cameraId').notEmpty().withMessage('카메라 ID는 필수입니다'),
    body('maxBitrate')
        .isInt({ min: 100000, max: 50000000 })
        .withMessage('최대 비트레이트는 100Kbps에서 50Mbps 사이여야 합니다'),
    body('qualityPreset')
        .optional()
        .isIn(['low_latency', 'balanced', 'quality'])
        .withMessage('품질 프리셋은 low_latency, balanced, quality 중 하나여야 합니다'),
    validateRequest,
    async (req, res) => {
        try {
            const { sessionId, cameraId } = req.params;
            const { maxBitrate, qualityPreset = 'balanced' } = req.body;
            
            // 비트레이트 설정 초기화
            bitrateManager.initializeBitrateSettings(sessionId, cameraId, maxBitrate);
            
            // 품질 프리셋 적용
            const settings = (bitrateManager as any).bitrateSettings.get(`${sessionId}_${cameraId}`);
            if (settings) {
                settings.qualityPreset = qualityPreset;
                await (bitrateManager as any).applyBitrateSettings(settings);
            }
            
            res.json({
                success: true,
                data: {
                    sessionId,
                    cameraId,
                    maxBitrate,
                    qualityPreset,
                    message: '비트레이트 설정이 초기화되었습니다'
                }
            });
        } catch (error) {
            console.error('비트레이트 초기화 오류:', error);
            res.status(500).json({
                success: false,
                error: '비트레이트 초기화 중 오류가 발생했습니다'
            });
        }
    }
);

/**
 * 레이턴시 통계 조회
 * GET /api/bitrate/latency/:sessionId/:cameraId
 */
router.get('/latency/:sessionId/:cameraId',
    authenticateToken,
    param('sessionId').notEmpty().withMessage('세션 ID는 필수입니다'),
    param('cameraId').notEmpty().withMessage('카메라 ID는 필수입니다'),
    validateRequest,
    async (req, res) => {
        try {
            const { sessionId, cameraId } = req.params;
            
            const latencyStats = bitrateManager.getLatencyStats(sessionId, cameraId);
            
            res.json({
                success: true,
                data: {
                    sessionId,
                    cameraId,
                    latencyStats: {
                        current: latencyStats.current,
                        average: latencyStats.average,
                        min: latencyStats.min,
                        max: latencyStats.max,
                        jitter: latencyStats.jitter,
                        samples: latencyStats.samples
                    },
                    timestamp: Date.now()
                }
            });
        } catch (error) {
            console.error('레이턴시 통계 조회 오류:', error);
            res.status(500).json({
                success: false,
                error: '레이턴시 통계 조회 중 오류가 발생했습니다'
            });
        }
    }
);

/**
 * 품질 프리셋 변경
 * PUT /api/bitrate/quality/:sessionId/:cameraId
 */
router.put('/quality/:sessionId/:cameraId',
    authenticateToken,
    param('sessionId').notEmpty().withMessage('세션 ID는 필수입니다'),
    param('cameraId').notEmpty().withMessage('카메라 ID는 필수입니다'),
    body('qualityPreset')
        .isIn(['low_latency', 'balanced', 'quality'])
        .withMessage('품질 프리셋은 low_latency, balanced, quality 중 하나여야 합니다'),
    body('adaptiveEnabled')
        .optional()
        .isBoolean()
        .withMessage('적응적 조정 활성화는 boolean 값이어야 합니다'),
    validateRequest,
    async (req, res) => {
        try {
            const { sessionId, cameraId } = req.params;
            const { qualityPreset, adaptiveEnabled } = req.body;
            
            // 현재 설정 조회
            const settings = (bitrateManager as any).bitrateSettings.get(`${sessionId}_${cameraId}`);
            
            if (!settings) {
                return res.status(404).json({
                    success: false,
                    error: '비트레이트 설정을 찾을 수 없습니다'
                });
            }
            
            // 설정 업데이트
            settings.qualityPreset = qualityPreset;
            if (adaptiveEnabled !== undefined) {
                settings.adaptiveEnabled = adaptiveEnabled;
            }
            
            await (bitrateManager as any).applyBitrateSettings(settings);
            
            res.json({
                success: true,
                data: {
                    sessionId,
                    cameraId,
                    qualityPreset,
                    adaptiveEnabled: settings.adaptiveEnabled,
                    message: '품질 설정이 업데이트되었습니다'
                }
            });
        } catch (error) {
            console.error('품질 설정 오류:', error);
            res.status(500).json({
                success: false,
                error: '품질 설정 중 오류가 발생했습니다'
            });
        }
    }
);

/**
 * 전체 세션의 비트레이트 설정 조회
 * GET /api/bitrate/settings/:sessionId
 */
router.get('/settings/:sessionId',
    authenticateToken,
    param('sessionId').notEmpty().withMessage('세션 ID는 필수입니다'),
    validateRequest,
    async (req, res) => {
        try {
            const { sessionId } = req.params;
            
            const allSettings = Array.from((bitrateManager as any).bitrateSettings.entries())
                .filter(([key, _]) => key.startsWith(`${sessionId}_`))
                .map(([key, settings]) => ({
                    sessionId: settings.sessionId,
                    cameraId: settings.cameraId,
                    maxBitrate: settings.maxBitrate,
                    currentPercentage: settings.currentPercentage,
                    effectiveBitrate: Math.floor(settings.maxBitrate * settings.currentPercentage),
                    adaptiveEnabled: settings.adaptiveEnabled,
                    qualityPreset: settings.qualityPreset,
                    lastUpdated: settings.lastUpdated,
                    latencyStats: bitrateManager.getLatencyStats(settings.sessionId, settings.cameraId)
                }));
            
            res.json({
                success: true,
                data: {
                    sessionId,
                    cameras: allSettings,
                    totalCameras: allSettings.length
                }
            });
        } catch (error) {
            console.error('세션 비트레이트 설정 조회 오류:', error);
            res.status(500).json({
                success: false,
                error: '세션 비트레이트 설정 조회 중 오류가 발생했습니다'
            });
        }
    }
);

/**
 * 비트레이트 설정 리셋
 * POST /api/bitrate/reset/:sessionId/:cameraId
 */
router.post('/reset/:sessionId/:cameraId',
    authenticateToken,
    param('sessionId').notEmpty().withMessage('세션 ID는 필수입니다'),
    param('cameraId').notEmpty().withMessage('카메라 ID는 필수입니다'),
    validateRequest,
    async (req, res) => {
        try {
            const { sessionId, cameraId } = req.params;
            
            // 현재 설정 조회
            const settings = (bitrateManager as any).bitrateSettings.get(`${sessionId}_${cameraId}`);
            
            if (!settings) {
                return res.status(404).json({
                    success: false,
                    error: '비트레이트 설정을 찾을 수 없습니다'
                });
            }
            
            // 기본값으로 리셋
            settings.currentPercentage = 1.0; // 서버가 보내는 대로
            settings.adaptiveEnabled = true;
            settings.qualityPreset = 'balanced';
            
            await (bitrateManager as any).applyBitrateSettings(settings);
            
            res.json({
                success: true,
                data: {
                    sessionId,
                    cameraId,
                    currentPercentage: settings.currentPercentage,
                    effectiveBitrate: settings.maxBitrate,
                    qualityPreset: settings.qualityPreset,
                    adaptiveEnabled: settings.adaptiveEnabled,
                    message: '비트레이트 설정이 기본값으로 리셋되었습니다'
                }
            });
        } catch (error) {
            console.error('비트레이트 리셋 오류:', error);
            res.status(500).json({
                success: false,
                error: '비트레이트 리셋 중 오류가 발생했습니다'
            });
        }
    }
);

/**
 * MediaMTX 스트림 이벤트 처리
 * POST /api/bitrate/initialize-stream
 */
router.post('/initialize-stream',
    body('path').notEmpty().withMessage('경로는 필수입니다'),
    body('max_bitrate').optional().isNumeric().withMessage('최대 비트레이트는 숫자여야 합니다'),
    body('codec').optional().isString().withMessage('코덱 정보는 문자열이어야 합니다'),
    validateRequest,
    async (req, res) => {
        try {
            const { path, max_bitrate, codec } = req.body;
            
            // 경로에서 세션 ID와 카메라 ID 추출
            const pathMatch = path.match(/session_(.+)_camera_(.+)/);
            if (!pathMatch) {
                return res.status(400).json({
                    success: false,
                    error: '유효하지 않은 스트림 경로입니다'
                });
            }
            
            const [, sessionId, cameraId] = pathMatch;
            const maxBitrate = max_bitrate ? parseInt(max_bitrate) : 5000000; // 5Mbps 기본값
            
            // 비트레이트 설정 초기화
            bitrateManager.initializeBitrateSettings(sessionId, cameraId, maxBitrate);
            
            console.log(`스트림 초기화: ${sessionId}/${cameraId} - ${maxBitrate}bps (${codec})`);
            
            res.json({
                success: true,
                data: {
                    sessionId,
                    cameraId,
                    maxBitrate,
                    codec,
                    message: '스트림 비트레이트 설정이 초기화되었습니다'
                }
            });
        } catch (error) {
            console.error('스트림 초기화 오류:', error);
            res.status(500).json({
                success: false,
                error: '스트림 초기화 중 오류가 발생했습니다'
            });
        }
    }
);

/**
 * MediaMTX 스트림 정리
 * POST /api/bitrate/cleanup-stream
 */
router.post('/cleanup-stream',
    body('path').notEmpty().withMessage('경로는 필수입니다'),
    validateRequest,
    async (req, res) => {
        try {
            const { path } = req.body;
            
            // 경로에서 세션 ID와 카메라 ID 추출
            const pathMatch = path.match(/session_(.+)_camera_(.+)/);
            if (!pathMatch) {
                return res.status(400).json({
                    success: false,
                    error: '유효하지 않은 스트림 경로입니다'
                });
            }
            
            const [, sessionId, cameraId] = pathMatch;
            
            // 비트레이트 설정 정리
            const key = `${sessionId}_${cameraId}`;
            (bitrateManager as any).bitrateSettings.delete(key);
            
            console.log(`스트림 정리: ${sessionId}/${cameraId}`);
            
            res.json({
                success: true,
                data: {
                    sessionId,
                    cameraId,
                    message: '스트림 비트레이트 설정이 정리되었습니다'
                }
            });
        } catch (error) {
            console.error('스트림 정리 오류:', error);
            res.status(500).json({
                success: false,
                error: '스트림 정리 중 오류가 발생했습니다'
            });
        }
    }
);

export default router;