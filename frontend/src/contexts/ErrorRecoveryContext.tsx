import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';

// 오류 타입 정의
export interface AppError {
  id: string;
  type: 'network' | 'media' | 'authentication' | 'streaming' | 'system' | 'user';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: string;
  timestamp: Date;
  context?: Record<string, any>;
  recoverable: boolean;
  retryCount: number;
  maxRetries: number;
  autoRecover: boolean;
  userAction?: 'dismiss' | 'retry' | 'refresh' | 'contact_support';
}

// 상태 타입
interface ErrorRecoveryState {
  errors: AppError[];
  isRecovering: boolean;
  lastRecoveryAttempt: Date | null;
  recoveryHistory: {
    error: AppError;
    success: boolean;
    timestamp: Date;
  }[];
  systemHealth: {
    network: 'healthy' | 'degraded' | 'offline';
    media: 'healthy' | 'degraded' | 'error';
    streaming: 'healthy' | 'degraded' | 'error';
    authentication: 'healthy' | 'degraded' | 'error';
  };
}

// 액션 타입
type ErrorRecoveryAction = 
  | { type: 'ADD_ERROR'; payload: Omit<AppError, 'id' | 'timestamp'> }
  | { type: 'REMOVE_ERROR'; payload: string }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'START_RECOVERY' }
  | { type: 'RECOVERY_SUCCESS'; payload: string }
  | { type: 'RECOVERY_FAILED'; payload: string }
  | { type: 'UPDATE_SYSTEM_HEALTH'; payload: Partial<ErrorRecoveryState['systemHealth']> }
  | { type: 'INCREMENT_RETRY_COUNT'; payload: string }
  | { type: 'SET_USER_ACTION'; payload: { errorId: string; action: AppError['userAction'] } };

// 초기 상태
const initialState: ErrorRecoveryState = {
  errors: [],
  isRecovering: false,
  lastRecoveryAttempt: null,
  recoveryHistory: [],
  systemHealth: {
    network: 'healthy',
    media: 'healthy',
    streaming: 'healthy',
    authentication: 'healthy',
  },
};

// 리듀서
const errorRecoveryReducer = (state: ErrorRecoveryState, action: ErrorRecoveryAction): ErrorRecoveryState => {
  switch (action.type) {
    case 'ADD_ERROR':
      const newError: AppError = {
        ...action.payload,
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
      };
      return {
        ...state,
        errors: [...state.errors, newError],
      };

    case 'REMOVE_ERROR':
      return {
        ...state,
        errors: state.errors.filter(error => error.id !== action.payload),
      };

    case 'CLEAR_ERRORS':
      return {
        ...state,
        errors: [],
      };

    case 'START_RECOVERY':
      return {
        ...state,
        isRecovering: true,
        lastRecoveryAttempt: new Date(),
      };

    case 'RECOVERY_SUCCESS':
      const successError = state.errors.find(error => error.id === action.payload);
      return {
        ...state,
        isRecovering: false,
        errors: state.errors.filter(error => error.id !== action.payload),
        recoveryHistory: successError 
          ? [...state.recoveryHistory, { error: successError, success: true, timestamp: new Date() }]
          : state.recoveryHistory,
      };

    case 'RECOVERY_FAILED':
      const failedError = state.errors.find(error => error.id === action.payload);
      return {
        ...state,
        isRecovering: false,
        recoveryHistory: failedError 
          ? [...state.recoveryHistory, { error: failedError, success: false, timestamp: new Date() }]
          : state.recoveryHistory,
      };

    case 'UPDATE_SYSTEM_HEALTH':
      return {
        ...state,
        systemHealth: {
          ...state.systemHealth,
          ...action.payload,
        },
      };

    case 'INCREMENT_RETRY_COUNT':
      return {
        ...state,
        errors: state.errors.map(error => 
          error.id === action.payload 
            ? { ...error, retryCount: error.retryCount + 1 }
            : error
        ),
      };

    case 'SET_USER_ACTION':
      return {
        ...state,
        errors: state.errors.map(error => 
          error.id === action.payload.errorId 
            ? { ...error, userAction: action.payload.action }
            : error
        ),
      };

    default:
      return state;
  }
};

// 컨텍스트 인터페이스
interface ErrorRecoveryContextType {
  state: ErrorRecoveryState;
  addError: (error: Omit<AppError, 'id' | 'timestamp'>) => void;
  removeError: (errorId: string) => void;
  clearErrors: () => void;
  attemptRecovery: (errorId: string) => Promise<boolean>;
  updateSystemHealth: (health: Partial<ErrorRecoveryState['systemHealth']>) => void;
  getErrorsByType: (type: AppError['type']) => AppError[];
  getErrorsBySeverity: (severity: AppError['severity']) => AppError[];
  getCriticalErrors: () => AppError[];
  hasRecoverableErrors: () => boolean;
  getSystemHealthScore: () => number;
  setUserAction: (errorId: string, action: AppError['userAction']) => void;
}

