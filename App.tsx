import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import Hero from './components/Hero';
import MovieRow from './components/MovieRow';
import TopTenRow from './components/TopTenRow';
import MovieCard from './components/MovieCard';
import ContinueWatchingRow from './components/ContinueWatchingRow';
import Footer from './components/Footer';
import type { StaticPageType } from './components/StaticPagesModal';

import FloatingTelegramButton from './components/FloatingTelegramButton';
import BookmarkNoticePopup from './components/BookmarkNoticePopup';
import TelegramJoinModal from './components/TelegramJoinModal';
import { MovieRowSkeleton, MovieGridSkeleton, HeroSkeleton } from './components/Skeletons';

// Lazy-loaded components for ultra-fast, lightweight initial loading
const MovieDetailsModal = React.lazy(() => import('./components/MovieDetailsModal'));
const SeriesDetailsModal = React.lazy(() => import('./components/SeriesDetailsModal'));
const DownloadSelectorModal = React.lazy(() => import('./components/DownloadSelectorModal'));
const InAppDownloadModal = React.lazy(() => import('./components/InAppDownloadModal'));
const VideoPlayerModal = React.lazy(() => import('./components/VideoPlayerModal'));
const SearchModal = React.lazy(() => import('./components/SearchModal'));
const ExploreCategoryView = React.lazy(() => import('./components/ExploreCategoryView'));
const WatchlistView = React.lazy(() => import('./components/WatchlistView'));
const StaticPagesModal = React.lazy(() => import('./components/StaticPagesModal'));
const BlogsView = React.lazy(() => import('./components/BlogsView'));
const SportsView = React.lazy(() => import('./components/SportsView'));
const EmbedPlayerView = React.lazy(() => import('./components/EmbedPlayerView'));
const EmbedShareModal = React.lazy(() => import('./components/EmbedShareModal'));
import { 
  fetchTrending, 
  fetchTop10Movies, 
  fetchTop10Series, 
  fetchTrendingMovies,
  fetchTrendingSeries,
  fetchMovies, 
  fetchTVShows, 
  fetchAnime,
  searchContent,
  fetchTitleLogo,
  fetchImdbId,
  fetchContentByGenre,
  fetchContentItemById,
  isIndianSerial,
  isItemReleased
} from './services/tmdbService';
import { resolveTmdbId } from './services/tmdbService';
import { ContentItem, PlayConfig, ServerProvider, ContinueWatchingItem } from './types';
import { getEmbedUrl, getDownloadUrl, getServerSlug, getServerDisplayName } from './utils/playerUtils';
import { GENRE_MAP } from './constants';
import { Film, Tv, Sparkles, Filter, Search, RotateCcw, Trophy, Radio, Flame } from 'lucide-react';

const MAIN_GENRES = [
  { id: 'all', name: 'All Categories' },
  { id: 'lang_hi', name: '🇮🇳 Hindi / Bollywood' },
  { id: 'lang_ta_te', name: '🇮🇳 South (Tamil/Telugu/Malayalam)' },
  { id: 'lang_ko', name: '🇰🇷 Korean (K-Drama)' },
  { id: 'lang_ja', name: '🇯🇵 Anime & Japanese' },
  { id: 'lang_es', name: '🇪🇸 Spanish / Global' },
  { id: 28, name: 'Action' },
  { id: 35, name: 'Comedy' },
  { id: 18, name: 'Drama' },
  { id: 878, name: 'Sci-Fi' },
  { id: 53, name: 'Thriller' },
  { id: 27, name: 'Horror' },
  { id: 16, name: 'Animation' },
  { id: 10749, name: 'Romance' },
  { id: 80, name: 'Crime' },
  { id: 9648, name: 'Mystery' },
  { id: 14, name: 'Fantasy' },
  { id: 12, name: 'Adventure' },
  { id: 36, name: 'History' },
  { id: 10751, name: 'Family' },
  { id: 10752, name: 'War' },
  { id: 99, name: 'Documentary' }
];

