'use client';

import React from 'react';
import { ExternalLink, Calendar, MapPin, Bookmark, Clock, Tag } from 'lucide-react';
import { Promotion } from '@/types';
import { getPromoEventUrl } from '@/lib/filterData';

interface PromoCardProps {
  promo: Promotion;
  isBookmarked: boolean;
  onToggleBookmark: (id: string) => void;
  onSelectPromo: (promo: Promotion) => void;
}

export const PromoCard: React.FC<PromoCardProps> = ({
  promo,
  isBookmarked,
  onToggleBookmark,
  onSelectPromo,
}) => {
  // Airline style helper (Simple material: technical monochrome glass badge)
  const getAirlineBadge = (airline: string) => {
    let dot = 'bg-slate-400';
    if (airline.includes('뉴질랜드')) dot = 'bg-emerald-400';
    else if (airline.includes('대한항공') || airline.includes('ANA')) dot = 'bg-sky-400';
    else if (airline.includes('아시아나')) dot = 'bg-amber-400';
    else if (airline.includes('티웨이') || airline.includes('이스타') || airline.includes('일본항공')) dot = 'bg-rose-400';
    else if (airline.includes('제주항공')) dot = 'bg-orange-400';
    else if (airline.includes('진에어')) dot = 'bg-lime-400';
    else if (airline.includes('에어서울')) dot = 'bg-teal-400';

    return {
      bg: 'bg-black/60 dark:bg-black/75 text-white border-white/15',
      dot,
    };
  };

  // D-Day calculation
  const calculateDday = (endStr: string | null, status: string) => {
    if (status === 'END') return { text: '종료', color: 'bg-slate-100 text-slate-500' };
    if (!endStr) return { text: '상시진행', color: 'bg-emerald-50 text-emerald-700' };

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date(endStr);
      end.setHours(0, 0, 0, 0);

      const diffTime = end.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) return { text: '종료', color: 'bg-slate-100 text-slate-500' };
      if (diffDays === 0) return { text: '오늘 마감!', color: 'bg-rose-600 text-white animate-pulse' };
      if (diffDays <= 3) return { text: `D-${diffDays} 마감임박`, color: 'bg-amber-500 text-white font-bold' };
      return { text: `D-${diffDays}`, color: 'bg-sky-100 text-sky-800 font-semibold' };
    } catch {
      return { text: '진행중', color: 'bg-emerald-50 text-emerald-700' };
    }
  };

  const airlineStyle = getAirlineBadge(promo.airline);
  const dday = calculateDday(promo.promo_end, promo.status);
  const eventUrl = getPromoEventUrl(promo);
  const destList = promo.destinations
    ? promo.destinations.split(',').map((d) => d.trim()).filter(Boolean)
    : [];

  // Default fallback image
  const defaultBg =
    promo.region_category === '일본'
      ? 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80'
      : promo.region_category === '뉴질랜드'
      ? 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=600&q=80'
      : 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=600&q=80';

  const displayImage = promo.image_url && promo.image_url.startsWith('http')
    ? promo.image_url
    : defaultBg;

  return (
    <div
      onClick={() => onSelectPromo(promo)}
      className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-400 shadow-sm hover:shadow-xl dark:hover:shadow-sky-950/40 transition-all duration-300 flex flex-col overflow-hidden cursor-pointer relative"
    >
      {/* Thumbnail Banner */}
      <div className="relative h-44 w-full overflow-hidden bg-slate-100">
        <img
          src={displayImage}
          alt={promo.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            (e.target as HTMLImageElement).src = defaultBg;
          }}
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          {/* Airline Chip */}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border backdrop-blur-md shadow-sm ${airlineStyle.bg}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${airlineStyle.dot}`} />
            {promo.airline}
          </span>

          {/* D-Day Chip */}
          <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold shadow-sm ${dday.color}`}>
            {dday.text}
          </span>
        </div>

        {/* Bookmark Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleBookmark(promo.id);
          }}
          className="absolute bottom-3 right-3 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-colors"
          title={isBookmarked ? '북마크 취소' : '관심 특가 저장'}
        >
          <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-amber-400 text-amber-400' : 'text-white'}`} />
        </button>

        {/* Region Chip on image */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1">
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-md backdrop-blur-md bg-black/60 dark:bg-black/75 text-white border border-white/15">
            {promo.region_category === '뉴질랜드' ? '뉴질랜드' : (promo.region_category || '국제선')}
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Badge text / Benefit tagline */}
          {promo.badge_text && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-1.5">
              <Tag className="w-3 h-3" />
              <span>{promo.badge_text}</span>
            </div>
          )}

          {/* Title */}
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            <a
              href={eventUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="hover:underline"
              title={`${promo.airline} 공식 이벤트 페이지 바로가기`}
            >
              {promo.title}
            </a>
          </h3>

          {/* Subtitle */}
          {promo.subtitle && promo.subtitle !== promo.badge_text && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-1">
              {promo.subtitle}
            </p>
          )}

          {/* Destination tags */}
          {destList.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {destList.slice(0, 4).map((dest, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  <MapPin className="w-2.5 h-2.5 text-slate-400" />
                  {dest}
                </span>
              ))}
              {destList.length > 4 && (
                <span className="text-[10px] text-slate-400 px-1 py-0.5">
                  +{destList.length - 4}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Bottom meta & Direct CTA */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>
              {promo.promo_start && promo.promo_end
                ? `${promo.promo_start} ~ ${promo.promo_end}`
                : '진행 중 특가'}
            </span>
          </div>

          <a
            href={eventUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-100 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200/80 dark:border-indigo-800/80 px-2.5 py-1 rounded-lg transition-all shadow-2xs"
            title={`${promo.airline} 바로가기`}
          >
            <span>바로가기</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
