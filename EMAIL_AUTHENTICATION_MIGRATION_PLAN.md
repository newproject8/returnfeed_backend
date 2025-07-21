# 📧 ReturnFeed 이메일 인증 통일 마이그레이션 계획

## 🎯 목표
회원 아이디(username)를 제거하고 이메일을 유일한 식별자로 사용하도록 시스템 전체를 통일

## 📊 현재 시스템 분석

### 데이터베이스 구조
```sql
-- 현재 users 테이블
username      VARCHAR(50) UNIQUE NOT NULL  -- 로그인에 사용
email         VARCHAR(255) UNIQUE NOT NULL -- 필수이지만 로그인에 사용 안함
password_hash VARCHAR(255)
```

### 인증 방식
1. **일반 로그인**: username + password
2. **PD 로그인**: username + password  
3. **Google OAuth**: email 기반 (하지만 구현 오류 있음)

### URL 구조
- 스트리밍 URL: `/play/:username` (공개 URL에 username 노출)

## 🔧 수정 방안

### 1단계: 데이터베이스 수정

#### A. 새로운 마이그레이션 파일
```sql
-- migrations/006_email_login_migration.sql

-- 1. username을 nullable로 변경 (단계적 제거를 위해)
ALTER TABLE users ALTER COLUMN username DROP NOT NULL;

-- 2. display_name 필드 추가 (공개 표시용)
ALTER TABLE users ADD COLUMN display_name VARCHAR(100);

-- 3. stream_slug 필드 추가 (URL용)
ALTER TABLE users ADD COLUMN stream_slug VARCHAR(100) UNIQUE;

-- 4. 기존 username으로 display_name과 stream_slug 초기화
UPDATE users SET 
  display_name = username,
  stream_slug = LOWER(REPLACE(username, ' ', '-'))
WHERE username IS NOT NULL;

-- 5. 인덱스 추가
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_stream_slug ON users(stream_slug);
```

### 2단계: 백엔드 API 수정

#### A. 인증 라우트 수정 (`src/routes/auth-secure.ts`)
```typescript
// 로그인 엔드포인트 수정
router.post('/login', async (req, res) => {
  const { email, password } = req.body;  // username → email
  
  if (!email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Email and password are required.' 
    });
  }
  
  // 이메일로 사용자 조회
  const user = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email.toLowerCase()]  // 이메일은 소문자로 통일
  );
  
  // ... 나머지 로직
});

// 회원가입 엔드포인트 수정
router.post('/register', async (req, res) => {
  const { email, password, displayName } = req.body;
  
  // stream_slug 자동 생성
  const baseSlug = displayName ? 
    displayName.toLowerCase().replace(/\s+/g, '-') : 
    email.split('@')[0];
  
  // 유니크한 slug 생성
  let streamSlug = baseSlug;
  let counter = 1;
  while (await checkSlugExists(streamSlug)) {
    streamSlug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  // 사용자 생성
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, display_name, stream_slug, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING id, email, display_name, stream_slug`,
    [email.toLowerCase(), hashedPassword, displayName, streamSlug]
  );
});
```

#### B. PD 인증 라우트 수정 (`src/routes/pd-auth.ts`)
```typescript
// 동일한 방식으로 email 기반으로 수정
router.post('/login-pd', async (req, res) => {
  const { email, password } = req.body;  // username → email
  
  // PD 사용자 확인
  const user = await pool.query(
    'SELECT * FROM users WHERE email = $1 AND is_pd = true',
    [email.toLowerCase()]
  );
  
  // ... 나머지 로직
});
```

### 3단계: 프론트엔드 수정

#### A. 로그인 컴포넌트 수정
```tsx
// src/components/Auth.tsx
const [formData, setFormData] = useState({
  email: '',      // username → email
  password: ''
});

// 로그인 폼 UI
<input
  type="email"
  name="email"
  placeholder="이메일"
  value={formData.email}
  onChange={handleChange}
  required
/>
```

#### B. 회원가입 컴포넌트 수정
```tsx
// src/pages/RegisterPD.tsx
const [formData, setFormData] = useState({
  email: '',
  password: '',
  confirmPassword: '',
  displayName: ''  // username 대체
});

// username 필드 제거, displayName 추가
<input
  type="text"
  name="displayName"
  placeholder="표시 이름 (선택사항)"
  value={formData.displayName}
  onChange={handleChange}