const App: React.FC = () => {
  const [activeBlogSlug, setActiveBlogSlug] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === 'undefined') return 'home';
    const fullPath = window.location.pathname.replace(/^\//, '');
    const segments = fullPath.split('/').filter(Boolean);
    const firstSegment = segments[0]?.toLowerCase();

    if (!firstSegment) return 'home';
    if (firstSegment === 'blogs' || firstSegment === 'blog') return 'blogs';
    if (firstSegment === 'movies' || firstSegment === 'movie') return 'movies';
    if (firstSegment === 'series' || firstSegment === 'shows' || firstSegment === 'tv') return 'series';
    if (firstSegment === 'anime') return 'anime';
    if (firstSegment === 'watchlist') return 'watchlist';
    if (firstSegment === 'sports' || firstSegment === 'sport' || firstSegment === 'live') return 'sports';
    return 'home';
  });
  const [loading, setLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState<number | string | null>(null);
  
  // Wipe any legacy colliding cache entries and purge stale active tab memory
  try {
    localStorage.removeItem('moflix_active_tab');
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('moo_c_') || key.includes('_v3') || key.includes('_v2') || key.includes('_v1')) {
        sessionStorage.removeItem(key);
      }
    });
  } catch {}

  const [trending, setTrending] = useState<ContentItem[]>(() => JSON.parse(sessionStorage.getItem('moflix_cache_trending_v4') || '[]'));
  const [top10Movies, setTop10Movies] = useState<ContentItem[]>(() => JSON.parse(sessionStorage.getItem('moflix_cache_top10movies_v4') || '[]'));
  const [top10Series, setTop10Series] = useState<ContentItem[]>(() => JSON.parse(sessionStorage.getItem('moflix_cache_top10series_v4') || '[]'));
  const [trendingMovies, setTrendingMovies] = useState<ContentItem[]>(() => JSON.parse(sessionStorage.getItem('moflix_cache_trending_movies_v4') || '[]'));
  const [trendingSeries, setTrendingSeries] = useState<ContentItem[]>(() => JSON.parse(sessionStorage.getItem('moflix_cache_trending_series_v4') || '[]'));
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('moflix_continue_watching') || '[]');
    } catch {
      return [];
    }
  });
  const [genreData, setGenreData] = useState<Record<string, ContentItem[]>>(() => JSON.parse(sessionStorage.getItem('moflix_cache_genredata') || '{}'));
  const [shuffledRows, setShuffledRows] = useState<string[]>(() => JSON.parse(sessionStorage.getItem('moflix_cache_shuffled_rows') || '[]'));
  
  // Endless Home Genres state
  const [homeGenresLoadedCount, setHomeGenresLoadedCount] = useState(() => Number(sessionStorage.getItem('moflix_cache_home_genres_count') || '8'));
  const [isLoadingMoreHomeGenres, setIsLoadingMoreHomeGenres] = useState(false);
  const homeBottomObserver = useRef<IntersectionObserver | null>(null);

  // Explore Category View state
  const [exploreCategory, setExploreCategory] = useState<{
    id: number | string;
    title: string;
    type?: 'genre' | 'trending' | 'recent' | 'top10movies' | 'top10series' | 'trending_movies' | 'trending_series';
  } | null>(null);

  // Hero Featured Item (Randomized fresh movie/series on every page load/refresh)
  const [heroIndex, setHeroIndex] = useState(() => Math.floor(Math.random() * 15));
  const [heroLogos, setHeroLogos] = useState<Record<string, string>>(() => JSON.parse(sessionStorage.getItem('moflix_cache_herologos') || '{}'));
  const [heroImdbIds, setHeroImdbIds] = useState<Record<string, string>>(() => JSON.parse(sessionStorage.getItem('moflix_cache_heroimdb') || '{}'));

  const [moviesList, setMoviesList] = useState<ContentItem[]>(() => JSON.parse(sessionStorage.getItem('moflix_cache_movies_list') || '[]'));
  const [seriesList, setSeriesList] = useState<ContentItem[]>(() => JSON.parse(sessionStorage.getItem('moflix_cache_series_list') || '[]'));
  const [animeList, setAnimeList] = useState<ContentItem[]>(() => JSON.parse(sessionStorage.getItem('moflix_cache_anime_list') || '[]'));

  const [moviesPage, setMoviesPage] = useState(() => Number(sessionStorage.getItem('moflix_cache_movies_page') || '1'));
  const [seriesPage, setSeriesPage] = useState(() => Number(sessionStorage.getItem('moflix_cache_series_page') || '1'));
  const [animePage, setAnimePage] = useState(() => Number(sessionStorage.getItem('moflix_cache_anime_page') || '1'));

  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [activePlayerConfig, setActivePlayerConfig] = useState<PlayConfig | null>(null);
  const [pendingPlayerSelect, setPendingPlayerSelect] = useState<{
    item: ContentItem;
    season?: number;
    episode?: number;
    imdbId?: string | null;
  } | null>(null);

  const [episodeToast, setEpisodeToast] = useState<{
    title: string;
    season: number;
    episode: number;
    visible: boolean;
  } | null>(null);

  // Audience Personalization: 'What's your Vibe?' & 'User Score' states
  const [selectedVibe, setSelectedVibe] = useState<string | null>(null);
  const [minUserScore, setMinUserScore] = useState<number>(0);

  // Download Selector state
  const [pendingDownloadConfig, setPendingDownloadConfig] = useState<{
    item: ContentItem;
    season?: number;
    episode?: number;
    imdbId?: string | null;
  } | null>(null);
  const [showDownloadSelector, setShowDownloadSelector] = useState(false);
  const [activeInAppDownload, setActiveInAppDownload] = useState<{
    url: string;
    serverName: string;
    item: ContentItem;
    season?: number;
    episode?: number;
  } | null>(null);
  const [activeStaticPage, setActiveStaticPage] = useState<StaticPageType | null>(null);
  

  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollPositions = useRef<Record<string, number>>({});
  const observer = useRef<IntersectionObserver | null>(null);
  const navStepRef = useRef(0);

  // Safe back navigation helper that syncs with native browser/mobile history
  const safeGoBack = useCallback((fallbackFn: () => void) => {
    fallbackFn();
    if (window.history.state && (window.history.state.overlay || (window.history.state.tab && window.history.state.tab !== 'home'))) {
      try {
        window.history.back();
      } catch (err) {
        console.warn('History back error:', err);
      }
    }
  }, []);

  // Check URL pathname for SEO pages, movies, series, blogs, and /play on mount
  useEffect(() => {
    const fullPath = window.location.pathname.replace(/^\//, '');
    const segments = fullPath.split('/').filter(Boolean);
    const firstSegment = segments[0]?.toLowerCase();

    // 0. Direct Player link /play?type=movie&id=12345 (supports both ?s= & ?season=)
    if (firstSegment === 'play') {
      const searchParams = new URLSearchParams(window.location.search);
      const rawType = (searchParams.get('type') || '').toLowerCase();
      const playType = rawType === 'series' || rawType === 'tv' ? 'series' : 'movie';
      const playId = searchParams.get('id');
      const playSeason = Math.max(1, parseInt(searchParams.get('s') || searchParams.get('season') || '1', 10) || 1);
      const playEpisode = Math.max(1, parseInt(searchParams.get('e') || searchParams.get('episode') || '1', 10) || 1);
      if (playId) {
        setActiveTab(playType === 'series' ? 'series' : 'movies');
        fetchContentItemById(playId, playType).then((item) => {
          if (item) {
            setSelectedItem(item);
            startPlaybackNow(item, playSeason, playEpisode);
          }
        }).catch(err => console.error('Failed to load /play item:', err));
      }
      return;
    }

    // 0.5 Direct Clean Watch Link: /watch/:id, /watch/series/:id, /watch/series/:id/:season/:episode, /watch/tv/:id/:season/:episode
    if (firstSegment === 'watch' && Boolean(segments[1])) {
      const seg1Lower = segments[1].toLowerCase();
      const isLegacyServerRoute = ['modiji', 'rahulji', 'cjp', 'aap', 'cinemaos', 'server1', 'server2', 'server3', 'server4'].includes(seg1Lower) && Boolean(segments[2]);
      const isTypedRoute = ['series', 'tv', 'shows', 'show', 'movie', 'movies'].includes(seg1Lower) && Boolean(segments[2]);
      const rawTarget = (isLegacyServerRoute || isTypedRoute) ? segments[2] : segments[1];
      const seasonSeg = (isLegacyServerRoute || isTypedRoute) ? segments[3] : segments[2];
      const episodeSeg = (isLegacyServerRoute || isTypedRoute) ? segments[4] : segments[3];
      const cleanTarget = rawTarget.split('?')[0];
      const id = cleanTarget.startsWith('tt')
        ? (cleanTarget.match(/^tt\d+/)?.[0] || cleanTarget)
        : (cleanTarget.match(/^\d+/)?.[0] || cleanTarget.split('-')[0]);
      const searchParams = new URLSearchParams(window.location.search);
      const s = Math.max(1, parseInt(searchParams.get('s') || searchParams.get('season') || seasonSeg || '1', 10) || 1);
      const e = Math.max(1, parseInt(searchParams.get('e') || searchParams.get('episode') || episodeSeg || '1', 10) || 1);

      const isSeriesHint =
        seg1Lower === 'series' ||
        seg1Lower === 'tv' ||
        seg1Lower === 'shows' ||
        seg1Lower === 'show' ||
        searchParams.has('s') ||
        searchParams.has('season') ||
        Boolean(seasonSeg && /^\d+$/.test(seasonSeg));
      const initialType = isSeriesHint ? 'series' : 'movie';

      fetchContentItemById(id, initialType).then(async (foundItem) => {
        let item = foundItem;
        if (!item) {
          const alternateType = initialType === 'movie' ? 'series' : 'movie';
          item = await fetchContentItemById(id, alternateType);
        }
        if (item) {
          setActiveTab(item.type === 'series' ? 'series' : 'movies');
          setSelectedItem(item);
          startPlaybackNow(item, s, e);
          const cleanUrl = `/watch/${item.tmdbId || item.id}${item.type === 'series' && (s > 1 || e > 1) ? `?s=${s}&e=${e}` : ''}`;
          window.history.replaceState({
            root: 'moflix_app',
            overlay: 'player',
            item,
            tab: item.type === 'series' ? 'series' : 'movies',
          }, '', cleanUrl);
        }
      }).catch(err => console.error('Failed to load /watch route:', err));
      return;
    }

    // 1. Direct Movie or Series Detailed Page Link (e.g. /series/87108, /movie/533535, /tv/87108)
    const isDirectLink = (firstSegment === 'movie' || firstSegment === 'movies' || firstSegment === 'series' || firstSegment === 'tv' || firstSegment === 'shows' || firstSegment === 'show') && Boolean(segments[1]);

    if (isDirectLink) {
      const type = (firstSegment === 'series' || firstSegment === 'tv' || firstSegment === 'shows' || firstSegment === 'show') ? 'series' : 'movie';
      const rawTarget = segments[1].split('?')[0];
      const id = rawTarget.startsWith('tt')
        ? (rawTarget.match(/^tt\d+/)?.[0] || rawTarget)
        : (rawTarget.match(/^\d+/)?.[0] || rawTarget.split('-')[0]);

      setActiveTab(type === 'series' ? 'series' : 'movies');
      fetchContentItemById(id, type).then((item) => {
        if (item) {
          setSelectedItem(item);
          window.history.replaceState({
            root: 'moflix_app',
            overlay: 'details',
            item,
            tab: type === 'series' ? 'series' : 'movies',
          }, '', `/${item.type === 'series' ? 'series' : 'movie'}/${item.id}`);
        } else {
          console.warn(`Could not resolve content item for ${type} id: ${id}`);
        }
      }).catch(err => {
        console.error('Failed to load item from direct link:', err);
      });
    } else if (firstSegment === 'search') {
      setIsSearchOpen(true);
    } else if (['about', 'dmca', 'privacy', 'terms', 'contact'].includes(firstSegment)) {
      setActiveStaticPage(firstSegment as StaticPageType);
    } else if (firstSegment === 'blog' && segments[1]) {
      setActiveTab('blogs');
      setActiveBlogSlug(segments[1]);
    } else if (firstSegment === 'blogs' || firstSegment === 'sitemap') {
      setActiveTab('blogs');
    } else if (firstSegment === 'movies' || firstSegment === 'movie') {
      setActiveTab('movies');
    } else if (firstSegment === 'series' || firstSegment === 'shows' || firstSegment === 'tv') {
      setActiveTab('series');
    } else if (firstSegment === 'anime') {
      setActiveTab('anime');
    } else if (firstSegment === 'watchlist') {
      setActiveTab('watchlist');
    } else if (firstSegment === 'sports' || firstSegment === 'sport' || firstSegment === 'live') {
      setActiveTab('sports');
    }
  }, []);

  // Dynamic Google Search Schema.org, Canonical & OpenGraph Title synchronization across all routes
  useEffect(() => {
    const syncMeta = (title: string, description: string, canonicalPath: string) => {
      document.title = title;
      const canonicalUrl = `https://mooflix.online${canonicalPath}`;

      const descEl = document.querySelector('meta[name="description"]');
      if (descEl) descEl.setAttribute('content', description);

      const ogTitleEl = document.querySelector('meta[property="og:title"]');
      if (ogTitleEl) ogTitleEl.setAttribute('content', title);

      const ogDescEl = document.querySelector('meta[property="og:description"]');
      if (ogDescEl) ogDescEl.setAttribute('content', description);

      const ogUrlEl = document.querySelector('meta[property="og:url"]');
      if (ogUrlEl) ogUrlEl.setAttribute('content', canonicalUrl);

      const twTitleEl = document.querySelector('meta[name="twitter:title"]');
      if (twTitleEl) twTitleEl.setAttribute('content', title);

      const twDescEl = document.querySelector('meta[name="twitter:description"]');
      if (twDescEl) twDescEl.setAttribute('content', description);

      const canonicalEl = document.querySelector('link[rel="canonical"]');
      if (canonicalEl) canonicalEl.setAttribute('href', canonicalUrl);
    };

    if (selectedItem) {
      const mediaSlug = selectedItem.type === 'series' ? 'series' : 'movie';
      const title = `${selectedItem.title} (${selectedItem.year || ''}) - Watch Free in Ultra HD 4K | MooFlix`;
      const desc = (selectedItem.description || `Stream ${selectedItem.title} online in Ultra HD 4K with zero ads on MooFlix.`).slice(0, 160);
      syncMeta(title, desc, `/${mediaSlug}/${selectedItem.id}`);

      const schemaScriptId = 'movie-series-seo-schema';
      let scriptEl = document.getElementById(schemaScriptId) as HTMLScriptElement | null;
      if (!scriptEl) {
        scriptEl = document.createElement('script');
        scriptEl.id = schemaScriptId;
        scriptEl.type = 'application/ld+json';
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": selectedItem.type === 'series' ? "TVSeries" : "Movie",
        "name": selectedItem.title,
        "image": selectedItem.thumbnail,
        "description": selectedItem.description,
        "datePublished": selectedItem.year ? String(selectedItem.year) : undefined,
        "aggregateRating": selectedItem.rating && selectedItem.rating !== 'N/A' ? {
          "@type": "AggregateRating",
          "ratingValue": selectedItem.rating,
          "bestRating": "10",
          "ratingCount": "150"
        } : undefined,
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock"
        }
      });
    } else if (activeTab !== 'blogs') {
      const scriptEl = document.getElementById('movie-series-seo-schema');
      if (scriptEl) scriptEl.remove();

      const tabSeo: Record<string, { title: string; desc: string; path: string }> = {
        home: {
          title: 'MooFlix — Watch Free Movies, Web Series & Live Sports in 4K (Zero Ads)',
          desc: 'Stream trending movies, web series, anime, and live sports on MooFlix in Ultra HD 4K with zero ads and automatic multi-server player failover.',
          path: '/',
        },
        movies: {
          title: 'Watch Trending Bollywood, Hollywood & South HD Movies | MooFlix',
          desc: 'Explore trending Bollywood, Hollywood, South Indian, and Tamil/Telugu dubbed movies in Ultra HD 4K with zero ads on MooFlix.',
          path: '/movies',
        },
        series: {
          title: 'Watch Popular Web Series, K-Dramas & TV Shows Online | MooFlix',
          desc: 'Stream full seasons of top Hindi web series, K-Dramas, and international TV shows with automatic server failover and zero ads on MooFlix.',
          path: '/series',
        },
        anime: {
          title: 'Watch HD Anime Series & Movies Sub/Dub Online | MooFlix',
          desc: 'Stream top Japanese Anime series and movies in 1080p HD sub and dub with zero ads on MooFlix.',
          path: '/anime',
        },
        sports: {
          title: 'Watch Live Cricket, Football & 24/7 Sports Streams Free | MooFlix',
          desc: 'Watch live IPL, T20 Cricket, Football, F1, UFC, and 24/7 HD sports streams free with zero ads on MooFlix.',
          path: '/sports',
        },
        watchlist: {
          title: 'My Watchlist | MooFlix',
          desc: 'Access your saved movies and TV series watchlist anytime on MooFlix.',
          path: '/watchlist',
        },
      };

      const seo = tabSeo[activeTab] || tabSeo.home;
      syncMeta(seo.title, seo.desc, seo.path);
    }
  }, [selectedItem, activeTab]);

  // History and PopState event listener for native-app back navigation
  useEffect(() => {
    // Initialize base history state with home guard barrier (skip wiping if direct deep link)
    if (!window.history.state || window.history.state.root !== 'moflix_app') {
      const currentPath = window.location.pathname;
      const isDirectDeepLink = Boolean(currentPath.match(/^\/(movie|series|tv|shows|watch|blog)\/.+/));
      if (!isDirectDeepLink) {
        const pathSegments = currentPath.replace(/^\//, '').split('/').filter(Boolean);
        const urlTab = pathSegments[0]?.toLowerCase() || 'home';
        const isHomeUrl = currentPath === '/' || currentPath === '' || urlTab === 'home';

        if (isHomeUrl) {
          window.history.replaceState({ root: 'moflix_app', tab: 'home', isGuard: true }, '', '/');
          window.history.pushState({ root: 'moflix_app', tab: 'home', isHome: true }, '', '/');
        } else {
          window.history.replaceState({ root: 'moflix_app', tab: urlTab }, '', currentPath);
        }
      }
    }

    const handlePopState = (e: PopStateEvent) => {
      const state = e.state;

      // Case 1: Trapped at Home Guard (User pressed back while at Home with no overlays)
      if (!state || state.isGuard) {
        setActiveStaticPage(null);
        setActiveInAppDownload(null);
        setActivePlayerConfig(null);
        setShowDownloadSelector(false);
        setPendingDownloadConfig(null);
        setSelectedItem(null);
        setIsSearchOpen(false);
        setExploreCategory(null);
        setActiveTab('home');

        // Re-push home to keep the guard barrier active so back does nothing on home!
        window.history.pushState({ root: 'moflix_app', tab: 'home', isHome: true }, '');
        return;
      }

      // Case 2: Popped back to Home
      if (state.isHome || (state.tab === 'home' && !state.overlay)) {
        setActiveStaticPage(null);
        setActiveInAppDownload(null);
        setActivePlayerConfig(null);
        setShowDownloadSelector(false);
        setPendingDownloadConfig(null);
        setSelectedItem(null);
        setIsSearchOpen(false);
        setExploreCategory(null);
        setActiveTab('home');
        return;
      }

      // Case 3: Popped back to a top-level Tab (movies, series, anime, watchlist)
      if (state.tab && !state.overlay) {
        setActiveStaticPage(null);
        setActiveInAppDownload(null);
        setActivePlayerConfig(null);
        setShowDownloadSelector(false);
        setPendingDownloadConfig(null);
        setSelectedItem(null);
        setIsSearchOpen(false);
        setExploreCategory(null);
        setActiveTab(state.tab);
        return;
      }

      // Case 4: Popped back to an Overlay
      if (state.overlay) {
        if (state.overlay === 'static_page') {
          setActiveStaticPage(state.page || null);
          setActiveInAppDownload(null);
          setActivePlayerConfig(null);
          setShowDownloadSelector(false);
          setPendingDownloadConfig(null);
          setSelectedItem(null);
          setIsSearchOpen(false);
          setExploreCategory(null);
        } else if (state.overlay === 'in_app_download') {
          setActiveStaticPage(null);
          setActiveInAppDownload(state.inAppDownload || null);
          if (state.downloadConfig) {
            setPendingDownloadConfig(state.downloadConfig);
            setShowDownloadSelector(true);
          }
          if (state.playerConfig) setActivePlayerConfig(state.playerConfig);
          if (state.item) setSelectedItem(state.item);
        } else if (state.overlay === 'download') {
          setActiveStaticPage(null);
          setActiveInAppDownload(null);
          setShowDownloadSelector(true);
          setPendingDownloadConfig(state.downloadConfig || null);
          if (state.playerConfig) setActivePlayerConfig(state.playerConfig);
          if (state.item) setSelectedItem(state.item);
        } else if (state.overlay === 'player') {
          setActiveStaticPage(null);
          setActiveInAppDownload(null);
          setShowDownloadSelector(false);
          setPendingDownloadConfig(null);
          setActivePlayerConfig(state.playerConfig || null);
          setSelectedItem(state.item || state.playerConfig?.item || null);
          setIsSearchOpen(!!state.fromSearch);
          setExploreCategory(state.category || null);
          if (state.tab) setActiveTab(state.tab);
        } else if (state.overlay === 'details') {
          setActiveStaticPage(null);
          setActiveInAppDownload(null);
          setShowDownloadSelector(false);
          setPendingDownloadConfig(null);
          setActivePlayerConfig(null);
          setSelectedItem(state.item || null);
          setIsSearchOpen(!!state.fromSearch);
          setExploreCategory(state.category || null);
          if (state.tab) setActiveTab(state.tab);
        } else if (state.overlay === 'search') {
          setActiveStaticPage(null);
          setActiveInAppDownload(null);
          setShowDownloadSelector(false);
          setPendingDownloadConfig(null);
          setActivePlayerConfig(null);
          setSelectedItem(null);
          setExploreCategory(null);
          setIsSearchOpen(true);
          if (state.tab) setActiveTab(state.tab);
        } else if (state.overlay === 'explore') {
          setActiveStaticPage(null);
          setActiveInAppDownload(null);
          setShowDownloadSelector(false);
          setPendingDownloadConfig(null);
          setActivePlayerConfig(null);
          setSelectedItem(null);
          setIsSearchOpen(false);
          setExploreCategory(state.category || null);
          if (state.tab) setActiveTab(state.tab);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle escape key and keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeStaticPage) {
          safeGoBack(() => setActiveStaticPage(null));
        } else if (pendingPlayerSelect) {
          safeGoBack(() => setPendingPlayerSelect(null));
        } else if (activeInAppDownload) {
          safeGoBack(() => setActiveInAppDownload(null));
        } else if (showDownloadSelector) {
          safeGoBack(() => {
            setShowDownloadSelector(false);
            setPendingDownloadConfig(null);
          });
        } else if (activePlayerConfig) {
          safeGoBack(() => setActivePlayerConfig(null));
        } else if (selectedItem) {
          safeGoBack(() => setSelectedItem(null));
        } else if (isSearchOpen) {
          safeGoBack(() => setIsSearchOpen(false));
        } else if (exploreCategory) {
          safeGoBack(() => setExploreCategory(null));
        }
      } else if (e.key === '/' && !isSearchOpen && !selectedItem && !activePlayerConfig && !activeInAppDownload && !activeStaticPage) {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        window.history.pushState({ root: 'moflix_app', overlay: 'search', tab: activeTab }, '');
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, selectedItem, exploreCategory, activePlayerConfig, showDownloadSelector, activeInAppDownload, activeStaticPage, activeTab, safeGoBack]);

  // Scroll memory
  useEffect(() => {
    const savedPos = scrollPositions.current[activeTab] || 0;
    setTimeout(() => window.scrollTo({ top: savedPos, behavior: 'instant' }), 40);
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          scrollPositions.current[activeTab] = window.scrollY;
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeTab]);

  // Randomize Hero banner featured title on fresh page load/refresh
  useEffect(() => {
    if (trending.length > 0) {
      setHeroIndex(Math.floor(Math.random() * Math.min(trending.length, 20)));
    }
  }, [trending.length]);

  // Keep-alive Heartbeat: Pings /api/health every 40s to keep Cloud Run active and prevent "App has been paused"
  useEffect(() => {
    const keepAlive = setInterval(() => {
      fetch('/api/health').catch(() => {});
    }, 40000);
    return () => clearInterval(keepAlive);
  }, []);

  // Infinite Scroll Trigger for Movies / Series / Anime Tab
  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || isFetchingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        if (activeTab === 'movies') setMoviesPage(p => p + 1);
        else if (activeTab === 'series') setSeriesPage(p => p + 1);
        else if (activeTab === 'anime') setAnimePage(p => p + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, isFetchingMore, activeTab]);

  // Initial Home Page Data Sync
  const initData = async (force = false) => {
    const hasCache = trending.length > 0;
    if (!hasCache || force) setLoading(true);

    try {
      const [t, tm, ts, trendMovies, trendSeries] = await Promise.all([
        fetchTrending(), 
        fetchTop10Movies(), 
        fetchTop10Series(),
        fetchTrendingMovies(),
        fetchTrendingSeries()
      ]);
      
      setTrending(t); 
      setTop10Movies(tm); 
      setTop10Series(ts);
      setTrendingMovies(trendMovies);
      setTrendingSeries(trendSeries);
      sessionStorage.setItem('moflix_cache_trending_v4', JSON.stringify(t));
      sessionStorage.setItem('moflix_cache_top10movies_v4', JSON.stringify(tm));
      sessionStorage.setItem('moflix_cache_top10series_v4', JSON.stringify(ts));
      sessionStorage.setItem('moflix_cache_trending_movies_v4', JSON.stringify(trendMovies));
      sessionStorage.setItem('moflix_cache_trending_series_v4', JSON.stringify(trendSeries));

      // Continue watching has zero mock seeds by default (strictly populated by real user playback)

      // Fetch logos and IMDb IDs for top items in carousel
      const topItems = t.slice(0, 6);
      const [logos, imdbIds] = await Promise.all([
        Promise.all(topItems.map(item => fetchTitleLogo(item.id, item.type))),
        Promise.all(topItems.map(item => fetchImdbId(item.id, item.type)))
      ]);
      const logoMap: Record<string, string> = {};
      const imdbMap: Record<string, string> = {};
      logos.forEach((url, idx) => {
        if (url) logoMap[topItems[idx].id] = url;
      });
      imdbIds.forEach((id, idx) => {
        if (id) imdbMap[topItems[idx].id] = id;
      });
      setHeroLogos(logoMap);
      setHeroImdbIds(imdbMap);
      sessionStorage.setItem('moflix_cache_herologos', JSON.stringify(logoMap));
      sessionStorage.setItem('moflix_cache_heroimdb', JSON.stringify(imdbMap));

      // Fetch complete set of 18 core genres once (No endless looping)
      const initialCount = 18;
      const genres: Record<string, ContentItem[]> = {};
      const genresToLoad = GENRE_MAP.slice(0, initialCount);
      const genrePromises = genresToLoad.map(g => fetchContentByGenre(g.id, 1));
      const genreResults = await Promise.all(genrePromises);
      
      genresToLoad.forEach((g, idx) => {
        if (genreResults[idx] && genreResults[idx].length > 0) {
          genres[g.name] = genreResults[idx];
        }
      });
      
      setGenreData(genres);
      sessionStorage.setItem('moflix_cache_genredata', JSON.stringify(genres));
      setHomeGenresLoadedCount(initialCount);

      const genreKeys = Object.keys(genres).map(name => `genre_${name}`);

      // Feature Movie Trending, Series Trending, Top 10, then all genres
      const rowKeys = [
        'trending_movies',
        'trending_series',
        'top10movies',
        'top10series',
        ...genreKeys
      ];
      
      setShuffledRows(rowKeys);
      sessionStorage.setItem('moflix_cache_shuffled_rows', JSON.stringify(rowKeys));
      
    } catch (err) { 
      if (!hasCache) setError("Synchronization failed. Please check your network."); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    initData();


  }, []);

  // Helper to find genre ID from row display name
  const getGenreIdForName = (displayName: string): number | string => {
    const cleanName = displayName.replace(/\s*•\s*Vol\.\s*\d+/, '').trim();
    const found = GENRE_MAP.find(g => g.name === cleanName || g.name === displayName);
    return found ? found.id : 28;
  };

  // Fetch Movies / TV Series / Anime browse pages data
  useEffect(() => {
    const loadData = async () => {
      const isMovie = activeTab === 'movies';
      const isSeries = activeTab === 'series';
      const isAnime = activeTab === 'anime';
      if (!isMovie && !isSeries && !isAnime) return;
      
      const page = isMovie ? moviesPage : isSeries ? seriesPage : animePage;
      const list = isMovie ? moviesList : isSeries ? seriesList : animeList;
      
      if (page === 1 && list.length > 0 && selectedGenre === null) return;
      
      setIsFetchingMore(true);
      try {
        const genreQuery = selectedGenre === 'all' ? undefined : (selectedGenre || undefined);
        let newData: ContentItem[] = [];
        if (isMovie) {
          newData = (await fetchMovies(page, genreQuery)).filter(isItemReleased);
        } else if (isSeries) {
          newData = (await fetchTVShows(page, genreQuery)).filter(isItemReleased);
        } else if (isAnime) {
          newData = (await fetchAnime(page, genreQuery)).filter(isItemReleased);
        }
        
        if (isMovie) {
          const updated = page === 1 ? newData : [...moviesList, ...newData];
          setMoviesList(updated);
          sessionStorage.setItem('moflix_cache_movies_list', JSON.stringify(updated));
          sessionStorage.setItem('moflix_cache_movies_page', page.toString());
        } else if (isSeries) {
          const updated = page === 1 ? newData : [...seriesList, ...newData];
          setSeriesList(updated);
          sessionStorage.setItem('moflix_cache_series_list', JSON.stringify(updated));
          sessionStorage.setItem('moflix_cache_series_page', page.toString());
        } else if (isAnime) {
          const updated = page === 1 ? newData : [...animeList, ...newData];
          setAnimeList(updated);
          sessionStorage.setItem('moflix_cache_anime_list', JSON.stringify(updated));
          sessionStorage.setItem('moflix_cache_anime_page', page.toString());
        }
      } catch (e) {
        console.error(e);
      } finally { 
        setIsFetchingMore(false); 
      }
    };
    loadData();
  }, [activeTab, moviesPage, seriesPage, animePage, selectedGenre]);

  const handleGenreChange = (genreId: number | string | null) => {
    const target = genreId === 'all' ? null : genreId;
    setSelectedGenre(target);
    setMoviesPage(1);
    setSeriesPage(1);
    setAnimePage(1);
    setMoviesList([]);
    setSeriesList([]);
    setAnimeList([]);
    sessionStorage.removeItem('moflix_cache_movies_list');
    sessionStorage.removeItem('moflix_cache_series_list');
    sessionStorage.removeItem('moflix_cache_anime_list');
  };

  const handleSelectVibe = (vibeId: string | null, genres: (number | string)[], minRating?: number) => {
    setSelectedVibe(vibeId);
    if (vibeId && genres.length > 0) {
      setSelectedGenre(genres[0]);
    } else {
      setSelectedGenre(null);
    }
    if (minRating && minRating > minUserScore) {
      setMinUserScore(minRating);
    }
    setMoviesPage(1);
    setSeriesPage(1);
    setAnimePage(1);
    setMoviesList([]);
    setSeriesList([]);
    setAnimeList([]);
  };

  const handleSelectMinScore = (score: number) => {
    setMinUserScore(score);
  };

  const handleNavigate = (tab: string) => {
    scrollPositions.current[activeTab] = window.scrollY;

    // Dismiss any active overlays and reset genre filters
    setSelectedItem(null);
    setActivePlayerConfig(null);
    setIsSearchOpen(false);
    setExploreCategory(null);
    setShowDownloadSelector(false);

    if (tab === 'home') {
      setActiveTab('home');
      window.history.pushState({ root: 'moflix_app', tab: 'home' }, '', '/');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.history.pushState({ root: 'moflix_app', tab }, '', `/${tab}`);
      setActiveTab(tab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenSearch = () => {
    window.history.pushState({ root: 'moflix_app', overlay: 'search', tab: activeTab }, '', '/search');
    setIsSearchOpen(true);
  };

  const handleOpenExplore = (category: {
    id: number | string;
    title: string;
    type?: 'genre' | 'trending' | 'recent' | 'top10movies' | 'top10series' | 'trending_movies' | 'trending_series';
  }) => {
    window.history.pushState({ root: 'moflix_app', overlay: 'explore', category, tab: activeTab }, '');
    setExploreCategory(category);
  };

  const handleItemClick = (item: ContentItem) => {
    const mediaType = item.type === 'series' ? 'series' : 'movie';
    window.history.pushState({
      root: 'moflix_app',
      overlay: 'details',
      item,
      category: exploreCategory,
      tab: activeTab,
      fromSearch: isSearchOpen,
    }, '', `/${mediaType}/${item.id}`);
    setSelectedItem(item);
  };

  const startPlaybackNow = async (
    target: any,
    season = 1,
    episode = 1,
    chosenProvider: ServerProvider = '1',
    initialImdbId?: string | null
  ) => {
    let item: ContentItem;
    let targetSeason = season;
    let targetEpisode = episode;
    let imdbId: string | null | undefined = initialImdbId;

    if (target && typeof target === 'object' && target.item) {
      item = target.item;
      targetSeason = target.season ?? season;
      targetEpisode = target.episode ?? episode;
      imdbId = target.imdbId ?? initialImdbId;
    } else {
      item = target;
    }

    // Resolve TMDB ID from IMDb for player if needed
    if (!item.tmdbId && typeof item.id === 'string' && item.id.startsWith('tt')) {
      try {
        const tId = await resolveTmdbId(item.id);
        if (tId) item.tmdbId = tId;
      } catch (err) {
        console.warn('Could not resolve TMDB ID:', err);
      }
    }

    const playConfig: PlayConfig = {
      item,
      provider: chosenProvider,
      season: targetSeason,
      episode: targetEpisode,
      imdbId,
    };

    setActivePlayerConfig(playConfig);

    // Save to Continue Watching
    const continueItem: ContinueWatchingItem = {
      id: String(item.id),
      title: item.title,
      description: item.description,
      thumbnail: item.thumbnail,
      backdrop: item.backdrop || item.thumbnail,
      rating: item.rating,
      year: item.year,
      type: item.type,
      season: targetSeason,
      episode: targetEpisode,
      lastWatched: Date.now(),
      progress: Math.floor(25 + Math.random() * 40)
    };

    setContinueWatching(prev => {
      const filtered = prev.filter(c => String(c.id) !== String(item.id));
      const updated = [continueItem, ...filtered].slice(0, 20);
      try {
        localStorage.setItem('moflix_continue_watching', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save continue watching:', e);
      }
      return updated;
    });

    const tmdbOrId = item.tmdbId || item.id;
    const playUrl = `/watch/${tmdbOrId}${item.type === 'series' && (targetSeason > 1 || targetEpisode > 1) ? `?s=${targetSeason}&e=${targetEpisode}` : ''}`;
    window.history.pushState({
      root: 'moflix_app',
      overlay: 'player',
      playerConfig: playConfig,
      item,
      category: exploreCategory,
      tab: activeTab,
      fromSearch: isSearchOpen,
    }, '', playUrl);
  };

  const handleWatch = (target: any, season = 1, episode = 1, provider?: ServerProvider) => {
    let item: ContentItem;
    let targetSeason = season;
    let targetEpisode = episode;
    let imdbId: string | null | undefined = undefined;
    let targetProvider = provider;

    if (target && typeof target === 'object' && target.item) {
      item = target.item;
      targetSeason = target.season ?? season;
      targetEpisode = target.episode ?? episode;
      imdbId = target.imdbId;
      if (target.provider) targetProvider = target.provider;
    } else {
      item = target;
    }

    // Open player popup modal directly on click (no drop-down or server selection modal)
    startPlaybackNow(item, targetSeason, targetEpisode, targetProvider || '1', imdbId);
  };

  const handlePlayerChosen = (provider: ServerProvider) => {
    if (!pendingPlayerSelect) return;
    const config = pendingPlayerSelect;
    setPendingPlayerSelect(null);
    startPlaybackNow(config.item, config.season || 1, config.episode || 1, provider, config.imdbId);
  };

  const handlePlayerEpisodeChange = (item: ContentItem, newSeason: number, newEpisode: number) => {
    const continueItem: ContinueWatchingItem = {
      id: String(item.id),
      title: item.title,
      description: item.description,
      thumbnail: item.thumbnail,
      backdrop: item.backdrop || item.thumbnail,
      rating: item.rating,
      year: item.year,
      type: item.type,
      season: newSeason,
      episode: newEpisode,
      lastWatched: Date.now(),
      progress: 10
    };

    // 1. Update Continue Watching shelf
    setContinueWatching(prev => {
      const filtered = prev.filter(c => String(c.id) !== String(item.id));
      const updated = [continueItem, ...filtered].slice(0, 20);
      try {
        localStorage.setItem('moflix_continue_watching', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save continue watching on episode change:', e);
      }
      return updated;
    });

    // 2. Update active player state
    setActivePlayerConfig(prev => prev ? {
      ...prev,
      season: newSeason,
      episode: newEpisode
    } : null);

    // 3. Update Browser URL in address bar
    const tmdbOrId = item.tmdbId || item.id;
    const playUrl = `/watch/${tmdbOrId}?s=${newSeason}&e=${newEpisode}`;
    window.history.replaceState({
      root: 'moflix_app',
      overlay: 'player',
      item,
      season: newSeason,
      episode: newEpisode,
      tab: activeTab,
    }, '', playUrl);

    // 4. Update Document Title
    document.title = `Watching ${item.title} - S${newSeason}:E${newEpisode} | MooFlix`;

    // 5. Trigger live website notification toast
    setEpisodeToast({
      title: item.title,
      season: newSeason,
      episode: newEpisode,
      visible: true,
    });
    setTimeout(() => {
      setEpisodeToast(prev => prev ? { ...prev, visible: false } : null);
    }, 4000);
  };

  const handleResumeContinueWatching = (cwItem: ContinueWatchingItem) => {
    const contentItem: ContentItem = {
      id: cwItem.id,
      title: cwItem.title,
      description: cwItem.description || '',
      thumbnail: cwItem.thumbnail,
      backdrop: cwItem.backdrop,
      rating: cwItem.rating,
      year: cwItem.year,
      type: cwItem.type
    };
    handleWatch(contentItem, cwItem.season || 1, cwItem.episode || 1);
  };

  const handleRemoveContinueWatching = (id: string) => {
    setContinueWatching(prev => {
      const updated = prev.filter(c => String(c.id) !== String(id));
      try {
        localStorage.setItem('moflix_continue_watching', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  const handleClearContinueWatching = () => {
    setContinueWatching([]);
    try {
      localStorage.removeItem('moflix_continue_watching');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownload = async (config: { item: ContentItem; season?: number; episode?: number; imdbId?: string | null }) => {
    // Ensure TMDB ID is resolved for download link
    if (!config.item.tmdbId && typeof config.item.id === 'string' && config.item.id.startsWith('tt')) {
      const tId = await resolveTmdbId(config.item.id);
      if (tId) {
        config.item.tmdbId = tId;
      }
    }
    // Direct Nxsha DL API download page redirect (Zero popups, zero ndhapi)
    const downloadUrl = getDownloadUrl(config.item, 1, config.season || 1, config.episode || 1, config.imdbId);
    try {
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch {
      window.location.href = downloadUrl;
    }
  };

  const handleOpenInAppDownload = (url: string, serverName: string) => {
    if (!pendingDownloadConfig) return;
    const downloadData = {
      url,
      serverName,
      item: pendingDownloadConfig.item,
      season: pendingDownloadConfig.season,
      episode: pendingDownloadConfig.episode,
    };

    window.history.pushState({
      root: 'moflix_app',
      overlay: 'in_app_download',
      inAppDownload: downloadData,
      downloadConfig: pendingDownloadConfig,
      playerConfig: activePlayerConfig,
      item: pendingDownloadConfig.item,
      tab: activeTab,
    }, '');

    setActiveInAppDownload(downloadData);
  };

  const handleOpenStaticPage = (page: StaticPageType) => {
    window.history.pushState({
      root: 'moflix_app',
      overlay: 'static_page',
      page,
      tab: activeTab,
    }, '', `/${page}`);
    setActiveStaticPage(page);
  };

  return (
    <Routes>
      {/* Standalone Universal Player API & Embed Routes */}
      <Route 
        path="/embed/movie/:id" 
        element={
          <React.Suspense fallback={<div className="fixed inset-0 bg-black flex items-center justify-center text-white"><div className="w-10 h-10 border-2 border-white/20 border-t-red-600 rounded-full animate-spin" /></div>}>
            <EmbedPlayerView type="movie" />
          </React.Suspense>
        } 
      />
      <Route 
        path="/embed/tv/:id/:season/:episode" 
        element={
          <React.Suspense fallback={<div className="fixed inset-0 bg-black flex items-center justify-center text-white"><div className="w-10 h-10 border-2 border-white/20 border-t-red-600 rounded-full animate-spin" /></div>}>
            <EmbedPlayerView type="tv" />
          </React.Suspense>
        } 
      />
      <Route 
        path="/embed/series/:id/:season/:episode" 
        element={
          <React.Suspense fallback={<div className="fixed inset-0 bg-black flex items-center justify-center text-white"><div className="w-10 h-10 border-2 border-white/20 border-t-red-600 rounded-full animate-spin" /></div>}>
            <EmbedPlayerView type="tv" />
          </React.Suspense>
        } 
      />
      <Route 
        path="/embed/tv/:id" 
        element={
          <React.Suspense fallback={<div className="fixed inset-0 bg-black flex items-center justify-center text-white"><div className="w-10 h-10 border-2 border-white/20 border-t-red-600 rounded-full animate-spin" /></div>}>
            <EmbedPlayerView type="tv" />
          </React.Suspense>
        } 
      />
      <Route 
        path="/embed/series/:id" 
        element={
          <React.Suspense fallback={<div className="fixed inset-0 bg-black flex items-center justify-center text-white"><div className="w-10 h-10 border-2 border-white/20 border-t-red-600 rounded-full animate-spin" /></div>}>
            <EmbedPlayerView type="tv" />
          </React.Suspense>
        } 
      />
      <Route 
        path="/embed" 
        element={
          <React.Suspense fallback={<div className="fixed inset-0 bg-black flex items-center justify-center text-white"><div className="w-10 h-10 border-2 border-white/20 border-t-red-600 rounded-full animate-spin" /></div>}>
            <EmbedPlayerView />
          </React.Suspense>
        } 
      />

      <Route path="*" element={
        <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-white/20 pb-36 sm:pb-44 lg:pb-12 font-sans antialiased">
          <Navbar 
            activeTab={activeTab} 
            onNavigate={handleNavigate} 
            onOpenSearch={handleOpenSearch}
            onOpenApiModal={() => setShowApiModal(true)}
          />

          <main className={`relative ${activeTab === 'home' ? '' : 'pt-16 sm:pt-20'}`}>
            {/* Explore Category View Modal */}
            {exploreCategory && (
              <React.Suspense fallback={null}>
                <ExploreCategoryView 
                  category={exploreCategory}
                  onClose={() => safeGoBack(() => setExploreCategory(null))}
                  onItemClick={handleItemClick}
                />
              </React.Suspense>
            )}

            <div>
              {/* Home Page Tab */}
              {activeTab === 'home' && (
                <div>
                  {/* Hero Featured Title (Static per session, fresh on each refresh) */}
                  {trending.length > 0 ? (
                    <Hero 
                      item={trending[heroIndex] || trending[0]} 
                      onWatch={handleWatch} 
                      onDetails={handleItemClick}
                      customLogoUrl={heroLogos[(trending[heroIndex] || trending[0])?.id]}
                      imdbId={heroImdbIds[(trending[heroIndex] || trending[0])?.id]}
                    />
                  ) : (
                    <HeroSkeleton />
                  )}
                  
                  <div className="relative z-10 px-4 md:px-12 mt-2 md:mt-4">
                    <div className="space-y-8 md:space-y-12 pb-12 pt-4">
                      {/* Initial Skeletons when fetching home data */}
                      {loading && trendingMovies.length === 0 && (
                        <div className="space-y-8 md:space-y-12">
                          <MovieRowSkeleton title="Movie Trending" count={8} />
                          <MovieRowSkeleton title="Series Trending" count={8} />
                          <MovieRowSkeleton title="Top 10 in India Today" count={8} />
                          <MovieRowSkeleton title="Action Hits" count={8} />
                        </div>
                      )}
                      {/* Continue Watching Section */}
                      {continueWatching.length > 0 && (
                        <ContinueWatchingRow 
                          items={continueWatching}
                          onResume={handleResumeContinueWatching}
                          onItemDetails={handleItemClick}
                          onRemove={handleRemoveContinueWatching}
                          onClearAll={handleClearContinueWatching}
                        />
                      )}


                      {/* Continuous Dynamic Rows */}
                      {shuffledRows.map((rowKey, idx) => {
                        let rowContent = null;
                        if (rowKey === 'trending_movies' && trendingMovies.length > 0) {
                          const onlyMovies = trendingMovies.filter(m => m.type === 'movie');
                          if (onlyMovies.length > 0) {
                            rowContent = (
                              <MovieRow 
                                key="trending_movies"
                                title="Trending Movies" 
                                items={onlyMovies} 
                                onItemClick={handleItemClick} 
                                onExploreAll={() => handleOpenExplore({
                                  id: 'trending_movies',
                                  title: 'Trending Movies',
                                  type: 'trending_movies'
                                })}
                              />
                            );
                          }
                        } else if (rowKey === 'trending_series' && trendingSeries.length > 0) {
                          const onlySeries = trendingSeries.filter(s => s.type === 'series' && !isIndianSerial(s));
                          if (onlySeries.length > 0) {
                            rowContent = (
                              <MovieRow 
                                key="trending_series"
                                title="Trending Series" 
                                items={onlySeries} 
                                onItemClick={handleItemClick} 
                                onExploreAll={() => handleOpenExplore({
                                  id: 'trending_series',
                                  title: 'Trending Series',
                                  type: 'trending_series'
                                })}
                              />
                            );
                          }
                        } else if (rowKey === 'top10movies' && top10Movies.length > 0) {
                          const onlyMovies = top10Movies.filter(m => m.type === 'movie');
                          if (onlyMovies.length > 0) {
                            rowContent = (
                              <TopTenRow 
                                key="top10movies"
                                title="Top 10 Movies in India Today" 
                                items={onlyMovies} 
                                onItemClick={handleItemClick} 
                              />
                            );
                          }
                        } else if (rowKey === 'top10series' && top10Series.length > 0) {
                          const onlySeries = top10Series.filter(s => s.type === 'series' && !isIndianSerial(s));
                          if (onlySeries.length > 0) {
                            rowContent = (
                              <TopTenRow 
                                key="top10series"
                                title="Top 10 TV Series in India Today" 
                                items={onlySeries} 
                                onItemClick={handleItemClick} 
                              />
                            );
                          }
                        } else if (rowKey.startsWith('genre_')) {
                          const genreName = rowKey.replace('genre_', '');
                          const items = genreData[genreName];
                          const genreId = getGenreIdForName(genreName);
                          if (items && items.length > 0) {
                            rowContent = (
                              <React.Fragment key={rowKey}>
                                <MovieRow 
                                  title={genreName} 
                                  items={items} 
                                  onItemClick={handleItemClick} 
                                  onExploreAll={() => handleOpenExplore({
                                    id: genreId,
                                    title: genreName,
                                    type: 'genre'
                                  })}
                                />
                              </React.Fragment>
                            );
                          }
                        }

                        if (!rowContent) return null;

                        return (
                          <React.Fragment key={rowKey}>
                            {rowContent}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Movies, TV Series & Anime Browse Pages */}
              {(activeTab === 'movies' || activeTab === 'series' || activeTab === 'anime') && (
                <div className="px-4 md:px-12 pt-6 md:pt-10 min-h-screen">
                  {/* Page Header */}
                  <div className="mb-2">
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
                      {activeTab === 'movies' 
                        ? 'Movies' 
                        : activeTab === 'series' 
                          ? 'TV Series' 
                          : 'Anime'}
                    </h1>
                    {activeTab === 'anime' ? (
                      <p className="text-xs md:text-sm text-neutral-400 mt-1">
                        Explore Japanese Anime series, OVAs, and cinematic films
                      </p>
                    ) : (
                      <p className="text-xs md:text-sm text-neutral-400 mt-1">
                        Browse the complete collection of top trending and popular titles
                      </p>
                    )}
                  </div>

                  {/* Grid / Skeletons */}
                  {loading && (activeTab === 'movies' ? moviesList : activeTab === 'series' ? seriesList : animeList).length === 0 ? (
                    <MovieGridSkeleton count={18} />
                  ) : (activeTab === 'movies' ? moviesList : activeTab === 'series' ? seriesList : animeList).length === 0 ? (
                    <div className="py-16 text-center">
                      <p className="text-neutral-400 text-sm mb-3">No titles available right now.</p>
                    </div>
                  ) : (
                    <div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
                        {(activeTab === 'movies' ? moviesList : activeTab === 'series' ? seriesList : animeList)
                          .filter(item => {
                            if (minUserScore <= 0) return true;
                            const score = parseFloat(item.rating || '0');
                            return !isNaN(score) && score >= minUserScore;
                          })
                          .map((item, idx) => (
                            <MovieCard 
                              key={`${item.id}-${idx}`}
                              item={item} 
                              onClick={handleItemClick} 
                            />
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Infinite Scroll Skeleton Loader */}
                  <div ref={lastElementRef} className="py-8">
                    {isFetchingMore && (
                      <div className="space-y-4">
                        <MovieGridSkeleton count={6} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <React.Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center"><div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /></div>}>
                {/* Cinema Blogs Hub */}
                {activeTab === 'blogs' && (
                  <BlogsView 
                    initialSlug={activeBlogSlug}
                    onOpenMovie={handleItemClick}
                    onNavigateHome={() => handleNavigate('home')}
                  />
                )}

                {/* Watchlist Tab */}
                {activeTab === 'watchlist' && (
                  <WatchlistView 
                    onItemClick={handleItemClick}
                    onExploreContent={() => handleNavigate('home')}
                  />
                )}

                {/* Live Sports & Matches Arena */}
                {activeTab === 'sports' && (
                  <SportsView 
                    onExploreMovies={() => handleNavigate('movies')}
                    onExploreSeries={() => handleNavigate('series')}
                  />
                )}
              </React.Suspense>
            </div>
          </main>


          <Footer 
            onOpenPage={handleOpenStaticPage} 
            onNavigateTab={handleNavigate} 
          />


          {/* Modals & Overlays wrapped in React.Suspense */}
          <React.Suspense fallback={null}>
            {/* SEO Trust and Legal Pages Modal */}
            {activeStaticPage && (
              <StaticPagesModal
                page={activeStaticPage}
                onClose={() => safeGoBack(() => {
                  setActiveStaticPage(null);
                  window.history.replaceState({ root: 'moflix_app', tab: activeTab, isHome: activeTab === 'home' }, '', activeTab === 'home' ? '/' : `/${activeTab}`);
                })}
                onNavigatePage={(p) => {
                  window.history.replaceState({ root: 'moflix_app', overlay: 'static_page', page: p, tab: activeTab }, '', `/${p}`);
                  setActiveStaticPage(p);
                }}
              />
            )}

            {/* Details Modals */}
            {selectedItem && (
              selectedItem.type === 'movie' ? (
                <MovieDetailsModal 
                  item={selectedItem} 
                  onModalClose={() => safeGoBack(() => {
                    setSelectedItem(null);
                    window.history.replaceState({ root: 'moflix_app', tab: activeTab, isHome: activeTab === 'home' }, '', activeTab === 'home' ? '/' : `/${activeTab}`);
                  })} 
                  onItemSelect={handleItemClick} 
                  onPlay={handleWatch}
                  onDownload={handleDownload} 
                />
              ) : (
                <SeriesDetailsModal 
                  item={selectedItem} 
                  onModalClose={() => safeGoBack(() => {
                    setSelectedItem(null);
                    window.history.replaceState({ root: 'moflix_app', tab: activeTab, isHome: activeTab === 'home' }, '', activeTab === 'home' ? '/' : `/${activeTab}`);
                  })} 
                  onItemSelect={handleItemClick} 
                  onPlay={handleWatch}
                  onDownload={handleDownload} 
                />
              )
            )}



            {/* Dedicated In-App Video Player Modal */}
            {activePlayerConfig && (
              <VideoPlayerModal
                item={activePlayerConfig.item}
                initialServer={activePlayerConfig.provider || '1'}
                initialSeason={activePlayerConfig.season || 1}
                initialEpisode={activePlayerConfig.episode || 1}
                initialImdbId={activePlayerConfig.imdbId}
                onClose={() => safeGoBack(() => {
                  setActivePlayerConfig(null);
                  if (selectedItem) {
                    window.history.replaceState({
                      root: 'moflix_app',
                      overlay: 'details',
                      item: selectedItem,
                      tab: activeTab,
                    }, '', `/${selectedItem.type === 'series' ? 'series' : 'movie'}/${selectedItem.id}`);
                  } else {
                    window.history.replaceState({
                      root: 'moflix_app',
                      tab: activeTab,
                      isHome: activeTab === 'home'
                    }, '', activeTab === 'home' ? '/' : `/${activeTab}`);
                  }
                })}
                onItemClick={(item) => handleItemClick(item)}
                onDownload={handleDownload}
                onEpisodeChange={(newSeason, newEpisode) =>
                  handlePlayerEpisodeChange(activePlayerConfig.item, newSeason, newEpisode)
                }
              />
            )}

            {/* Download Selector Modal (Rendered on top of Player & Modals) */}
            {showDownloadSelector && pendingDownloadConfig && (
              <DownloadSelectorModal
                item={pendingDownloadConfig.item}
                season={pendingDownloadConfig.season}
                episode={pendingDownloadConfig.episode}
                imdbId={pendingDownloadConfig.imdbId}
                onOpenInAppDownload={handleOpenInAppDownload}
                onClose={() => safeGoBack(() => {
                  setShowDownloadSelector(false);
                  setPendingDownloadConfig(null);
                })}
              />
            )}

            {/* In-App Download Window Popup Modal (Renders in-app instead of external tab) */}
            {activeInAppDownload && (
              <InAppDownloadModal
                url={activeInAppDownload.url}
                serverName={activeInAppDownload.serverName}
                item={activeInAppDownload.item}
                season={activeInAppDownload.season}
                episode={activeInAppDownload.episode}
                onClose={() => safeGoBack(() => setActiveInAppDownload(null))}
              />
            )}

            {/* Dedicated Search Modal */}
            {isSearchOpen && (
              <SearchModal
                isOpen={isSearchOpen}
                onClose={() => safeGoBack(() => {
                  setIsSearchOpen(false);
                  window.history.replaceState(
                    { root: 'moflix_app', tab: activeTab, isHome: activeTab === 'home' },
                    '',
                    activeTab === 'home' ? '/' : `/${activeTab}`
                  );
                })}
                onItemClick={handleItemClick}
              />
            )}

            {/* Universal Embed Player API Generator Modal (Triggered by Header & Mobile API Buttons) */}
            {showApiModal && (
              <EmbedShareModal
                onClose={() => setShowApiModal(false)}
              />
            )}
          </React.Suspense>


          {/* iOS Floating Telegram Community Action Button (Bottom Right) */}
          <FloatingTelegramButton />

          {/* Quick Bookmark Notice Popup (Bottom Left) */}
          <BookmarkNoticePopup />

          {/* Telegram 24-Hour Popup Modal */}
          <TelegramJoinModal />

          {/* Live Episode Change Toast (Visible across the website & inside player) */}
          {episodeToast && episodeToast.visible && (
            <div 
              className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000005] bg-[#0c0c14]/95 border border-red-500/50 text-white px-4 py-2.5 rounded-full shadow-[0_12px_36px_rgba(229,9,20,0.5)] flex items-center gap-2.5 text-xs font-bold backdrop-blur-2xl animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none select-none"
              style={{
                marginTop: 'env(safe-area-inset-top, 0px)',
              }}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse inline-block shrink-0" />
              <span className="text-neutral-200">Episode Changed:</span>
              <span className="px-2 py-0.5 rounded-md bg-white/15 text-red-400 font-mono font-bold text-[11px] shrink-0">
                S{episodeToast.season} : E{episodeToast.episode}
              </span>
              <span className="text-neutral-300 truncate max-w-[160px] sm:max-w-[240px]">
                {episodeToast.title}
              </span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-[200] bg-red-600 text-white px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-3 animate-in slide-in-from-bottom-6">
              <span>{error}</span>
              <button 
                onClick={() => { setError(null); initData(true); }} 
                className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-xs transition-colors flex items-center gap-1"
              >
                <RotateCcw size={12} /> Retry
              </button>
            </div>
          )}

          {!exploreCategory && (
            <BottomNav 
              activeTab={activeTab} 
              isSearchOpen={isSearchOpen}
              onNavigate={(tab) => {
                handleNavigate(tab);
              }}
              onSearchClick={() => {
                handleOpenSearch();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}
        </div>
      } />
    </Routes>
  );
};

export default App;
