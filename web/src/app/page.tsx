'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar } from '@/components/Navbar';
import { FilterBar } from '@/components/FilterBar';
import { PromoCard } from '@/components/PromoCard';
import { PromoModal } from '@/components/PromoModal';
import { NewsCard } from '@/components/NewsCard';
import { clusterNewsArticles } from '@/lib/clusterNews';
import { filterPromotions, filterNewsArticles, calculatePromoStats, isPromoExpired } from '@/lib/filterData';
import { Promotion, CrawlStats, NewsArticle, GroupedNews } from '@/types';
import { BookmarkX, PlaneTakeoff, Newspaper, RefreshCw, Search, X, Calendar } from 'lucide-react';
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

  // 새로고침 시 탭 복원 및 클라이언트 마운트 완료 처리 (Hydration 에러 방지)
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

  // Load bookmarks on mount
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

  // Fetch static data (Compatible with GitHub Pages & Local dev)
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
    setRefreshMessage('최신 특가 데이터를 갱신했습니다!');
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans w-full max-w-full overflow-x-hidden transition-colors">
      {/* Refresh Toast Notification */}
      {refreshMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
          <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
          <span>{refreshMessage}</span>
        </div>
      )}

      {/* Global Navbar */}
      <Navbar
        className="hidden sm:block"
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        bookmarkCount={bookmarkedIds.length}
        showOnlyBookmarks={showOnlyBookmarks}
        onToggleBookmarks={() => setShowOnlyBookmarks(!showOnlyBookmarks)}
        lastUpdated={stats?.lastUpdated}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full min-w-0">
        {/* Tab Switcher: Airline Website Events vs Flight News vs Friend Calendar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 mb-6 border-b border-slate-200 dark:border-slate-800 w-full min-w-0">
          <button
            onClick={() => handleTabChange('calendar')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shrink-0 ${
              activeTab === 'calendar'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4 shrink-0" />
            <span className="truncate">친구 일정 캘린더</span>
          </button>

          <button
            onClick={() => handleTabChange('promotions')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shrink-0 ${
              activeTab === 'promotions'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <PlaneTakeoff className="w-4 h-4 shrink-0" />
            <span className="truncate">항공사 공식 특가</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                activeTab === 'promotions' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {stats.total}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('news')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shrink-0 ${
              activeTab === 'news'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Newspaper className="w-4 h-4 shrink-0" />
            <span className="truncate">실시간 특가 보도자료</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                activeTab === 'news' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {totalNewsCount}
            </span>
          </button>
        </div>

        {/* Main Content View by Active Tab */}
        {!isMounted ? (
          <div className="min-h-[420px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 flex flex-col items-center justify-center gap-3">
            <div className="w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-400">화면을 불러오는 중입니다...</p>
          </div>
        ) : activeTab === 'calendar' ? (
          <FriendCalendar />
        ) : activeTab === 'promotions' ? (
          <>
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

            {/* Promotions Grid */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-80 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
                ))}
              </div>
            ) : displayedPromotions.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center max-w-md mx-auto my-12 shadow-sm">
                <BookmarkX className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {showOnlyBookmarks ? '저장된 관심 특가가 없습니다' : '조건에 맞는 특가가 없습니다'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {showOnlyBookmarks
                    ? '마음에 드는 항공권 특가의 북마크 아이콘을 눌러 저장해보세요.'
                    : '검색 조건을 변경하거나 필터를 초기화해보세요.'}
                </p>
              </div>
            )}
          </>
        ) : (
          /* News Feed Mode */
          <div className="space-y-4">
            {/* Filter Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              {/* Country Filter */}
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <button
                    onClick={() => setSelectedCountry('ALL')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      selectedCountry === 'ALL'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm font-bold'
                        : 'hover:text-slate-900 dark:hover:text-[#f0f6fc]'
                    }`}
                  >
                    전체
                  </button>
                  <button
                    onClick={() => setSelectedCountry('JAPAN')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      selectedCountry === 'JAPAN'
                        ? 'bg-indigo-600 text-white shadow-sm font-bold'
                        : 'hover:text-slate-900 dark:hover:text-[#f0f6fc]'
                    }`}
                  >
                    일본
                  </button>
                  <button
                    onClick={() => setSelectedCountry('NZ')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      selectedCountry === 'NZ'
                        ? 'bg-indigo-600 text-white shadow-sm font-bold'
                        : 'hover:text-slate-900 dark:hover:text-[#f0f6fc]'
                    }`}
                  >
                    뉴질랜드
                  </button>
                </div>
              </div>

              {/* News Search */}
              <div className="w-full sm:w-72 relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="기사 검색 (오클랜드, 도쿄, 할인...)"
                  className="w-full pl-9 pr-9 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* News List */}
            {newsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="p-5 rounded-2xl bg-white border border-slate-200 animate-pulse h-40" />
                ))}
              </div>
            ) : displayNewsList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayNewsList.map((grouped) => (
                  <NewsCard key={grouped.id} grouped={grouped} />
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center max-w-md mx-auto my-12 shadow-sm">
                <Newspaper className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">해당 조건의 기사가 없습니다</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">검색어를 지우거나 전체 기사 보기를 클릭해보세요.</p>
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
