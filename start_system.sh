#!/bin/bash
# ReturnFeed 전체 시스템 시작 스크립트

set -e

echo "🚀 ReturnFeed 시스템 시작 중..."

# 로그 디렉토리 생성
mkdir -p logs

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 함수 정의
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 포트 사용 여부 확인
check_port() {
    local port=$1
    local service=$2
    
    if lsof -i :$port > /dev/null 2>&1; then
        log_warning "$service 포트 $port이 이미 사용 중입니다."
        return 1
    else
        log_info "$service 포트 $port 사용 가능"
        return 0
    fi
}

# 의존성 확인
check_dependencies() {
    log_info "시스템 의존성 확인 중..."
    
    # Node.js 확인
    if ! command -v node &> /dev/null; then
        log_error "Node.js가 설치되지 않았습니다."
        exit 1
    fi
    
    # npm 확인
    if ! command -v npm &> /dev/null; then
        log_error "npm이 설치되지 않았습니다."
        exit 1
    fi
    
    # Python 확인
    if ! command -v python3 &> /dev/null; then
        log_error "Python3가 설치되지 않았습니다."
        exit 1
    fi
    
    log_success "모든 의존성 확인 완료"
}

# 필요한 포트 확인
check_ports() {
    log_info "포트 사용 여부 확인 중..."
    
    check_port 3000 "Frontend"
    check_port 3001 "Backend"
    check_port 8889 "MediaMTX-WebRTC"
    check_port 8890 "MediaMTX-SRT"
    check_port 9997 "MediaMTX-API"
    check_port 9998 "MediaMTX-Metrics"
    
    log_success "포트 확인 완료"
}

# 프로세스 ID 파일 정리
cleanup_pids() {
    rm -f logs/mediamtx.pid logs/backend.pid logs/frontend.pid
}

# 시그널 핸들러 설정
cleanup() {
    log_info "시스템 종료 중..."
    
    # PID 파일에서 프로세스 종료
    if [ -f logs/mediamtx.pid ]; then
        kill -TERM $(cat logs/mediamtx.pid) 2>/dev/null || true
    fi
    
    if [ -f logs/backend.pid ]; then
        kill -TERM $(cat logs/backend.pid) 2>/dev/null || true
    fi
    
    if [ -f logs/frontend.pid ]; then
        kill -TERM $(cat logs/frontend.pid) 2>/dev/null || true
    fi
    
    cleanup_pids
    log_success "시스템 종료 완료"
    exit 0
}

trap cleanup SIGINT SIGTERM

# 의존성 설치
install_dependencies() {
    log_info "의존성 설치 중..."
    
    # 백엔드 의존성 설치
    if [ ! -d "backend/node_modules" ]; then
        log_info "백엔드 의존성 설치 중..."
        cd backend
        npm install
        cd ..
        log_success "백엔드 의존성 설치 완료"
    fi
    
    # 프론트엔드 의존성 설치
    if [ ! -d "frontend/node_modules" ]; then
        log_info "프론트엔드 의존성 설치 중..."
        cd frontend
        npm install
        cd ..
        log_success "프론트엔드 의존성 설치 완료"
    fi
    
    # PD 소프트웨어 의존성 설치
    if [ ! -d "pd-software/venv" ]; then
        log_info "PD 소프트웨어 의존성 설치 중..."
        cd pd-software
        python3 -m venv venv
        source venv/bin/activate
        pip install -r requirements.txt
        cd ..
        log_success "PD 소프트웨어 의존성 설치 완료"
    fi
}

# MediaMTX 시작
start_mediamtx() {
    log_info "MediaMTX 서버 시작 중..."
    
    cd mediamtx
    if [ ! -f "mediamtx" ]; then
        log_error "MediaMTX 실행 파일을 찾을 수 없습니다."
        exit 1
    fi
    
    # MediaMTX 백그라운드 실행
    nohup ./mediamtx mediamtx-optimized.yml > ../logs/mediamtx.log 2>&1 &
    echo $! > ../logs/mediamtx.pid
    cd ..
    
    # 시작 확인
    sleep 3
    if kill -0 $(cat logs/mediamtx.pid) 2>/dev/null; then
        log_success "MediaMTX 서버 시작 완료 (PID: $(cat logs/mediamtx.pid))"
    else
        log_error "MediaMTX 서버 시작 실패"
        exit 1
    fi
}

# 백엔드 시작
start_backend() {
    log_info "백엔드 API 서버 시작 중..."
    
    cd backend
    
    # 환경 변수 설정
    export NODE_ENV=development
    export PORT=3001
    
    # 백엔드 백그라운드 실행
    nohup npm start > ../logs/backend.log 2>&1 &
    echo $! > ../logs/backend.pid
    cd ..
    
    # 시작 확인
    sleep 5
    if kill -0 $(cat logs/backend.pid) 2>/dev/null; then
        log_success "백엔드 API 서버 시작 완료 (PID: $(cat logs/backend.pid))"
    else
        log_error "백엔드 API 서버 시작 실패"
        exit 1
    fi
}

