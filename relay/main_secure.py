#!/usr/bin/env python3
"""
보안 강화된 Relay Server 실행 스크립트
JWT 인증이 추가된 버전
"""

import os
import sys

# relay_server_secure 모듈을 임포트하고 실행
from relay_server_secure import main
import asyncio

if __name__ == "__main__":
    # 환경변수 확인
    jwt_secret = os.environ.get('JWT_SECRET')
    if not jwt_secret or jwt_secret == 'your_jwt_secret':
        print("경고: JWT_SECRET 환경변수가 설정되지 않았거나 기본값을 사용 중입니다.")
        print("프로덕션 환경에서는 반드시 안전한 JWT_SECRET을 설정하세요.")
        print("예: export JWT_SECRET='your-very-long-random-secret-key'")
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n서버를 종료합니다.")
        sys.exit(0)