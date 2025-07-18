import { useEffect, useRef, useState, useCallback } from 'react';

interface VoiceSettings {
  enabled: boolean;
  volume: number;
  rate: number;
  pitch: number;
  forceMale: boolean;
  language: string;
}

interface VoiceGuidanceHookProps {
  selectedCamera: number | null;
  programInput: number | null;
  previewInput: number | null;
  settings: VoiceSettings;
}

export const useVoiceGuidance = ({
  selectedCamera,
  programInput,
  previewInput,
  settings
}: VoiceGuidanceHookProps) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const lastAnnouncementRef = useRef<string>('');
  const synthRef = useRef<SpeechSynthesis | null>(null);
  
  // 음성 초기화
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
      
      const loadVoices = () => {
        const availableVoices = synthRef.current?.getVoices() || [];
        setVoices(availableVoices);
        
        // 강제 남성 음성 선택 (HTML 버전의 UltraForcedMaleAudioSystem 로직)
        if (settings.forceMale) {
          const maleVoices = availableVoices.filter(voice => {
            const name = voice.name.toLowerCase();
            const lang = voice.lang.toLowerCase();
            
            // 한국어 남성 음성 우선
            if (lang.includes('ko')) {
              return name.includes('male') || 
                     name.includes('남성') || 
                     name.includes('man') ||
                     name.includes('hyeryun') ||
                     name.includes('heami') === false; // 여성 음성 제외
            }
            
            // 영어 남성 음성
            if (lang.includes('en')) {
              return name.includes('male') || 
                     name.includes('man') ||
                     name.includes('david') ||
                     name.includes('alex') ||
                     name.includes('daniel') ||
                     !name.includes('female') &&
                     !name.includes('woman') &&
                     !name.includes('samantha') &&
                     !name.includes('victoria');
            }
            
            return false;
          });
          
          // 가장 적합한 남성 음성 선택
          const bestMaleVoice = maleVoices.find(voice => 
            voice.lang.includes(settings.language)
          ) || maleVoices[0];
          
          setSelectedVoice(bestMaleVoice || availableVoices[0]);
        } else {
          // 일반 음성 선택
          const preferredVoice = availableVoices.find(voice => 
            voice.lang.includes(settings.language)
          );
          setSelectedVoice(preferredVoice || availableVoices[0]);
        }
        
        setIsInitialized(true);
      };
      
      // 음성 로딩
      loadVoices();
      synthRef.current.onvoiceschanged = loadVoices;
    }
  }, [settings.language, settings.forceMale]);

  // 음성 안내 실행
  const speak = useCallback((text: string, priority: 'high' | 'medium' | 'low' = 'medium') => {
    if (!settings.enabled || !synthRef.current || !selectedVoice) return;
    
    // 중복 안내 방지
    if (lastAnnouncementRef.current === text && priority !== 'high') {
      return;
    }
    
    // 기존 음성 중단 (높은 우선순위인 경우)
    if (priority === 'high') {
      synthRef.current.cancel();
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = selectedVoice;
    utterance.volume = settings.volume;
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    
    // 음성 안내 시작/종료 이벤트
    utterance.onstart = () => {
      lastAnnouncementRef.current = text;
    };
    
    utterance.onend = () => {
      // 안내 완료 후 잠시 후 중복 방지 해제
      setTimeout(() => {
        if (lastAnnouncementRef.current === text) {
          lastAnnouncementRef.current = '';
        }
      }, 1000);
    };
    
    utterance.onerror = (event) => {
      console.error('음성 안내 오류:', event.error);
      lastAnnouncementRef.current = '';
    };
    
    synthRef.current.speak(utterance);
  }, [settings, selectedVoice]);

  // 탤리 상태 변경 감지 및 음성 안내 (cut/standby)
  useEffect(() => {
    if (!isInitialized || !selectedCamera || !settings.enabled) return;
    
    const wasOnProgram = lastAnnouncementRef.current === 'cut';
    const wasOnPreview = lastAnnouncementRef.current === 'standby';
    
    if (programInput === selectedCamera) {
      if (!wasOnProgram) {
        speak('cut', 'high');
      }
    } else if (previewInput === selectedCamera) {
      if (!wasOnPreview) {
        speak('standby', 'high');
      }
    } else {
      // 대기 상태에서는 음성 안내 없음 (사용자 요구사항에 따라)
      if (wasOnProgram || wasOnPreview) {
        lastAnnouncementRef.current = '';
      }
    }
  }, [selectedCamera, programInput, previewInput, isInitialized, speak, settings.enabled]);

  // 연결 상태 안내
  const announceConnection = useCallback((status: 'connected' | 'disconnected' | 'reconnecting') => {
    const messages = {
      connected: '서버에 연결되었습니다.',
      disconnected: '서버와의 연결이 끊어졌습니다.',
      reconnecting: '서버에 재연결하는 중입니다.'
    };
    
    speak(messages[status], 'high');
  }, [speak]);

  // 오류 상황 안내
  const announceError = useCallback((error: string) => {
    speak(`오류가 발생했습니다: ${error}`, 'high');
  }, [speak]);

  // 시스템 상태 안내
  const announceSystemStatus = useCallback((status: string) => {
    speak(status, 'medium');
  }, [speak]);

  return {
    speak,
    announceConnection,
    announceError,
    announceSystemStatus,
    voices,
    selectedVoice,
    isInitialized
  };
};

// 기본 음성 설정
export const defaultVoiceSettings: VoiceSettings = {
  enabled: true,
  volume: 0.8,
  rate: 1.0,
  pitch: 0.8, // 남성스러운 낮은 톤
  forceMale: true,
  language: 'ko-KR'
};

export default useVoiceGuidance;