# 프론트엔드 시작
start_frontend() {
    log_info "프론트엔드 개발 서버 시작 중..."
    
    cd frontend
    
    # 환경 변수 설정
    export PORT=3000
    export BROWSER=none
    
    # 프론트엔드 백그라운드 실행
    nohup npm start > ../logs/frontend.log 2>&1 &
    echo $! > ../logs/frontend.pid
    cd ..
    
    # 시작 확인
    sleep 10
    if kill -0 $(cat logs/frontend.pid) 2>/dev/null; then
        log_success "프론트엔드 개발 서버 시작 완료 (PID: $(cat logs/frontend.pid))"
    else
        log_error "프론트엔드 개발 서버 시작 실패"
        exit 1
    fi
}

# 시스템 상태 확인
check_system_health() {
    log_info "시스템 상태 확인 중..."
    
    # API 엔드포인트 확인
    max_retries=10
    retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
            log_success "백엔드 API 서버 응답 정상"
            break
        else
            log_warning "백엔드 API 서버 응답 대기 중... ($((retry_count + 1))/$max_retries)"
            sleep 3
            retry_count=$((retry_count + 1))
        fi
    done
    
    if [ $retry_count -eq $max_retries ]; then
        log_error "백엔드 API 서버 응답 시간 초과"
        return 1
    fi
    
    # MediaMTX API 확인
    retry_count=0
    while [ $retry_count -lt $max_retries ]; do
        if curl -s http://localhost:9997/v3/config/global > /dev/null 2>&1; then
            log_success "MediaMTX API 서버 응답 정상"
            break
        else
            log_warning "MediaMTX API 서버 응답 대기 중... ($((retry_count + 1))/$max_retries)"
            sleep 3
            retry_count=$((retry_count + 1))
        fi
    done
    
    if [ $retry_count -eq $max_retries ]; then
        log_error "MediaMTX API 서버 응답 시간 초과"
        return 1
    fi
    
    return 0
}

# 사용법 출력
show_usage() {
    echo "ReturnFeed 시스템 시작 스크립트"
    echo "사용법: $0 [옵션]"
    echo ""
    echo "옵션:"
    echo "  -h, --help     이 도움말 표시"
    echo "  -c, --check    시스템 상태만 확인"
    echo "  -s, --stop     실행 중인 서비스 중지"
    echo "  -r, --restart  서비스 재시작"
    echo ""
}

# 서비스 중지
stop_services() {
    log_info "서비스 중지 중..."
    
    if [ -f logs/mediamtx.pid ]; then
        kill -TERM $(cat logs/mediamtx.pid) 2>/dev/null || true
        log_success "MediaMTX 서버 중지"
    fi
    
    if [ -f logs/backend.pid ]; then
        kill -TERM $(cat logs/backend.pid) 2>/dev/null || true
        log_success "백엔드 API 서버 중지"
    fi
    
    if [ -f logs/frontend.pid ]; then
        kill -TERM $(cat logs/frontend.pid) 2>/dev/null || true
        log_success "프론트엔드 개발 서버 중지"
    fi
    
    cleanup_pids
}

# 메인 실행
main() {
    case "${1:-}" in
        -h|--help)
            show_usage
            exit 0
            ;;
        -c|--check)
            check_system_health
            exit $?
            ;;
        -s|--stop)
            stop_services
            exit 0
            ;;
        -r|--restart)
            stop_services
            sleep 2
            ;;
        "")
            # 기본 시작 프로세스
            ;;
        *)
            log_error "알 수 없는 옵션: $1"
            show_usage
            exit 1
            ;;
    esac
    
    # 시스템 시작
    check_dependencies
    check_ports
    cleanup_pids
    install_dependencies
    
    start_mediamtx
    start_backend
    start_frontend
    
    if check_system_health; then
        log_success "🎉 ReturnFeed 시스템 시작 완료!"
        echo ""
        echo "서비스 URL:"
        echo "  - 프론트엔드: http://localhost:3000"
        echo "  - 백엔드 API: http://localhost:3001"
        echo "  - MediaMTX API: http://localhost:9997"
        echo "  - MediaMTX 메트릭: http://localhost:9998"
        echo ""
        echo "로그 파일:"
        echo "  - MediaMTX: logs/mediamtx.log"
        echo "  - 백엔드: logs/backend.log"
        echo "  - 프론트엔드: logs/frontend.log"
        echo ""
        echo "시스템 종료: Ctrl+C 또는 ./start_system.sh --stop"
        echo ""
        
        # 실행 상태 유지
        while true; do
            sleep 10
            
            # 프로세스 상태 확인
            if [ -f logs/mediamtx.pid ] && ! kill -0 $(cat logs/mediamtx.pid) 2>/dev/null; then
                log_error "MediaMTX 서버가 중지되었습니다."
                cleanup
            fi
            
            if [ -f logs/backend.pid ] && ! kill -0 $(cat logs/backend.pid) 2>/dev/null; then
                log_error "백엔드 API 서버가 중지되었습니다."
                cleanup
            fi
            
            if [ -f logs/frontend.pid ] && ! kill -0 $(cat logs/frontend.pid) 2>/dev/null; then
                log_error "프론트엔드 개발 서버가 중지되었습니다."
                cleanup
            fi
        done
    else
        log_error "시스템 상태 확인 실패"
        cleanup
        exit 1
    fi
}

# 스크립트 실행
main "$@"