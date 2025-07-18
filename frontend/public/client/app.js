// URL 파라미터 파싱
function parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const role = params.get('role');
    const cam = params.get('cam');
    const name = params.get('name');
    
    return { role, cam, name };
}

// 역할별 정보 정의
const ROLE_INFO = {
    camera: {
        title: (cam) => `CAM ${cam}`,
        label: '카메라맨',
        description: (cam, name) => `${name || `카메라 ${cam}`} 담당\n탈리 신호를 확인하며 촬영해주세요.`,
        color: 'camera',
        hasTally: true,
        features: ['tally', 'vibration', 'audio', 'performance']
    },
    pgm: {
        title: () => 'PGM',
        label: '프로그램 모니터',
        description: () => '최종 송출 화면을 모니터링합니다.\n탈리 기능이 비활성화됩니다.',
        color: 'pgm',
        hasTally: false,
        features: ['performance']
    },
    staff: {
        title: (cam, name) => name || 'STAFF',
        label: '스탭',
        description: (cam, name) => `${name || '스탭'} 모니터링 화면\n실시간 방송 상황을 확인할 수 있습니다.`,
        color: 'staff',
        hasTally: false,
        features: ['performance']
    },
    director: {
        title: () => 'DIRECTOR',
        label: '감독',
        description: () => '전체 방송 상황을 모니터링합니다.\n모든 카메라 상태를 확인할 수 있습니다.',
        color: 'pgm',
        hasTally: false,
        features: ['performance', 'audio']
    },
    audio: {
        title: () => 'AUDIO',
        label: '오디오 엔지니어',
        description: () => '오디오 모니터링 전용 화면입니다.\n음성 안내가 활성화됩니다.',
        color: 'staff',
        hasTally: false,
        features: ['performance', 'audio']
    }
};

// 모바일 디바이스 감지
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isAndroid = /Android/i.test(navigator.userAgent);
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

// 음성 시스템 (간소화)
class VoiceSystem {
    constructor() {
        this.enabled = false;
        this.voice = null;
        this.init();
    }

    async init() {
        if (!('speechSynthesis' in window)) return;
        
        // 음성 로드 대기
        await new Promise(resolve => {
            if (speechSynthesis.getVoices().length > 0) {
                resolve();
            } else {
                speechSynthesis.addEventListener('voiceschanged', resolve, { once: true });
            }
        });
        
        this.selectVoice();
    }

    selectVoice() {
        const voices = speechSynthesis.getVoices();
        // 한국어 남성 음성 우선, 없으면 영어 남성 음성
        this.voice = voices.find(v => v.lang.startsWith('ko') && v.name.toLowerCase().includes('male')) ||
                     voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('male')) ||
                     voices.find(v => v.lang.startsWith('ko')) ||
                     voices[0];
    }

    speak(text) {
        if (!this.enabled || !this.voice) return;
        
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = this.voice;
        utterance.rate = 0.9;
        utterance.pitch = 0.8;
        utterance.volume = 1.0;
        speechSynthesis.speak(utterance);
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            speechSynthesis.cancel();
        }
    }
}

// WebRTC 시스템 (간소화)
class StreamingSystem {
    constructor() {
        this.pc = null;
        this.isConnected = false;
        this.statsInterval = null;
        this.onConnectionChange = null;
        this.onStatsUpdate = null;
    }

