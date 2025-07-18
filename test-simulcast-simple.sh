#!/bin/bash

echo "========================================="
echo "간단한 시뮬캐스트 2-레이어 테스트"
echo "========================================="
echo ""

SESSION_KEY="test_$(date +%s)"

echo "[1] MediaMTX 컨테이너 확인..."
if docker ps | grep -q returnfeed-mediamtx; then
    echo "✓ MediaMTX 실행 중"
else
    echo "✗ MediaMTX가 실행되지 않았습니다."
    exit 1
fi

echo ""
echo "[2] 테스트 스트림 생성 (Docker FFmpeg 사용)..."
echo ""

# High 품질 스트림 (1Mbps)
echo "  High 품질 (1Mbps) 스트림 시작..."
docker run --rm -d \
    --name simulcast_test_h \
    --network host \
    linuxserver/ffmpeg \
    -f lavfi -i testsrc2=size=640x360:rate=60 \
    -f lavfi -i sine=frequency=1000:sample_rate=48000 \
    -t 60 \
    -c:v libx264 -profile:v baseline -preset ultrafast -tune zerolatency \
    -b:v 1000k -maxrate 1000k -bufsize 2000k \
    -g 60 -keyint_min 60 -bf 0 \
    -c:a libopus -b:a 128k -application lowdelay \
    -f mpegts \
    "srt://localhost:8890?streamid=publish:simulcast_${SESSION_KEY}_h&latency=20" \
    > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "    ✓ High 품질 스트림 시작됨"
else
    echo "    ✗ High 품질 스트림 시작 실패"
fi

# Low 품질 스트림 (0.1Mbps)
echo "  Low 품질 (0.1Mbps) 스트림 시작..."
docker run --rm -d \
    --name simulcast_test_l \
    --network host \
    linuxserver/ffmpeg \
    -f lavfi -i testsrc2=size=640x360:rate=30 \
    -f lavfi -i sine=frequency=500:sample_rate=48000 \
    -t 60 \
    -c:v libx264 -profile:v baseline -preset ultrafast -tune zerolatency \
    -b:v 100k -maxrate 100k -bufsize 200k \
    -g 30 -keyint_min 30 -bf 0 \
    -c:a libopus -b:a 32k -application lowdelay \
    -f mpegts \
    "srt://localhost:8890?streamid=publish:simulcast_${SESSION_KEY}_l&latency=20" \
    > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "    ✓ Low 품질 스트림 시작됨"
else
    echo "    ✗ Low 품질 스트림 시작 실패"
fi

echo ""
echo "[3] 스트림 활성화 대기 (5초)..."
sleep 5

echo ""
echo "[4] WebRTC 접속 URL:"
echo ""
echo "  🔵 High 품질 (1Mbps): http://localhost:8899/simulcast_${SESSION_KEY}_h"
echo "  🟡 Low 품질 (0.1Mbps): http://localhost:8899/simulcast_${SESSION_KEY}_l"
echo ""
echo "  위 URL을 브라우저에서 열어 테스트하세요."
echo ""

echo "[5] 스트림 상태 모니터링..."
echo "  (Ctrl+C로 중단)"
echo ""

# 스트림 상태 모니터링
while true; do
    HIGH_RUNNING=$(docker ps -q -f name=simulcast_test_h)
    LOW_RUNNING=$(docker ps -q -f name=simulcast_test_l)
    
    STATUS=""
    if [ -n "$HIGH_RUNNING" ]; then
        STATUS="${STATUS}[H:✓] "
    else
        STATUS="${STATUS}[H:✗] "
    fi
    
    if [ -n "$LOW_RUNNING" ]; then
        STATUS="${STATUS}[L:✓] "
    else
        STATUS="${STATUS}[L:✗] "
    fi
    
    printf "\r  스트림 상태: $STATUS ($(date +%H:%M:%S))"
    
    # 두 스트림이 모두 종료되면 자동 종료
    if [ -z "$HIGH_RUNNING" ] && [ -z "$LOW_RUNNING" ]; then
        echo ""
        echo ""
        echo "모든 스트림이 종료되었습니다."
        break
    fi
    
    sleep 1
done

# 정리
echo ""
echo "[6] 테스트 종료..."
docker stop simulcast_test_h simulcast_test_l 2>/dev/null

echo ""
echo "========================================="
echo "시뮬캐스트 2-레이어 테스트 완료"
echo "========================================="
echo ""
echo "구현된 기능:"
echo "  - 2개 품질 레이어 (1Mbps, 0.1Mbps)"
echo "  - 동일 해상도 유지 (640x360)"
echo "  - SRT → WebRTC 변환"
echo "  - 초저지연 스트리밍 (20-50ms 목표)"
echo ""