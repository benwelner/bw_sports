import 'dotenv/config'; 
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import ical from 'node-ical'; // <-- NEW DEPENDENCY

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
  "CANADA", 
  "CAROLINA HURRICANES", 
  "CAROLINA PANTHERS", 
  "CHARLOTTE HORNETS"
];

function isFavorite(event) {
  const home = event.home_team ? event.home_team.toUpperCase() : "";
  const away = event.away_team ? event.away_team.toUpperCase() : "";
  return FAVORITE_TEAMS.some(fav => home.includes(fav) || away.includes(fav));
}

// We'll keep loadTeamCache intact in case you ever need mapping,
// but our new Static JSONs should natively have the correct names.
async function loadTeamCache() {
  console.log("📥 LOADING TEAM MAPPINGS DICTIONARY...");
  try {
    const { data, error } = await supabase.from('team_mappings').select('league, api_id, full_name');
    if (error) throw error;
    data.forEach(m => {
      const key = `${m.league.toUpperCase()}|${m.api_id.toUpperCase()}`;
      teamCache.set(key, m.full_name);
    });
    console.log(`  ✅ Cached ${teamCache.size} team mappings.`);
  } catch (err) { console.error("  ⚠️ Failed to load team mappings.", err.message); }
}

const currentYear = new Date().getFullYear();
const targetSeasons = [currentYear, currentYear + 1];

// ==========================================
// 1. UNIVERSAL STATIC ADAPTER
// ==========================================
class UniversalStaticAdapter {
  constructor(leagueName, icon, folderName) {
    this.name = `${leagueName} Static JSON`;
    this.leagueName = leagueName;
    this.icon = icon;
    this.folderName = folderName;
  }

  async fetchEvents() {
    let normalizedEvents = [];
    
    for (const season of targetSeasons) {
      // CACHE BUSTER ADDED HERE: ?v=${Date.now()} forces GitHub to bypass cache
      const url = `https://raw.githubusercontent.com/benwelner/bw_sports/main/_db/${this.folderName}/${season}.json?v=${Date.now()}`;
      
      try {
        const response = await fetch(url);
        
        // If the JSON for a specific year (like 2027) doesn't exist yet, we just skip smoothly
        if (!response.ok) continue;
        
        const rawData = await response.json();
        
        // BUG FIX: Replaced || with ?? to preserve empty strings and strictly enforce DB Schema
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
          home_logo: event.home_logo ?? '',
          away_logo: event.away_logo ?? ''
        }));
        
        normalizedEvents = normalizedEvents.concat(events);
      } catch (error) {
        console.error(`  🛑 [${this.name}] Fetch failed for ${season}:`, error.message);
      }
    }
    
    return normalizedEvents;
  }
}

// ==========================================
// 2. DYNAMIC ICAL ADAPTER
// ==========================================
class DynamicIcalAdapter {
  constructor(leagueName, icon, iCalUrl, parseStrategy) {
    this.name = `${leagueName} iCal Adapter`;
    this.leagueName = leagueName;
    this.icon = icon;
    this.iCalUrl = iCalUrl;
    this.parseStrategy = parseStrategy;
  }

  async fetchEvents() {
    let normalizedEvents = [];
    try {
      const webEvents = await ical.async.fromURL(this.iCalUrl);
      for (const event of Object.values(webEvents)) {
        if (event.type === 'VEVENT') {
          const parsed = this.parseStrategy(event);
          if (parsed) {
            normalizedEvents.push({
              slug: parsed.slug,
              league_name: this.leagueName,
              event_name: parsed.eventName,
              sub_text: parsed.subText || '',
              // Capturing the new requested metadata
              broadcast_info: event.description || 'Check local listings',
              favorites_subtext: parsed.favoritesSubtext || '',
              start_time: new Date(event.start).toISOString(),
              status: 'pre',
              icon_primary: this.icon,
              home_team: parsed.homeTeam,
              away_team: parsed.awayTeam,
              home_score: '0',
              away_score: '0',
              home_logo: '',
              away_logo: ''
            });
          }
        }
      }
    } catch (err) {
      console.error(`  🛑 [${this.name}] Failed:`, err.message);
    }
    return normalizedEvents;
  }
}

// ==========================================
// 3. ORCHESTRATOR
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

  // Define strategy for parsing World Cup ICS
  const worldCupStrategy = (event) => {
    // Basic logic to parse title "Country A vs Country B"
    // Using an optional chaining/fallback in case the summary is weirdly formatted
    const summary = event.summary || "TBD vs TBD";
    const teams = summary.split(' vs ');
    
    return {
      slug: `WC-2026-${new Date(event.start).getTime()}`,
      eventName: summary,
      homeTeam: teams[1] ? teams[1].trim().toUpperCase() : "TBD",
      awayTeam: teams[0] ? teams[0].trim().toUpperCase() : "TBD",
      subText: event.location || 'Group Stage',
      favoritesSubtext: 'Follow: Canada' // Tracking your favorite
    };
  };
  
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
    new DynamicIcalAdapter(
      'WORLD CUP', 
      '⚽', 
      'https://YOUR_ICAL_URL_HERE.ics', // IMPORTANT: Replace with your actual iCal feed
      worldCupStrategy
    ),
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
    new UniversalStaticAdapter('DAKAR RALLY', '🏁', 'dakar_rally'),
    new UniversalStaticAdapter('WRC', '🏎️', 'wrc'),
    new UniversalStaticAdapter('FORMULA E', '🏎️', 'formula_e'),
    new UniversalStaticAdapter('CARVANA PPA TOUR', '🏓', 'carvana_ppa_tour'),
    new UniversalStaticAdapter('MLS', '⚽', 'mls'),
    new UniversalStaticAdapter('USL LEAGUE TWO', '⚽', 'usl-league-two')
  ];
  
  const uniqueEvents = new Map();

  for (const adapter of adapters) {
    console.log(`⚙️ Syncing ${adapter.name}...`);
    try {
      const events = await adapter.fetchEvents();
      if (events.length === 0) console.warn(`  🛑 [${adapter.name}] returned zero events. Check data source.`);
      events.forEach(e => { if (e.start_time && !e.start_time.includes("undefined")) uniqueEvents.set(e.slug, e); });
    } catch (err) { console.error(`  💥 Adapter ${adapter.name} failed:`, err.message); }
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
      console.error(`  💥 Failed to fetch stale records:`, fetchError.message);
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
          console.error(`  💥 Failed to delete stale records:`, deleteError.message);
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