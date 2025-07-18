# ReturnFeed 포괄적 브랜딩 및 웹디자인 전략

## 브랜드 포지셔닝 전략

### 시장 차별화 포인트
연구 결과, 원격 방송 제작(REMI) 시장은 2030년까지 연평균 22.2% 성장하여 214억 달러 규모에 이를 것으로 예상됩니다. 하지만 현재 시장에는 명확한 공백이 있습니다:

**주요 시장 기회:**
- **중소규모 시장 공백**: 대부분의 경쟁사(TVU Networks, LiveU)는 대기업 중심으로 복잡한 가격 체계 운영
- **AI 자동화 부재**: 탈리 및 모니터링 시스템에서 지능형 자동화 기능 부족
- **모바일 최적화 부족**: 현장 운영을 위한 정교한 모바일 인터페이스 제한적
- **통합 워크플로우 부재**: 대부분의 솔루션이 단절되어 있어 엔드투엔드 통합 기회 존재

### 브랜드 아이덴티티 

**핵심 가치 제안:**
"**실시간 방송 제작의 새로운 기준** - 기술 감독 없이도 전문 방송을 가능하게 하는 차세대 리턴 모니터링 시스템"

**브랜드 포지셔닝:**
- **Primary**: 접근성 높은 전문 방송 솔루션
- **Secondary**: 초저지연 영상 전송 기술 리더
- **Tertiary**: 중소규모 방송 팀을 위한 최적화된 도구

## 확장된 컬러 시스템

### Primary Colors
```css
--rf-primary-blue: #00c6ff;    /* 메인 브랜드 컬러 */
--rf-primary-dark: #0099cc;    /* 호버/액티브 상태 */
--rf-primary-light: #33d1ff;   /* 배경/서브틀 사용 */
```

### Semantic Colors (방송 표준 준수)
```css
--rf-tally-red: #D41728;       /* PGM/Live 상태 */
--rf-tally-green: #00A36C;     /* Preview 상태 */
--rf-tally-yellow: #FFB000;    /* ISO/Recording */
--rf-tally-off: #2A2A2A;       /* 비활성 상태 */
```

### UI Colors
```css
/* Dark Theme (Primary) */
--rf-bg-primary: #0A0A0A;      /* 메인 배경 */
--rf-bg-secondary: #121212;    /* 카드/패널 배경 */
--rf-bg-tertiary: #1E1E1E;     /* 입력 필드 배경 */
--rf-bg-elevated: #2A2A2A;     /* 상승된 요소 */

/* Text Colors */
--rf-text-primary: #FFFFFF;    /* 주요 텍스트 */
--rf-text-secondary: #B3B3B3;  /* 보조 텍스트 */
--rf-text-tertiary: #808080;   /* 비활성 텍스트 */
--rf-text-link: #00c6ff;       /* 링크 텍스트 */

/* Status Colors */
--rf-success: #16A34A;         /* 성공 상태 */
--rf-warning: #F59E0B;         /* 경고 상태 */
--rf-error: #DC2626;           /* 오류 상태 */
--rf-info: #3B82F6;            /* 정보 상태 */
```

### Accessibility Colors
```css
/* Color Blind Safe Variants */
--rf-cb-safe-red: #CC3311;     /* Deuteranopia safe */
--rf-cb-safe-green: #009988;   /* Protanopia safe */
--rf-cb-safe-blue: #0077BB;    /* Tritanopia safe */
```

## 타이포그래피 시스템

### Font Stack 정의
```css
/* 한글/영문 혼용 최적화 */
--rf-font-primary: 'Metropolis', 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
--rf-font-korean: 'G마켓 산스', 'Pretendard', 'Noto Sans KR', sans-serif;
--rf-font-mono: 'JetBrains Mono', 'D2Coding', 'SF Mono', monospace;
```

### Type Scale (8pt Grid System)
```css
/* Headings */
--rf-h1: 3rem/1.2;      /* 48px - 페이지 타이틀 */
--rf-h2: 2.25rem/1.3;   /* 36px - 섹션 헤더 */
--rf-h3: 1.875rem/1.4;  /* 30px - 서브섹션 */
--rf-h4: 1.5rem/1.4;    /* 24px - 카드 타이틀 */
--rf-h5: 1.25rem/1.5;   /* 20px - 서브타이틀 */
--rf-h6: 1.125rem/1.5;  /* 18px - 라벨 */

/* Body Text */
--rf-body-large: 1.125rem/1.6;  /* 18px */
--rf-body-base: 1rem/1.6;        /* 16px */
--rf-body-small: 0.875rem/1.5;   /* 14px */
--rf-caption: 0.75rem/1.4;       /* 12px */
```

## 아이콘 및 그래픽 스타일 가이드

### Icon System
- **Style**: Outline icons with 2px stroke weight
- **Grid**: 24x24px base, scalable to 16px, 32px, 48px
- **Corner radius**: 2px for consistency
- **Format**: SVG with currentColor for theme adaptability

### 탈리 상태 아이콘
```
● LIVE (빨간 원 + 전파 아이콘)
● PREVIEW (녹색 원 + 눈 아이콘)  
● REC (노란 원 + 녹화 아이콘)
○ OFF (회색 원)
```

### UI Component Icons
- Navigation: 햄버거 메뉴, 화살표, 닫기
- Media: 재생, 일시정지, 정지, 음소거
- System: 설정, 알림, 경고, 정보
- Device: 카메라, 마이크, 모니터, 모바일

## 반응형 로고 시스템

### Logo Variations
1. **Full Logo**: "ReturnFeed" - 데스크톱 헤더, 마케팅 자료
2. **Short Logo**: "RF" - 모바일 헤더, 앱 아이콘
3. **Icon Only**: 심볼 마크 - 파비콘, 로딩 스크린
4. **Tally Integration**: 로고에 빨간 점 포함 - 라이브 상태 표시

