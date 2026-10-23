'use client';

import React from 'react';
import { BookOpen, RefreshCw, Bookmark, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

interface NavbarProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  bookmarkCount: number;
  showOnlyBookmarks: boolean;
  onToggleBookmarks: () => void;
  lastUpdated?: string;
  className?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  onRefresh,
  isRefreshing,
  bookmarkCount,
  showOnlyBookmarks,
  onToggleBookmarks,
  lastUpdated,
  className = '',
}) => {
  const { resolvedTheme, isLocal, toggleTheme } = useTheme();
  let dateObj: Date | null = null;
  if (lastUpdated) {
    const normalized = (!lastUpdated.endsWith('Z') && !lastUpdated.includes('+'))
      ? `${lastUpdated}Z`
      : lastUpdated;
    dateObj = new Date(normalized);
  }

  const formattedTime = dateObj
    ? dateObj.toLocaleTimeString('ko-KR', {
        timeZone: 'Asia/Seoul',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <header className={`sticky top-0 z-40 backdrop-blur-2xl bg-white/70 dark:bg-slate-950/75 border-b border-slate-200/60 dark:border-white/[0.06] transition-colors duration-200 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Architectural Brand Mark */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center shadow-sm">
            <BookOpen className="w-4 h-4 stroke-[2]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">
              모임<span className="text-indigo-600 dark:text-indigo-400">수첩</span>
            </span>
            <span className="hidden sm:inline-block text-xs font-medium text-slate-400 dark:text-slate-500">
              항공권 특가 큐레이션
            </span>
          </div>
        </div>

        {/* Action Controls (Refined Pills & Layered Micro-Borders) */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Local Dev Theme Toggle */}
          {isLocal && (
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100/80 dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-white/[0.09] border border-slate-200/80 dark:border-white/[0.08] transition-all cursor-pointer"
              title={`테마 전환 (현재: ${resolvedTheme === 'dark' ? '다크' : '라이트'})`}
              aria-label="로컬 개발용 테마 전환"
            >
              {resolvedTheme === 'dark' ? (
                <Moon className="w-3.5 h-3.5 text-indigo-400 stroke-[1.75]" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-indigo-600 stroke-[1.75]" />
              )}
              <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-400">
                DEV
              </span>
            </button>
          )}

          {/* Bookmark Filter Toggle */}
          <button
            onClick={onToggleBookmarks}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border ${
              showOnlyBookmarks
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/25'
                : 'bg-white dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.08] border-slate-200/80 dark:border-white/[0.08]'
            }`}
            title="관심 프로모션만 모아보기"
          >
            <Bookmark className={`w-3.5 h-3.5 stroke-[1.75] ${showOnlyBookmarks ? 'fill-current' : ''}`} />
            <span className="hidden sm:inline">관심특가</span>
            {bookmarkCount > 0 && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold ${
                  showOnlyBookmarks
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                }`}
              >
                {bookmarkCount}
              </span>
            )}
          </button>

          {/* Sync Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-xs border ${
              isRefreshing
                ? 'bg-slate-100 dark:bg-white/5 text-slate-400 cursor-not-allowed border-slate-200 dark:border-white/5'
                : 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 border-transparent active:scale-98'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 stroke-[2] ${isRefreshing ? 'animate-spin text-slate-400' : ''}`} />
            <span className="hidden md:inline">
              {isRefreshing ? '특가 수집 중' : '최신 특가 수집'}
            </span>
            <span className="md:hidden">{isRefreshing ? '수집중' : '새로고침'}</span>
          </button>

          {formattedTime && (
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 border-l border-slate-200/80 dark:border-white/[0.07] pl-3 ml-1">
              <span className="text-[11px] text-slate-400">수집:</span>
              <span className="font-semibold text-slate-600 dark:text-slate-300">{formattedTime}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
