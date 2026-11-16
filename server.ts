import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import { GoogleGenAI } from "@google/genai";
import { renderPageWithSeo } from "./server/seoPrerender.js";
import { registerVidlyProxy } from "./server/vidlyProxy.ts";

dotenv.config();

const app = express();
app.set("trust proxy", true);
const PORT = Number(process.env.PORT) || 3000;

// Global process guards to prevent dev server crashes
process.on("unhandledRejection", (reason) => {
  console.warn("Server unhandledRejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.warn("Server uncaughtException:", err);
});

// AI Studio Internal Control Plane & Cloud Run Health Probes
// CRITICAL: AI Studio's dev environment periodically probes /__aistudio_internal_control_plane/dev/status.
// Returning valid JSON 200 OK prevents AI Studio from marking the environment as paused.
app.all([
  "/health",
  "/healthz",
  "/api/health",
  "/ping",
  "/status",
  "/_health",
  "/__health",
  /^\/__aistudio_internal_control_plane(\/.*)?$/,
  /^\/__aistudio(\/.*)?$/,
  /^\/_ah\/health$/,
  /^\/_ah\/start$/
], (_req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  return res.status(200).json({
    status: "ok",
    state: "running",
    healthy: true,
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

app.get(/^\/sitemap.*\.xml$/, (req, res) => {
  const reqFile = req.path.replace(/^\//, '');
  const publicPath = path.join(process.cwd(), "public", reqFile);
  const distPath = path.join(process.cwd(), "dist", reqFile);
  
  if (fs.existsSync(publicPath)) {
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    return res.sendFile(publicPath);
  } else if (fs.existsSync(distPath)) {
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    return res.sendFile(distPath);
  }
  return res.status(404).send("Sitemap not found");
});

// Official RSS 2.0 & Atom Feed for Search Crawlers
app.get(["/rss.xml", "/feed.xml", "/rss"], (req, res) => {
  const reqFile = req.path.includes("feed") ? "feed.xml" : "rss.xml";
  const publicPath = path.join(process.cwd(), "public", reqFile);
  const distPath = path.join(process.cwd(), "dist", reqFile);

  if (fs.existsSync(publicPath)) {
    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    return res.sendFile(publicPath);
  } else if (fs.existsSync(distPath)) {
    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    return res.sendFile(distPath);
  }
  return res.status(404).send("Feed not found");
});

app.get("/atom.xml", (_req, res) => {
  const publicPath = path.join(process.cwd(), "public", "atom.xml");
  const distPath = path.join(process.cwd(), "dist", "atom.xml");
  if (fs.existsSync(publicPath)) {
    res.setHeader("Content-Type", "application/atom+xml; charset=utf-8");
    return res.sendFile(publicPath);
  } else if (fs.existsSync(distPath)) {
    res.setHeader("Content-Type", "application/atom+xml; charset=utf-8");
    return res.sendFile(distPath);
  }
  return res.status(404).send("Atom feed not found");
});

app.get("/robots.txt", (req, res) => {
  const robotsPath = path.join(process.cwd(), "public", "robots.txt");
  if (fs.existsSync(robotsPath)) {
    res.setHeader("Content-Type", "text/plain");
    return res.sendFile(robotsPath);
  }
  return res.status(404).send("User-agent: *\nAllow: /\nSitemap: https://mooflix.online/sitemap.xml");
});

// RFC 9116 Official Security.txt Endpoint
app.get(["/.well-known/security.txt", "/security.txt"], (req, res) => {
  const primaryPath = path.join(process.cwd(), "public", ".well-known", "security.txt");
  const fallbackPath = path.join(process.cwd(), "public", "security.txt");
  const targetPath = fs.existsSync(primaryPath) ? primaryPath : fallbackPath;
  if (fs.existsSync(targetPath)) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.sendFile(targetPath);
  }
  return res.status(200).type("text/plain").send("Contact: mailto:workrajydv@gmail.com\nExpires: 2027-12-31T23:59:59.000Z\nPreferred-Languages: en, hi\nCanonical: https://mooflix.online/.well-known/security.txt\nPolicy: https://mooflix.online/privacy");
});

const rawGeminiKey = (process.env.GEMINI_API_KEY || "").trim();
const hasValidGeminiKey = Boolean(
  rawGeminiKey &&
  !rawGeminiKey.startsWith("AQ.") &&
  (rawGeminiKey.startsWith("AIza") || rawGeminiKey.length > 30)
);

const ai = hasValidGeminiKey ? new GoogleGenAI({
  apiKey: rawGeminiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
}) : null;

app.use(cors({
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
}));

app.use(express.json());

const limiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later.",
});

if (process.env.RATE_LIMIT === "true") {
  app.use(limiter);
}

// Register Vidly Stream Proxy (Server 1)
registerVidlyProxy(app);

// Standalone Backup Player - 100% Ad-Free Fullscreen Mode
app.get(["/backup-player/rahul-ji", "/backup-player-rahul-ji", "/backup-player"], (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>MooFlix Backup Player</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .top-bar {
      position: absolute;
      top: 12px;
      left: 12px;
      right: 12px;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: space-between;
      pointer-events: none;
    }
    .back-btn {
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: rgba(0, 0, 0, 0.75);
      color: #fff;
      text-decoration: none;
      font-size: 12px;
      font-weight: 700;
      border-radius: 9999px;
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .back-btn:hover {
      background: rgba(255, 255, 255, 0.25);
      transform: scale(1.02);
    }
    .title-pill {
      pointer-events: auto;
      display: inline-block;
      padding: 6px 14px;
      background: rgba(0, 0, 0, 0.75);
      color: #e5e5e5;
      font-size: 12px;
      font-weight: 600;
      border-radius: 9999px;
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      max-width: 260px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: 0;
      display: block;
      background: #000;
    }
  </style>
</head>
<body>
  <div class="top-bar">
    <button class="back-btn" onclick="if(window.opener || history.length <= 1){window.close();}else{history.back();}">
      ← Back
    </button>
    <span class="title-pill" id="title-display">MooFlix Player</span>
  </div>
  <iframe
    id="player-frame"
    src=""
    allowfullscreen
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen; screen-wake-lock"
  ></iframe>
  <script>
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id') || '550';
    const type = params.get('type') || 'movie';
    const season = params.get('season') || '1';
    const episode = params.get('episode') || '1';
    const title = params.get('title') || 'Now Playing';

    const cleanTitle = decodeURIComponent(title);
    document.getElementById('title-display').textContent = cleanTitle + (type === 'tv' || type === 'series' ? ' (S' + season + ':E' + episode + ')' : '');
    document.title = cleanTitle + ' - MooFlix Watch';

    const playerUrl = (type === 'tv' || type === 'series')
      ? 'https://player.moonflix.website/tv/' + id + '/S' + season + '/E' + episode
      : 'https://player.moonflix.website/movie/' + id;

    document.getElementById('player-frame').src = playerUrl;
  </script>
</body>
</html>`);
});

// In-memory cache for search grounding results to avoid hitting quota
interface GroundingEntity {
  exactTitle: string;
  year?: string | null;
  type?: 'movie' | 'series' | 'star' | null;
  directorOrStar?: string | null;
}

interface GroundingCacheEntry {
  summary: string | null;
  sources: { title: string; url: string }[];
  entity?: GroundingEntity | null;
  timestamp: number;
}
const groundingCache = new Map<string, GroundingCacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Google Search Grounding with intelligent entity resolution & fallback
app.post("/api/search-grounding", async (req, res) => {
  const { query, category } = req.body || {};
  if (!query || typeof query !== "string" || query.trim().length < 2) {
    return res.json({ summary: null, sources: [], entity: null });
  }

  const cleanQuery = query.trim();
  const cacheKey = `${(category || 'all').toLowerCase()}_${cleanQuery.toLowerCase()}`;

  // 1. Check in-memory cache first
  const cached = groundingCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json({
      summary: cached.summary,
      sources: cached.sources,
      entity: cached.entity || null,
      cached: true,
    });
  }

  let summary: string | null = null;
  let webSources: { title: string; url: string }[] = [];
  let entity: GroundingEntity | null = null;

  const contextInstruction = category === 'movie'
    ? `the movie "${cleanQuery}"`
    : category === 'series'
    ? `the TV/web series "${cleanQuery}"`
    : category === 'star'
    ? `the actor/celebrity/star "${cleanQuery}"`
    : `"${cleanQuery}" (movie, web series, or celebrity/star)`;

  // 2. Identify exact entity (title, year, type, creator/star)
  if (ai) {
    try {
      const entityRes = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: `Search query: "${cleanQuery}" (category: ${category || 'all'}).
Identify the primary movie, TV/web series, or celebrity/star.
Even if the query has spelling mistakes, phonetic typos, or Romanized Hindi transliterations (e.g. "dil wale dulaniya le jaynge" -> "Dilwale Dulhania Le Jayenge", "kalkee" -> "Kalki 2898 AD", "sholey" -> "Sholay"), recognize the intended official correct title!
Respond with JSON only:
{
  "exactTitle": "exact official title with correct spelling",
  "year": "4-digit release year if movie/series (e.g. 1995) or null",
  "type": "movie" | "series" | "star",
  "directorOrStar": "director or lead star if known or null"
}`,
        config: {
          responseMimeType: "application/json",
        },
      });

      const parsed = JSON.parse(entityRes.text || '{}');
      if (parsed && parsed.exactTitle) {
        entity = {
          exactTitle: String(parsed.exactTitle).trim(),
          year: parsed.year ? String(parsed.year).trim() : null,
          type: parsed.type || (category === 'movie' ? 'movie' : category === 'series' ? 'series' : null),
          directorOrStar: parsed.directorOrStar || null,
        };
      }
    } catch {
      // Quiet regex fallback
    }

    // 3. Attempt Google Search Grounding with gemini-3.8-flash for real-time overview
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: `Provide a quick, concise 2-sentence real-time factual overview of ${contextInstruction}. Mention release year/status, lead stars/director or notable works, and key premise or fame. Keep it direct and factual without conversational filler.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      summary = response.text?.trim() || null;
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      for (const chunk of chunks as any[]) {
        if (chunk?.web?.uri) {
          webSources.push({
            title: chunk.web.title || "Google Search Source",
            url: chunk.web.uri,
          });
        }
      }
    } catch {
      // Quiet fallback to gemini-3.1-flash-lite without noisy logs
      try {
        const fallbackResponse = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: `Provide a quick, concise 2-sentence factual overview of ${contextInstruction}. Include release year or fame, starring cast or notable works, and brief plot or legacy. Keep it strictly 2 sentences, factual, and informative.`,
        });
        summary = fallbackResponse.text?.trim() || null;
      } catch {
        // Quiet fallback
      }
    }
  }

  // Regex fallback for year and title detection
  if (!entity) {
    const yearMatch = cleanQuery.match(/\b(19\d\d|20\d\d)\b/);
    if (yearMatch) {
      entity = {
        exactTitle: cleanQuery.replace(yearMatch[0], '').replace(/\s+/g, ' ').trim(),
        year: yearMatch[1],
        type: category === 'series' ? 'series' : 'movie',
      };
    }
  }

  // 4. Ensure verified Google & IMDb research sources exist
  if (webSources.length === 0) {
    const targetTitle = entity?.exactTitle || cleanQuery;
    const targetYear = entity?.year ? ` ${entity.year}` : '';
    const searchParam = encodeURIComponent(`${targetTitle}${targetYear} ${category === 'star' ? 'actor star' : 'movie series'}`);
    webSources = [
      {
        title: `Google: "${targetTitle}${targetYear}"`,
        url: `https://www.google.com/search?q=${searchParam}`,
      },
      {
        title: `Wikipedia Search`,
        url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(targetTitle)}`,
      }
    ];
  }

  const uniqueSources = webSources
    .filter((s, idx, arr) => arr.findIndex((x) => x.url === s.url) === idx)
    .slice(0, 4);

  const result = {
    summary,
    sources: uniqueSources,
    entity,
  };

  if (summary || entity) {
    // Cache the result
    if (groundingCache.size > 500) {
      const oldestKey = groundingCache.keys().next().value;
      if (oldestKey) groundingCache.delete(oldestKey);
    }
    groundingCache.set(cacheKey, { ...result, timestamp: Date.now() });
  }

  return res.json(result);
});

// Ad-free API stubs (All pre-roll and VAST ad endpoints permanently disabled)
app.get(["/api/vast-ad", "/api/media-preroll"], (_req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  return res.json({ hasAd: false });
});

app.get("/api/media-ad-stream", (_req, res) => {
  return res.status(204).end();
});

app.get("/api/vast-beacon", (_req, res) => {
  return res.status(204).end();
});


// Streamed Sports API Proxy (Protects against client DNS/adblock issues and guarantees 100% uptime)
app.use("/api/sports-stream", async (req, res) => {
  try {
    const rawSubpath = req.url.replace(/^\//, "").split("?")[0];
    if (!rawSubpath) {
      return res.status(400).json({ error: "Missing sports endpoint subpath" });
    }
    const queryString = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    const targetUrl = `https://streamed.pk/api/${rawSubpath}${queryString}`;

    const isImage = rawSubpath.startsWith("images") || rawSubpath.includes(".webp") || rawSubpath.includes(".png") || rawSubpath.includes(".jpg");

    if (isImage) {
      const imgRes = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "Referer": "https://streamed.pk/",
        },
      });

      if (!imgRes.ok) {
        return res.status(imgRes.status).send("Image not found");
      }

      const buffer = await imgRes.arrayBuffer();
      res.setHeader("Content-Type", imgRes.headers.get("content-type") || "image/webp");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(Buffer.from(buffer));
    }

    const upstreamRes = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
    });

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({ error: `Upstream error ${upstreamRes.status}` });
    }

    const contentType = upstreamRes.headers.get("content-type") || "";
    const text = await upstreamRes.text();

    if (!contentType.includes("application/json") && !text.trim().startsWith("{") && !text.trim().startsWith("[")) {
      return res.status(502).json({ error: "Upstream returned non-JSON response" });
    }

    try {
      const data = JSON.parse(text);
      res.setHeader("Cache-Control", "public, max-age=30");
      return res.json(data);
    } catch {
      return res.status(502).json({ error: "Invalid JSON from upstream" });
    }
  } catch (err: any) {
    return res.status(502).json({ error: "Stream API temporarily unavailable" });
  }
});

