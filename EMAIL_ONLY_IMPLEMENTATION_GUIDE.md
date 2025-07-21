# 🚀 ReturnFeed 이메일 전용 인증 구현 가이드

## 📁 새로 생성된 파일들

### 백엔드
- `init-email-only.sql` - 이메일 전용 데이터베이스 스키마
- `src/routes/auth-clean.ts` - 일반 사용자 인증 API
- `src/routes/pd-auth-clean.ts` - PD 사용자 인증 API  
- `src/index-email.ts` - 메인 서버 파일

### 프론트엔드
- `frontend/src/components/Auth-Email.tsx` - 로그인/회원가입 컴포넌트
- `frontend/src/pages/RegisterPD-Email.tsx` - PD 회원가입 페이지
- `frontend/src/context/AuthContext-Email.tsx` - 인증 컨텍스트

## 🛠️ 구현 단계

### 1단계: 데이터베이스 설정

```bash
# PostgreSQL에 접속
psql -U postgres

# 새 데이터베이스 생성 (또는 기존 DB 초기화)
DROP DATABASE IF EXISTS returnfeed;
CREATE DATABASE returnfeed;

# 새 스키마 적용
psql -U postgres -d returnfeed < init-email-only.sql
```

### 2단계: 백엔드 설정

```bash
# 의존성 설치
cd /home/newproject/returnfeed_backend
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일 편집하여 설정

# TypeScript 컴파일
npm run build

# 서버 실행
npm start
```

### 3단계: 프론트엔드 설정

```tsx
// App.tsx 수정 예시
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext-Email';
import Auth from './components/Auth-Email';
import RegisterPD from './pages/RegisterPD-Email';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/register" element={<Auth />} />
          <Route path="/register-pd" element={<RegisterPD />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/play/:profileSlug" element={<VideoPlayer />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
```

## 📋 주요 변경사항

### 이전 (Username 기반)
```typescript
// 로그인
{ username: "user123", password: "pass123" }

// 회원가입
{ username: "user123", email: "user@example.com", password: "pass123" }

// URL
/play/user123
```

### 이후 (Email 전용)
```typescript
// 로그인
{ email: "user@example.com", password: "pass123" }

// 회원가입
{ email: "user@example.com", password: "pass123", displayName: "User Name" }

// URL
/play/user-name-1
```

## 🔧 API 사용 예시

### 회원가입
```javascript
fetch('https://returnfeed.net/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securepass123',
    displayName: 'John Doe'  // 선택사항
  })
});
```

### 로그인
```javascript
fetch('https://returnfeed.net/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',  // 쿠키 포함
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securepass123'
  })
});
```

### PD 로그인
```javascript
fetch('https://returnfeed.net/api/pd-auth/login-pd', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    email: 'pd@example.com',
    password: 'securepass123',
    pdSoftwareVersion: '5.0.0'  // 선택사항
  })
});
```

## 🎯 PD Software 수정 필요사항

### auth_manager_v2.py 수정
```python
# 이전
data = {
    "username": self.username,
    "password": self.password
}

# 이후
data = {
    "email": self.email,  # username 대신 email 사용
    "password": self.password,
    "pdSoftwareVersion": "5.0.0"
}
```

### 설정 파일 수정
```json
{
  "auth": {
    "email": "pd@example.com",
    "password": "encrypted_password"
  }
}
```

## ✅ 체크리스트

- [ ] 데이터베이스 백업
- [ ] 새 스키마 적용
- [ ] 백엔드 코드 교체
- [ ] 프론트엔드 컴포넌트 교체
- [ ] PD Software 업데이트
- [ ] 테스트 환경에서 검증
- [ ] 프로덕션 배포

## 🔍 테스트 시나리오

1. **일반 사용자 플로우**
   - 이메일로 회원가입
   - 이메일로 로그인
   - 프로필 확인

2. **PD 사용자 플로우**
   - PD 회원가입
   - PD Software에서 로그인
   - 스트리밍 설정 확인

3. **에러 케이스**
   - 중복 이메일 가입 시도
   - 잘못된 이메일 형식
   - 짧은 비밀번호

## 🚨 주의사항

1. **기존 데이터**: 서비스 시작 전이므로 데이터 마이그레이션 불필요
2. **URL 변경**: profileSlug 기반으로 모든 URL 업데이트 필요
3. **쿠키**: httpOnly 쿠키 사용으로 XSS 공격 방지
4. **이메일 정규화**: Gmail 등의 도트/플러스 처리 자동화

## 📞 문제 해결

### "Email already registered" 오류
- 이미 가입된 이메일
- 이메일 정규화 확인 (대소문자, 공백)

### 로그인 후 리다이렉트 안됨
- AuthContext 제대로 import 했는지 확인
- 쿠키 설정 확인 (credentials: 'include')

### PD Software 연결 안됨
- API 엔드포인트 확인 (/api/pd-auth/login-pd)
- 이메일 필드명 확인 (username → email)