// 컨텍스트 생성
const ErrorRecoveryContext = createContext<ErrorRecoveryContextType | null>(null);

// 복구 전략 인터페이스
interface RecoveryStrategy {
  type: AppError['type'];
  handler: (error: AppError) => Promise<boolean>;
  priority: number;
}

// 프로바이더 컴포넌트
export const ErrorRecoveryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(errorRecoveryReducer, initialState);

  // 복구 전략 정의
  const recoveryStrategies: RecoveryStrategy[] = [
    {
      type: 'network',
      handler: async (error: AppError) => {
        console.log('네트워크 복구 시도:', error.message);
        // 네트워크 연결 재시도
        try {
          const response = await fetch('/api/health', { method: 'GET' });
          if (response.ok) {
            dispatch({ type: 'UPDATE_SYSTEM_HEALTH', payload: { network: 'healthy' } });
            return true;
          }
        } catch (e) {
          console.error('네트워크 복구 실패:', e);
        }
        return false;
      },
      priority: 1,
    },
    {
      type: 'media',
      handler: async (error: AppError) => {
        console.log('미디어 복구 시도:', error.message);
        // 미디어 스트림 재시작
        try {
          // 미디어 스트림 재초기화 로직
          await new Promise(resolve => setTimeout(resolve, 2000));
          dispatch({ type: 'UPDATE_SYSTEM_HEALTH', payload: { media: 'healthy' } });
          return true;
        } catch (e) {
          console.error('미디어 복구 실패:', e);
        }
        return false;
      },
      priority: 2,
    },
    {
      type: 'streaming',
      handler: async (error: AppError) => {
        console.log('스트리밍 복구 시도:', error.message);
        // 스트리밍 연결 재시도
        try {
          // WebSocket 재연결 로직
          await new Promise(resolve => setTimeout(resolve, 3000));
          dispatch({ type: 'UPDATE_SYSTEM_HEALTH', payload: { streaming: 'healthy' } });
          return true;
        } catch (e) {
          console.error('스트리밍 복구 실패:', e);
        }
        return false;
      },
      priority: 3,
    },
    {
      type: 'authentication',
      handler: async (error: AppError) => {
        console.log('인증 복구 시도:', error.message);
        // 토큰 갱신 시도
        try {
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            const response = await fetch('/api/auth/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken }),
            });
            
            if (response.ok) {
              const { accessToken } = await response.json();
              localStorage.setItem('accessToken', accessToken);
              dispatch({ type: 'UPDATE_SYSTEM_HEALTH', payload: { authentication: 'healthy' } });
              return true;
            }
          }
        } catch (e) {
          console.error('인증 복구 실패:', e);
        }
        return false;
      },
      priority: 4,
    },
    {
      type: 'system',
      handler: async (error: AppError) => {
        console.log('시스템 복구 시도:', error.message);
        // 시스템 상태 재초기화
        try {
          // 캐시 클리어
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
          }
          
          // 페이지 새로고침 (최후의 수단)
          window.location.reload();
          return true;
        } catch (e) {
          console.error('시스템 복구 실패:', e);
        }
        return false;
      },
      priority: 5,
    },
    {
      type: 'user',
      handler: async (error: AppError) => {
        console.log('사용자 오류 처리:', error.message);
        // 사용자 오류는 자동 복구하지 않음
        return false;
      },
      priority: 6,
    },
  ];

  // 컨텍스트 메서드 구현
  const addError = useCallback((error: Omit<AppError, 'id' | 'timestamp'>) => {
    dispatch({ type: 'ADD_ERROR', payload: error });
    
    // 시스템 상태 업데이트
    const healthUpdate: Partial<ErrorRecoveryState['systemHealth']> = {};
    switch (error.type) {
      case 'network':
        healthUpdate.network = error.severity === 'critical' ? 'offline' : 'degraded';
        break;
      case 'media':
        healthUpdate.media = error.severity === 'critical' ? 'error' : 'degraded';
        break;
      case 'streaming':
        healthUpdate.streaming = error.severity === 'critical' ? 'error' : 'degraded';
        break;
      case 'authentication':
        healthUpdate.authentication = error.severity === 'critical' ? 'error' : 'degraded';
        break;
    }
    
    if (Object.keys(healthUpdate).length > 0) {
      dispatch({ type: 'UPDATE_SYSTEM_HEALTH', payload: healthUpdate });
    }
  }, []);

  const removeError = useCallback((errorId: string) => {
    dispatch({ type: 'REMOVE_ERROR', payload: errorId });
  }, []);

  const clearErrors = useCallback(() => {
    dispatch({ type: 'CLEAR_ERRORS' });
  }, []);

  const attemptRecovery = useCallback(async (errorId: string): Promise<boolean> => {
    const error = state.errors.find(e => e.id === errorId);
    if (!error || !error.recoverable) {
      return false;
    }

    if (error.retryCount >= error.maxRetries) {
      console.log('최대 재시도 횟수 초과:', error.message);
      return false;
    }

    dispatch({ type: 'START_RECOVERY' });
    dispatch({ type: 'INCREMENT_RETRY_COUNT', payload: errorId });

    try {
      const strategy = recoveryStrategies.find(s => s.type === error.type);
      if (strategy) {
        const success = await strategy.handler(error);
        if (success) {
          dispatch({ type: 'RECOVERY_SUCCESS', payload: errorId });
          return true;
        }
      }
      
      dispatch({ type: 'RECOVERY_FAILED', payload: errorId });
      return false;
    } catch (e) {
      console.error('복구 시도 중 오류:', e);
      dispatch({ type: 'RECOVERY_FAILED', payload: errorId });
      return false;
    }
  }, [state.errors]);

  const updateSystemHealth = useCallback((health: Partial<ErrorRecoveryState['systemHealth']>) => {
    dispatch({ type: 'UPDATE_SYSTEM_HEALTH', payload: health });
  }, []);

  const getErrorsByType = useCallback((type: AppError['type']) => {
    return state.errors.filter(error => error.type === type);
  }, [state.errors]);

  const getErrorsBySeverity = useCallback((severity: AppError['severity']) => {
    return state.errors.filter(error => error.severity === severity);
  }, [state.errors]);

  const getCriticalErrors = useCallback(() => {
    return state.errors.filter(error => error.severity === 'critical');
  }, [state.errors]);

  const hasRecoverableErrors = useCallback(() => {
    return state.errors.some(error => error.recoverable && error.retryCount < error.maxRetries);
  }, [state.errors]);

  const getSystemHealthScore = useCallback(() => {
    const healthValues = Object.values(state.systemHealth);
    const healthyCount = healthValues.filter(status => status === 'healthy').length;
    return (healthyCount / healthValues.length) * 100;
  }, [state.systemHealth]);

  const setUserAction = useCallback((errorId: string, action: AppError['userAction']) => {
    dispatch({ type: 'SET_USER_ACTION', payload: { errorId, action } });
    
    // 사용자 액션에 따른 처리
    switch (action) {
      case 'dismiss':
        removeError(errorId);
        break;
      case 'retry':
        attemptRecovery(errorId);
        break;
      case 'refresh':
        window.location.reload();
        break;
      case 'contact_support':
        // 지원팀 연락 로직
        console.log('지원팀 연락 요청');
        break;
    }
  }, [removeError, attemptRecovery]);

  // 자동 복구 시스템
  useEffect(() => {
    const autoRecoveryInterval = setInterval(() => {
      const recoverableErrors = state.errors.filter(error => 
        error.autoRecover && 
        error.recoverable && 
        error.retryCount < error.maxRetries
      );

      recoverableErrors.forEach(error => {
        // 마지막 시도로부터 5초 후 재시도
        const timeSinceLastAttempt = new Date().getTime() - error.timestamp.getTime();
        if (timeSinceLastAttempt > 5000) {
          attemptRecovery(error.id);
        }
      });
    }, 5000);

    return () => clearInterval(autoRecoveryInterval);
  }, [state.errors, attemptRecovery]);

  // 시스템 상태 모니터링
  useEffect(() => {
    const healthCheckInterval = setInterval(() => {
      // 네트워크 상태 확인
      if (navigator.onLine) {
        if (state.systemHealth.network !== 'healthy') {
          updateSystemHealth({ network: 'healthy' });
        }
      } else {
        updateSystemHealth({ network: 'offline' });
      }
    }, 10000);

    return () => clearInterval(healthCheckInterval);
  }, [state.systemHealth, updateSystemHealth]);

  // 온라인/오프라인 이벤트 처리
  useEffect(() => {
    const handleOnline = () => {
      updateSystemHealth({ network: 'healthy' });
    };

    const handleOffline = () => {
      updateSystemHealth({ network: 'offline' });
      addError({
        type: 'network',
        severity: 'high',
        message: '네트워크 연결이 끊어졌습니다',
        recoverable: true,
        retryCount: 0,
        maxRetries: 5,
        autoRecover: true,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addError, updateSystemHealth]);

  const contextValue: ErrorRecoveryContextType = {
    state,
    addError,
    removeError,
    clearErrors,
    attemptRecovery,
    updateSystemHealth,
    getErrorsByType,
    getErrorsBySeverity,
    getCriticalErrors,
    hasRecoverableErrors,
    getSystemHealthScore,
    setUserAction,
  };

  return (
    <ErrorRecoveryContext.Provider value={contextValue}>
      {children}
    </ErrorRecoveryContext.Provider>
  );
};

// 훅
export const useErrorRecovery = () => {
  const context = useContext(ErrorRecoveryContext);
  if (!context) {
    throw new Error('useErrorRecovery must be used within an ErrorRecoveryProvider');
  }
  return context;
};

// 오류 리포팅 유틸리티
export const reportError = (error: Error, context?: Record<string, any>) => {
  // 실제 환경에서는 외부 서비스로 전송
  console.error('오류 리포트:', {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
  });
};

export default ErrorRecoveryContext;