// Intelligent Multi-Server Availability Resolver & Failover Router (Server 1 -> Server 2 -> Server 3 -> Server 4)
const TMDB_RESOLVE_KEY = process.env.TMDB_API_KEY || "f4c3361d4917e9f25f79f339356eb8d9";
const playerResolveCache = new Map<string, { data: any; timestamp: number }>();
const play4uAvailabilityCache = new Map<string, { available: boolean; timestamp: number }>();

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 2800): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

app.get("/api/player/resolve", async (req, res) => {
  const rawType = String(req.query.type || "movie").toLowerCase();
  const isTv = rawType === "tv" || rawType === "series" || rawType === "shows";
  let tmdbId = String(req.query.tmdbId || "").trim();
  let imdbId = String(req.query.imdbId || "").trim();
  const season = Math.max(1, Number(req.query.s || req.query.season) || 1);
  const episode = Math.max(1, Number(req.query.e || req.query.episode) || 1);

  if (tmdbId.startsWith("tt") && !imdbId) {
    imdbId = tmdbId;
    tmdbId = "";
  }

  const cacheKey = `${isTv ? "tv" : "movie"}:${tmdbId}:${imdbId}:${season}:${episode}`;
  const cached = playerResolveCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.json(cached.data);
  }

  // 1. Cross-resolve missing TMDB / IMDb ID
  try {
    if (!tmdbId && imdbId.startsWith("tt")) {
      const findRes = await fetchWithTimeout(
        `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?api_key=${TMDB_RESOLVE_KEY}&external_source=imdb_id`,
        {},
        3000
      );
      if (findRes.ok) {
        const findData: any = await findRes.json();
        const match = isTv
          ? (findData.tv_results?.[0] || findData.movie_results?.[0])
          : (findData.movie_results?.[0] || findData.tv_results?.[0]);
        if (match?.id) tmdbId = String(match.id);
      }
    }

    if (tmdbId && (!imdbId || !imdbId.startsWith("tt"))) {
      const extRes = await fetchWithTimeout(
        `https://api.themoviedb.org/3/${isTv ? "tv" : "movie"}/${encodeURIComponent(tmdbId)}/external_ids?api_key=${TMDB_RESOLVE_KEY}`,
        {},
        3000
      );
      if (extRes.ok) {
        const extData: any = await extRes.json();
        if (extData?.imdb_id && String(extData.imdb_id).startsWith("tt")) {
          imdbId = String(extData.imdb_id);
        }
      }
    }
  } catch {}

  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/json,*/*;q=0.8",
  };

  // 2. Parallel availability checks for Server 1, Server 2 (Play4U), Server 4 (Nxsha)
  const checkServer1 = async (): Promise<boolean | "unknown"> => {
    if (!tmdbId) return false;
    try {
      if (isTv) {
        const s1Url = `https://raw.githubusercontent.com/Watchout2025/api/refs/heads/main/hls/tv/${encodeURIComponent(tmdbId)}/S${season}.json`;
        const r = await fetchWithTimeout(s1Url, { headers: browserHeaders }, 2500);
        if (r.status === 404) return false;
        if (!r.ok) return "unknown";
        const json: any = await r.json();
        return Boolean(json && json[String(episode)]);
      } else {
        const s1Url = `https://raw.githubusercontent.com/Watchout2025/api/refs/heads/main/hls/movie/${encodeURIComponent(tmdbId)}`;
        const r = await fetchWithTimeout(s1Url, { headers: browserHeaders }, 2500);
        if (r.status === 404) return false;
        if (!r.ok) return "unknown";
        const txt = (await r.text()).trim();
        return txt.length > 0 && !txt.toLowerCase().includes("not found");
      }
    } catch {
      return "unknown";
    }
  };

  const checkServer2 = async (): Promise<boolean | "unknown"> => {
    if (!imdbId || !imdbId.startsWith("tt")) return false;
    const sPad = String(season).padStart(2, "0");
    const ePad = String(episode).padStart(2, "0");
    const play4uUrl = isTv
      ? `https://play4u.org/series/${encodeURIComponent(imdbId)}/s-${sPad}/ep-${ePad}`
      : `https://play4u.org/${encodeURIComponent(imdbId)}`;
    try {
      const r = await fetchWithTimeout(play4uUrl, {
        headers: { ...browserHeaders, "Referer": "https://mooflix.online/" },
      }, 2800);
      if (r.status === 404 || r.status >= 500) return false;
      if (!r.ok) return "unknown";
      const html = await r.text();
      if (/<title>\s*Not found\s*<\/title>/i.test(html) || /Video not found\./i.test(html)) {
        return false;
      }
      return true;
    } catch {
      return "unknown";
    }
  };

  const checkServer4 = async (): Promise<boolean | "unknown"> => {
    if (!tmdbId) return false;
    const nxshaUrl = isTv
      ? `https://nxsha.space/embed/tv/${encodeURIComponent(tmdbId)}/${season}/${episode}?disable_ad=true&disable_ads=true&ads=0&no_ads=1`
      : `https://nxsha.space/embed/movie/${encodeURIComponent(tmdbId)}?disable_ad=true&disable_ads=true&ads=0&no_ads=1`;
    try {
      const r = await fetchWithTimeout(nxshaUrl, { headers: browserHeaders }, 2800);
      if (r.status === 404) return false;
      if (!r.ok) return false;
      const html = await r.text();
      if (html.includes("__next_error__") || /not\s*found/i.test(html.slice(0, 1200))) {
        return false;
      }
      return true;
    } catch {
      return "unknown";
    }
  };

  const [s1, s2, s4] = await Promise.all([checkServer1(), checkServer2(), checkServer4()]);

  const availability = {
    "1": s1,
    "2": s2,
    "3": "unknown" as const,
    "4": s4,
  };

  // Determine recommended server strictly in 1 -> 2 -> 3 -> 4 failover order:
  // If Server 1 has confirmed stream (or uncertain), prefer it unless confirmed false.
  // If Server 1 is false, try Server 2 (if confirmed true), else Server 3 (always loadable via browser Cloudflare challenge), else Server 4.
  let recommendedServer: "1" | "2" | "3" | "4" = "1";
  if (s1 === true) {
    recommendedServer = "1";
  } else if (s1 === false) {
    if (s2 === true) recommendedServer = "2";
    else if (s2 === "unknown") recommendedServer = "2";
    else recommendedServer = "3";
  } else {
    // s1 is unknown (e.g. timeout), keep 1 so proxy attempts and falls back cleanly via postMessage
    recommendedServer = "1";
  }

  const payload = {
    resolvedTmdbId: tmdbId || "",
    resolvedImdbId: imdbId || "",
    availability,
    recommendedServer,
  };

  if (playerResolveCache.size > 1000) {
    const oldest = playerResolveCache.keys().next().value;
    if (oldest) playerResolveCache.delete(oldest);
  }
  playerResolveCache.set(cacheKey, { data: payload, timestamp: Date.now() });

  res.setHeader("Cache-Control", "public, max-age=300");
  return res.json(payload);
});

// Clean Ad-Free Proxy for Server 1 (vidout.pages.dev) with instant Not-Found / Fallback Auto-Failover Hook
app.get("/api/player/proxy", async (req, res) => {
  const type = String(req.query.type || "movie").toLowerCase();
  const isTv = type === "tv" || type === "series";
  const tmdbId = String(req.query.tmdbId || req.query.id || "").trim();
  const season = Math.max(1, Number(req.query.s || req.query.season) || 1);
  const episode = Math.max(1, Number(req.query.e || req.query.episode) || 1);

  const sendFailoverNoticeHtml = (reason: string) => {
    res.removeHeader("X-Frame-Options");
    res.removeHeader("Content-Security-Policy");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Switching Server...</title></head>
<body style="background:#000;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;opacity:0.85;font-size:14px;">Stream unavailable on Server 1. Switching to Server 2...</div>
  <script>
    try { window.parent.postMessage({ type: 'MOOFLIX_PLAYER_NOT_FOUND', server: '1', reason: ${JSON.stringify(reason)} }, '*'); } catch(e){}
  </script>
</body></html>`);
  };

  if (!tmdbId) {
    return sendFailoverNoticeHtml("missing_tmdb_id");
  }

  const upstreamUrl = isTv
    ? `https://vidout.pages.dev/tv/${encodeURIComponent(tmdbId)}/S${season}/E${episode}`
    : `https://vidout.pages.dev/movie/${encodeURIComponent(tmdbId)}`;

  try {
    const upstreamRes = await fetchWithTimeout(upstreamUrl, {
      headers: {
        "User-Agent": (req.headers["user-agent"] as string) || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://vidout.pages.dev/",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    }, 5000);

    if (!upstreamRes.ok) {
      return sendFailoverNoticeHtml(`http_${upstreamRes.status}`);
    }

    let html = await upstreamRes.text();

    // Remove Google referrer redirect and ad network scripts
    html = html.replace(/window\.location\.replace\(\s*["']https:\/\/www\.google\.com\/?["']\s*\)/gi, "void 0");
    html = html.replace(/location\.replace\(\s*["']https:\/\/www\.google\.com\/?["']\s*\)/gi, "void 0");
    html = html.replace(/<script[^>]*src=["'](?:https?:)?\/\/[^"']*(?:wpadmngr|magsrv|ariososhands|popads|hilltopads|onclicka|acscdn|adsterra|monetag|quge5|capitalhospitals|optimserve|auctionr|heiressnicholasfitful|highperformanceformat|effectivecpmnetwork)[^"']*["'][^>]*?>\s*<\/script>/gi, "<!-- ad-removed -->");

    // Intercept showFallbackPlayer / displayError so instead of loading ad-heavy fallback or sticking on error, Server 2 takes over seamlessly
    const injectedHead = `
<base href="https://vidout.pages.dev/">
<meta name="referrer" content="no-referrer">
<script>
  (function() {
    var notified = false;
    function notifyFailover(reason) {
      if (notified) return;
      notified = true;
      try {
        window.parent.postMessage({ type: 'MOOFLIX_PLAYER_NOT_FOUND', server: '1', reason: reason || 'not_found' }, '*');
      } catch(e) {}
    }

    window.aclib = { runPop: function(){}, runAutoTag: function(){} };
    window.open = function() {
      return { close: function(){}, closed: true, focus: function(){}, blur: function(){}, postMessage: function(){}, location: { href: 'about:blank' } };
    };
    window.alert = function() { return null; };
    window.confirm = function() { return true; };

    // Trap fallback/error functions exposed globally on vidout
    var wrapFn = function(name, fn) {
      return function() {
        notifyFailover(name);
        return undefined;
      };
    };

    try {
      Object.defineProperty(window, 'showFallbackPlayer', {
        configurable: true,
        set: function() {},
        get: function() { return wrapFn('fallback_triggered'); }
      });
    } catch(e) {}

    window.addEventListener('DOMContentLoaded', function() {
      var checkDomError = function() {
        var text = (document.body && document.body.innerText ? document.body.innerText : '').toLowerCase();
        if (/(not found|video unavailable|no stream|no sources|media not found|failed to load video|episode not found|404 error)/.test(text)) {
          notifyFailover('dom_error_text');
        }
        var frames = document.querySelectorAll('iframe');
        for (var i = 0; i < frames.length; i++) {
          var s = (frames[i].getAttribute('src') || '').toLowerCase();
          if (s.includes('vidy.st')) {
            frames[i].removeAttribute('src');
            notifyFailover('vidy_fallback_blocked');
          }
        }
      };
      var obs = new MutationObserver(checkDomError);
      if (document.body) obs.observe(document.body, { childList: true, subtree: true, characterData: true });
      setTimeout(checkDomError, 1500);
      setTimeout(checkDomError, 4000);
    });
  })();
</script>
`;

    if (html.includes("<head>")) {
      html = html.replace("<head>", `<head>${injectedHead}`);
    } else if (html.includes("<html>")) {
      html = html.replace("<html>", `<html><head>${injectedHead}</head>`);
    } else {
      html = `<head>${injectedHead}</head>${html}`;
    }

    res.removeHeader("X-Frame-Options");
    res.removeHeader("Content-Security-Policy");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.send(html);
  } catch {
    return sendFailoverNoticeHtml("upstream_timeout");
  }
});

app.get(["/api/player/play4u", "/api/play4u"], async (req, res) => {
  const imdbId = (req.query.imdbId as string) || "";
  const tmdbId = (req.query.tmdbId as string) || "";
  const type = (req.query.type as string) === "series" || (req.query.type as string) === "tv" ? "tv" : "movie";
  const season = Math.max(1, Number(req.query.s || req.query.season) || 1);
  const episode = Math.max(1, Number(req.query.e || req.query.episode) || 1);

  const fallbackUrl = type === "movie"
    ? `https://rozgarlelo.modiplay.xyz/embed/tmdb/movie?id=${tmdbId || imdbId}`
    : `https://rozgarlelo.modiplay.xyz/embed/tmdb/tv?id=${tmdbId || imdbId}&s=${season}&e=${episode}`;

  if (!imdbId || !imdbId.startsWith("tt")) {
    return res.redirect(302, fallbackUrl);
  }

  const sPad = String(season).padStart(2, "0");
  const ePad = String(episode).padStart(2, "0");
  const play4uTarget = type === "movie"
    ? `https://play4u.org/${imdbId}`
    : `https://play4u.org/series/${imdbId}/s-${sPad}/ep-${ePad}`;

  const cacheKey = `${imdbId}-${type}-${season}-${episode}`;
  const cached = play4uAvailabilityCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < 12 * 60 * 60 * 1000) {
    return res.redirect(302, cached.available ? play4uTarget : fallbackUrl);
  }

  try {
    const checkRes = await fetchWithTimeout(play4uTarget, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://mooflix.online/",
      },
    }, 2500);

    const body = checkRes.ok ? await checkRes.text() : "";
    const isValid = checkRes.status === 200 && !/<title>\s*Not found\s*<\/title>/i.test(body) && !/Video not found\./i.test(body);
    play4uAvailabilityCache.set(cacheKey, { available: isValid, timestamp: now });
    return res.redirect(302, isValid ? play4uTarget : fallbackUrl);
  } catch {
    return res.redirect(302, fallbackUrl);
  }
});

// ondemand.st Official Live Sports API Proxy (with 60s memory caching)
let ondemandStreamsCache: { data: any; time: number } | null = null;
let ondemandPingCache: { data: any; time: number } | null = null;
let ppvVodsCache: { data: any; time: number } | null = null;

const ONDEMAND_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
};

app.get(["/api/ondemand/streams", "/api/sports/streams", "/api/ppv/streams"], async (_req, res) => {
  const now = Date.now();
  if (ondemandStreamsCache && now - ondemandStreamsCache.time < 60000) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.json(ondemandStreamsCache.data);
  }

  const getLocalSportsFallback = () => {
    try {
      const jsonPath = path.join(process.cwd(), "public/data/sports_streams.json");
      if (fs.existsSync(jsonPath)) {
        const raw = fs.readFileSync(jsonPath, "utf-8");
        const staticData = JSON.parse(raw);
        const categoriesMap = new Map<string, any[]>();
        const allEvents = [...(staticData['Live Events'] || []), ...(staticData['Upcoming Events'] || [])];
        allEvents.forEach((ev: any, idx: number) => {
          const cat = ev.category || 'Sports';
          if (!categoriesMap.has(cat)) categoriesMap.set(cat, []);
          categoriesMap.get(cat)!.push({
            id: ev.id || `ev-${idx}`,
            name: ev.name,
            poster: ev.poster || 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800',
            starts_at: ev.status === 'live' ? Math.floor(Date.now() / 1000) - 1800 : Math.floor(Date.now() / 1000) + 7200,
            ends_at: Math.floor(Date.now() / 1000) + 14400,
            category_name: cat,
            status: ev.status === 'live' ? 'live' : 'upcoming',
            league: cat,
            viewers: 15000 + (idx * 211) % 25000,
            always_live: ev.status === 'live' ? 1 : 0,
            sources: (ev.streams || []).map((s: any, sIdx: number) => ({
              source: s.name || `Server ${sIdx + 1}`,
              id: `${ev.id || idx}-s${sIdx + 1}`,
              name: s.name || `Server ${sIdx + 1}`,
              embed: s.url || '',
              hd: 1,
            })),
            iframe: ev.streams?.[0]?.url || '',
          });
        });
        const streams = Array.from(categoriesMap.entries()).map(([category, sList], i) => ({
          id: i + 1,
          category,
          streams: sList,
        }));
        return { success: true, timestamp: Math.floor(Date.now() / 1000), streams };
      }
    } catch {}
    return null;
  };

  try {
    const upstreamRes = await fetch("https://ondemand.st/papi/api/streams", {
      headers: ONDEMAND_HEADERS,
    });

    if (upstreamRes.ok) {
      const data = await upstreamRes.json();
      if (data && Array.isArray(data.streams) && data.streams.length > 0) {
        ondemandStreamsCache = { data, time: now };
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=60");
        return res.json(data);
      }
    }
  } catch (err: any) {
    // Upstream error handled by fallback below
  }

  const fallback = getLocalSportsFallback();
  if (fallback) {
    ondemandStreamsCache = { data: fallback, time: now };
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.json(fallback);
  }

  if (ondemandStreamsCache) return res.json(ondemandStreamsCache.data);
  return res.status(200).json({ success: true, streams: [] });
});

app.get(["/api/ondemand/ping", "/api/sports/ping"], async (_req, res) => {
  const now = Date.now();
  if (ondemandPingCache && now - ondemandPingCache.time < 60000) {
    return res.json(ondemandPingCache.data);
  }

  try {
    const upstreamRes = await fetch("https://ondemand.st/papi/api/ping", {
      headers: ONDEMAND_HEADERS,
    });
    const data = await upstreamRes.json();
    ondemandPingCache = { data, time: now };
    return res.json(data);
  } catch (err: any) {
    return res.json({ success: true, timestamp: Math.floor(Date.now() / 1000) });
  }
});

app.get("/api/ppv/vods", async (req, res) => {
  const now = Date.now();
  if (ppvVodsCache && now - ppvVodsCache.time < 60000) {
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.json(ppvVodsCache.data);
  }

  try {
    const upstreamRes = await fetch("https://api.ppv.st/api/vods", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
    });

    if (!upstreamRes.ok) {
      if (ppvVodsCache) return res.json(ppvVodsCache.data);
      return res.status(upstreamRes.status).json({ error: "Failed to fetch VODs" });
    }

    const data = await upstreamRes.json();
    ppvVodsCache = { data, time: now };
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.json(data);
  } catch (err: any) {
    if (ppvVodsCache) return res.json(ppvVodsCache.data);
    return res.status(502).json({ error: "PPV.st VODs unreachable" });
  }
});

app.get("/api/ppv/vods/:id", async (req, res) => {
  const vodId = req.params.id;
  try {
    const upstreamRes = await fetch(`https://api.ppv.st/api/vods/${vodId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
    });
    const data = await upstreamRes.json();
    return res.json(data);
  } catch (err: any) {
    return res.status(502).json({ error: "Failed to fetch VOD details" });
  }
});

// Proxy for JW Player & Clappr bundles from upstream sports CDN
app.get(["/js/bundle-jw.js", "/js/bundle.js"], async (req, res) => {
  try {
    const upstreamUrl = `https://taifood-blog.asia${req.path}`;
    const upstreamRes = await fetch(upstreamUrl, {
      headers: {
        "User-Agent": (req.headers["user-agent"] as string) || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://taifood-blog.asia/",
      },
    });
    if (!upstreamRes.ok) {
      return res.status(404).send("/* Bundle not found upstream */");
    }
    const js = await upstreamRes.text();
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.send(js);
  } catch (err: any) {
    console.error("Bundle proxy error:", err);
    return res.status(502).send("/* Failed to load bundle */");
  }
});

