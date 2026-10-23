'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar } from '@/components/Navbar';
import { FilterBar } from '@/components/FilterBar';
import { PromoCard } from '@/components/PromoCard';
import { PromoModal } from '@/components/PromoModal';
import { NewsCard } from '@/components/NewsCard';
import { clusterNewsArticles } from '@/lib/clusterNews';
import { filterPromotions, filterNewsArticles, calculatePromoStats, getPromoEventUrl } from '@/lib/filterData';
import { Promotion, NewsArticle, GroupedNews } from '@/types';
import { BookmarkX, PlaneTakeoff, Newspaper, RefreshCw, Search, X, Calendar, Sparkles, ExternalLink, ArrowRight } from 'lucide-react';
import { FriendCalendar } from '@/components/FriendCalendar';

export default function Home() {
  const [rawPromotions, setRawPromotions] = useState<Promotion[]>([]);
  const [rawNewsArticles, setRawNewsArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [newsLoading, setNewsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);

  // Tab: 'promotions' (공식 특가) | 'news' (특가 기사) | 'calendar' (친구 일정 달력)
  const [activeTab, setActiveTab] = useState<'promotions' | 'news' | 'calendar'>('calendar');
  const [isMounted, setIsMounted] = useState<boolean>(false);

  // 탭 변경 시 URL Hash 및 LocalStorage에 저장
  const handleTabChange = useCallback((tab: 'promotions' | 'news' | 'calendar') => {
    setActiveTab(tab);
    try {
      localStorage.setItem('flypromo_active_tab', tab);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#${tab}`);
      }
    } catch (e) {
      console.error('Failed to save active tab:', e);
    }
  }, []);

  // 새로고침 시 탭 복원 및 클라이언트 마운트 완료 처리
  useEffect(() => {
    let initialTab: 'promotions' | 'news' | 'calendar' = 'calendar';
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'calendar' || hash === 'news' || hash === 'promotions') {
        initialTab = hash as 'promotions' | 'news' | 'calendar';
      } else {
        try {
          const savedTab = localStorage.getItem('flypromo_active_tab');
          if (savedTab === 'calendar' || savedTab === 'news' || savedTab === 'promotions') {
            initialTab = savedTab as 'promotions' | 'news' | 'calendar';
            window.history.replaceState(null, '', `#${savedTab}`);
          }
        } catch (e) {}
      }
    }

    setActiveTab(initialTab);
    setIsMounted(true);

    const handleHashChange = () => {
      if (typeof window === 'undefined') return;
      const hash = window.location.hash.replace('#', '');
      if (hash === 'calendar' || hash === 'news' || hash === 'promotions') {
        setActiveTab(hash as 'promotions' | 'news' | 'calendar');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<'ALL' | 'JAPAN' | 'NZ'>('ALL');
  const [selectedRegion, setSelectedRegion] = useState('ALL');
  const [selectedAirline, setSelectedAirline] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('default');
  const [showOnlyBookmarks, setShowOnlyBookmarks] = useState(false);

  // News states
  const [isGroupingEnabled, setIsGroupingEnabled] = useState(true);

  // Bookmarks (LocalStorage)
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('flypromo_bookmarks');
      if (saved) {
        setBookmarkedIds(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to parse bookmarks:', e);
    }
  }, []);

  const toggleBookmark = (id: string) => {
    setBookmarkedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem('flypromo_bookmarks', JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save bookmarks:', e);
      }
      return next;
    });
  };

  // Fetch static data
  const loadData = useCallback(async () => {
    setLoading(true);
    setNewsLoading(true);
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

    try {
      const cacheBust = `?t=${Date.now()}`;
      const [promosRes, newsRes] = await Promise.all([
        fetch(`${basePath}/data/promotions.json${cacheBust}`),
        fetch(`${basePath}/data/news.json${cacheBust}`),
      ]);

      if (promosRes.ok) {
        const promosData = await promosRes.json();
        setRawPromotions(promosData);
      }

      if (newsRes.ok) {
        const newsData = await newsRes.json();
        setRawNewsArticles(newsData);
      }
    } catch (err) {
      console.error('Failed to load static flight data:', err);
    } finally {
      setLoading(false);
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Refresh
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
    setRefreshMessage('최신 특가 데이터를 갱신했습니다.');
    setTimeout(() => setRefreshMessage(null), 4000);
  };

  // Computed: Stats
  const stats = useMemo(() => calculatePromoStats(rawPromotions), [rawPromotions]);

  // Computed: Filtered Promotions
  const displayedPromotions = useMemo(() => {
    return filterPromotions(rawPromotions, {
      country: selectedCountry,
      airline: selectedAirline,
      region: selectedRegion,
      search: searchTerm,
      sort: sortOrder,
      bookmarkedIds,
      showOnlyBookmarks,
    });
  }, [rawPromotions, selectedCountry, selectedAirline, selectedRegion, searchTerm, sortOrder, bookmarkedIds, showOnlyBookmarks]);

  // Computed: Filtered News Articles
  const filteredNews = useMemo(() => {
    return filterNewsArticles(rawNewsArticles, {
      country: selectedCountry,
      airline: selectedAirline,
      search: searchTerm,
    });
  }, [rawNewsArticles, selectedCountry, selectedAirline, searchTerm]);

  const totalNewsCount = useMemo(() => rawNewsArticles.length, [rawNewsArticles]);

  // Grouped news by topic
  const groupedNews = useMemo(() => clusterNewsArticles(filteredNews), [filteredNews]);

  const rawDisplayList: GroupedNews[] = useMemo(() => {
    if (isGroupingEnabled) return groupedNews;
    return filteredNews.map((art) => ({
      id: art.id,
      mainArticle: art,
      relatedArticles: [],
      articleCount: 1,
      sources: [art.source],
      is_japan: art.is_japan,
      japan_cities: art.japan_cities,
      airline: art.airline,
      promo_status: art.promo_status || 'ACTIVE',
      promo_period_desc: art.promo_period_desc || '실시간 진행중',
      latestPublishedAt: art.published_at,
    }));
  }, [isGroupingEnabled, groupedNews, filteredNews]);

  const displayNewsList = rawDisplayList;

  // 차경(借景) 하이라이트 프레임: 가장 주목할 만한 프로모션 선별
  const featuredPromo = useMemo(() => {
    if (displayedPromotions.length === 0) return null;
    return displayedPromotions[0];
  }, [displayedPromotions]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 flex flex-col font-sans w-full max-w-full overflow-x-hidden transition-colors relative">
      {/* Ambient Architectural Lighting Mesh */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] sm:w-[1000px] h-[360px] bg-slate-200/50 dark:bg-indigo-500/[0.04] blur-[120px] rounded-full" />

      {/* Refresh Toast Notification */}
      {refreshMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-full shadow-2xl flex items-center gap-2 border border-white/10 animate-in fade-in slide-in-from-top-2 duration-200">
          <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
          <span>{refreshMessage}</span>
        </div>
      )}

      {/* Global Navbar (모바일/PC 공통 반응형 지원) */}
      <Navbar
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        bookmarkCount={bookmarkedIds.length}
        showOnlyBookmarks={showOnlyBookmarks}
        onToggleBookmarks={() => setShowOnlyBookmarks(!showOnlyBookmarks)}
        lastUpdated={stats?.lastUpdated}
      />

      {/* Main Stage (비움과 마당의 미학) */}
      <main className="flex-1 max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-10 w-full min-w-0">
        {/* Architectural Segment Controller Tab Switcher (모바일 최적화) */}
        <div className="flex items-center justify-between pb-2.5 mb-6 sm:mb-8 border-b border-slate-200/70 dark:border-white/[0.06] overflow-x-auto no-scrollbar">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-200/60 dark:bg-white/[0.05] rounded-full border border-slate-200/60 dark:border-white/[0.06] shadow-2xs w-full sm:w-auto justify-between sm:justify-start">
            <button
              onClick={() => handleTabChange('calendar')}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 rounded-full font-bold text-xs sm:text-sm transition-all flex-1 sm:flex-initial cursor-pointer ${
                activeTab === 'calendar'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2] shrink-0" />
              <span className="sm:hidden">일정 달력</span>
              <span className="hidden sm:inline">친구 일정 캘린더</span>
            </button>

            <button
              onClick={() => handleTabChange('promotions')}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 rounded-full font-bold text-xs sm:text-sm transition-all flex-1 sm:flex-initial cursor-pointer ${
                activeTab === 'promotions'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <PlaneTakeoff className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2] shrink-0" />
              <span className="sm:hidden">공식 특가</span>
              <span className="hidden sm:inline">항공사 공식 특가</span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                  activeTab === 'promotions'
                    ? 'bg-white/20 dark:bg-slate-900/15 text-current'
                    : 'bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                }`}
              >
                {stats.total}
              </span>
            </button>

            <button
              onClick={() => handleTabChange('news')}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 rounded-full font-bold text-xs sm:text-sm transition-all flex-1 sm:flex-initial cursor-pointer ${
                activeTab === 'news'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Newspaper className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2] shrink-0" />
              <span className="sm:hidden">보도자료</span>
              <span className="hidden sm:inline">실시간 특가 보도자료</span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                  activeTab === 'news'
                    ? 'bg-white/20 dark:bg-slate-900/15 text-current'
                    : 'bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                }`}
              >
                {totalNewsCount}
              </span>
            </button>
          </div>
        </div>

        {/* Main Content View by Active Tab */}
        {!isMounted ? (
          <div className="min-h-[420px] bg-white dark:bg-slate-900/70 rounded-3xl border border-slate-200/70 dark:border-white/[0.08] p-8 flex flex-col items-center justify-center gap-3">
            <div className="w-6 h-6 border-2 border-slate-900 dark:border-white border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-400 font-mono">LOADING CURATED VIEW</p>
          </div>
        ) : activeTab === 'calendar' ? (
          <FriendCalendar />
        ) : activeTab === 'promotions' ? (
          <>
            {/* 차경(借景) 하이라이트 프레임: 가장 주목할 만한 프로모션 와이드 액자 */}
            {featuredPromo && !searchTerm && selectedRegion === 'ALL' && selectedAirline === 'ALL' && !showOnlyBookmarks && (
              <div
                onClick={() => setSelectedPromo(featuredPromo)}
                className="relative w-full h-48 sm:h-80 md:h-[360px] rounded-2xl sm:rounded-3xl overflow-hidden mb-6 sm:mb-8 border border-slate-200/80 dark:border-white/[0.1] shadow-md group cursor-pointer arch-card-glow"
              >
                <img
                  src={featuredPromo.image_url || 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80'}
                  alt={featuredPromo.title}
                  className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-1000 ease-out"
                />
                {/* Deep Architectural Vignette Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent pointer-events-none" />

                {/* Top Floating Tag */}
                <div className="absolute top-3 left-3.5 right-3.5 sm:top-4 sm:left-5 sm:right-5 flex items-center justify-between pointer-events-none">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-white/20 backdrop-blur-md text-white border border-white/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                      주목 특가
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-black/50 backdrop-blur-md text-white/90 border border-white/10">
                      {featuredPromo.airline}
                    </span>
                  </div>

                  <span className="text-xs font-bold px-2.5 sm:px-3 py-1 rounded-full backdrop-blur-md bg-black/70 text-white border border-white/15">
                    {featuredPromo.region_category === '뉴질랜드' ? '뉴질랜드' : '일본 노선'}
                  </span>
                </div>

                {/* Bottom Frame Content */}
                <div className="absolute bottom-3.5 left-3.5 right-3.5 sm:bottom-7 sm:left-7 sm:right-7 flex flex-row items-end justify-between gap-3">
                  <div className="max-w-2xl text-white min-w-0">
                    {featuredPromo.badge_text && (
                      <p className="hidden sm:flex text-xs font-bold text-amber-300 mb-1.5 tracking-tight items-center gap-1">
                        <span>{featuredPromo.badge_text}</span>
                      </p>
                    )}
                    <h2 className="text-sm sm:text-2xl md:text-3xl font-black leading-snug sm:leading-tight tracking-tight drop-shadow-md line-clamp-2">
                      {featuredPromo.title}
                    </h2>
                    {featuredPromo.subtitle && (
                      <p className="hidden sm:block text-xs sm:text-sm text-slate-300 mt-2 line-clamp-1 max-w-xl">
                        {featuredPromo.subtitle}
                      </p>
                    )}
                  </div>

                  <a
                    href={getPromoEventUrl(featuredPromo)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-full bg-white text-slate-950 font-bold hover:bg-slate-100 transition-all text-xs sm:text-sm shadow-md active:scale-97 shrink-0 cursor-pointer"
                    title={`${featuredPromo.airline} 바로가기`}
                  >
                    <span>바로가기</span>
                    <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                  </a>
                </div>
              </div>
            )}

            {/* Filter Bar */}
            <FilterBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedCountry={selectedCountry}
              onCountryChange={setSelectedCountry}
              selectedRegion={selectedRegion}
              onSelectRegion={setSelectedRegion}
              selectedAirline={selectedAirline}
              onSelectAirline={setSelectedAirline}
              sortOrder={sortOrder}
              onSortChange={setSortOrder}
              totalFilteredCount={displayedPromotions.length}
            />

            {/* Promotions Grid (걷고 싶은 거리의 리듬감) */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-32 sm:h-80 bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-200/70 dark:border-white/[0.06] animate-pulse" />
                ))}
              </div>
            ) : displayedPromotions.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                {displayedPromotions.map((promo) => (
                  <PromoCard
                    key={promo.id}
                    promo={promo}
                    isBookmarked={bookmarkedIds.includes(promo.id)}
                    onToggleBookmark={toggleBookmark}
                    onSelectPromo={setSelectedPromo}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900/70 rounded-3xl border border-slate-200/70 dark:border-white/[0.08] p-12 text-center max-w-md mx-auto my-12 shadow-xs">
                <BookmarkX className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3 stroke-[1.5]" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {showOnlyBookmarks ? '저장된 관심 특가가 없습니다' : '조건에 맞는 특가가 없습니다'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  {showOnlyBookmarks
                    ? '마음에 드는 항공권 특가의 북마크 아이콘을 눌러 보관해보세요.'
                    : '검색어나 지역 필터를 변경해보세요.'}
                </p>
              </div>
            )}
          </>
        ) : (
          /* News Feed Mode */
          <div className="space-y-6">
            {/* Filter Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              {/* Country Filter (Pill) */}
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-full bg-slate-100 dark:bg-white/[0.05] border border-slate-200/60 dark:border-white/[0.06] p-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <button
                    onClick={() => setSelectedCountry('ALL')}
                    className={`px-3.5 py-1 rounded-full transition-all ${
                      selectedCountry === 'ALL'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold shadow-xs'
                        : 'hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    전체
                  </button>
                  <button
                    onClick={() => setSelectedCountry('JAPAN')}
                    className={`px-3.5 py-1 rounded-full transition-all ${
                      selectedCountry === 'JAPAN'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold shadow-xs'
                        : 'hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    일본
                  </button>
                  <button
                    onClick={() => setSelectedCountry('NZ')}
                    className={`px-3.5 py-1 rounded-full transition-all ${
                      selectedCountry === 'NZ'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold shadow-xs'
                        : 'hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    뉴질랜드
                  </button>
                </div>
              </div>

              {/* News Search */}
              <div className="w-full sm:w-72 relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 stroke-[2]" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="보도 기사 검색"
                  className="w-full pl-9 pr-9 py-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/[0.08] text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    aria-label="검색어 지우기"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* News List */}
            {newsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/[0.06] animate-pulse h-32 sm:h-40" />
                ))}
              </div>
            ) : displayNewsList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
                {displayNewsList.map((grouped) => (
                  <NewsCard key={grouped.id} grouped={grouped} />
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900/70 rounded-3xl border border-slate-200/70 dark:border-white/[0.08] p-12 text-center max-w-md mx-auto my-12 shadow-xs">
                <Newspaper className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3 stroke-[1.5]" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">해당 조건의 기사가 없습니다</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">검색어를 지우거나 전체 기사 보기를 선택해보세요.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Selected Promotion Modal */}
      {selectedPromo && (
        <PromoModal
          promo={selectedPromo}
          onClose={() => setSelectedPromo(null)}
          isBookmarked={bookmarkedIds.includes(selectedPromo.id)}
          onToggleBookmark={toggleBookmark}
        />
      )}
    </div>
  );
}
