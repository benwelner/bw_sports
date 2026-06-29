import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import ical from 'node-ical'; // Required for Dynamic iCal fetching

console.log("🏁 SCRIPT INITIALIZED: World Cup & Motorsports Sync...");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("💥 CRITICAL FAILURE: Missing Supabase credentials in .env file.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// 0. TRANSLATION LAYER
// ==========================================
let teamCache = new Map();

// CONSOLIDATED FAVORITES ARRAY (Official Names Only)
const FAVORITE_TEAMS = [
  "CANADA", "CAROLINA HURRICANES", "CAROLINA PANTHERS", "CHARLOTTE HORNETS"
];

function isFavorite(event) {
  const home = event.home_team ? event.home_team.toUpperCase() : "";
  const away = event.away_team ? event.away_team.toUpperCase() : "";
  return FAVORITE_TEAMS.some(fav => home.includes(fav) || away.includes(fav));
}

async function loadTeamCache() {
  console.log("📥 LOADING TEAM MAPPINGS DICTIONARY...");
  try {
    const { data, error } = await supabase.from('team_mappings').select('league, api_id, full_name');
    if (error) throw error;
    data.forEach(m => {
      const key = `${m.league.toUpperCase()}|${m.api_id.toUpperCase()}`;
      teamCache.set(key, m.full_name);
    });
    console.log(`✅ Cached ${teamCache.size} team mappings.`);
  } catch (err) {
    console.error("⚠️ Failed to load team mappings.", err.message);
  }
}

const currentYear = new Date().getFullYear();
const targetSeasons = [currentYear, currentYear + 1];

// ==========================================
// 1. UNIVERSAL STATIC ADAPTER
// ==========================================
class UniversalStaticAdapter {
  constructor(leagueName, icon, folderName, defaultLogo = '') {
    this.name = `${leagueName} Static JSON`;
    this.leagueName = leagueName;
    this.icon = icon;
    this.folderName = folderName;
    this.defaultLogo = defaultLogo;
  }

  async fetchEvents() {
    let normalizedEvents = [];
    
    // URL CLEANER & LOCAL PATH INTERCEPTOR
    const extractUrl = (str) => {
      if (!str || typeof str !== 'string') return '';
      let cleaned = str.trim();
      if (cleaned === 'null' || cleaned === '') return '';

      // 1. Extract URL if trapped in Markdown format [url](url)
      const match = cleaned.match(/\[.*?\]\((.*?)\)/);
      if (match && match.length > 1) {
        cleaned = match.at(1); // Using .at(1) prevents any bracket parsing issues
      }

      // Safety fallback in case parsing fails
      if (!cleaned) return '';

      // 2. Next.js Public Folder Interceptor
      if (cleaned.includes('/logos/')) {
        const filename = cleaned.split('/').pop(); 
        cleaned = `/logos/${filename}`;
      }

      return cleaned;
    };

    for (const season of targetSeasons) {
      // CACHE BUSTER ADDED HERE: ?v=${Date.now()} forces GitHub to bypass cache
      const url = `https://raw.githubusercontent.com/benwelner/bw_sports/main/_db/${this.folderName}/${season}.json?v=${Date.now()}`;
      try {
        const response = await fetch(url);
        // If the JSON for a specific year (like 2027) doesn't exist yet, we just skip smoothly
        if (!response.ok) continue;

        const rawData = await response.json();
        
        const events = rawData.map((event) => ({
          slug: event.slug,
          league_name: this.leagueName,
          event_name: event.event_name ?? `${event.away_team ?? 'TBD'} AT ${event.home_team ?? 'TBD'}`,
          sub_text: event.sub_text ?? '',
          display_clock: event.display_clock ?? '',
          start_time: event.start_time,
          status: event.status ?? 'pre',
          icon_primary: this.icon,
          home_team: event.home_team ?? 'TBD',
          away_team: event.away_team ?? '',
          home_score: event.home_score ?? '0',
          away_score: event.away_score ?? '0',
          // Cleans markdown out of the URLs, overrides old paths, and falls back to defaultLogo securely
          home_logo: extractUrl(event.home_logo) || this.defaultLogo || '',
          away_logo: extractUrl(event.away_logo) || ''
        }));
        
        normalizedEvents = normalizedEvents.concat(events);
      } catch (error) {
        console.error(`🛑 [${this.name}] Fetch failed for ${season}:`, error.message);
      }
    }
    return normalizedEvents;
  }
}

// ==========================================
// 2. ORCHESTRATOR
// ==========================================
async function chunkedUpsert(events, syncStartTime) {
  const CHUNK_SIZE = 500;
  for (let i = 0; i < events.length; i += CHUNK_SIZE) {
    const chunk = events.slice(i, i + CHUNK_SIZE).map(e => ({ ...e, last_updated_at: syncStartTime }));
    const { error } = await supabase.from('events').upsert(chunk, { onConflict: 'slug' });
    if (error) throw error;
  }
}

async function syncLeagues() {
  const syncStartTime = new Date().toISOString();
  const currentMs = new Date(syncStartTime).getTime();
  await loadTeamCache();

  // Clean, unified initialization
  const adapters = [
    new UniversalStaticAdapter('FORMULA 1', '🏎️', 'f1'),
    new UniversalStaticAdapter('FORMULA 2', '🏁', 'f2'),
    new UniversalStaticAdapter('FORMULA 3', '🏁', 'f3'),
    new UniversalStaticAdapter('F1 ACADEMY', '🏁', 'f1_academy'),
    new UniversalStaticAdapter('INDYCAR', '🏎️', 'indycar'),
    new UniversalStaticAdapter('INDYNXT', '🏁', 'indynxt'),
    new UniversalStaticAdapter('NHL', '🏒', 'nhl'),
    new UniversalStaticAdapter('NBA', '🏀', 'nba'),
    new UniversalStaticAdapter('NFL', '🏈', 'nfl'),
    new UniversalStaticAdapter('WORLD CUP', '⚽', 'world_cup'),
    new UniversalStaticAdapter('NASCAR CUP', '🏁', 'nascar_cup'),
    new UniversalStaticAdapter('NASCAR XFINITY', '🏁', 'nascar_xfinity'),
    new UniversalStaticAdapter('NASCAR TRUCKS', '🏁', 'nascar_trucks'),
    new UniversalStaticAdapter('ARCA MENARDS', '🏁', 'arca_menards'),
    new UniversalStaticAdapter('ARCA EAST', '🏁', 'arca_east'),
    new UniversalStaticAdapter('ARCA WEST', '🏁', 'arca_west'),
    new UniversalStaticAdapter('WEC', '🏎️', 'wec'),
    new UniversalStaticAdapter('IMSA', '🏎️', 'imsa'),
    new UniversalStaticAdapter('SUPERCARS', '🏎️', 'supercars'),
    new UniversalStaticAdapter('NÜRBURGRING 24H', '🏁', 'nurburgring'),
    new UniversalStaticAdapter('CARS TOUR', '🏁', 'cars_tour'),
    new UniversalStaticAdapter('ASIAN LE MANS', '🏎️', 'asian_le_mans'),
    new UniversalStaticAdapter('ADAC GT MASTERS', '🏎️', 'adac_gt_masters'),
    new UniversalStaticAdapter('EXTREME H', '🏁', 'extreme_h'),
    new UniversalStaticAdapter('EUROPEAN LE MANS', '🏎️', 'european_le_mans'),
    new UniversalStaticAdapter('SUPER FORMULA', '🏎️', 'super_formula'),
    new UniversalStaticAdapter('BTCC', '🏎️', 'btcc'),
    new UniversalStaticAdapter('DAKAR RALLY', '🏁', 'dakar_rally')
  ];

  const uniqueEvents = new Map();
  for (const adapter of adapters) {
    console.log(`⚙️ Syncing ${adapter.name}...`);
    try {
      const events = await adapter.fetchEvents();
      events.forEach(e => {
        if (e.start_time && !e.start_time.includes("undefined")) {
          uniqueEvents.set(e.slug, e);
        }
      });
    } catch (err) {
      console.error(`💥 Adapter ${adapter.name} failed:`, err.message);
    }
  }

  const eventsToSave = Array.from(uniqueEvents.values());
  if (eventsToSave.length > 0) {
    console.log(`\n💾 Upserting ${eventsToSave.length} total events to Supabase...`);
    await chunkedUpsert(eventsToSave, syncStartTime);
    
    // MODIFIED CLEANUP LOGIC: ARCHIVE MODE
    console.log(`\n🧹 Executing custom retention cleanup...`);
    const { data: staleRecords, error: fetchError } = await supabase
      .from('events')
      .select('slug, start_time')
      .lt('last_updated_at', syncStartTime);

    if (fetchError) {
      console.error(`💥 Failed to fetch stale records:`, fetchError.message);
    } else if (staleRecords && staleRecords.length > 0) {
      const slugsToDelete = [];
      staleRecords.forEach(record => {
        const startMs = new Date(record.start_time).getTime();
        // Because we are an archive now, we ONLY delete future events that disappeared 
        // from your JSON file (which implies they were cancelled or moved). 
        // We do NOT delete old games.
        if (startMs > currentMs) {
          slugsToDelete.push(record.slug);
        }
      });
      
      if (slugsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('events')
          .delete()
          .in('slug', slugsToDelete);
          
        if (deleteError) {
          console.error(`💥 Failed to delete stale records:`, deleteError.message);
        } else {
          console.log(`✅ Cleaned up ${slugsToDelete.length} cancelled future events.`);
        }
      } else {
        console.log(`✅ No cancelled future events met deletion criteria. Past schedules safely retained as archive.`);
      }
    } else {
      console.log(`✅ No stale records found.`);
    }
  }

  console.log("\n🏆 MASTER SYNC COMPLETE!");
}

syncLeagues();