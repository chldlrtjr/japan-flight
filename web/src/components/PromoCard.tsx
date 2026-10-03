'use client';

import React from 'react';
import { ExternalLink, Calendar, MapPin, Bookmark, Clock, Tag } from 'lucide-react';
import { Promotion } from '@/types';

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
  // Airline style helper
  const getAirlineBadge = (airline: string) => {
    switch (airline) {
      case '제주항공':
        return {
          bg: 'bg-orange-50 text-orange-700 border-orange-200',
          dot: 'bg-orange-500',
        };
      case '티웨이항공':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          dot: 'bg-rose-500',
        };
      case '이스타항공':
        return {
          bg: 'bg-red-50 text-red-700 border-red-200',
          dot: 'bg-red-500',
        };
      case '진에어':
        return {
          bg: 'bg-lime-50 text-lime-800 border-lime-300',
          dot: 'bg-lime-600',
        };
      case '피치항공 (Peach)':
      case '피치항공':
        return {
          bg: 'bg-pink-50 text-pink-700 border-pink-200',
          dot: 'bg-pink-500',
        };
      case '집에어 (ZIPAIR)':
      case '집에어':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
          dot: 'bg-emerald-600',
        };
      case '일본항공 (JAL)':
      case '일본항공':
        return {
          bg: 'bg-red-50 text-red-800 border-red-300',
          dot: 'bg-red-600',
        };
      case '전일본공수 (ANA)':
      case '전일본공수':
        return {
          bg: 'bg-blue-50 text-blue-900 border-blue-300',
          dot: 'bg-blue-600',
        };
      case '대한항공':
        return {
          bg: 'bg-sky-50 text-sky-900 border-sky-300',
          dot: 'bg-sky-600',
        };
      case '아시아나항공':
        return {
          bg: 'bg-amber-50 text-amber-900 border-amber-300',
          dot: 'bg-amber-600',
        };
      case '에어서울':
        return {
          bg: 'bg-teal-50 text-teal-800 border-teal-300',
          dot: 'bg-teal-500',
        };
      case '에어부산':
        return {
          bg: 'bg-blue-50 text-blue-800 border-blue-300',
          dot: 'bg-blue-600',
        };
      case '에어프레미아':
        return {
          bg: 'bg-indigo-50 text-indigo-900 border-indigo-300',
          dot: 'bg-indigo-600',
        };
      case '에어로케이':
        return {
          bg: 'bg-yellow-50 text-yellow-900 border-yellow-300',
          dot: 'bg-yellow-600',
        };
      case '파라타항공':
        return {
          bg: 'bg-cyan-50 text-cyan-900 border-cyan-300',
          dot: 'bg-cyan-600',
        };
      case '제트스타 재팬 (Jetstar)':
      case '제트스타':
      case '제트스타 재팬':
        return {
          bg: 'bg-orange-50 text-orange-900 border-orange-300',
          dot: 'bg-orange-600',
        };
      case '스카이마크 (Skymark)':
      case '스카이마크':
        return {
          bg: 'bg-yellow-50 text-sky-900 border-yellow-300',
          dot: 'bg-yellow-500',
        };
      case '스타플라이어 (StarFlyer)':
      case '스타플라이어':
        return {
          bg: 'bg-slate-900 text-white border-slate-700',
          dot: 'bg-slate-300',
        };
      case '에어도 (AIRDO)':
      case '에어도':
        return {
          bg: 'bg-sky-50 text-sky-800 border-sky-200',
          dot: 'bg-sky-400',
        };
      case '솔라시드 에어 (Solaseed Air)':
      case '솔라시드 에어':
      case '솔라시드':
        return {
          bg: 'bg-lime-50 text-emerald-800 border-emerald-300',
          dot: 'bg-emerald-500',
        };
      case '후지드림 항공 (FDA)':
      case '후지드림 항공':
      case '후지드림':
        return {
          bg: 'bg-purple-50 text-purple-800 border-purple-300',
          dot: 'bg-purple-600',
        };
      case '아이벡스 항공 (IBEX)':
      case '아이벡스 항공':
      case '아이벡스':
        return {
          bg: 'bg-indigo-50 text-indigo-800 border-indigo-300',
          dot: 'bg-indigo-600',
        };
      case '스프링 재팬 (Spring Japan)':
      case '스프링 재팬':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
          dot: 'bg-emerald-600',
        };
      case '일본 트랜스오션 항공 (JTA)':
      case '일본 트랜스오션 항공':
      case '일본 트랜스오션':
        return {
          bg: 'bg-cyan-50 text-cyan-900 border-cyan-300',
          dot: 'bg-cyan-600',
        };
      case '류큐 에어 커뮤터 (RAC)':
      case '류큐 에어 커뮤터':
        return {
          bg: 'bg-teal-50 text-teal-900 border-teal-300',
          dot: 'bg-teal-600',
        };
      case '토키에어 (TOKI AIR)':
      case '토키에어':
        return {
          bg: 'bg-red-50 text-red-700 border-red-200',
          dot: 'bg-red-500',
        };
      case '아마쿠사 에어라인 (AMX)':
      case '아마쿠사 에어라인':
        return {
          bg: 'bg-blue-50 text-blue-800 border-blue-200',
          dot: 'bg-blue-500',
        };
      case '오리엔탈 에어 브릿지 (ORC)':
      case '오리엔탈 에어 브릿지':
        return {
          bg: 'bg-sky-50 text-sky-900 border-sky-200',
          dot: 'bg-sky-500',
        };
      case '홋카이도 에어 시스템 (HAC)':
      case '홋카이도 에어 시스템':
        return {
          bg: 'bg-slate-100 text-slate-800 border-slate-300',
          dot: 'bg-red-600',
        };
      default:
        return {
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
          dot: 'bg-slate-500',
        };
    }
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
  const destList = promo.destinations
    ? promo.destinations.split(',').map((d) => d.trim()).filter(Boolean)
    : [];

  // Default fallback image
  const defaultBg =
    promo.region_category === '일본'
      ? 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80'
      : promo.region_category === '동남아'
      ? 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80'
      : promo.region_category === '중화권'
      ? 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=600&q=80'
      : 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=600&q=80';

  const displayImage = promo.image_url && promo.image_url.startsWith('http')
    ? promo.image_url
    : defaultBg;

  return (
    <div
      onClick={() => onSelectPromo(promo)}
      className="group bg-white rounded-2xl border border-slate-200 hover:border-sky-300 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden cursor-pointer relative"
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
        <div className="absolute bottom-3 left-3">
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-white/20 text-white backdrop-blur-md border border-white/20">
            {promo.region_category || '국제선'}
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Badge text / Benefit tagline */}
          {promo.badge_text && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-sky-600 mb-1.5">
              <Tag className="w-3 h-3" />
              <span>{promo.badge_text}</span>
            </div>
          )}

          {/* Title */}
          <h3 className="text-base font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-sky-600 transition-colors">
            {promo.title}
          </h3>

          {/* Subtitle */}
          {promo.subtitle && promo.subtitle !== promo.badge_text && (
            <p className="text-xs text-slate-500 mt-1.5 line-clamp-1">
              {promo.subtitle}
            </p>
          )}

          {/* Destination tags */}
          {destList.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {destList.slice(0, 4).map((dest, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600"
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
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>
              {promo.promo_start && promo.promo_end
                ? `${promo.promo_start} ~ ${promo.promo_end}`
                : '진행 중 특가'}
            </span>
          </div>

          <a
            href={promo.detail_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-800 transition-colors p-1"
            title="항공사 공식 이벤트 페이지 이동"
          >
            <span>예매하기</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