// Proxy for damitv stream player scripts and HLS assets
app.get(["/js/xk7m9p2.js", "/js/adgeo.js"], async (req, res) => {
  try {
    const upstreamUrl = `https://damitv.st${req.originalUrl}`;
    const upstreamRes = await fetch(upstreamUrl, {
      headers: {
        "User-Agent": (req.headers["user-agent"] as string) || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://damitv.st/",
      },
    });
    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).send("/* Asset not found upstream */");
    }
    const contentType = upstreamRes.headers.get("content-type") || "application/javascript";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    const buffer = await upstreamRes.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (err: any) {
    return res.status(502).send("/* Asset proxy error */");
  }
});

app.use("/player", async (req, res) => {
  try {
    const upstreamUrl = `https://damitv.st${req.originalUrl}`;
    const upstreamRes = await fetch(upstreamUrl, {
      headers: {
        "User-Agent": (req.headers["user-agent"] as string) || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://damitv.st/",
      },
    });
    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).send("/* Player not found upstream */");
    }
    const contentType = upstreamRes.headers.get("content-type") || "text/html; charset=utf-8";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    const buffer = await upstreamRes.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (err: any) {
    return res.status(502).send("/* Player proxy error */");
  }
});

// 219+ Live Sports & Entertainment Channels API
app.get("/api/sports-channels", (_req, res) => {
  try {
    const jsonPath = path.join(process.cwd(), "public/data/sports_streams.json");
    if (!fs.existsSync(jsonPath)) {
      return res.status(404).json({ error: "Sports data not found" });
    }
    const rawData = fs.readFileSync(jsonPath, "utf-8");
    const data = JSON.parse(rawData);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to load sports channels" });
  }
});

