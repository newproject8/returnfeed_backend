// 고급 테마 시스템
export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  
  // 탤리 전용 색상
  tally: {
    program: string;
    preview: string;
    standby: string;
    programGlow: string;
    previewGlow: string;
    standbyGlow: string;
  };
  
  // 상태 색상
  status: {
    online: string;
    offline: string;
    streaming: string;
    buffering: string;
    error: string;
  };
  
  // 그라데이션
  gradients: {
    primary: string;
    secondary: string;
    accent: string;
    tally: string;
    glass: string;
  };
}

export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  xxl: string;
}

export interface ThemeTypography {
  fontFamily: {
    primary: string;
    secondary: string;
    mono: string;
  };
  fontSize: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    xxl: string;
    xxxl: string;
  };
  fontWeight: {
    light: number;
    normal: number;
    medium: number;
    bold: number;
    black: number;
  };
  lineHeight: {
    tight: number;
    normal: number;
    loose: number;
  };
}

export interface ThemeBreakpoints {
  mobile: string;
  tablet: string;
  desktop: string;
  widescreen: string;
}

export interface ThemeAnimations {
  duration: {
    fast: string;
    normal: string;
    slow: string;
  };
  easing: {
    ease: string;
    easeIn: string;
    easeOut: string;
    easeInOut: string;
    bounce: string;
  };
  keyframes: {
    fadeIn: string;
    fadeOut: string;
    slideIn: string;
    slideOut: string;
    pulse: string;
    glow: string;
    shake: string;
  };
}

export interface ThemeShadows {
  small: string;
  medium: string;
  large: string;
  xl: string;
  glow: string;
  tallyProgram: string;
  tallyPreview: string;
  glass: string;
}

export interface Theme {
  colors: ThemeColors;
  spacing: ThemeSpacing;
  typography: ThemeTypography;
  breakpoints: ThemeBreakpoints;
  animations: ThemeAnimations;
  shadows: ThemeShadows;
  borderRadius: {
    small: string;
    medium: string;
    large: string;
    round: string;
  };
  zIndex: {
    modal: number;
    overlay: number;
    dropdown: number;
    tooltip: number;
    tally: number;
    controls: number;
  };
}

// 다크 테마 (기본)
export const darkTheme: Theme = {
  colors: {
    primary: '#2563eb',
    secondary: '#7c3aed',
    accent: '#f59e0b',
    background: '#000000',
    surface: '#111111',
    text: '#ffffff',
    textSecondary: '#a1a1aa',
    border: '#27272a',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    
    tally: {
      program: '#ef4444',
      preview: '#10b981',
      standby: '#71717a',
      programGlow: 'rgba(239, 68, 68, 0.5)',
      previewGlow: 'rgba(16, 185, 129, 0.5)',
      standbyGlow: 'rgba(113, 113, 122, 0.3)',
    },
    
    status: {
      online: '#10b981',
      offline: '#71717a',
      streaming: '#ef4444',
      buffering: '#f59e0b',
      error: '#ef4444',
    },
    
    gradients: {
      primary: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
      secondary: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
      accent: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
      tally: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      glass: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
    },
  },
  
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '3rem',
  },
  
  typography: {
    fontFamily: {
      primary: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      secondary: '"JetBrains Mono", "Fira Code", "Monaco", monospace',
      mono: '"JetBrains Mono", "Fira Code", "Monaco", monospace',
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      xxl: '1.5rem',
      xxxl: '2rem',
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      bold: 700,
      black: 900,
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      loose: 1.8,
    },
  },
  
  breakpoints: {
    mobile: '768px',
    tablet: '1024px',
    desktop: '1280px',
    widescreen: '1920px',
  },
  
  animations: {
    duration: {
      fast: '0.15s',
      normal: '0.3s',
      slow: '0.5s',
    },
    easing: {
      ease: 'ease',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
    keyframes: {
      fadeIn: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `,
      fadeOut: `
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `,
      slideIn: `
        @keyframes slideIn {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `,
      slideOut: `
        @keyframes slideOut {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(-10px); opacity: 0; }
        }
      `,
      pulse: `
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `,
      glow: `
        @keyframes glow {
          0%, 100% { 
            box-shadow: 0 0 5px currentColor;
            opacity: 1;
          }
          50% { 
            box-shadow: 0 0 20px currentColor;
            opacity: 0.8;
          }
        }
      `,
      shake: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
      `,
    },
  },
  
  shadows: {
    small: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
    medium: '0 4px 6px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08)',
    large: '0 10px 15px rgba(0, 0, 0, 0.12), 0 4px 6px rgba(0, 0, 0, 0.08)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.12), 0 8px 10px rgba(0, 0, 0, 0.08)',
    glow: '0 0 20px rgba(59, 130, 246, 0.5)',
    tallyProgram: '0 0 30px rgba(239, 68, 68, 0.8)',
    tallyPreview: '0 0 20px rgba(16, 185, 129, 0.6)',
    glass: '0 8px 32px rgba(31, 38, 135, 0.37)',
  },
  
  borderRadius: {
    small: '4px',
    medium: '8px',
    large: '12px',
    round: '50%',
  },
  
  zIndex: {
    modal: 1000,
    overlay: 900,
    dropdown: 800,
    tooltip: 700,
    tally: 600,
    controls: 500,
  },
};

