'use client';

import React, { useState } from 'react';
import { ExternalLink, Newspaper, Calendar, MapPin, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { GroupedNews, NewsArticle } from '@/types';

interface NewsCardProps {
  grouped: GroupedNews;
}

function formatNumericDate(rawDate?: string | null): string {
  if (!rawDate) return '';
  const trimmed = rawDate.trim();

  // Pattern 1: YYYY-MM-DD or YYYY.MM.DD (e.g. "2026-09-27 13:16", "2026.09.21")
  const ymdMatch = trimmed.match(/^(\d{4})[-.](\d{1,2})[-.](\d{1,2})/);
  if (ymdMatch) {
    const yyyy = ymdMatch[1];
    const mm = ymdMatch[2].padStart(2, '0');
    const dd = ymdMatch[3].padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Pattern 2: DD Mon YYYY (e.g. "25 Sep 2026 15:30")
  const monthMap: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
  };
  const regexMatch = trimmed.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (regexMatch) {
    const day = regexMatch[1].padStart(2, '0');
    const month = monthMap[regexMatch[2]] || '01';
    const year = regexMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Pattern 3: Fallback to Date parser
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return trimmed.split(' ')[0] || trimmed;
}

export const NewsCard: React.FC<NewsCardProps> = ({ grouped }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { mainArticle, relatedArticles, articleCount, sources } = grouped;

  const cities = grouped.japan_cities
    ? grouped.japan_cities.split(',').map((c) => c.trim()).filter(Boolean)
    : [];

  const otherSourcesText =
    sources.length > 1
      ? `${sources.slice(0, 2).join(', ')} 외 ${sources.length - 2 > 0 ? sources.length - 2 + '개사' : ''}`
      : sources[0];

  const getDDayText = (endDateStr?: string | null) => {
    if (!endDateStr) return null;
    try {
      const today = new Date('2026-09-29T00:00:00');
      const end = new Date(`${endDateStr}T23:59:59`);
      const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return '마감됨';
      if (diffDays === 0) return '오늘 마감';
      if (diffDays === 1) return '내일 마감 (D-1)';
      return `D-${diffDays}`;
    } catch {
      return null;
    }
  };

  const dDayText = getDDayText(grouped.promo_end);

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden ${
        grouped.is_japan === 1
          ? 'bg-gradient-to-br from-white via-rose-50/20 to-amber-50/30 border-rose-200 hover:border-rose-400 shadow-sm hover:shadow-md'
          : 'bg-white border-slate-200 hover:border-sky-300 shadow-sm hover:shadow-md'
      }`}
    >
      <div className="p-5">
        {/* Top Badges & Topic Clustering Indicator */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Primary Source */}
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              <Newspaper className="w-3 h-3 text-slate-400" />
              {mainArticle.source}
            </span>

            {/* Airline Badge if detected */}
            {grouped.airline && grouped.airline !== '기타/LCC' && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100">
                {grouped.airline}
              </span>
            )}


          </div>

          {/* Status Badge: Active vs Upcoming */}
          <div className="flex items-center gap-1 shrink-0">
            {grouped.promo_status === 'UPCOMING' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-sm">
                ⏰ 오픈 예정
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm">
                🔥 진행중
              </span>
            )}
          </div>
        </div>

        {/* Promo End Date & D-day */}
        {grouped.promo_end && (
          <div className="mb-2.5 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
              <Calendar className="w-3.5 h-3.5 text-rose-600" />
              <span>종료 예정일: <strong>{grouped.promo_end}</strong></span>
              {dDayText && (
                <span className="bg-rose-600 text-white text-[10px] px-2 py-0.5 rounded-full ml-1 font-bold">
                  {dDayText}
                </span>
              )}
            </span>
          </div>
        )}

        {/* Target Period Tag */}
        {grouped.promo_period_desc && grouped.promo_period_desc !== '실시간 진행중' && (
          <div className="mb-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
              🎯 {grouped.promo_period_desc}
            </span>
          </div>
        )}

        {/* Article Title */}
        <h3 className="text-base font-bold text-slate-900 leading-snug hover:text-sky-600 transition-colors">
          <a href={mainArticle.link} target="_blank" rel="noopener noreferrer">
            {mainArticle.title}
          </a>
        </h3>

        {/* Japan Cities Tags */}
        {grouped.is_japan === 1 && cities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {cities.map((city, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-rose-100/70 text-rose-800"
              >
                <MapPin className="w-2.5 h-2.5 text-rose-500" />
                {city}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Accordion: Related Articles from Other Press */}
      {relatedArticles.length > 0 && isExpanded && (
        <div className="bg-slate-50 border-t border-slate-100 px-5 py-3 space-y-2 text-xs">
          <p className="font-bold text-slate-500 text-[11px] mb-1">
            동일 보도자료 관련 기사 ({relatedArticles.length}개):
          </p>
          {relatedArticles.map((rel) => (
            <div key={rel.id} className="flex items-start justify-between gap-2 py-1 border-b border-slate-200/50 last:border-none">
              <div className="flex-1">
                <span className="font-bold text-slate-700 mr-1.5">[{rel.source}]</span>
                <span className="text-slate-600">{rel.title}</span>
                {rel.published_at && (
                  <span className="text-slate-400 text-[11px] ml-1.5 shrink-0">
                    {formatNumericDate(rel.published_at)}
                  </span>
                )}
              </div>
              <a
                href={rel.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-600 hover:text-sky-800 shrink-0 inline-flex items-center gap-0.5 p-0.5"
                title="기사 보기"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Meta & Read Action */}
      <div className="px-5 py-3 border-t border-slate-100 bg-white flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3 text-slate-400" />
          <span>{formatNumericDate(grouped.latestPublishedAt) || '최근 보도'}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle related press button */}
          {relatedArticles.length > 0 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg"
            >
              <span>관련 기사 {relatedArticles.length}개</span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}

          <a
            href={mainArticle.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-800 transition-colors"
          >
            <span>기사 원문</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