/>
```

#### C. URL 라우팅 수정
```tsx
// App.tsx
// 기존: /play/:username
// 변경: /play/:streamSlug
<Route path="/play/:streamSlug" element={<VideoPlayer />} />
```

### 4단계: 마이그레이션 전략

#### A. 기존 사용자 처리
```sql
-- 마이그레이션 스크립트
-- 1. 이메일이 없는 사용자 확인
SELECT username FROM users WHERE email IS NULL OR email = '';

-- 2. username을 이메일로 사용하는 사용자 처리
UPDATE users 
SET email = CONCAT(username, '@returnfeed.temp')
WHERE email IS NULL OR email = ''
AND username IS NOT NULL;

-- 3. 중복 username 처리
WITH duplicates AS (
  SELECT email, COUNT(*) as cnt
  FROM users
  GROUP BY email
  HAVING COUNT(*) > 1
)
SELECT * FROM users WHERE email IN (SELECT email FROM duplicates);
```

#### B. 단계적 전환
1. **Phase 1** (즉시): 
   - 새 회원가입은 이메일만 사용
   - 기존 회원은 username/email 둘 다 허용

2. **Phase 2** (1개월 후):
   - 로그인 시 이메일 사용 권장 안내
   - username으로 로그인 시 이메일 전환 유도

3. **Phase 3** (3개월 후):
   - username 로그인 완전 제거
   - 이메일 로그인만 허용

### 5단계: 보안 고려사항

#### A. 이메일 정규화
```typescript
// 이메일 정규화 함수
function normalizeEmail(email: string): string {
  const [localPart, domain] = email.toLowerCase().split('@');
  
  // Gmail의 경우 . 제거 및 + 이후 제거
  if (domain === 'gmail.com') {
    const cleanLocal = localPart
      .replace(/\./g, '')  // 점 제거
      .split('+')[0];      // + 이후 제거
    return `${cleanLocal}@${domain}`;
  }
  
  return email.toLowerCase();
}
```

#### B. 비밀번호 재설정
```typescript
// 이메일 기반 비밀번호 재설정
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  // 이메일로 사용자 확인
  const user = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [normalizeEmail(email)]
  );
  
  // 재설정 토큰 생성 및 이메일 발송
  // ...
});
```

## 📋 체크리스트

### 백엔드
- [ ] 데이터베이스 마이그레이션 파일 생성
- [ ] auth-secure.ts 수정 (이메일 로그인)
- [ ] pd-auth.ts 수정 (PD 이메일 로그인)
- [ ] passport.ts 수정 (Google OAuth 오류 수정)
- [ ] 이메일 정규화 함수 구현
- [ ] 비밀번호 재설정 API 추가

### 프론트엔드
- [ ] Auth.tsx 수정 (이메일 필드)
- [ ] Auth-Branded.tsx 수정
- [ ] RegisterPD.tsx 수정 (username 제거)
- [ ] AuthContext 수정 (email 파라미터)
- [ ] URL 라우팅 수정 (/play/:streamSlug)

### 테스트
- [ ] 기존 사용자 로그인 테스트
- [ ] 새 사용자 가입 테스트
- [ ] 이메일 중복 처리 테스트
- [ ] URL 리다이렉션 테스트

### 배포
- [ ] 데이터베이스 백업
- [ ] 마이그레이션 스크립트 실행
- [ ] 단계적 배포 계획 수립
- [ ] 사용자 안내 공지

## 🎯 예상 효과

### 장점
1. **사용자 경험 개선**: 하나의 ID(이메일)만 기억
2. **보안 강화**: 이메일 기반 본인 확인 용이
3. **관리 간소화**: 중복 필드 제거
4. **표준화**: 업계 표준 방식 채택

### 주의사항
1. **URL 변경**: 기존 /play/:username URL 리다이렉션 필요
2. **사용자 혼란**: 충분한 안내 필요
3. **이메일 변경**: 이메일 변경 기능 필요
4. **백업**: 완벽한 데이터 백업 필수

## 🚀 구현 우선순위

1. **긴급**: 데이터베이스 스키마 수정 및 백업
2. **높음**: 백엔드 API 수정
3. **중간**: 프론트엔드 수정
4. **낮음**: 부가 기능 (이메일 변경, 프로필 설정 등)