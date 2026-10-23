'use client';

import React, { useState, useMemo } from 'react';
import { GroupedNews } from '@/types';
import { Newspaper, ChevronDown, ChevronUp, MapPin, Clock, X, ExternalLink } from 'lucide-react';

interface NewsCardProps {
  grouped: GroupedNews;
}

export const NewsCard: React.FC<NewsCardProps> = ({ grouped }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { mainArticle, relatedArticles, articleCount } = grouped;

  const cities = grouped.japan_cities
    ? grouped.japan_cities.split(',').map((c) => c.trim()).filter((c) => c && c !== '일본 전역' && c !== '뉴질랜드 전역')
    : [];

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return `${d.getMonth() + 1}월 ${d.getDate()}일`;
    } catch {
      return dateStr;
    }
  };

  const getDDayText = (promoEnd: string | null | undefined) => {
    if (!promoEnd) return null;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date(promoEnd);
      end.setHours(0, 0, 0, 0);

      const diffTime = end.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) return '종료됨';
      if (diffDays === 0) return '오늘 마감!';
      if (diffDays === 1) return '내일 마감 (D-1)';
      return `D-${diffDays}`;
    } catch {
      return null;
    }
  };

  const dDayText = getDDayText(grouped.promo_end);
  const isNZ = grouped.is_japan === 0;

  // Deduplicated list of all media sources that reported on this topic
  const uniqueSources = useMemo(() => {
    const map = new Map<string, string>();
    if (mainArticle?.source) {
      map.set(mainArticle.source, mainArticle.link);
    }
    for (const rel of relatedArticles) {
      if (rel.source && !map.has(rel.source)) {
        map.set(rel.source, rel.link);
      }
    }
    return Array.from(map.entries()).map(([source, link]) => ({ source, link }));
  }, [mainArticle, relatedArticles]);

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 flex flex-col justify-between relative ${
        isExpanded ? 'z-30 ring-2 ring-indigo-500/30' : 'z-10'
      } bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:border-indigo-300 dark:hover:border-indigo-600 shadow-xs hover:shadow-md`}
    >
      <div className="p-5">
        {/* Top Badges & Indicator */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Region Badge */}
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
              {isNZ ? '뉴질랜드' : '일본'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* D-Day Chip if promo_end available */}
            {dDayText && (
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                  dDayText === '오늘 마감!'
                    ? 'bg-rose-600 text-white animate-pulse'
                    : dDayText.includes('D-')
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {dDayText}
              </span>
            )}

            {/* Published date */}
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(grouped.latestPublishedAt || mainArticle.published_at)}
            </span>
          </div>
        </div>

        {/* Article Title */}
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
          <a href={mainArticle.link} target="_blank" rel="noopener noreferrer">
            {mainArticle.title}
          </a>
        </h3>

        {/* Cities Tags */}
        {cities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {cities.map((city, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800"
              >
                <MapPin className="w-2.5 h-2.5 text-slate-400 dark:text-slate-400" />
                {city}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer Button: Toggle Floating Dropdown Popover */}
      {relatedArticles.length > 0 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-t border-slate-100 dark:border-slate-800 transition-colors rounded-b-2xl cursor-pointer ${
            isExpanded
              ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold'
              : 'bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-[#f0f6fc]'
          }`}
        >
          <span>
            {isExpanded ? '언론사 목록 닫기' : `관련 기사 ${relatedArticles.length}개 더보기`}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          )}
        </button>
      )}

      {/* Floating Popover: Opens DOWNWARDS below the card */}
      {relatedArticles.length > 0 && isExpanded && (
        <>
          {/* Backdrop to close when clicking outside */}
          <div
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setIsExpanded(false)}
          />

          {/* Floating Dropdown Panel anchored below the card */}
          <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-40 bg-white/98 dark:bg-slate-900/98 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-1.5">
                <Newspaper className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  보도 언론사 목록 ({uniqueSources.length}곳)
                </span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Media Company Name Pills Only */}
            <div className="max-h-56 overflow-y-auto py-2.5 flex flex-wrap gap-1.5 content-start pr-1 no-scrollbar">
              {uniqueSources.map(({ source, link }, idx) => (
                <a
                  key={idx}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all shadow-2xs group/chip"
                  title={`${source} 기사 바로가기`}
                >
                  <span>{source}</span>
                  <ExternalLink className="w-2.5 h-2.5 text-slate-400 group-hover/chip:text-indigo-600 dark:text-indigo-400" />
                </a>
              ))}
            </div>

            {/* Popover Footer Info */}
            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 text-center shrink-0">
              언론사를 누르면 해당 기사로 바로 이동합니다
            </div>
          </div>
        </>
      )}
    </div>
  );
};
