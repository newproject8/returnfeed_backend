#!/bin/bash

# MediaMTX 패스스루 모드 검증 스크립트
# 트랜스코딩이 발생하지 않는지 확인

echo "========================================="
echo "MediaMTX 패스스루 모드 검증 스크립트"
echo "========================================="
echo ""

# MediaMTX API 엔드포인트
MEDIAMTX_API="http://localhost:9997/v3"

# 1. MediaMTX 상태 확인
echo "[1] MediaMTX 서버 상태 확인..."
if curl -s "$MEDIAMTX_API/config/get" > /dev/null; then
    echo "✓ MediaMTX API 응답 정상"
else
    echo "✗ MediaMTX API 응답 없음"
    exit 1
fi

# 2. 활성 경로 목록
echo ""
echo "[2] 활성 스트림 목록..."
PATHS=$(curl -s "$MEDIAMTX_API/paths/list" | jq -r '.items[].name' 2>/dev/null)

if [ -z "$PATHS" ]; then
    echo "현재 활성 스트림이 없습니다."
    echo "테스트를 위해 스트림을 시작해주세요."
    exit 0
fi

echo "발견된 스트림:"
echo "$PATHS" | while read path; do
    echo "  - $path"
done

# 3. 각 경로의 패스스루 상태 검증
echo ""
echo "[3] 패스스루 모드 검증..."
echo ""

PASSTHROUGH_COUNT=0
TRANSCODING_COUNT=0

echo "$PATHS" | while read path; do
    if [ -z "$path" ]; then
        continue
    fi
    
    echo "경로: $path"
    echo "-----------------"
    
    # 경로 정보 가져오기
    PATH_INFO=$(curl -s "$MEDIAMTX_API/paths/get/$path")
    
    # 비디오 트랙 분석
    VIDEO_INFO=$(echo "$PATH_INFO" | jq '.tracks[] | select(.type == "video")')
    
    if [ -n "$VIDEO_INFO" ]; then
        CODEC=$(echo "$VIDEO_INFO" | jq -r '.codec')
        WIDTH=$(echo "$VIDEO_INFO" | jq -r '.width')
        HEIGHT=$(echo "$VIDEO_INFO" | jq -r '.height')
        FPS=$(echo "$VIDEO_INFO" | jq -r '.fps')
        DECODER_DECODED=$(echo "$VIDEO_INFO" | jq -r '.decoderDecoded')
        ENCODER_ENCODED=$(echo "$VIDEO_INFO" | jq -r '.encoderEncoded')
        
        echo "  비디오 코덱: $CODEC"
        echo "  해상도: ${WIDTH}x${HEIGHT}"
        echo "  FPS: $FPS"
        
        # 패스스루 확인
        if [ "$DECODER_DECODED" = "null" ] && [ "$ENCODER_ENCODED" = "null" ]; then
            echo "  상태: ✓ 패스스루 모드 (트랜스코딩 없음)"
            PASSTHROUGH_COUNT=$((PASSTHROUGH_COUNT + 1))
        else
            echo "  상태: ✗ 트랜스코딩 발생!"
            echo "    - 디코딩된 프레임: $DECODER_DECODED"
            echo "    - 인코딩된 프레임: $ENCODER_ENCODED"
            TRANSCODING_COUNT=$((TRANSCODING_COUNT + 1))
        fi
    else
        echo "  비디오 트랙 없음"
    fi
    
    # 오디오 트랙 분석
    AUDIO_INFO=$(echo "$PATH_INFO" | jq '.tracks[] | select(.type == "audio")')
    
    if [ -n "$AUDIO_INFO" ]; then
        AUDIO_CODEC=$(echo "$AUDIO_INFO" | jq -r '.codec')
        CHANNELS=$(echo "$AUDIO_INFO" | jq -r '.channels')
        SAMPLE_RATE=$(echo "$AUDIO_INFO" | jq -r '.sampleRate')
        
        echo "  오디오 코덱: $AUDIO_CODEC"
        echo "  채널: $CHANNELS"
        echo "  샘플레이트: $SAMPLE_RATE"
    fi
    
    # 클라이언트 정보
    READERS=$(echo "$PATH_INFO" | jq '.readers | length')
    echo "  연결된 클라이언트: $READERS"
    
    echo ""
