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

// CONSOLIDATED FAVORITES ARRAY
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
      const url = `https://raw.githubusercontent.com/benwelner/bw_sports/main/_db/${this.folderName}/${season}.json?v=${Date.now()}`;
      
      try {
        const response = await fetch(url);
        
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
          home_logo: (event.home_logo && event.home_logo !== 'null') ? event.home_logo : '',
          away_logo: (event.away_logo && event.away_logo !== 'null') ? event.away_logo : '',
          favorites_subtext: isFavorite(event) ? '★ FAVORITE' : '' 
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
      // Fetching raw iCal string with spoofed browser headers to bypass minor bot blocks
      const response = await fetch(this.iCalUrl.trim(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/calendar, text/plain, */*'
        }
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const icsString = await response.text();
      const webEvents = ical.sync.parseICS(icsString);
      
      for (const event of Object.values(webEvents)) {
        if (event.type === 'VEVENT') {
          const parsed = this.parseStrategy(event);
          if (parsed) {
            normalizedEvents.push({
              slug: parsed.slug,
              league_name: this.leagueName,
              event_name: parsed.eventName,
              sub_text: parsed.subText || '',
              broadcast_info: event.description || 'Check local listings',
              favorites_subtext: parsed.favoritesSubtext || '',
              start_time: new Date(event.start).toISOString(),
              status: 'pre',
              icon_primary: this.icon,
              home_team: parsed.homeTeam,
              away_team: parsed.awayTeam,
              home_score: '0',
              away_score: '0',
              home_logo: parsed.homeLogo || '',
              away_logo: parsed.awayLogo || ''
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

  // ==========================================
  // UPDATED WORLD CUP PARSER
  // ==========================================
  const worldCupStrategy = (event) => {
    const summaryRaw = event.summary || "TBD vs TBD";
    let summary = typeof summaryRaw === 'string' ? summaryRaw : (summaryRaw.val || "TBD vs TBD");

    // 1. Strip out the " (First Stage (Group A))" junk by cutting off at the first parenthesis
    let cleanSummary = summary.split('(')[0].trim();
    
    // Catch-all: Strip out any "Match 11:" or "Match 11 -" prefix just in case it ever appears
    cleanSummary = cleanSummary.replace(/Match\s*\d+[^\w]+/i, '').trim();

    let homeTeam = "TBD";
    let awayTeam = "TBD";

    // 2. Split the teams cleanly by "vs", "vs.", "VS", or " - "
    const teams = cleanSummary.split(/\s+vs\.?\s+|\s+-\s+/i);

    if (teams.length > 1) {
      awayTeam = teams[0].trim().toUpperCase(); 
      homeTeam = teams[1].trim().toUpperCase(); 
    } else {
      homeTeam = cleanSummary.toUpperCase(); 
    }

    // 3. TBD INTERCEPTOR: Detects official FIFA seeding placeholders
    // Checks if the string contains a number (e.g., "1E", "2F", "MATCH 49") 
    // or explicitly says WINNER/LOSER. No actual country name contains a number.
    const isPlaceholder = (teamStr) => {
      return /[0-9]/.test(teamStr) || /WINNER|LOSER|TBA|TBD/i.test(teamStr);
    };

    if (isPlaceholder(awayTeam)) awayTeam = "TBD";
    if (isPlaceholder(homeTeam)) homeTeam = "TBD";

    const eventName = `${awayTeam} AT ${homeTeam}`.replace("TBD AT TBD", "TBD").trim();

    // 4. Pull the official location from the calendar event, with a gentle fallback
    const locationRaw = event.location || "";
    let cleanLocation = typeof locationRaw === 'string' ? locationRaw : (locationRaw.val || "");
    
    // NEW: Strip URLs and clean up trailing punctuation
    cleanLocation = cleanLocation
      .replace(/(https?:\/\/[^\s]+)/g, '') // Removes any URL starting with http:// or https://
      .replace(/[-,\s]+$/, '')             // Removes any dangling commas, dashes, or spaces left behind
      .trim();                             // Trims standard whitespace

    const subText = cleanLocation || "Location TBD"; // Fallback to "Location TBD" if empty

    // 5. ISO Country Codes Mapping for FlagCDN
    const flagMap = {
      "USA": "us", "MEXICO": "mx", "CANADA": "ca", "ARGENTINA": "ar",
      "BRAZIL": "br", "FRANCE": "fr", "GERMANY": "de", "SPAIN": "es",
      "ENGLAND": "gb-eng", "PORTUGAL": "pt", "COLOMBIA": "co", "PANAMA": "pa",
      "CZECHIA": "cz", "SOUTH KOREA": "kr", "KOREA REPUBLIC": "kr", "SOUTH AFRICA": "za", 
      "UZBEKISTAN": "uz", "CONGO DR": "cd", "CONGO": "cg", "CROATIA": "hr", "NETHERLANDS": "nl",
      "JAPAN": "jp", "AUSTRALIA": "au", "TURKEY": "tr", "TURKIYE": "tr", "TÜRKIYE": "tr", 
      "CURACAO": "cw", "CURAÇAO": "cw", "HAITI": "ht", "SCOTLAND": "gb-sct", 
      "BOSNIA AND HERZEGOVINA": "ba", "BOSNIA-HERZEGOVINA": "ba", "BOSNIA-HERZEGOVINIA": "ba",
      "ITALY": "it", "BELGIUM": "be", "URUGUAY": "uy", "MOROCCO": "ma", "SENEGAL": "sn",
      "PARAGUAY": "py", "QATAR": "qa", "SWITZERLAND": "ch", "COTE DIVOIRE": "ci", 
      "CÔTE D'IVOIRE": "ci", "ECUADOR": "ec", "SWEDEN": "se", "TUNISIA": "tn", 
      "CABO VERDE": "cv", "EGYPT": "eg", "SAUDI ARABIA": "sa", "IR IRAN": "ir", 
      "IRAN": "ir", "NEW ZEALAND": "nz", "NORWAY": "no", "ALGERIA": "dz", 
      "AUSTRIA": "at", "JORDAN": "jo", "GHANA": "gh", "IRAQ": "iq"
    };

    const homeIso = flagMap[homeTeam];
    const awayIso = flagMap[awayTeam];

    // Inject URLs if ISO code is found, otherwise return empty string
    const homeLogo = homeIso ? `https://flagcdn.com/w160/${homeIso}.png` : "";
    const awayLogo = awayIso ? `https://flagcdn.com/w160/${awayIso}.png` : "";

    return {
      slug: `WC-2026-${new Date(event.start).getTime()}`,
      eventName: eventName,
      homeTeam: homeTeam,
      awayTeam: awayTeam,
      homeLogo: homeLogo,
      awayLogo: awayLogo,
      subText: subText,
      favoritesSubtext: isFavorite({ home_team: homeTeam, away_team: awayTeam }) ? '★ FAVORITE' : '' 
    };
  };
  
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
      'WORLD Cup', 
      '⚽', 
      'http://www.addevent.com/feed/easghsauw.ics', 
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