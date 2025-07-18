# ReturnFeed Documentation Index

## 📚 Documentation Overview

This index provides a comprehensive guide to all ReturnFeed documentation.

### 🎆 v4.1 Release Documentation

#### 1. [IMPLEMENTATION_PROGRESS_v4.md](IMPLEMENTATION_PROGRESS_v4.md)
**Purpose**: v4.0 트랜스코딩 제거 구현 진행상황  
**Audience**: 개발팀, 프로젝트 관리자  
**Contents**: 구현 내역, 테스트 결과, 성능 개선

#### 2. [LATENCY_OPTIMIZATION_GUIDE.md](LATENCY_OPTIMIZATION_GUIDE.md)
**Purpose**: 초저지연 최적화 가이드  
**Audience**: PD 소프트웨어 개발자, 시스템 관리자  
**Contents**: 트랜스코딩 제거 방법, 코덱 설정, 성능 분석

#### 3. [WEBRTC_NATIVE_CODEC_GUIDE.md](pd-software/WEBRTC_NATIVE_CODEC_GUIDE.md)
**Purpose**: PD 소프트웨어 WebRTC 네이티브 코덱 설정  
**Audience**: PD 소프트웨어 개발자  
**Contents**: H.264 baseline + Opus 설정, FFmpeg 파라미터

#### 4. [개발계획서 v4.1.0](doc/리턴피드_개발계획서.md)
**Purpose**: ReturnFeed 프로젝트 전체 개발 계획  
**Audience**: 모든 이해관계자  
**Contents**: NDI Proxy 표준화, GPU 벤더 독립성, 60fps 지원

#### 5. [PASSTHROUGH_MODE_GUIDE.md](PASSTHROUGH_MODE_GUIDE.md)
**Purpose**: MediaMTX 패스스루 모드 구성 가이드  
**Audience**: 시스템 관리자, 개발자  
**Contents**: 20-50ms 초저지연 달성 방법

#### 6. [ENHANCED_STREAMING_GUIDE.md](pd-software/ENHANCED_STREAMING_GUIDE.md)
**Purpose**: NDI Proxy 및 GPU 벤더 독립적 스트리밍  
**Audience**: PD 소프트웨어 개발자  
**Contents**: GPU 감지, NDI Proxy 구현, 성능 비교

### Core Documentation

#### 1. [README.md](README.md)
**Purpose**: Project overview and quick start guide  
**Audience**: All users  
**Contents**: Introduction, features, installation, tech stack

#### 2. [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)
**Purpose**: Technical architecture details  
**Audience**: Developers, DevOps  
**Contents**: System design, components, data flow, security

#### 3. [API Documentation](doc/API.md)
**Purpose**: Complete API reference  
**Audience**: Frontend/Backend developers  
**Contents**: Endpoints, authentication, WebSocket protocol

#### 4. [Frontend Documentation](frontend/README.md)
**Purpose**: Frontend development guide  
**Audience**: Frontend developers  
**Contents**: React components, development setup, build process

#### 5. [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
**Purpose**: Complete feature implementation overview  
**Audience**: All users, project managers  
**Contents**: 100% completion status, performance metrics, key achievements

### Security Documentation

#### 1. [SECURITY_IMPLEMENTATION_GUIDE.md](SECURITY_IMPLEMENTATION_GUIDE.md)
**Purpose**: Security best practices and implementation  
**Audience**: Security engineers, developers  
**Contents**: Authentication, encryption, secure deployment

#### 2. [SECURITY_IMPROVEMENTS.md](SECURITY_IMPROVEMENTS.md)
**Purpose**: Recent security enhancements  
**Audience**: System administrators  
**Contents**: Vulnerability fixes, security updates

### Deployment & Operations

#### 1. [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
**Purpose**: Step-by-step deployment instructions  
**Audience**: DevOps, system administrators  
**Contents**: Installation, configuration, troubleshooting

#### 2. [TODO.md](TODO.md)
**Purpose**: Development roadmap and known issues  
**Audience**: Development team  
**Contents**: Completed features, pending tasks, bug tracking

#### 3. [DEPLOYMENT_ENTERPRISE.md](DEPLOYMENT_ENTERPRISE.md)
**Purpose**: Enterprise deployment guide  
**Audience**: Enterprise IT teams  
**Contents**: High-availability setup, scaling, monitoring

