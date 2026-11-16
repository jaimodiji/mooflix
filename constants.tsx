export interface GenreDefinition {
  id: number | string;
  name: string;
  sortBy?: string;
  type?: 'all' | 'movie' | 'tv';
}

export const GENRE_MAP: GenreDefinition[] = [
  // Primary Core Genres
  { id: 28, name: "Action Hits" },
  { id: 12, name: "Adventure Quests" },
  { id: 16, name: "Animation & Anime" },
  { id: 35, name: "Comedy & Laughs" },
  { id: 80, name: "Crime & Gangs" },
  { id: 18, name: "Acclaimed Drama" },
  { id: 10751, name: "Family & Kids" },
  { id: 14, name: "Fantasy Worlds" },
  { id: 36, name: "Historical Epics" },
  { id: 27, name: "Horror & Nightmares" },
  { id: 10402, name: "Music & Musicals" },
  { id: 9648, name: "Mystery & Suspense" },
  { id: 10749, name: "Romance & Passion" },
  { id: 878, name: "Sci-Fi & Cyberpunk" },
  { id: 53, name: "High-Octane Thrillers" },
  { id: 10752, name: "War & Military" },
  { id: 37, name: "Westerns" },
  { id: 99, name: "Documentaries" },

  // Hybrid & Popular Subgenres
  { id: "28,53", name: "Action Thrillers" },
  { id: "35,10749", name: "Romantic Comedies" },
  { id: "878,28", name: "Sci-Fi Action" },
  { id: "27,53", name: "Psychological Horror" },
  { id: "80,9648", name: "Detective & Crime Mysteries" },
  { id: "28,12", name: "Action Adventures" },
  { id: "16,35", name: "Animated Comedies" },
  { id: "14,28", name: "Heroic Fantasy" },
  { id: "18,10749", name: "Emotional Romance" },
  { id: "53,9648", name: "Mind-Bending Thrillers" },
  { id: "28,35", name: "Action Comedies" },
  { id: "16,18", name: "Adult Anime & Animation" },
  { id: "27,14", name: "Supernatural & Dark Fantasy" },
  { id: "80,18", name: "Underworld Crime Sagas" },
  { id: "18,36", name: "Period & Royal Dramas" },
  { id: "878,9648", name: "Sci-Fi Mysteries" },
  { id: "12,14", name: "Mythological Adventures" },
  { id: "27,80", name: "Slasher & Serial Killer" },
  { id: "10768,18", name: "Political & Spy Intrigue" },
  { id: "10765,18", name: "Epic Fantasy Series" },
  { id: "10759,28", name: "Martial Arts & Survival" },
  { id: "35,18", name: "Dramedy & Satire" },
  { id: "9648,18", name: "Whodunit Mysteries" },
  { id: "10749,14", name: "Romantic Fantasy" },
  { id: "878,53", name: "Techno Thrillers" },
  { id: "10751,16", name: "Family Friendly Animation" },
  { id: "18,53", name: "Edge-of-the-Seat Drama" },
  { id: "28,10752", name: "War Action" }
];

export const INDIAN_LANGS = "hi|te|ta|ml|kn|pa|bn";
export const REGION = "IN";
