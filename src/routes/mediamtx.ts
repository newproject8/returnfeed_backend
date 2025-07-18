/**
 * MediaMTX 서버 이벤트 처리 API
 */
import express, { Request, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';

const router = express.Router();

// Async handler wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/**
 * 스트림 준비 완료 이벤트
 * POST /api/mediamtx/stream-ready
 */
router.post('/stream-ready',
    body('path').notEmpty().withMessage('경로는 필수입니다'),
    body('source').notEmpty().withMessage('소스 타입은 필수입니다'),
    body('video_codec').optional().isString(),
    body('bitrate').optional().isString(),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const { path, source, video_codec, bitrate } = req.body;
            
            console.log(`스트림 준비됨: ${path} (${source}) - ${video_codec} @ ${bitrate}bps`);
            
            // 스트림 준비 이벤트 로깅
            const eventData = {
                timestamp: new Date().toISOString(),
                event: 'stream_ready',
                path,
                source,
                video_codec: video_codec || 'unknown',
                bitrate: bitrate || 'unknown'
            };
            
            // 여기에 추가적인 스트림 준비 로직 추가 가능
            // 예: 알림 전송, 모니터링 시스템 업데이트 등
            
            res.json({
                success: true,
                data: eventData
            });
        } catch (error) {
            console.error('스트림 준비 이벤트 처리 오류:', error);
            res.status(500).json({
                success: false,
                error: '스트림 준비 이벤트 처리 중 오류가 발생했습니다'
            });
        }
    })
);

/**
 * 스트림 종료 이벤트
 * POST /api/mediamtx/stream-ended
 */
router.post('/stream-ended',
    body('path').notEmpty().withMessage('경로는 필수입니다'),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const { path } = req.body;
            
            console.log(`스트림 종료됨: ${path}`);
            
            const eventData = {
                timestamp: new Date().toISOString(),
                event: 'stream_ended',
                path
            };
            
            res.json({
                success: true,
                data: eventData
            });
        } catch (error) {
            console.error('스트림 종료 이벤트 처리 오류:', error);
            res.status(500).json({
                success: false,
                error: '스트림 종료 이벤트 처리 중 오류가 발생했습니다'
            });
        }
    })
);

/**
 * 클라이언트 연결 이벤트
 * POST /api/mediamtx/client-connected
 */
router.post('/client-connected',
    body('path').notEmpty().withMessage('경로는 필수입니다'),
    body('client_ip').notEmpty().withMessage('클라이언트 IP는 필수입니다'),
    body('protocol').optional().isString(),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const { path, client_ip, protocol } = req.body;
            
            console.log(`클라이언트 연결됨: ${client_ip} -> ${path} (${protocol})`);
            
            const eventData = {
                timestamp: new Date().toISOString(),
                event: 'client_connected',
                path,
                client_ip,
                protocol: protocol || 'unknown'
            };
            
            res.json({
                success: true,
                data: eventData
            });
        } catch (error) {
            console.error('클라이언트 연결 이벤트 처리 오류:', error);
            res.status(500).json({
                success: false,
                error: '클라이언트 연결 이벤트 처리 중 오류가 발생했습니다'
            });
        }
    })
);

/**
 * 클라이언트 연결 해제 이벤트
 * POST /api/mediamtx/client-disconnected
 */
router.post('/client-disconnected',
    body('path').notEmpty().withMessage('경로는 필수입니다'),
    body('client_ip').notEmpty().withMessage('클라이언트 IP는 필수입니다'),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const { path, client_ip } = req.body;
            
            console.log(`클라이언트 연결 해제됨: ${client_ip} -> ${path}`);
            
            const eventData = {
                timestamp: new Date().toISOString(),
                event: 'client_disconnected',
                path,
                client_ip
            };
            
            res.json({
                success: true,
                data: eventData
            });
        } catch (error) {
            console.error('클라이언트 연결 해제 이벤트 처리 오류:', error);
            res.status(500).json({
                success: false,
                error: '클라이언트 연결 해제 이벤트 처리 중 오류가 발생했습니다'
            });
        }
    })
);

/**
 * MediaMTX 인증 처리
 * POST /api/mediamtx/auth
 */
router.post('/auth',
    body('ip').notEmpty().withMessage('IP는 필수입니다'),
    body('user').optional().isString(),
    body('password').optional().isString(),
    body('path').notEmpty().withMessage('경로는 필수입니다'),
    body('protocol').notEmpty().withMessage('프로토콜은 필수입니다'),
    body('action').notEmpty().withMessage('액션은 필수입니다'),
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const { ip, user, password, path, protocol, action } = req.body;
            
            console.log(`MediaMTX 인증 요청: ${ip} -> ${path} (${protocol}/${action})`);
            
            // 기본적으로 모든 읽기 요청은 허용
            if (action === 'read') {
                res.status(200).json({
                    success: true,
                    message: '읽기 권한 허용'
                });
                return;
            }
            
            // 발행 요청에 대한 인증 로직
            if (action === 'publish') {
                // 여기에 실제 인증 로직 구현
                // 현재는 모든 발행 요청을 허용
                res.status(200).json({
                    success: true,
                    message: '발행 권한 허용'
                });
                return;
            }
            
            // 기타 액션은 거부
            res.status(403).json({
                success: false,
                error: '권한이 없습니다'
            });
        } catch (error) {
            console.error('MediaMTX 인증 오류:', error);
            res.status(500).json({
                success: false,
                error: '인증 처리 중 오류가 발생했습니다'
            });
        }
    })
);

/**
 * MediaMTX 서버 상태 조회
 * GET /api/mediamtx/status
 */
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
    try {
        // MediaMTX API를 통한 상태 조회
        const response = await fetch('http://localhost:9997/v3/config/global');
        const config = await response.json();
        
        res.json({
            success: true,
            data: {
                status: 'running',
                config: config,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('MediaMTX 상태 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: 'MediaMTX 상태 조회 중 오류가 발생했습니다'
        });
    }
}));

/**
 * MediaMTX 스트림 목록 조회
 * GET /api/mediamtx/streams
 */
router.get('/streams', asyncHandler(async (req: Request, res: Response) => {
    try {
        // MediaMTX API를 통한 스트림 목록 조회
        const response = await fetch('http://localhost:9997/v3/paths/list');
        const paths = await response.json();
        
        res.json({
            success: true,
            data: {
                streams: paths,
                count: paths.length,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('MediaMTX 스트림 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: 'MediaMTX 스트림 목록 조회 중 오류가 발생했습니다'
        });
    }
}));

export default router;