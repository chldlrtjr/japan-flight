'use client';

import React from 'react';
import { Plane, RefreshCw, Bookmark } from 'lucide-react';

interface NavbarProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  bookmarkCount: number;
  showOnlyBookmarks: boolean;
  onToggleBookmarks: () => void;
  lastUpdated?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  onRefresh,
  isRefreshing,
  bookmarkCount,
  showOnlyBookmarks,
  onToggleBookmarks,
  lastUpdated,
}) => {
  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
            <Plane className="w-6 h-6 transform -rotate-45" />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-slate-900">
              일본특가<span className="text-rose-600">모아</span>
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
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            title="관심 프로모션만 모아보기"
          >
            <Bookmark className={`w-4 h-4 ${showOnlyBookmarks ? 'fill-current' : ''}`} />
            <span className="hidden sm:inline">관심특가</span>
            {bookmarkCount > 0 && (
              <span
                className={`text-xs px-1.5 py-0.2 rounded-full font-bold ${
                  showOnlyBookmarks ? 'bg-white text-amber-600' : 'bg-amber-100 text-amber-700'
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
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-sky-600 text-white hover:bg-sky-700 active:scale-95 shadow-sky-600/20'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
            <span className="hidden md:inline">
              {isRefreshing ? '특가 수집 중...' : '최신 특가 수집'}
            </span>
            <span className="md:hidden">{isRefreshing ? '수집중' : '새로고침'}</span>
          </button>

          {formattedTime && (
            <div className="hidden lg:flex flex-col text-right text-[11px] text-slate-400 border-l border-slate-200 pl-3">
              <span>최근 수집</span>
              <span className="font-semibold text-slate-600">{formattedTime}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
