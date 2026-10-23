'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  resolvedTheme: 'light',
  isDark: false,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // 과거 수동 저장된 테마 캐시 클린업
    try {
      localStorage.removeItem('app_theme');
    } catch {
      // ignore
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (matchesDark: boolean) => {
      const root = document.documentElement;
      if (matchesDark) {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
        setResolvedTheme('dark');
      } else {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
        setResolvedTheme('light');
      }
    };

    // 초기 상태 반영
    applyTheme(mediaQuery.matches);

    // OS/디바이스 테마 실시간 변경 감지 리스너
    const handleChange = (e: MediaQueryListEvent) => {
      applyTheme(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme: 'system',
        resolvedTheme,
        isDark: resolvedTheme === 'dark',
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  return useContext(ThemeContext);
};