// 라이트 테마
export const lightTheme: Theme = {
  ...darkTheme,
  colors: {
    ...darkTheme.colors,
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#1f2937',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
    
    gradients: {
      primary: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
      secondary: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
      accent: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
      tally: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      glass: 'linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.4) 100%)',
    },
  },
  
  shadows: {
    small: '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.16)',
    medium: '0 4px 6px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
    large: '0 10px 15px rgba(0, 0, 0, 0.08), 0 4px 6px rgba(0, 0, 0, 0.04)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.08), 0 8px 10px rgba(0, 0, 0, 0.04)',
    glow: '0 0 20px rgba(59, 130, 246, 0.3)',
    tallyProgram: '0 0 30px rgba(239, 68, 68, 0.5)',
    tallyPreview: '0 0 20px rgba(16, 185, 129, 0.4)',
    glass: '0 8px 32px rgba(31, 38, 135, 0.2)',
  },
};

// 고대비 테마
export const highContrastTheme: Theme = {
  ...darkTheme,
  colors: {
    ...darkTheme.colors,
    background: '#000000',
    surface: '#000000',
    text: '#ffffff',
    textSecondary: '#ffffff',
    border: '#ffffff',
    
    tally: {
      program: '#ffffff',
      preview: '#ffff00',
      standby: '#808080',
      programGlow: 'rgba(255, 255, 255, 0.8)',
      previewGlow: 'rgba(255, 255, 0, 0.8)',
      standbyGlow: 'rgba(128, 128, 128, 0.5)',
    },
    
    status: {
      online: '#00ff00',
      offline: '#808080',
      streaming: '#ff0000',
      buffering: '#ffff00',
      error: '#ff0000',
    },
  },
  
  shadows: {
    small: '0 0 0 2px #ffffff',
    medium: '0 0 0 3px #ffffff',
    large: '0 0 0 4px #ffffff',
    xl: '0 0 0 5px #ffffff',
    glow: '0 0 10px #ffffff',
    tallyProgram: '0 0 20px #ffffff',
    tallyPreview: '0 0 20px #ffff00',
    glass: '0 0 0 2px #ffffff',
  },
};

// 테마 유틸리티 함수
export const createThemeVariables = (theme: Theme): Record<string, string> => {
  const variables: Record<string, string> = {};
  
  // 색상 변수
  Object.entries(theme.colors).forEach(([key, value]) => {
    if (typeof value === 'string') {
      variables[`--color-${key}`] = value;
    } else if (typeof value === 'object') {
      Object.entries(value).forEach(([subKey, subValue]) => {
        variables[`--color-${key}-${subKey}`] = subValue;
      });
    }
  });
  
  // 간격 변수
  Object.entries(theme.spacing).forEach(([key, value]) => {
    variables[`--spacing-${key}`] = value;
  });
  
  // 타이포그래피 변수
  Object.entries(theme.typography.fontSize).forEach(([key, value]) => {
    variables[`--font-size-${key}`] = value;
  });
  
  Object.entries(theme.typography.fontWeight).forEach(([key, value]) => {
    variables[`--font-weight-${key}`] = value.toString();
  });
  
  Object.entries(theme.typography.fontFamily).forEach(([key, value]) => {
    variables[`--font-family-${key}`] = value;
  });
  
  // 애니메이션 변수
  Object.entries(theme.animations.duration).forEach(([key, value]) => {
    variables[`--duration-${key}`] = value;
  });
  
  Object.entries(theme.animations.easing).forEach(([key, value]) => {
    variables[`--easing-${key}`] = value;
  });
  
  // 그림자 변수
  Object.entries(theme.shadows).forEach(([key, value]) => {
    variables[`--shadow-${key}`] = value;
  });
  
  // 테두리 반지름 변수
  Object.entries(theme.borderRadius).forEach(([key, value]) => {
    variables[`--radius-${key}`] = value;
  });
  
  // z-index 변수
  Object.entries(theme.zIndex).forEach(([key, value]) => {
    variables[`--z-index-${key}`] = value.toString();
  });
  
  return variables;
};

// 미디어 쿼리 헬퍼
export const media = {
  mobile: `@media (max-width: ${darkTheme.breakpoints.mobile})`,
  tablet: `@media (min-width: ${darkTheme.breakpoints.mobile}) and (max-width: ${darkTheme.breakpoints.tablet})`,
  desktop: `@media (min-width: ${darkTheme.breakpoints.tablet})`,
  widescreen: `@media (min-width: ${darkTheme.breakpoints.widescreen})`,
};

// 색상 유틸리티
export const colorUtils = {
  // 색상 투명도 조정
  alpha: (color: string, alpha: number): string => {
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  },
  
  // 색상 밝기 조정
  lighten: (color: string, amount: number): string => {
    // 간단한 구현 - 실제로는 더 복잡한 색상 조작이 필요
    return color;
  },
  
  // 색상 어둡게 조정
  darken: (color: string, amount: number): string => {
    // 간단한 구현 - 실제로는 더 복잡한 색상 조작이 필요
    return color;
  },
};

export default darkTheme;