### Safe Space Rules
- Minimum clear space: 로고 높이의 50%
- Minimum size: 120px (가로), 24px (아이콘)
- Background contrast: 최소 3:1 비율 유지

## 웹사이트 구성 계획

### 사이트맵 구조

```
홈
├── 제품
│   ├── ReturnFeed Live 개요
│   ├── 주요 기능
│   ├── 기술 사양
│   └── 호환성 정보
├── 솔루션
│   ├── 방송 PD를 위한 솔루션
│   ├── 카메라맨을 위한 솔루션
│   └── 중소규모 제작팀 사례
├── 가격
│   ├── 요금제 비교
│   ├── 무료 체험
│   └── 엔터프라이즈 문의
├── 리소스
│   ├── 시작 가이드
│   ├── 비디오 튜토리얼
│   ├── API 문서
│   └── 기술 지원
└── 회사
    ├── 소개
    ├── 블로그
    └── 문의하기
```

### 랜딩 페이지 구성

#### Hero Section
- **Headline**: "실시간 방송 제작의 새로운 기준"
- **Subheadline**: "초저지연 영상 전송 기술로 어디서나 완벽한 PGM 모니터링"
- **CTA**: "무료 체험 시작" / "데모 보기"
- **Hero Visual**: 실제 사용 환경 비디오 (루프)

#### Features Grid (Bento Box Layout)
1. **초저지연 스트리밍** (<100ms)
2. **실시간 탈리 신호**
3. **웹브라우저 기반**
4. **다중 디바이스 지원**
5. **vMix 완벽 호환**
6. **보안 연결 (SSL/HTTPS)**

#### Social Proof Section
- 고객사 로고 캐러셀
- 주요 통계: "지연시간 <100ms", "99.9% 가동률", "5분 설치"
- 사용자 후기 (방송 PD, 카메라맨)

#### Use Cases
- **스튜디오 방송**: 다중 카메라 라이브 프로덕션
- **야외 중계**: 스포츠, 이벤트 현장 중계
- **기업 방송**: 웨비나, 제품 발표회

#### Technical Comparison
- 경쟁사 대비 장점 테이블
- 지연시간, 설치 시간, 가격, 기능 비교

#### Call-to-Action
- Primary: "14일 무료 체험"
- Secondary: "기술 문서 보기"

## 모바일 우선 디자인 시스템

### Breakpoints
```css
--rf-mobile: 375px;     /* 최소 지원 */
--rf-tablet: 768px;     /* 태블릿 세로 */
--rf-desktop: 1024px;   /* 데스크톱 시작 */
--rf-wide: 1440px;      /* 와이드 스크린 */
```

### Touch Targets
- Minimum size: 44x44px (Apple HIG standard)
- Spacing between targets: 8px minimum
- Critical controls: 56x56px (bottom screen area)

### Mobile-Specific Features
1. **One-handed operation**: 하단 2/3 영역에 주요 컨트롤 배치
2. **Gesture controls**: 
   - Swipe left/right: 카메라 전환
   - Double tap: 전체화면 전환
   - Long press: 상세 옵션
3. **Orientation handling**: 세로/가로 모드 자동 전환
4. **Offline capability**: 마지막 상태 캐싱

## 디자인 시스템 컴포넌트

### Button System
```css
/* Primary Button */
.btn-primary {
  background: var(--rf-primary-blue);
  color: white;
  padding: 12px 24px;
  border-radius: 6px;
  font-weight: 600;
  transition: all 0.2s ease;
}

/* Tally State Buttons */
.btn-tally-live {
  background: var(--rf-tally-red);
  box-shadow: 0 0 20px rgba(212, 23, 40, 0.5);
  animation: pulse 2s infinite;
}
```

### Card Components
- **Monitor Card**: 비디오 피드 + 탈리 상태 + 컨트롤
- **Status Card**: 연결 상태, 지연시간, 품질 지표
- **Device Card**: 카메라/오디오 장치 정보

### Form Elements
- **Input fields**: 다크 배경에 최적화된 고대비 디자인
- **Toggle switches**: 탈리 on/off 상태 명확한 표시
- **Dropdowns**: 카메라/오디오 소스 선택

## 구현 권장사항

### 기술 스택
1. **Frontend Framework**: React + TypeScript
2. **Styling**: Tailwind CSS + Custom Design Tokens
3. **Animation**: Framer Motion (성능 최적화)
4. **Icons**: Custom SVG icon system
5. **Testing**: Storybook for component development

### 성능 최적화
- Core Web Vitals 목표: LCP <2.5s, FID <100ms, CLS <0.1
- 이미지 최적화: WebP format, lazy loading
- 폰트 최적화: Variable fonts, subset for Korean

### 접근성 체크리스트
- [ ] WCAG 2.1 AA 준수
- [ ] 색맹 사용자 테스트
- [ ] 스크린 리더 호환성
- [ ] 키보드 네비게이션
- [ ] 고대비 모드 지원

### 브랜드 일관성 유지
1. **Design Tokens**: 중앙 집중식 디자인 변수 관리
2. **Component Library**: Storybook 기반 문서화
3. **Brand Guidelines**: Figma 기반 디자인 시스템
4. **Version Control**: 디자인 변경사항 추적

이 종합적인 브랜딩 및 웹디자인 전략은 ReturnFeed가 전문 방송 시장에서 신뢰할 수 있는 브랜드로 자리매김하면서도, 중소규모 제작팀이 쉽게 접근할 수 있는 솔루션으로 포지셔닝할 수 있도록 설계되었습니다.