    async startConnection() {
        try {
            // WebRTC 설정
            const config = {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ],
                iceCandidatePoolSize: 10,
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require'
            };

            this.pc = new RTCPeerConnection(config);

            // 연결 상태 모니터링
            this.pc.onconnectionstatechange = () => {
                if (this.onConnectionChange) {
                    this.onConnectionChange(this.pc.connectionState);
                }
                
                if (this.pc.connectionState === 'connected') {
                    this.isConnected = true;
                    this.startStatsMonitoring();
                } else if (this.pc.connectionState === 'failed') {
                    this.tryHlsFallback();
                }
            };

            // 스트림 수신
            this.pc.ontrack = (event) => {
                const video = document.getElementById('videoElement');
                if (event.streams && event.streams[0]) {
                    video.srcObject = event.streams[0];
                    this.handleVideoPlay(video);
                }
            };

            // 트랜시버 추가
            this.pc.addTransceiver('video', { direction: 'recvonly' });
            this.pc.addTransceiver('audio', { direction: 'recvonly' });

            // Offer 생성
            const offer = await this.pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            
            await this.pc.setLocalDescription(offer);

            // WHEP 요청
            const response = await fetch('https://returnfeed.net/pgm_srt_raw/whep', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/sdp'
                },
                body: this.pc.localDescription.sdp
            });

            if (!response.ok) {
                throw new Error(`WHEP request failed: ${response.status}`);
            }

            const answerSdp = await response.text();
            await this.pc.setRemoteDescription({
                type: 'answer',
                sdp: answerSdp
            });

        } catch (error) {
            console.error('WebRTC connection failed:', error);
            this.tryHlsFallback();
        }
    }

    async handleVideoPlay(video) {
        try {
            video.playsInline = true;
            video.muted = true;
            video.autoplay = true;
            
            const playPromise = video.play();
            if (playPromise !== undefined) {
                await playPromise;
                document.getElementById('mobilePlayButton').classList.remove('visible');
            }
        } catch (error) {
            console.log('Autoplay failed:', error);
            document.getElementById('mobilePlayButton').classList.add('visible');
        }
    }

    tryHlsFallback() {
        const video = document.getElementById('videoElement');
        
        if (Hls.isSupported()) {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90
            });
            
            hls.loadSource('https://returnfeed.net/pgm_srt_raw/index.m3u8');
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                this.handleVideoPlay(video);
                if (this.onConnectionChange) {
                    this.onConnectionChange('connected-hls');
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = 'https://returnfeed.net/pgm_srt_raw/index.m3u8';
            this.handleVideoPlay(video);
        }
    }

    startStatsMonitoring() {
        if (this.statsInterval) clearInterval(this.statsInterval);
        
        this.statsInterval = setInterval(async () => {
            if (this.pc && this.pc.getStats && this.onStatsUpdate) {
                const stats = await this.pc.getStats();
                let rtt = 'N/A', bitrate = 'N/A';
                
                stats.forEach(report => {
                    if (report.type === 'candidate-pair' && report.currentRoundTripTime) {
                        rtt = (report.currentRoundTripTime * 1000).toFixed(0) + 'ms';
                    }
                    if (report.type === 'inbound-rtp' && report.kind === 'video') {
                        const bps = report.bytesReceived * 8 / report.timestamp;
                        bitrate = (bps / 1000).toFixed(1) + 'kbps';
                    }
                });
                
                this.onStatsUpdate({ rtt, bitrate });
            }
        }, 2000);
    }

    close() {
        if (this.pc) {
            this.pc.close();
            this.pc = null;
        }
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
        }
    }
}

// 메인 애플리케이션
class ReturnFeedClient {
    constructor() {
        this.params = parseUrlParams();
        this.roleInfo = null;
        this.ws = null;
        this.streaming = new StreamingSystem();
        this.voice = new VoiceSystem();
        this.tallyState = { program: null, preview: null };
        this.lastTallyState = { state: 'off' };
        this.settings = this.loadSettings();
        this.isOverlayVisible = false;
        this.overlayTimeout = null;
        
        this.init();
    }

    async init() {
        // URL 파라미터 검증
        if (!this.validateParams()) {
            this.showError();
            return;
        }

        // 역할 정보 설정
        this.roleInfo = ROLE_INFO[this.params.role];
        
        // 스플래시 화면 표시
        await this.showSplashScreen();
        
        // 역할 확인 화면 표시
        this.showRoleConfirmScreen();
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
    }

    validateParams() {
        const { role, cam } = this.params;
        
        // 역할이 없거나 유효하지 않은 경우
        if (!role || !ROLE_INFO[role]) {
            return false;
        }
        
        // 카메라 역할인데 cam 번호가 없는 경우
        if (role === 'camera' && (!cam || isNaN(parseInt(cam)))) {
            return false;
        }
        
        return true;
    }

    async showSplashScreen() {
        await new Promise(resolve => setTimeout(resolve, 1000));
        document.getElementById('splashScreen').classList.add('hidden');
    }

    showRoleConfirmScreen() {
        const { role, cam, name } = this.params;
        const info = this.roleInfo;
        
        document.getElementById('roleLabel').textContent = info.label;
        document.getElementById('roleTitle').textContent = info.title(cam, name);
        document.getElementById('roleTitle').className = `role-title ${info.color}`;
        document.getElementById('roleDescription').textContent = info.description(cam, name);
        
        document.getElementById('roleConfirmScreen').classList.add('active');
    }

