'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  isDark: boolean;
  isLocal: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  resolvedTheme: 'light',
  isDark: false,
  isLocal: false,
  toggleTheme: () => {},
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [isLocal, setIsLocal] = useState<boolean>(false);

  // Apply theme to DOM
  const applyTheme = (isDark: boolean) => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
      setResolvedTheme('dark');
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
      setResolvedTheme('light');
    }
  };

  useEffect(() => {
    // 로컬 환경 판별 (localhost, 127.0.0.1, dev 환경)
    const host = window.location.hostname;
    const isLocalEnv =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      process.env.NODE_ENV === 'development';
    setIsLocal(isLocalEnv);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // 로컬 모드일 때만 sessionStorage에서 개발용 수동 선택 테마 복원
    let initialTheme: Theme = 'system';
    if (isLocalEnv) {
      try {
        const saved = sessionStorage.getItem('dev_theme') as Theme | null;
        if (saved === 'light' || saved === 'dark') {
          initialTheme = saved;
        }
      } catch {
        // ignore
      }
    } else {
      // 프로덕션 환경은 수동 캐시 완전 소거
      try {
        sessionStorage.removeItem('dev_theme');
        localStorage.removeItem('app_theme');
      } catch {
        // ignore
      }
    }

    setThemeState(initialTheme);

    const isDark =
      initialTheme === 'dark' ||
      (initialTheme === 'system' && mediaQuery.matches);
    applyTheme(isDark);

    // OS/디바이스 테마 실시간 변경 감지 리스너
    const handleSystemChange = (e: MediaQueryListEvent) => {
      // 프로덕션이거나, 로컬에서 테마를 'system'으로 둔 경우 자동 반응
      if (!isLocalEnv || theme === 'system') {
        applyTheme(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [theme]);

  // 로컬 모드 전용 테마 변경 함수
  const setTheme = (newTheme: Theme) => {
    if (!isLocal) return; // 프로덕션에서는 수동 변경 차단 (시스템 테마 강제)

    setThemeState(newTheme);
    try {
      if (newTheme === 'system') {
        sessionStorage.removeItem('dev_theme');
      } else {
        sessionStorage.setItem('dev_theme', newTheme);
      }
    } catch {
      // ignore
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const isDark =
      newTheme === 'dark' ||
      (newTheme === 'system' && mediaQuery.matches);
    applyTheme(isDark);
  };

  // 로컬 모드 전용 토글: 라이트 ↔ 다크 빠른 전환
  const toggleTheme = () => {
    if (!isLocal) return;
    const nextTheme: Theme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        isDark: resolvedTheme === 'dark',
        isLocal,
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  return useContext(ThemeContext);
};