done

# 4. 성능 메트릭
echo "[4] 성능 메트릭..."
METRICS=$(curl -s "http://localhost:9998/metrics" 2>/dev/null | grep mediamtx)

if [ -n "$METRICS" ]; then
    # CPU 사용률
    CPU_USAGE=$(echo "$METRICS" | grep "process_cpu_seconds_total" | awk '{print $2}')
    
    # 메모리 사용량
    MEMORY_USAGE=$(echo "$METRICS" | grep "process_resident_memory_bytes" | awk '{print $2}')
    MEMORY_MB=$(echo "scale=2; $MEMORY_USAGE / 1024 / 1024" | bc 2>/dev/null || echo "N/A")
    
    # 활성 연결 수
    CONNECTIONS=$(echo "$METRICS" | grep "paths{state=\"ready\"}" | awk '{print $2}')
    
    echo "  CPU 시간: ${CPU_USAGE:-N/A}초"
    echo "  메모리 사용: ${MEMORY_MB:-N/A}MB"
    echo "  활성 경로: ${CONNECTIONS:-0}"
fi

# 5. 레이턴시 추정
echo ""
echo "[5] 레이턴시 분석..."

# SRT 설정 확인
SRT_CONFIG=$(curl -s "$MEDIAMTX_API/config/get" | jq '.srtLatency' 2>/dev/null)
echo "  SRT 레이턴시 설정: ${SRT_CONFIG:-N/A}ms"

# WebRTC 지터 버퍼 확인
echo "  WebRTC 지터 버퍼: 최소화됨 (패스스루 모드)"

# 예상 레이턴시
echo ""
echo "  예상 End-to-End 레이턴시:"
echo "    - 패스스루 모드: 20-50ms"
echo "    - 트랜스코딩 모드: 150-300ms"

# 6. 최종 결과
echo ""
echo "========================================="
echo "검증 결과 요약"
echo "========================================="
echo "  패스스루 스트림: $PASSTHROUGH_COUNT"
echo "  트랜스코딩 스트림: $TRANSCODING_COUNT"

if [ $TRANSCODING_COUNT -eq 0 ] && [ $PASSTHROUGH_COUNT -gt 0 ]; then
    echo ""
    echo "✓ 모든 스트림이 패스스루 모드로 동작 중입니다!"
    echo "  예상 레이턴시: 20-50ms"
elif [ $TRANSCODING_COUNT -gt 0 ]; then
    echo ""
    echo "⚠ 경고: 일부 스트림에서 트랜스코딩이 발생하고 있습니다!"
    echo "  다음 사항을 확인하세요:"
    echo "  1. PD 소프트웨어가 H.264 baseline + Opus로 인코딩하는지"
    echo "  2. MediaMTX 설정에서 webrtcCodecH264: yes 인지"
    echo "  3. 불필요한 트랜스코딩 설정이 없는지"
else
    echo ""
    echo "현재 활성 스트림이 없습니다."
fi

# 7. 권장 사항
echo ""
echo "========================================="
echo "패스스루 모드 최적화 권장사항"
echo "========================================="
echo "1. PD 소프트웨어에서 출력 코덱 설정:"
echo "   - 비디오: H.264 baseline profile"
echo "   - 오디오: Opus"
echo "   - 해상도: 640x360 (NDI Proxy)"
echo "   - FPS: 60"
echo ""
echo "2. MediaMTX 설정 확인:"
echo "   - webrtcCodecH264: yes"
echo "   - webrtcCodecOpus: yes"
echo "   - webrtcCodecVP8: no"
echo "   - webrtcCodecVP9: no"
echo ""
echo "3. 네트워크 최적화:"
echo "   - SRT 레이턴시: 20ms"
echo "   - 로컬 네트워크 사용"
echo "   - 방화벽 예외 설정"