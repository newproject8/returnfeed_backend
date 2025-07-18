#!/bin/bash
# ReturnFeed 시스템 상태 확인 스크립트

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 함수 정의
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_header() {
    echo -e "\n${CYAN}=== $1 ===${NC}"
}

# 시스템 정보 표시
show_system_info() {
    log_header "시스템 정보"
    
    echo "현재 시간: $(date)"
    echo "시스템: $(uname -s) $(uname -r)"
    echo "CPU: $(nproc) 코어"
    echo "메모리: $(free -h | awk 'NR==2{printf "%.1f/%.1f GB (%.1f%%)", $3/1024/1024, $2/1024/1024, $3*100/$2}')"
    echo "디스크: $(df -h / | awk 'NR==2{printf "%s/%s (%s)", $3, $2, $5}')"
}

# 포트 상태 확인
check_ports() {
    log_header "포트 상태 확인"
    
    local ports=(3000 3001 8889 8890 9997 9998)
    local services=("Frontend" "Backend" "MediaMTX-WebRTC" "MediaMTX-SRT" "MediaMTX-API" "MediaMTX-Metrics")
    
    for i in "${!ports[@]}"; do
        local port=${ports[$i]}
        local service=${services[$i]}
        
        if lsof -i :$port > /dev/null 2>&1; then
            local pid=$(lsof -i :$port -t 2>/dev/null | head -1)
            local process=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
            log_success "$service (포트 $port) - PID: $pid, 프로세스: $process"
        else
            log_error "$service (포트 $port) - 사용 중이지 않음"
        fi
    done
}

# 프로세스 상태 확인
check_processes() {
    log_header "프로세스 상태 확인"
    
    # MediaMTX 프로세스 확인
    if pgrep -f "mediamtx" > /dev/null; then
        local pid=$(pgrep -f "mediamtx")
        local memory=$(ps -p $pid -o rss= 2>/dev/null | awk '{print $1/1024 "MB"}')
        local cpu=$(ps -p $pid -o pcpu= 2>/dev/null | awk '{print $1"%"}')
        log_success "MediaMTX 프로세스 (PID: $pid, 메모리: $memory, CPU: $cpu)"
    else
        log_error "MediaMTX 프로세스를 찾을 수 없음"
    fi
    
    # Node.js 프로세스 확인
    if pgrep -f "node" > /dev/null; then
        local node_processes=$(pgrep -f "node")
        for pid in $node_processes; do
            local cmdline=$(ps -p $pid -o args= 2>/dev/null | head -c 50)
            local memory=$(ps -p $pid -o rss= 2>/dev/null | awk '{print $1/1024 "MB"}')
            local cpu=$(ps -p $pid -o pcpu= 2>/dev/null | awk '{print $1"%"}')
            log_success "Node.js 프로세스 (PID: $pid, 메모리: $memory, CPU: $cpu)"
            echo "  명령어: $cmdline"
        done
    else
        log_error "Node.js 프로세스를 찾을 수 없음"
    fi
}