// Clean Stream Embed Proxy (Neutralizes third-party popup ads, click-hijackers, and sandboxing errors)
app.get(["/api/clean-stream", "/api/sports-embed"], async (req, res) => {
  try {
    const embedUrl = req.query.url as string;
    if (!embedUrl || !embedUrl.startsWith("http")) {
      return res.status(400).send("Invalid stream embed URL");
    }

    const targetUrl = new URL(embedUrl);
    const isDamitv = targetUrl.hostname.includes("damitv.st");
    const defaultUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

    const sendAutoFailoverPage = (reason: string) => {
      res.removeHeader("X-Frame-Options");
      res.removeHeader("Content-Security-Policy");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      return res.status(200).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#000;color:#ccc;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;text-align:center;font-size:13px}</style></head><body><div>Switching to next working server...</div><script>try{window.parent.postMessage({type:'MOOFLIX_SPORTS_ERROR',reason:${JSON.stringify(reason)}},'*');}catch(e){}</script></body></html>`);
    };

    // Upstream stream hosters require appropriate Referer & full browser UA
    const upstreamRes = await fetch(embedUrl, {
      headers: {
        "User-Agent": (req.headers["user-agent"] as string) || defaultUA,
        "Referer": isDamitv ? "https://ondemand.st/" : `${targetUrl.origin}/`,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!upstreamRes.ok) {
      return sendAutoFailoverPage(`upstream_http_${upstreamRes.status}`);
    }

    let html = await upstreamRes.text();

    if (/Worker threw exception|cf-error-details|<title>\s*(403 Forbidden|502 Bad Gateway|500 Internal Server Error)/i.test(html)) {
      return sendAutoFailoverPage("upstream_cf_error");
    }

    // Special handler for bintv-sources: neutralize aclib popup and pre-check inner iframe worker health
    if (embedUrl.includes("bintv-sources.pages.dev")) {
      const idParam = targetUrl.searchParams.get("id") || "";
      if (idParam) {
        try {
          const decodedUrl = Buffer.from(idParam, "base64").toString("utf8");
          if (decodedUrl.startsWith("http")) {
            const probeRes = await fetchWithTimeout(decodedUrl, {
              method: "GET",
              headers: {
                "User-Agent": defaultUA,
                "Referer": "https://bintv-sources.pages.dev/",
              },
            }, 2500);
            if (!probeRes.ok) {
              return sendAutoFailoverPage(`bintv_worker_${probeRes.status}`);
            }
          }
        } catch {
          return sendAutoFailoverPage("bintv_worker_unreachable");
        }
        html = html.replace(/var encoded\s*=\s*[^;]+;/g, `var encoded = "${idParam}";`);
      }
      html = html.replace(/<script[^>]*src=["'](?:https?:)?\/\/[^"']*(?:acscdn|capitalhospitals|optimserve|quge5|adsterra|monetag)[^"']*["'][^>]*?>\s*<\/script>/gi, "<!-- ad-script-neutralized -->");
      html = html.replace(/<script[^>]*>[\s\S]*?aclib\.runPop[\s\S]*?<\/script>/gi, "<!-- aclib-neutralized -->");
    }

    // 1. Neuter the sandboxed detector checks inside the player bundle script WITHOUT wiping the player engine
    html = html.replace(/isSandboxed\(\)\s*\{return this\.#pe\}/g, "isSandboxed(){return false}");
    html = html.replace(/this\.#s\.isSandboxed\(\)/g, "false");
    html = html.replace(/showSandboxWarningOverlay\(\)\s*\{/g, "showSandboxWarningOverlay(){return;");
    html = html.replace(/#be\(\)\s*\{const e=document\.createElement\("div"\);e\.id="sbxwo"/g, "#be(){return;const e=document.createElement(\"div\");e.id=\"sbxwo\"");

    // 2. Point player bundle script directly to taifood-blog.asia so bundle-jw.js loads without localhost 404
    html = html.replace(/var a=location\.protocol\+["'\s]*\+?["']\/\/["']\s*\+?\s*location\.host/g, `var a="${targetUrl.origin}"`);
    html = html.replace(/var a=location\.protocol\+"(\/\/)"\+location\.host/g, `var a="${targetUrl.origin}"`);

    // 3. Remove standalone ad popups & intrusive network trackers
    html = html.replace(/<script[^>]*>\s*aclib\.runPop[\s\S]*?<\/script>/gi, "<!-- aclib-neutralized -->");
    html = html.replace(/<script[^>]*src=["'](?:https?:)?\/\/[^"']*(?:wpadmngr|magsrv|ariososhands|popads|hilltopads|onclicka|acscdn|capitalhospitals|optimserve|quge5|auctionr|heiressnicholasfitful|highperformanceformat|adsterra|monetag|effectivecpmnetwork|llvpn|doubleclick|googlesyndication)[^"']*["'][^>]*?>\s*<\/script>/gi, "<!-- ad-script-neutralized -->");
    html = html.replace(/<script[^>]*>[\s\S]*?(?:ariososhands|wpadmngr|magsrv|atOptions|popads|hilltopads|onclicka)[\s\S]*?<\/script>/gi, "<!-- ad-inline-neutralized -->");

    // 4. Remove hidden ad iframes & click-under overlays
    html = html.replace(/<iframe[^>]*?(?:visibility:\s*hidden|display:\s*none)[^>]*?>[\s\S]*?<\/iframe>/gi, "");

    // 5. Inject anti-sandbox bypass, dummy window.open, CSS hiding for sbxwo, and sports stream failover watcher
    const antiAdShield = `
<base href="${targetUrl.origin}/">
<meta name="referrer" content="no-referrer-when-downgrade">
<style>
  #sbxwo, [id*="sbx"], .sandbox-warning, div[style*="z-index: 10000"], div[style*="zIndex: 1e4"], div[style*="z-index: 2147483647"], div[style*="z-index: 999999"], div:has(> p:contains("Sandbox")) {
    display: none !important;
    opacity: 0 !important;
    pointer-events: none !important;
    visibility: hidden !important;
    height: 0 !important;
    width: 0 !important;
  }
</style>
<script>
  (function() {
    window.aclib = { runPop: function() {}, runAutoTag: function() {} };
    window.open = function() {
      return {
        close: function() {},
        closed: true,
        focus: function() {},
        blur: function() {},
        postMessage: function() {},
        location: { href: 'about:blank' }
      };
    };
    window.alert = function() { return null; };
    window.confirm = function() { return true; };
    try {
      Object.defineProperty(window, 'onbeforeunload', { configurable: false, writable: false, value: null });
    } catch(e) {}

    var reportedSportsErr = false;
    function notifySportsFail(reason) {
      if (reportedSportsErr) return;
      reportedSportsErr = true;
      try {
        window.parent.postMessage({ type: 'MOOFLIX_SPORTS_ERROR', reason: reason || 'stream_error' }, '*');
      } catch(e) {}
    }

    window.addEventListener('DOMContentLoaded', function() {
      var checkStreamHealth = function() {
        var text = (document.body && document.body.innerText ? document.body.innerText : '').toLowerCase();
        var vid = document.querySelector('video');
        var hasPlayingVideo = Boolean(vid && vid.readyState >= 2 && !vid.error);
        if (!hasPlayingVideo && /(stream unavailable|not found|channel offline|stream offline|no stream|404 error|media could not be loaded)/.test(text)) {
          notifySportsFail('offline_or_not_found');
        }
      };
      var obs = new MutationObserver(checkStreamHealth);
      if (document.body) obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(checkStreamHealth, 3500);
    });
  })();
</script>
`;

    if (html.includes("<head>")) {
      html = html.replace("<head>", "<head>" + antiAdShield);
    } else if (html.includes("<html>")) {
      html = html.replace("<html>", "<html><head>" + antiAdShield + "</head>");
    } else {
      html = "<head>" + antiAdShield + "</head>" + html;
    }

    // Permissive frame headers so iframe renders smoothly without sandbox restrictions
    res.removeHeader("X-Frame-Options");
    res.removeHeader("Content-Security-Policy");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.send(html);
  } catch (err: any) {
    console.error("Sports Embed proxy error:", err?.message || err);
    return res.status(502).send("Unable to load clean stream embed.");
  }
});

// Clean Ad-Shielded Moonflix Player Proxy (Neutralizes ariososhands popunders, ad-free Hexon & clean Ranger)
async function serveCleanMoonflixHtml(req: any, res: any, upstreamPath: string) {
  try {
    const upstreamUrl = `https://player.moonflix.website${upstreamPath}`;
    const upstreamRes = await fetch(upstreamUrl, {
      headers: {
        "User-Agent": (req.headers["user-agent"] as string) || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://player.moonflix.website/",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).send(`Failed to load player (${upstreamRes.status})`);
    }

    let html = await upstreamRes.text();

    // 1. Strip the popunder ad script (aj.ariososhands.com) that triggers ads when clicking on the player or on the servers button!
    html = html.replace(/<script[^>]*ariososhands[^>]*>[\s\S]*?<\/script>/gi, "<!-- ad-script-neutralized -->");
    html = html.replace(/<script[^>]*src=["'](?:https?:)?\/\/[^"']*(?:capitalhospitals|optimserve|quge5|auctionr|heiressnicholasfitful|highperformanceformat|adsterra|monetag|effectivecpmnetwork|llvpn)[^"']*["'][^>]*?>\s*<\/script>/gi, "<!-- ad-script-neutralized -->");
    html = html.replace(/<script[^>]*rocket-loader[^>]*>[\s\S]*?<\/script>/gi, "");

    // 2. Normalize module scripts from Cloudflare rocket-loader
    html = html.replace(/type="[a-f0-9]+-module"/gi, 'type="module"');
    html = html.replace(/type="[a-f0-9]+-text\/javascript"/gi, '');

    // 3. Point main.js to our clean proxy so servers.js is ad-shielded
    html = html.replace(/\/main\.js\?v=\d+/gi, '/api/moonflix-player/main.js');
    html = html.replace(/\/styles\.css\?v=\d+/gi, 'https://player.moonflix.website/styles.css?v=7');

    // 4. Inject comprehensive Anti-Popup & Anti-Click-Hijack script
    const antiAdShield = `
<script>
  (function() {
    window.open = function(url) {
      console.warn('[MooFlix AdShield] Blocked popup window.open:', url);
      return null;
    };
    window.alert = function() { return null; };
    window.confirm = function() { return true; };
    document.addEventListener('click', function(e) {
      const a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (a && a.target === '_blank') {
        const href = a.getAttribute('href') || '';
        if (!href.startsWith('https://player.moonflix.website') && !href.startsWith('/')) {
          e.preventDefault();
          e.stopPropagation();
          console.warn('[MooFlix AdShield] Blocked unexpected blank link click:', href);
        }
      }
    }, true);
  })();
</script>
`;

    if (html.includes("<head>")) {
      html = html.replace("<head>", "<head>" + antiAdShield);
    } else {
      html = antiAdShield + html;
    }

    res.removeHeader("X-Frame-Options");
    res.removeHeader("Content-Security-Policy");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.send(html);
  } catch (err: any) {
    console.error("Moonflix HTML proxy error:", err);
    return res.status(502).send("Unable to load player");
  }
}

app.get("/api/moonflix-player/movie/:id", (req, res) => {
  return serveCleanMoonflixHtml(req, res, `/movie/${req.params.id}`);
});

app.get("/api/moonflix-player/tv/:id/S:season/E:episode", (req, res) => {
  return serveCleanMoonflixHtml(req, res, `/tv/${req.params.id}/S${req.params.season}/E${req.params.episode}`);
});

app.get("/api/moonflix-player/tv/:id/:season/:episode", (req, res) => {
  return serveCleanMoonflixHtml(req, res, `/tv/${req.params.id}/${req.params.season}/${req.params.episode}`);
});

app.get("/api/moonflix-player/main.js", async (_req, res) => {
  try {
    const upstreamRes = await fetch("https://player.moonflix.website/main.js?v=4");
    let code = await upstreamRes.text();
    code = code.replace(
      "from './components/player-shell.js'",
      "from '/api/moonflix-player/components/player-shell.js'"
    );
    code = code.replace(
      "`/player/${file}?v=19`",
      "`/api/moonflix-player/player/${file}?v=19`"
    );
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(code);
  } catch (err) {
    console.error("Moonflix main.js proxy error:", err);
    return res.status(502).send("/* Failed to load main.js */");
  }
});

app.get("/api/moonflix-player/components/player-shell.js", async (_req, res) => {
  try {
    const upstreamRes = await fetch("https://player.moonflix.website/components/player-shell.js");
    const code = await upstreamRes.text();
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(code);
  } catch (err) {
    return res.status(502).send("/* Failed to load player-shell.js */");
  }
});

app.get("/api/moonflix-player/player/:file", async (req, res) => {
  const file = req.params.file;
  try {
    const upstreamRes = await fetch(`https://player.moonflix.website/player/${file}?v=19`);
    let code = await upstreamRes.text();

    if (file === "servers.js") {
      // 1. Rewrite Hexon with anti-ad flags: disable_ads=true, no_ads=1, disable_app_ads=true, ads=0
      code = code.replace(
        /url:\s*`https:\/\/nxsha\.space\/embed\/movie\/\$\{media\.id\}`/g,
        "url: `https://nxsha.space/embed/movie/${media.id}?server=MbPly&sub=hi&disable_dl_button=true&color=netflix&lang=en&disable_app_ad=true&disable_app_ads=true&disable_ad=true&disable_ads=true&ads=0&no_ads=1&auto_start=true`"
      );
      code = code.replace(
        /url:\s*`https:\/\/nxsha\.space\/embed\/tv\/\$\{media\.id\}\/\$\{media\.season\}\/\$\{media\.episode\}`/g,
        "url: `https://nxsha.space/embed/tv/${media.id}/${media.season}/${media.episode}?server=MbPly&sub=hi&disable_dl_button=true&color=netflix&lang=en&disable_app_ad=true&disable_app_ads=true&disable_ad=true&disable_ads=true&ads=0&no_ads=1&auto_start=true`"
      );

      // 2. Rewrite Ranger so it is proxied through clean embed proxy (strips all popunders and ad networks)
      code = code.replace(
        /url:\s*`https:\/\/rozgarlelo\.modiplay\.xyz\/embed\/tmdb\/movie\?id=\$\{media\.id\}`/g,
        "url: `/api/clean-stream?url=${encodeURIComponent('https://rozgarlelo.modiplay.xyz/embed/tmdb/movie?id=' + media.id)}`"
      );
      code = code.replace(
        /url:\s*`https:\/\/rozgarlelo\.modiplay\.xyz\/embed\/tmdb\/tv\?id=\$\{media\.id\}&s=\$\{media\.season\}&e=\$\{media\.episode\}`/g,
        "url: `/api/clean-stream?url=${encodeURIComponent('https://rozgarlelo.modiplay.xyz/embed/tmdb/tv?id=' + media.id + '&s=' + media.season + '&e=' + media.episode)}`"
      );
    }

    if (file === "controls.js") {
      // Enhance mobile landscape locking on fullscreen
      code = code.replace(
        "function lockLandscape() {",
        "function lockLandscape() { try { window.parent?.postMessage({ type: 'MOOFLIX_LOCK_LANDSCAPE' }, '*'); } catch(e){} "
      );
      code = code.replace(
        "function unlockOrientation() {",
        "function unlockOrientation() { try { window.parent?.postMessage({ type: 'MOOFLIX_UNLOCK_ORIENTATION' }, '*'); } catch(e){} "
      );
      code = code.replace(
        ".then(() => { if (isMobileDevice()) lockLandscape(); })",
        ".then(() => { lockLandscape(); })"
      );
    }

    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(code);
  } catch (err) {
    return res.status(502).send("/* Failed to load player file */");
  }
});

/**
 * Proxy for In-App Download pages to override yellow accents to MooFlix Cinema Red
 */
app.get("/api/download-proxy", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl || !targetUrl.startsWith("http")) {
    return res.status(400).send("Invalid target URL");
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!upstreamRes.ok) {
      return res.redirect(targetUrl);
    }

    let html = await upstreamRes.text();

    const baseTag = `<base href="${targetUrl}">`;

    // Red Theme Overrides replacing all yellow/gold/amber accents
    const redThemeOverrides = `
<style id="mooflix-red-download-theme">
  :root {
    --primary: #e50914 !important;
    --primary-rgb: 229, 9, 20 !important;
    --primary-color: #e50914 !important;
    --accent: #ff2a38 !important;
    --yellow-400: #e50914 !important;
    --yellow-500: #e50914 !important;
    --amber-400: #e50914 !important;
    --amber-500: #e50914 !important;
  }
  
  /* Replace yellow borders and outlines */
  [style*="#FFE259"], [style*="#FFA751"], [style*="rgba(255, 204, 0"], [style*="rgba(245, 158, 11"],
  [class*="yellow"], [class*="amber"], [class*="gold"] {
    border-color: #e50914 !important;
  }

  /* Replace yellow gradient backgrounds */
  [style*="linear-gradient(135deg, #FFE259"], [style*="linear-gradient(90deg, #FFE259"],
  [style*="background: linear-gradient(135deg, rgb(255, 226, 89)"] {
    background: linear-gradient(135deg, #e50914 0%, #b81d24 100%) !important;
    -webkit-background-clip: text !important;
    -webkit-text-fill-color: #ff3b47 !important;
    color: #ff3b47 !important;
  }

  /* Target radial gradients */
  [style*="radial-gradient(circle, rgba(255, 204, 0"] {
    background: radial-gradient(circle, rgba(229, 9, 20, 0.15) 0%, rgba(0,0,0,0) 70%) !important;
  }

  /* Download Action Buttons & Links */
  a[href*="download"], a[download], button, .btn, [role="button"], [class*="download"] {
    background: linear-gradient(to right, #e50914, #b81d24) !important;
    color: #ffffff !important;
    border-color: #ff3844 !important;
    box-shadow: 0 4px 18px rgba(229, 9, 20, 0.4) !important;
  }

  /* SVGs, icons, and path fills */
  svg path[stroke*="#FFE259"], svg path[stroke*="#FFA751"], svg path[fill*="#FFE259"], svg path[fill*="#FFA751"],
  svg text, svg[class*="yellow"], svg[class*="amber"] {
    stroke: #ff3344 !important;
    fill: #ff3344 !important;
  }
</style>
`;

    if (html.includes("<head>")) {
      html = html.replace("<head>", `<head>${baseTag}${redThemeOverrides}`);
    } else {
      html = `<head>${baseTag}${redThemeOverrides}</head>` + html;
    }

    res.removeHeader("X-Frame-Options");
    res.removeHeader("Content-Security-Policy");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.send(html);
  } catch (err: any) {
    console.error("Download proxy error, redirecting:", err?.message || err);
    return res.redirect(targetUrl);
  }
});

// Vite middleware for development & Dynamic SSR Prerender in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: "spa",
    });

    app.use(async (req, res, next) => {
      const url = req.originalUrl || req.url;
      // If client/Googlebot is requesting an HTML page route (not api or static asset)
      if (req.method === 'GET' && !url.startsWith('/api') && !url.includes('.') && req.headers.accept?.includes('text/html')) {
        try {
          const indexHtmlPath = path.join(process.cwd(), 'index.html');
          let template = fs.readFileSync(indexHtmlPath, 'utf-8');
          template = await vite.transformIndexHtml(url, template);
          const rendered = renderPageWithSeo(template, url);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('X-Robots-Tag', 'index, follow');
          return res.status(200).send(rendered);
        } catch (e) {
          next(e);
        }
      } else {
        vite.middlewares(req, res, next);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const distIndex = path.join(distPath, 'index.html');
    const template = fs.existsSync(distIndex) ? fs.readFileSync(distIndex, 'utf-8') : '';

    app.use(express.static(distPath, { index: false }));

    app.use((req, res) => {
      const url = req.path;
      if (template) {
        const rendered = renderPageWithSeo(template, url);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('X-Robots-Tag', 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
        return res.status(200).send(rendered);
      }
      res.sendFile(distIndex);
    });
  }

  const httpServer = http.createServer(app);

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
