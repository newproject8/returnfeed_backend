# PD Software NGINX 설정 수정 가이드

## 🔧 해결된 문제

### 1. HTTPS 리다이렉트 루프 문제
- **원인**: 모든 HTTP 요청을 HTTPS로 리다이렉트하여 API 호출 시 무한 루프 발생
- **해결**: API 엔드포인트(`/api/*`)는 HTTP와 HTTPS 모두에서 직접 처리하도록 수정

### 2. CORS 오류
- **원인**: Cross-Origin Resource Sharing 헤더 미설정
- **해결**: 모든 API 엔드포인트에 CORS 헤더 추가

### 3. PD 인증 API 접근 불가
- **원인**: HTTPS 강제 리다이렉트 및 HSTS 정책
- **해결**: 
  - HTTP API 직접 접근 허용
  - 8092 포트로 별도 API 서버 운영
  - HSTS 헤더 제거

## 📋 수정 내용

### nginx-pd-fix.conf 주요 변경사항

1. **HTTP (80포트) 서버 설정**
   ```nginx
   # API 요청은 리다이렉트하지 않고 직접 처리
   location /api/ {
       # CORS 헤더 설정
       add_header 'Access-Control-Allow-Origin' '*' always;
       proxy_pass http://backend_server;
   }
   
   # 나머지 요청만 HTTPS로 리다이렉트
   location / {
       return 301 https://$server_name$request_uri;
   }
   ```

2. **별도 API 포트 (8092) 추가**
   ```nginx
   server {
       listen 8092;
       # 모든 API 요청 처리
   }
   ```

3. **CORS 헤더 완전 지원**
   - OPTIONS 프리플라이트 요청 처리
   - 모든 필요한 헤더 허용

## 🚀 배포 방법

### 1. 자동 배포 (권장)
```bash
cd /home/newproject/returnfeed_backend
sudo ./fix_pd_nginx.sh
```

### 2. 수동 배포
```bash
# 1. 백업
sudo cp /etc/nginx/sites-available/returnfeed /etc/nginx/sites-available/returnfeed.backup

# 2. 새 설정 적용
sudo cp nginx/nginx-pd-fix.conf /etc/nginx/sites-available/returnfeed

# 3. 설정 테스트
sudo nginx -t

# 4. NGINX 재시작
sudo systemctl reload nginx

# 5. 포트 열기
sudo ufw allow 8092/tcp
```

## 🔌 사용 가능한 엔드포인트

### PD Software에서 사용할 수 있는 URL

1. **HTTP API (권장)**
   ```
   http://returnfeed.net/api/pd-auth/login-pd
   http://returnfeed.net/api/pd-auth/register-pd
   http://returnfeed.net/api/pd-auth/stream-info
   ```

2. **직접 포트 접근 (백업)**
   ```
   http://returnfeed.net:8092/api/pd-auth/login-pd
   http://returnfeed.net:8092/api/pd-auth/register-pd
   http://returnfeed.net:8092/api/pd-auth/stream-info
   ```

3. **HTTPS API (선택사항)**
   ```
   https://returnfeed.net/api/pd-auth/login-pd
   https://returnfeed.net/api/pd-auth/register-pd
   https://returnfeed.net/api/pd-auth/stream-info
   ```

### WebSocket 연결
```
ws://returnfeed.net/ws/relay
ws://returnfeed.net:8092/ws/relay
wss://returnfeed.net/ws/relay
```

## 🧪 테스트 방법

### 1. API 접근 테스트
```bash
# HTTP API 테스트
curl -X POST http://returnfeed.net/api/pd-auth/login-pd \
  -H "Content-Type: application/json" \
  -d '{"pdId": "test", "password": "test"}'

# 8092 포트 테스트  
curl -X POST http://returnfeed.net:8092/api/pd-auth/login-pd \
  -H "Content-Type: application/json" \
  -d '{"pdId": "test", "password": "test"}'
```

### 2. CORS 테스트
```javascript
// 브라우저 콘솔에서 실행
fetch('http://returnfeed.net/api/pd-auth/login-pd', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ pdId: 'test', password: 'test' })
})
.then(response => response.json())
.then(data => console.log(data));
```

## ⚠️ 주의사항

1. **보안 고려사항**
   - HTTP API는 암호화되지 않으므로 민감한 정보 전송 시 주의
   - 프로덕션 환경에서는 가능한 HTTPS 사용 권장

2. **방화벽 설정**
   - 8092 포트가 열려있는지 확인 필요
   - 클라우드 환경인 경우 보안 그룹에서도 포트 개방 필요

3. **DNS 전파**
   - returnfeed.net 도메인이 올바른 IP를 가리키는지 확인

## 📞 문제 발생 시

1. **NGINX 로그 확인**
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

2. **백엔드 로그 확인**
   ```bash
   docker logs returnfeed_backend_backend_1
   ```

3. **설정 롤백**
   ```bash
   sudo cp /etc/nginx/sites-available/returnfeed.backup /etc/nginx/sites-available/returnfeed
   sudo systemctl reload nginx
   ```

## 🎯 요약

- ✅ HTTPS 리다이렉트 루프 해결
- ✅ API 엔드포인트 HTTP 직접 접근 가능
- ✅ CORS 헤더 설정 완료
- ✅ 8092 포트 백업 접근 경로 제공
- ✅ WebSocket 연결 지원

PD Software는 이제 다음 중 하나의 방법으로 API에 접근할 수 있습니다:
- `http://returnfeed.net/api/*` (권장)
- `http://returnfeed.net:8092/api/*` (백업)
- `https://returnfeed.net/api/*` (보안 연결)