# API 엔드포인트 확인
check_api_endpoints() {
    log_header "API 엔드포인트 확인"
    
    # 백엔드 API 상태 확인
    if response=$(curl -s -w "%{http_code}" http://localhost:3001/api/health 2>/dev/null); then
        http_code="${response: -3}"
        body="${response%???}"
        
        if [ "$http_code" = "200" ]; then
            log_success "백엔드 API 서버 응답 정상 (HTTP $http_code)"
            echo "  응답: $body"
        else
            log_error "백엔드 API 서버 응답 오류 (HTTP $http_code)"
        fi
    else
        log_error "백엔드 API 서버 연결 실패"
    fi
    
    # MediaMTX API 상태 확인
    if response=$(curl -s -w "%{http_code}" http://localhost:9997/v3/config/global 2>/dev/null); then
        http_code="${response: -3}"
        
        if [ "$http_code" = "200" ]; then
            log_success "MediaMTX API 서버 응답 정상 (HTTP $http_code)"
        else
            log_error "MediaMTX API 서버 응답 오류 (HTTP $http_code)"
        fi
    else
        log_error "MediaMTX API 서버 연결 실패"
    fi
    
    # 프론트엔드 서버 확인
    if response=$(curl -s -w "%{http_code}" http://localhost:3000 2>/dev/null); then
        http_code="${response: -3}"
        
        if [ "$http_code" = "200" ]; then
            log_success "프론트엔드 서버 응답 정상 (HTTP $http_code)"
        else
            log_error "프론트엔드 서버 응답 오류 (HTTP $http_code)"
        fi
    else
        log_error "프론트엔드 서버 연결 실패"
    fi
}

# 데이터베이스 연결 확인
check_database() {
    log_header "데이터베이스 연결 확인"
    
    if response=$(curl -s http://localhost:3001/api/db-test 2>/dev/null); then
        if echo "$response" | grep -q '"status":"ok"'; then
            log_success "데이터베이스 연결 정상"
            db_time=$(echo "$response" | grep -o '"db_time":"[^"]*"' | cut -d'"' -f4)
            echo "  DB 시간: $db_time"
        else
            log_error "데이터베이스 연결 오류"
            echo "  응답: $response"
        fi
    else
        log_error "데이터베이스 테스트 API 호출 실패"
    fi
}

# MediaMTX 스트림 상태 확인
check_mediamtx_streams() {
    log_header "MediaMTX 스트림 상태 확인"
    
    if response=$(curl -s http://localhost:9997/v3/paths/list 2>/dev/null); then
        if echo "$response" | grep -q "\[\]"; then
            log_warning "활성 스트림 없음"
        else
            log_success "활성 스트림 감지됨"
            echo "  스트림 정보: $response"
        fi
    else
        log_error "MediaMTX 스트림 상태 확인 실패"
    fi
}

# 시스템 리소스 사용량 확인
check_resource_usage() {
    log_header "시스템 리소스 사용량"
    
    # CPU 사용량
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    if (( $(echo "$cpu_usage < 80" | bc -l) )); then
        log_success "CPU 사용량: ${cpu_usage}%"
    else
        log_warning "CPU 사용량 높음: ${cpu_usage}%"
    fi
    
    # 메모리 사용량
    memory_usage=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
    if (( $(echo "$memory_usage < 80" | bc -l) )); then
        log_success "메모리 사용량: ${memory_usage}%"
    else
        log_warning "메모리 사용량 높음: ${memory_usage}%"
    fi
    
    # 디스크 사용량
    disk_usage=$(df / | tail -1 | awk '{print $5}' | cut -d'%' -f1)
    if (( disk_usage < 80 )); then
        log_success "디스크 사용량: ${disk_usage}%"
    else
        log_warning "디스크 사용량 높음: ${disk_usage}%"
    fi
}

# 로그 파일 상태 확인
check_log_files() {
    log_header "로그 파일 상태 확인"
    
    local log_files=("logs/mediamtx.log" "logs/backend.log" "logs/frontend.log")
    
    for log_file in "${log_files[@]}"; do
        if [ -f "$log_file" ]; then
            local size=$(du -h "$log_file" | cut -f1)
            local last_modified=$(stat -c %y "$log_file" | cut -d'.' -f1)
            log_success "$log_file (크기: $size, 수정: $last_modified)"
            
            # 최근 오류 확인
            if grep -i "error\|failed\|exception" "$log_file" | tail -3 | grep -q .; then
                log_warning "최근 오류 발견:"
                grep -i "error\|failed\|exception" "$log_file" | tail -3 | sed 's/^/    /'
            fi
        else
            log_warning "$log_file 파일을 찾을 수 없음"
        fi
    done
}

# 네트워크 연결 테스트
check_network() {
    log_header "네트워크 연결 테스트"
    
    # 로컬 연결 테스트
    if ping -c 1 localhost > /dev/null 2>&1; then
        log_success "로컬 연결 정상"
    else
        log_error "로컬 연결 실패"
    fi
    
    # 외부 연결 테스트
    if ping -c 1 8.8.8.8 > /dev/null 2>&1; then
        log_success "외부 네트워크 연결 정상"
    else
        log_warning "외부 네트워크 연결 실패"
    fi
    
    # DNS 해상도 테스트
    if nslookup google.com > /dev/null 2>&1; then
        log_success "DNS 해상도 정상"
    else
        log_warning "DNS 해상도 실패"
    fi
}

# 의존성 확인
check_dependencies() {
    log_header "의존성 확인"
    
    # Node.js 버전 확인
    if command -v node &> /dev/null; then
        node_version=$(node --version)
        log_success "Node.js 설치됨 (버전: $node_version)"
    else
        log_error "Node.js가 설치되지 않음"
    fi
    
    # npm 버전 확인
    if command -v npm &> /dev/null; then
        npm_version=$(npm --version)
        log_success "npm 설치됨 (버전: $npm_version)"
    else
        log_error "npm이 설치되지 않음"
    fi
    
    # Python 버전 확인
    if command -v python3 &> /dev/null; then
        python_version=$(python3 --version)
        log_success "Python3 설치됨 (버전: $python_version)"
    else
        log_error "Python3가 설치되지 않음"
    fi
    
    # 필수 명령어 확인
    local commands=("curl" "jq" "lsof" "bc")
    for cmd in "${commands[@]}"; do
        if command -v $cmd &> /dev/null; then
            log_success "$cmd 사용 가능"
        else
            log_warning "$cmd 설치되지 않음"
        fi
    done
}

# 전체 시스템 상태 요약
show_summary() {
    log_header "시스템 상태 요약"
    
    local total_checks=0
    local passed_checks=0
    
    # 간단한 상태 확인
    checks=(
        "curl -s http://localhost:3001/api/health > /dev/null 2>&1"
        "curl -s http://localhost:9997/v3/config/global > /dev/null 2>&1"
        "curl -s http://localhost:3000 > /dev/null 2>&1"
        "pgrep -f mediamtx > /dev/null"
        "pgrep -f node > /dev/null"
    )
    
    check_names=(
        "백엔드 API"
        "MediaMTX API"
        "프론트엔드"
        "MediaMTX 프로세스"
        "Node.js 프로세스"
    )
    
    for i in "${!checks[@]}"; do
        total_checks=$((total_checks + 1))
        if eval "${checks[$i]}"; then
            passed_checks=$((passed_checks + 1))
            log_success "${check_names[$i]}"
        else
            log_error "${check_names[$i]}"
        fi
    done
    
    echo ""
    if [ $passed_checks -eq $total_checks ]; then
        log_success "전체 시스템 상태: 정상 ($passed_checks/$total_checks)"
    else
        log_warning "전체 시스템 상태: 부분 정상 ($passed_checks/$total_checks)"
    fi
    
    # 추천 액션
    if [ $passed_checks -lt $total_checks ]; then
        echo ""
        log_info "추천 액션:"
        echo "  - 실패한 서비스 재시작: ./start_system.sh --restart"
        echo "  - 로그 확인: tail -f logs/*.log"
        echo "  - 수동 서비스 시작: ./start_system.sh"
    fi
}

# 사용법 표시
show_usage() {
    echo "ReturnFeed 시스템 상태 확인 스크립트"
    echo "사용법: $0 [옵션]"
    echo ""
    echo "옵션:"
    echo "  -h, --help        이 도움말 표시"
    echo "  -q, --quick       빠른 상태 확인만 실행"
    echo "  -v, --verbose     상세한 정보 표시"
    echo "  -w, --watch       실시간 모니터링 모드"
    echo "  --api-only        API 엔드포인트만 확인"
    echo "  --processes-only  프로세스 상태만 확인"
    echo ""
}

# 실시간 모니터링
watch_mode() {
    echo "실시간 모니터링 모드 시작 (Ctrl+C로 종료)"
    echo ""
    
    while true; do
        clear
        echo "=== ReturnFeed 시스템 실시간 모니터링 ==="
        echo "업데이트 시간: $(date)"
        echo ""
        
        show_summary
        check_resource_usage
        
        sleep 5
    done
}

# 메인 함수
main() {
    case "${1:-}" in
        -h|--help)
            show_usage
            exit 0
            ;;
        -q|--quick)
            show_summary
            exit 0
            ;;
        -w|--watch)
            watch_mode
            exit 0
            ;;
        --api-only)
            check_api_endpoints
            exit 0
            ;;
        --processes-only)
            check_processes
            exit 0
            ;;
        -v|--verbose)
            # 상세 모드 - 모든 확인 실행
            ;;
        "")
            # 기본 모드 - 대부분의 확인 실행
            ;;
        *)
            log_error "알 수 없는 옵션: $1"
            show_usage
            exit 1
            ;;
    esac
    
    # 로고 표시
    echo ""
    echo "  ____      _                   _____             _ "
    echo " |  _ \ ___| |_ _   _ _ __ _ __ |  ___|__  ___  __| |"
    echo " | |_) / _ \ __| | | | '__| '_ \| |_ / _ \/ _ \/ _  |"
    echo " |  _ <  __/ |_| |_| | |  | | | |  _|  __/  __/ (_| |"
    echo " |_| \_\___|\__|\__,_|_|  |_| |_|_|  \___|\___|\__,_|"
    echo ""
    echo "              시스템 상태 확인 도구"
    echo ""
    
    # 확인 실행
    show_system_info
    check_dependencies
    check_ports
    check_processes
    check_api_endpoints
    check_database
    check_mediamtx_streams
    check_resource_usage
    check_network
    check_log_files
    show_summary
    
    echo ""
    log_info "상태 확인 완료"
}

# 스크립트 실행
main "$@"