    showError() {
        document.getElementById('splashScreen').classList.add('hidden');
        document.getElementById('errorScreen').classList.add('active');
        
        // URL 예시 표시
        const examples = [
            '/client/?role=camera&cam=1',
            '/client/?role=camera&cam=2&name=3루캠',
            '/client/?role=pgm',
            '/client/?role=staff&name=오디오팀',
            '/client/?role=director'
        ];
        
        document.getElementById('errorDescription').innerHTML = `
            올바른 URL 형식으로 접속해주세요.<br><br>
            예시:<br>
            ${examples.map(ex => `<code>${ex}</code>`).join('<br>')}
        `;
    }

    setupEventListeners() {
        // 시작 버튼
        document.getElementById('confirmButton').addEventListener('click', () => {
            this.startPlayer();
        });

        // 모바일 재생 버튼
        document.getElementById('mobilePlayButton').addEventListener('click', async () => {
            const video = document.getElementById('videoElement');
            try {
                await video.play();
                document.getElementById('mobilePlayButton').classList.remove('visible');
            } catch (error) {
                console.error('Play failed:', error);
            }
        });

        // 터치/클릭 이벤트
        const touchArea = document.getElementById('touchArea');
        touchArea.addEventListener('click', () => this.toggleOverlay());
        touchArea.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.toggleOverlay();
        }, { passive: false });

        // 설정 토글
        document.querySelectorAll('.switch input').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                this.handleSettingToggle(e.target.id, e.target.checked);
            });
        });

        // 스트리밍 콜백 설정
        this.streaming.onConnectionChange = (state) => {
            this.updateConnectionStatus(state);
        };

        this.streaming.onStatsUpdate = (stats) => {
            document.getElementById('rttCounter').textContent = stats.rtt;
            document.getElementById('bitrateCounter').textContent = stats.bitrate;
        };
    }

    startPlayer() {
        document.getElementById('roleConfirmScreen').classList.remove('active');
        document.getElementById('playerScreen').classList.add('active');
        
        // 역할 오버레이 설정
        const roleOverlay = document.getElementById('roleOverlay');
        roleOverlay.textContent = this.roleInfo.title(this.params.cam, this.params.name);
        
        // 성능 모니터에 역할 표시
        document.getElementById('roleIndicator').textContent = 
            `${this.roleInfo.label}${this.params.cam ? ` ${this.params.cam}` : ''}`;
        
        // 기능별 UI 업데이트
        this.updateFeatures();
        
        // WebSocket 연결 (탈리가 필요한 경우만)
        if (this.roleInfo.hasTally) {
            this.connectWebSocket();
        }
        
        // 스트리밍 시작
        this.streaming.startConnection();
        
        // 설정 복원
        this.restoreSettings();
    }

    updateFeatures() {
        const features = this.roleInfo.features;
        
        // 진동 설정
        const vibrationItem = document.querySelector('#vibrationToggle').closest('.setting-item');
        vibrationItem.style.display = features.includes('vibration') ? 'flex' : 'none';
        
        // 음성 설정
        const audioItem = document.querySelector('#audioToggle').closest('.setting-item');
        audioItem.style.display = features.includes('audio') ? 'flex' : 'none';
        
        // 음성 디버그 표시
        const voiceDebug = document.getElementById('voiceDebug');
        voiceDebug.style.display = features.includes('audio') ? 'block' : 'none';
        
        // 탈리 기능
        if (!features.includes('tally')) {
            document.getElementById('tallyContainer').style.display = 'none';
        }
    }

    async connectWebSocket() {
        try {
            this.ws = new WebSocket('wss://returnfeed.net/ws/');
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.requestTallyState();
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (e) {
                    console.error('WebSocket message parse error:', e);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                setTimeout(() => this.connectWebSocket(), 3000);
            };

        } catch (error) {
            console.error('WebSocket connection failed:', error);
        }
    }

    requestTallyState() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ command: 'get_full_state' }));
        }
    }

    handleWebSocketMessage(data) {
        if (data.type === 'tally_update' || data.type === 'full_state') {
            this.tallyState = { program: data.program, preview: data.preview };
            this.updateTallyState();
        }
    }

    updateTallyState() {
        if (!this.roleInfo.hasTally || this.params.role !== 'camera') return;
        
        const camNumber = parseInt(this.params.cam);
        let currentTally = 'off';
        
        if (camNumber === this.tallyState.program) {
            currentTally = 'pgm';
        } else if (camNumber === this.tallyState.preview) {
            currentTally = 'pvw';
        }
        
        if (this.lastTallyState.state !== currentTally) {
            this.lastTallyState.state = currentTally;
            this.applyTallyVisual(currentTally);
            this.triggerFeedback(currentTally);
        }
    }

    applyTallyVisual(state) {
        const container = document.getElementById('tallyContainer');
        container.className = 'tally-container';
        
        if (state === 'pgm') {
            container.classList.add('pgm-tally');
        } else if (state === 'pvw') {
            container.classList.add('pvw-tally');
        }
    }

    triggerFeedback(state) {
        // 진동
        if (this.settings.vibration && 'vibrate' in navigator) {
            if (state === 'pgm') {
                navigator.vibrate([200, 100, 200]);
            } else if (state === 'pvw') {
                navigator.vibrate(100);
            }
        }
        
        // 음성
        if (this.settings.audio) {
            if (state === 'pgm') {
                this.voice.speak('On Air');
            } else if (state === 'pvw') {
                this.voice.speak('Standby');
            }
        }
    }

    toggleOverlay() {
        this.isOverlayVisible = !this.isOverlayVisible;
        
        const overlayControls = document.getElementById('overlayControls');
        const roleOverlay = document.getElementById('roleOverlay');
        
        if (this.isOverlayVisible) {
            overlayControls.classList.add('visible');
            roleOverlay.classList.add('visible');
            
            // 3초 후 자동 숨김
            clearTimeout(this.overlayTimeout);
            this.overlayTimeout = setTimeout(() => {
                this.isOverlayVisible = false;
                overlayControls.classList.remove('visible');
                roleOverlay.classList.remove('visible');
            }, 3000);
        } else {
            overlayControls.classList.remove('visible');
            roleOverlay.classList.remove('visible');
            clearTimeout(this.overlayTimeout);
        }
    }

    handleSettingToggle(toggleId, checked) {
        switch (toggleId) {
            case 'vibrationToggle':
                this.settings.vibration = checked;
                break;
            case 'audioToggle':
                this.settings.audio = checked;
                this.voice.setEnabled(checked);
                break;
            case 'conserveToggle':
                this.settings.conserve = checked;
                break;
            case 'performanceToggle':
                this.settings.performance = checked;
                document.getElementById('performanceMonitor').classList.toggle('visible', checked);
                break;
        }
        
        this.saveSettings();
    }

    updateConnectionStatus(state) {
        const statusDot = document.getElementById('statusDot');
        const connectionText = document.getElementById('connectionText');
        
        statusDot.className = 'status-dot';
        
        switch (state) {
            case 'connected':
                statusDot.classList.add('connected');
                connectionText.textContent = 'WebRTC 연결됨';
                document.getElementById('loadingSpinner').style.display = 'none';
                break;
            case 'connected-hls':
                statusDot.classList.add('connected');
                connectionText.textContent = 'HLS 연결됨';
                document.getElementById('loadingSpinner').style.display = 'none';
                break;
            case 'connecting':
                statusDot.classList.add('connecting');
                connectionText.textContent = '연결 중...';
                document.getElementById('loadingSpinner').style.display = 'block';
                break;
            case 'failed':
            case 'disconnected':
                connectionText.textContent = '연결 실패';
                break;
            default:
                connectionText.textContent = '대기 중';
        }
    }

    loadSettings() {
        const saved = localStorage.getItem('returnfeed_settings');
        return saved ? JSON.parse(saved) : {
            vibration: true,
            audio: true,
            conserve: false,
            performance: false
        };
    }

    saveSettings() {
        localStorage.setItem('returnfeed_settings', JSON.stringify(this.settings));
    }

    restoreSettings() {
        document.getElementById('vibrationToggle').checked = this.settings.vibration;
        document.getElementById('audioToggle').checked = this.settings.audio;
        document.getElementById('conserveToggle').checked = this.settings.conserve;
        document.getElementById('performanceToggle').checked = this.settings.performance;
        
        this.voice.setEnabled(this.settings.audio);
        document.getElementById('performanceMonitor').classList.toggle('visible', this.settings.performance);
    }
}

// 앱 시작
document.addEventListener('DOMContentLoaded', () => {
    new ReturnFeedClient();
});