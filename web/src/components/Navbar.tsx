'use client';

import React from 'react';
import { BookOpen, RefreshCw, Bookmark } from 'lucide-react';

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
  let dateObj: Date | null = null;
  if (lastUpdated) {
    // 타임존 오프셋(Z 또는 +)이 없는 레거시 ISO 문자열은 GitHub 러너의 UTC 시간으로 보정
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
    <header className={`sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-600/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              모임 <span className="text-indigo-600 dark:text-indigo-400">수첩</span>
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Bookmark Filter Toggle */}
          <button
            onClick={onToggleBookmarks}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
              showOnlyBookmarks
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700'
            }`}
            title="관심 프로모션만 모아보기"
          >
            <Bookmark className={`w-4 h-4 ${showOnlyBookmarks ? 'fill-current' : ''}`} />
            <span className="hidden sm:inline">관심특가</span>
            {bookmarkCount > 0 && (
              <span
                className={`text-xs px-1.5 py-0.2 rounded-full font-bold ${
                  showOnlyBookmarks
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {bookmarkCount}
              </span>
            )}
          </button>

          {/* Real-time Crawl Sync Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-bold transition-all shadow-sm ${
              isRefreshing
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-indigo-600/20'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-200' : ''}`} />
            <span className="hidden md:inline">
              {isRefreshing ? '특가 수집 중...' : '최신 특가 수집'}
            </span>
            <span className="md:hidden">{isRefreshing ? '수집중' : '새로고침'}</span>
          </button>

          {formattedTime && (
            <div className="hidden lg:flex flex-col text-right text-[11px] text-slate-400 dark:text-slate-500 border-l border-slate-200 dark:border-slate-800 pl-3">
              <span>최근 수집</span>
              <span className="font-semibold text-slate-600 dark:text-slate-300">{formattedTime}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