### Project Planning

#### 1. [Project Plan](doc/Project_Plan.md)
**Purpose**: Comprehensive project planning document  
**Audience**: Project managers, stakeholders  
**Contents**: Development phases, technical stack, roadmap

#### 2. [리턴피드 개발계획서](doc/리턴피드_개발계획서.md)
**Purpose**: Korean development plan (v3.0.0)  
**Audience**: Korean stakeholders  
**Contents**: 100% feature completion, implementation details

### Business Documentation (Korean)

#### 1. [브랜딩 전략](doc/ReturnFeed 포괄적 브랜딩 및 웹디자인 전략_리턴피드.md)
**Purpose**: Branding and web design strategy  
**Audience**: Marketing team, designers

#### 2. [마케팅 분석](doc/ReturnFeed, PD 소프트웨어 마켓팅 통합 분석_.txt)
**Purpose**: Market analysis and positioning  
**Audience**: Business development, marketing

#### 3. [시장 및 마케팅](doc/리턴피드_시장및 마켓팅.txt)
**Purpose**: Market research and marketing strategy  
**Audience**: Business team

#### 4. [기존 문제 사례](doc/리턴피드 기존문제사례.md)
**Purpose**: Analysis of existing solutions' problems  
**Audience**: Product team

### v4.0 Testing & Benchmarking

#### 1. [test_passthrough_integration.sh](test_passthrough_integration.sh)
**Purpose**: 패스스루 모드 통합 테스트 스크립트  
**Audience**: QA팀, 개발자  
**Contents**: 자동화된 테스트, 레이턴시 측정, 성공률 분석

#### 2. [benchmark_passthrough_performance.py](benchmark_passthrough_performance.py)
**Purpose**: 트랜스코딩 제거 성능 벤치마크  
**Audience**: 성능 엔지니어  
**Contents**: CPU/GPU/메모리 측정, 전후 비교, 차트 생성

#### 3. [optimize_system_latency.sh](scripts/optimize_system_latency.sh)
**Purpose**: 시스템 레벨 레이턴시 최적화  
**Audience**: 시스템 관리자  
**Contents**: 네트워크 버퍼, CPU 거버너, IRQ 최적화

### Integration & Testing Documentation

#### 1. [SYSTEM_INTEGRATION_TEST.md](SYSTEM_INTEGRATION_TEST.md)
**Purpose**: Comprehensive system testing guide  
**Audience**: QA team, developers  
**Contents**: Test scenarios, performance metrics, automation scripts

#### 2. [PD_SOFTWARE_INTEGRATION.md](PD_SOFTWARE_INTEGRATION.md)
**Purpose**: PD software integration guide  
**Audience**: Broadcast engineers  
**Contents**: GPU-accelerated encoding, SRT streaming, latency optimization

#### 3. [MEDIAMTX_INTEGRATION.md](MEDIAMTX_INTEGRATION.md)
**Purpose**: MediaMTX server configuration  
**Audience**: DevOps, system administrators  
**Contents**: SRT/WebRTC setup, adaptive bitrate, optimization

#### 4. [PD_SOFTWARE_WORKFLOW.md](PD_SOFTWARE_WORKFLOW.md)
**Purpose**: PD software workflow documentation  
**Audience**: Production staff  
**Contents**: User guide, best practices

### Development History (Korean)

#### 1. [개발 과정 문제점](doc/리턴피드 개발과정 문제점들1.txt)
**Purpose**: Development challenges and solutions  
**Audience**: Development team

#### 2. [개발간 문제점](doc/리턴피드 returnfeed 개발간 문제점.txt)
**Purpose**: Technical issues during development  
**Audience**: Technical team

#### 3. [제작간 추가 정보](doc/리턴피드 제작간 추가 정보.txt)
**Purpose**: Additional development notes  
**Audience**: Development team

## 🔄 Documentation Standards

### Version Control
- All documentation uses semantic versioning
- Last update date included in each document
- Changes tracked through Git

### Language
- Technical documentation: English
- Business/Marketing documentation: Korean
- Code comments: English

### Format
- Primary format: Markdown (.md)
- Supplementary: Plain text (.txt)
- API specs: OpenAPI/Swagger (planned)

## 📝 Contributing to Documentation

