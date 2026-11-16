
export interface ContentItem {
  id: string;
  tmdbId?: string | number | null;
  title: string;
  description: string;
  thumbnail: string;
  poster?: string;
  posterPath?: string;
  backdrop: string;
  rating: string;
  year: number;
  type: 'movie' | 'series' | 'anime' | 'tv';
  badge?: string;
  badgeType?: 'new_episode' | 'new_release' | 'recently_added' | 'popular' | 'trending' | 'starring';
  releaseDateText?: string;
  imdbId?: string | null;
  imdbRating?: string;
  popularity?: number;
  voteCount?: number;
}

export interface Genre {
  id: number | string;
  name: string;
  poster?: string;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string;
}

export interface Episode {
  id: number;
  name: string;
  overview: string;
  stillPath: string;
  episodeNumber: number;
  runtime: number;
  seasonNumber?: number;
}

export interface ExtendedDetails {
  genres: string[];
  cast: CastMember[];
  trailerKey: string | null;
  recommendations: ContentItem[];
  runtime?: number;
  seasons?: { name: string; episodeCount: number; seasonNumber: number; id: number | string }[];
  directors?: string[];
  creators?: string[];
  status?: string;
  originalLanguage?: string;
  imdbId?: string | null;
  logoUrl?: string | null;
  screenshots?: string[];
}

export type ServerProvider =
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | 'aap'
  | 'yogiji'
  | 'vidout'
  | 'ranger'
  | 'hexon'
  | 'moonflix'
  | 'mooflix'
  | 'mooflix2'
  | 'mooflix3'
  | 'modiji'
  | 'rahulji'
  | 'player1'
  | 'player2'
  | 'player3'
  | 'vidly'
  | 'nxsha'
  | 'cjp'
  | 'cinemaos';

export interface PlayConfig {
    item: ContentItem;
    season?: number;
    episode?: number;
    imdbId?: string | null;
    url?: string;
    provider?: ServerProvider;
}

export interface ContinueWatchingItem {
  id: string;
  title: string;
  description?: string;
  thumbnail: string;
  backdrop: string;
  rating: string;
  year: number;
  type: 'movie' | 'series' | 'anime' | 'tv';
  season?: number;
  episode?: number;
  lastWatched: number;
  progress: number;
}
