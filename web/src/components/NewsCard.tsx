'use client';

import React, { useState, useMemo } from 'react';
import { GroupedNews } from '@/types';
import { Newspaper, ChevronDown, ChevronUp, MapPin, Clock, X, ExternalLink } from 'lucide-react';

interface NewsCardProps {
  grouped: GroupedNews;
}

export const NewsCard: React.FC<NewsCardProps> = ({ grouped }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { mainArticle, relatedArticles } = grouped;

  const cities = grouped.japan_cities
    ? grouped.japan_cities.split(',').map((c) => c.trim()).filter((c) => c && c !== '일본 전역' && c !== '뉴질랜드 전역')
    : [];

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      // YYYY-MM-DD 형식 우선 직접 분리 (타임존 왜곡 완전 방지)
      const clean = dateStr.trim().split(/[ T]/)[0];
      const parts = clean.split('-');
      if (parts.length === 3) {
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        if (!isNaN(m) && !isNaN(d)) {
          return `${m}월 ${d}일`;
        }
      }
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
      if (diffDays === 0) return '오늘 마감';
      if (diffDays === 1) return 'D-1';
      return `D-${diffDays}`;
    } catch {
      return null;
    }
  };

  const dDayText = getDDayText(grouped.promo_end);
  const isNZ = grouped.is_japan === 0;

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
      className={`rounded-2xl border transition-all duration-300 flex flex-col justify-between relative arch-card-glow ${
        isExpanded ? 'z-30 ring-1 ring-slate-900/20 dark:ring-white/20' : 'z-10'
      } bg-white dark:bg-slate-900/70 border-slate-200/70 dark:border-white/[0.08] hover:border-slate-400 dark:hover:border-white/20 shadow-xs hover:shadow-xl dark:hover:shadow-2xl`}
    >
      <div className="p-3.5 sm:p-5">
        {/* Top Badges & Time */}
        <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.08] text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-white/[0.08]">
              {isNZ ? '뉴질랜드' : '일본'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {dDayText && (
              <span
                className={`text-[11px] sm:text-xs font-bold px-2 sm:px-2.5 py-0.5 rounded-full ${
                  dDayText === '오늘 마감'
                    ? 'bg-rose-500 text-white'
                    : dDayText.includes('D-')
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-100 dark:bg-white/10 text-slate-500'
                }`}
              >
                {dDayText}
              </span>
            )}

            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 stroke-[1.75]" />
              {formatDate(grouped.latestPublishedAt || mainArticle.published_at)}
            </span>
          </div>
        </div>

        {/* Article Title */}
        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
          <a href={mainArticle.link} target="_blank" rel="noopener noreferrer">
            {mainArticle.title}
          </a>
        </h3>

        {/* Cities Tags */}
        {cities.length > 0 && (
          <div className="mt-2.5 sm:mt-3.5 flex flex-wrap gap-1 sm:gap-1.5">
            {cities.map((city, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-white/[0.04]"
              >
                <MapPin className="w-2.5 h-2.5 text-slate-400 stroke-[2]" />
                {city}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer Toggle */}
      {relatedArticles.length > 0 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-t border-slate-100 dark:border-white/[0.06] transition-colors rounded-b-2xl cursor-pointer ${
            isExpanded
              ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white font-bold'
              : 'bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-600 dark:text-slate-400'
          }`}
        >
          <span>
            {isExpanded ? '보도 언론사 닫기' : `보도 언론사 ${uniqueSources.length}곳 보기`}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          )}
        </button>
      )}

      {/* Floating Popover Panel */}
      {relatedArticles.length > 0 && isExpanded && (
        <>
          <div
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setIsExpanded(false)}
          />

          <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl p-4 shadow-2xl border border-slate-200 dark:border-white/[0.1] flex flex-col justify-between animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-white/[0.06] shrink-0">
              <div className="flex items-center gap-1.5">
                <Newspaper className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300 stroke-[2]" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  보도 언론사 ({uniqueSources.length}곳)
                </span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                aria-label="닫기"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto py-2.5 flex flex-wrap gap-1.5 content-start pr-1 no-scrollbar">
              {uniqueSources.map(({ source, link }, idx) => (
                <a
                  key={idx}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-slate-950 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/[0.08] transition-all shadow-2xs group/chip"
                >
                  <span>{source}</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover/chip:opacity-100" />
                </a>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] text-[10px] text-slate-400 text-center shrink-0">
              언론사를 선택하면 해당 공식 보도 기사로 이동합니다
            </div>
          </div>
        </>
      )}
    </div>
  );
};