### Guidelines
1. Keep documentation up-to-date with code changes
2. Use clear, concise language
3. Include examples where applicable
4. Follow existing formatting conventions

### Review Process
1. Create PR with documentation changes
2. Technical review by development team
3. Language review if necessary
4. Merge after approval

## 🔍 Quick Links

### For Developers
- [API Reference](doc/API.md)
- [System Architecture](SYSTEM_ARCHITECTURE.md)
- [Frontend Guide](frontend/README.md)
- [System Integration Test](SYSTEM_INTEGRATION_TEST.md)
- [Implementation Summary](IMPLEMENTATION_SUMMARY.md)

### For Operations
- [Deployment Guide](DEPLOYMENT_GUIDE.md)
- [Enterprise Deployment](DEPLOYMENT_ENTERPRISE.md)
- [Security Guide](SECURITY_IMPLEMENTATION_GUIDE.md)
- [SSL Setup](nginx/certs/README.md)
- [System Scripts](start_system.sh) & [Monitoring](check_system.sh)

### For Business
- [Project Plan](doc/Project_Plan.md)
- [Korean Development Plan](doc/리턴피드_개발계획서.md)
- Marketing documents in `/doc` directory

### For Broadcast Engineers
- [PD Software Integration](PD_SOFTWARE_INTEGRATION.md)
- [MediaMTX Configuration](MEDIAMTX_INTEGRATION.md)
- [Production Workflow](PD_SOFTWARE_WORKFLOW.md)

## 📞 Documentation Support

- **Issues**: Report documentation issues on GitHub
- **Updates**: Submit PRs for documentation improvements
- **Questions**: Contact documentation team

---

### v4.1 Testing & Verification

#### 1. [MULTI_STREAM_TEST_RESULT.md](MULTI_STREAM_TEST_RESULT.md)
**Purpose**: MediaMTX 다중 스트림 검증 결과  
**Audience**: 시스템 관리자  
**Contents**: 무제한 PD 동시 스트리밍 가능 확인

#### 2. [WEB_MULTI_ACCESS_TEST_RESULT.md](WEB_MULTI_ACCESS_TEST_RESULT.md)
**Purpose**: 웹 페이지 다중 접속 테스트 결과  
**Audience**: 개발팀, QA팀  
**Contents**: 42명 동시 접속 성공, CPU 2% 미만 사용

#### 3. [test-passthrough-streaming.sh](test-passthrough-streaming.sh)
**Purpose**: 패스스루 모드 스트리밍 테스트  
**Audience**: 개발자, QA팀  
**Contents**: H.264 baseline + Opus 테스트 스트림

#### 4. [verify-passthrough-mode.sh](mediamtx/verify-passthrough-mode.sh)
**Purpose**: 패스스루 모드 검증 도구  
**Audience**: 시스템 관리자  
**Contents**: 트랜스코딩 발생 여부 실시간 확인

### 🎯 v4.2 Simulcast Documentation

#### 1. [SIMULCAST_IMPLEMENTATION.md](SIMULCAST_IMPLEMENTATION.md)
**Purpose**: 2-Layer adaptive streaming implementation guide  
**Audience**: Developers, system administrators  
**Contents**: Architecture, quality switching algorithm, configuration

#### 2. [simulcast_encoder.py](pd-software/simulcast_encoder.py)
**Purpose**: GPU-agnostic simulcast encoder  
**Audience**: PD software developers  
**Contents**: 2-layer encoding (1Mbps/0.1Mbps), GPU detection

#### 3. [SimulcastVideoPlayer.tsx](frontend/src/components/SimulcastVideoPlayer.tsx)
**Purpose**: Frontend simulcast video player  
**Audience**: Frontend developers  
**Contents**: Auto/manual quality switching, network metrics

#### 4. [simulcastQualityManager.ts](frontend/src/utils/simulcastQualityManager.ts)
**Purpose**: Quality switching algorithm implementation  
**Audience**: Frontend developers  
**Contents**: Network metrics analysis, hysteresis logic

#### 5. [test-simulcast-simple.sh](test-simulcast-simple.sh)
**Purpose**: Simulcast testing script  
**Audience**: QA team, developers  
**Contents**: 2-layer stream verification, WebRTC URLs

_Last updated: January 17, 2025 (v4.2 Release)_