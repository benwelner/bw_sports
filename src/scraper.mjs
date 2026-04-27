import 'dotenv/config'; 
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

console.log("🏁 SCRIPT INITIALIZED: Pro Motorsports Sync...");

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

function getPrettyName(league, rawId) {
  if (!rawId) return "";
  const cleanId = rawId.toString().trim().toUpperCase();
  const key = `${league.toUpperCase()}|${cleanId}`;
  return teamCache.get(key) || rawId;
}

const currentYear = new Date().getFullYear();
const targetSeasons = [currentYear, currentYear + 1];

// ==========================================
// 1. RACING ADAPTERS (F1 / F2 / F3 / F1A)
// ==========================================
class JolpicaF1Adapter {
  constructor() { this.name = 'Jolpica F1 API'; this.leagueName = 'FORMULA 1'; this.icon = '🏎️'; }
  async fetchEvents() {
    let normalizedEvents = [];
    const now = new Date().getTime();
    for (const season of targetSeasons) {
      const url = `https://api.jolpi.ca/ergast/f1/${season}.json`;
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const data = await response.json();
        const races = data.MRData?.RaceTable?.Races || [];
        races.forEach(race => {
          const sessions = [{ key: 'FirstPractice', label: 'Practice 1' }, { key: 'SecondPractice', label: 'Practice 2' }, { key: 'ThirdPractice', label: 'Practice 3' }, { key: 'Qualifying', label: 'Qualifying' }, { key: 'Sprint', label: 'Sprint' }, { key: 'GrandPrix', label: 'Grand Prix' }];
          sessions.forEach(session => {
            let eventDate = session.key === 'GrandPrix' ? race.date : race[session.key]?.date;
            let eventTime = session.key === 'GrandPrix' ? race.time : race[session.key]?.time;
            if (eventDate) {
              const startTimeString = `${eventDate}T${eventTime || '00:00:00Z'}`;
              normalizedEvents.push({
                slug: `F1-${race.season}-${race.round}-${session.label.replace(/ /g, '')}`,
                league_name: this.leagueName, event_name: `${race.raceName} - ${session.label}`,
                sub_text: race.Circuit.Location.locality, display_clock: "", start_time: startTimeString,
                status: new Date(startTimeString).getTime() < now ? 'post' : 'pre',
                icon_primary: this.icon, home_team: race.Circuit.Location.locality.toUpperCase(),
                away_team: null, home_score: "0", away_score: "0", home_logo: null, away_logo: null
              });
            }
          });
        });
      } catch (e) { console.error(`  ⚠️ [${this.name}] Error:`, e.message); }
    }
    return normalizedEvents;
  }
}

class Formula2Adapter {
  constructor() { this.name = 'F2 Calendar'; this.leagueName = 'FORMULA 2'; this.icon = '🏁'; }
  async fetchEvents() {
    let normalizedEvents = []; const now = new Date().getTime();
    for (const season of targetSeasons) {
      const url = `https://raw.githubusercontent.com/sportstimes/f1/main/_db/f2/${season}.json`;
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const data = await response.json();
        (data.races || []).forEach(race => {
          const sessions = { practice: 'Practice', qualifying: 'Qualifying', sprint: 'Sprint Race', feature: 'Feature Race' };
          Object.entries(sessions).forEach(([key, label]) => {
            const start = race.sessions?.[key]; if (!start) return;
            normalizedEvents.push({
              slug: `F2-${season}-${race.round}-${label.replace(/ /g, '')}`,
              league_name: this.leagueName, event_name: `${race.name} - ${label}`,
              sub_text: race.location, display_clock: "", start_time: start,
              status: new Date(start).getTime() < now ? 'post' : 'pre',
              icon_primary: this.icon, home_team: race.location.split(',')[0].toUpperCase(),
              away_team: null, home_score: "0", away_score: "0", home_logo: null, away_logo: null
            });
          });
        });
      } catch (e) {}
    }
    return normalizedEvents;
  }
}

class Formula3Adapter {
  constructor() { this.name = 'F3 Calendar'; this.leagueName = 'FORMULA 3'; this.icon = '🏁'; }
  async fetchEvents() {
    let normalizedEvents = []; const now = new Date().getTime();
    for (const season of targetSeasons) {
      const url = `https://raw.githubusercontent.com/sportstimes/f1/main/_db/f3/${season}.json`;
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const data = await response.json();
        (data.races || []).forEach(race => {
          const sessions = { practice: 'Practice', qualifying: 'Qualifying', sprint: 'Sprint Race', feature: 'Feature Race' };
          Object.entries(sessions).forEach(([key, label]) => {
            const start = race.sessions?.[key]; if (!start) return;
            normalizedEvents.push({
              slug: `F3-${season}-${race.round}-${label.replace(/ /g, '')}`,
              league_name: this.leagueName, event_name: `${race.name} - ${label}`,
              sub_text: race.location, display_clock: "", start_time: start,
              status: new Date(start).getTime() < now ? 'post' : 'pre',
              icon_primary: this.icon, home_team: race.location.split(',')[0].toUpperCase(),
              away_team: null, home_score: "0", away_score: "0", home_logo: null, away_logo: null
            });
          });
        });
      } catch (e) {}
    }
    return normalizedEvents;
  }
}

class F1AcademyAdapter {
  constructor() { 
    this.name = 'F1 Academy Static JSON'; 
    this.leagueName = 'F1 ACADEMY'; 
    this.icon = '🏁'; 
  }

  async fetchEvents() {
    let normalizedEvents = [];
    const now = new Date().getTime();
    
    for (const season of targetSeasons) {
      const url = `https://raw.githubusercontent.com/benwelner/bw_sports/main/_db/f1_academy/${season}.json`;
      
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const data = await response.json();
        
        (data.races || []).forEach(race => {
          const start = race.start_time;
          if (!start) return;
          
          normalizedEvents.push({
            slug: `F1ACADEMY-${season}-${race.id || Math.random().toString(36).substring(7)}`,
            league_name: this.leagueName,
            event_name: race.name || "F1 Academy Race",
            sub_text: race.location?.toUpperCase() || "TBD",
            display_clock: "",
            start_time: start,
            status: new Date(start).getTime() < now ? 'post' : 'pre',
            icon_primary: this.icon,
            home_team: race.location?.split(',')[0].toUpperCase() || "F1 ACADEMY",
            away_team: null,
            home_score: "0",
            away_score: "0",
            home_logo: null,
            away_logo: null
          });
        });
      } catch (e) {}
    }
    return normalizedEvents;
  }
}

// ==========================================
// 2. TEAM SPORTS ADAPTERS
// ==========================================
class NHLAdapter {
  constructor() { this.name = 'NHL Schedule API'; this.leagueName = 'NHL'; this.icon = '🏒'; }
  async fetchEvents() {
    const normalizedEvents = []; const url = `https://api-web.nhle.com/v1/schedule/now`;
    try {
      const response = await fetch(url); if (!response.ok) return [];
      const data = await response.json(); const weeks = data.gameWeek || [];
      for (const day of weeks) {
        for (const game of day.games) {
          let status = (['LIVE', 'CRIT'].includes(game.gameState)) ? 'in' : (['FINAL', 'OFF'].includes(game.gameState) ? 'post' : 'pre');
          const seriesInfo = game.seriesSummary?.seriesStatusText || "";
          normalizedEvents.push({
            slug: `${this.leagueName}-${game.id}`, league_name: this.leagueName,
            event_name: `${getPrettyName('NHL', game.awayTeam.abbrev)} AT ${getPrettyName('NHL', game.homeTeam.abbrev)}`,
            sub_text: seriesInfo, display_clock: "", start_time: game.startTimeUTC, status,
            icon_primary: this.icon, home_team: getPrettyName('NHL', game.homeTeam.abbrev), away_team: getPrettyName('NHL', game.awayTeam.abbrev),
            home_score: (game.homeTeam.score ?? "0").toString(), away_score: (game.awayTeam.score ?? "0").toString(),
            home_logo: game.homeTeam.logo, away_logo: game.awayTeam.logo
          });
        }
      }
    } catch (e) { console.error(`  ⚠️ [${this.name}] Error:`, e.message); }
    return normalizedEvents;
  }
}

class NBAAdapter {
  constructor() { this.name = 'NBA Static CDN'; this.leagueName = 'NBA'; this.icon = '🏀'; }
  async fetchEvents() {
    const normalizedEvents = []; const now = new Date().getTime();
    try {
      const response = await fetch('https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json');
      const data = await response.json();
      for (const day of (data.leagueSchedule?.gameDates || [])) {
        for (const game of day.games) {
          const gameTimeMs = new Date(game.gameDateTimeUTC).getTime();
          let status = game.gameStatusText === 'Final' ? 'post' : (gameTimeMs < now ? (game.gameStatus === 2 ? 'in' : 'post') : 'pre');
          normalizedEvents.push({
            slug: `${this.leagueName}-${game.gameId}`, league_name: this.leagueName,
            event_name: `${getPrettyName('NBA', game.awayTeam.teamName)} AT ${getPrettyName('NBA', game.homeTeam.teamName)}`,
            sub_text: game.seriesText || "", display_clock: game.gameStatusText || "",
            start_time: game.gameDateTimeUTC, status, icon_primary: this.icon,
            home_team: getPrettyName('NBA', game.homeTeam.teamName), away_team: getPrettyName('NBA', game.awayTeam.teamName),
            home_score: (game.homeTeam.score ?? "0").toString(), away_score: (game.awayTeam.score ?? "0").toString(),
            home_logo: `https://cdn.nba.com/logos/nba/${game.homeTeam.teamId}/global/L/logo.svg`, 
            away_logo: `https://cdn.nba.com/logos/nba/${game.awayTeam.teamId}/global/L/logo.svg`
          });
        }
      }
    } catch (e) {}
    return normalizedEvents;
  }
}

// ==========================================
// 3. INDYCAR / INDYNXT ADAPTERS
// ==========================================
class IndyCarAdapter {
  constructor() { 
    this.name = 'ESPN IndyCar API'; 
    this.leagueName = 'INDYCAR'; 
    this.icon = '🏎️'; 
  }

  async fetchEvents() {
    let normalizedEvents = [];
    for (const season of targetSeasons) {
      const url = `https://site.api.espn.com/apis/site/v2/sports/racing/irl/scoreboard?limit=100&dates=${season}`;
      
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const data = await response.json();
        
        (data.events || []).forEach(event => {
          const race = event.competitions?.[0];
          if (!race) return;
          
          let status = event.status?.type?.state === 'in' ? 'in' : (event.status?.type?.state === 'post' ? 'post' : 'pre');
          
          normalizedEvents.push({
            slug: `INDYCAR-${event.id}`,
            league_name: this.leagueName,
            event_name: event.name,
            sub_text: race.venue?.fullName?.toUpperCase() || "TBD",
            display_clock: "",
            start_time: event.date,
            status: status,
            icon_primary: this.icon,
            home_team: race.venue?.address?.city?.toUpperCase() || "INDYCAR",
            away_team: null,
            home_score: "0",
            away_score: "0",
            home_logo: null,
            away_logo: null
          });
        });
      } catch (e) { 
        console.error(`  ⚠️ [${this.name}] Error:`, e.message); 
      }
    }
    return normalizedEvents;
  }
}

class IndyNXTAdapter {
  constructor() { 
    this.name = 'IndyNXT Static JSON'; 
    this.leagueName = 'INDYNXT'; 
    this.icon = '🏁'; 
  }

  async fetchEvents() {
    let normalizedEvents = [];
    const now = new Date().getTime();
    
    for (const season of targetSeasons) {
      const url = `https://raw.githubusercontent.com/benwelner/bw_sports/main/_db/indynxt/${season}.json`;
      
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const data = await response.json();
        
        (data.races || []).forEach(race => {
          const start = race.start_time;
          if (!start) return;
          
          normalizedEvents.push({
            slug: `INDYNXT-${season}-${race.id || Math.random().toString(36).substring(7)}`,
            league_name: this.leagueName,
            event_name: race.name || "Indy NXT Race",
            sub_text: race.location?.toUpperCase() || "TBD",
            display_clock: "",
            start_time: start,
            status: new Date(start).getTime() < now ? 'post' : 'pre',
            icon_primary: this.icon,
            home_team: race.location?.split(',')[0].toUpperCase() || "INDYNXT",
            away_team: null,
            home_score: "0",
            away_score: "0",
            home_logo: null,
            away_logo: null
          });
        });
      } catch (e) {}
    }
    return normalizedEvents;
  }
}

// ==========================================
// 4. ARCA / WEC / IMSA STATIC ADAPTERS
// ==========================================
class ARCAMenardsAdapter {
  constructor() { 
    this.name = 'ARCA Menards Static JSON'; 
    this.leagueName = 'ARCA MENARDS'; 
    this.icon = '🏁'; 
  }

  async fetchEvents() {
    let normalizedEvents = [];
    const now = new Date().getTime();
    
    for (const season of targetSeasons) {
      const url = `https://raw.githubusercontent.com/benwelner/bw_sports/main/_db/arca_menards/${season}.json`;
      
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const data = await response.json();
        
        (data.races || []).forEach(race => {
          const start = race.start_time;
          if (!start) return;
          
          normalizedEvents.push({
            slug: `ARCAMENARDS-${season}-${race.id || Math.random().toString(36).substring(7)}`,
            league_name: this.leagueName,
            event_name: race.name || "ARCA Menards Race",
            sub_text: race.location?.toUpperCase() || "TBD",
            display_clock: "",
            start_time: start,
            status: new Date(start).getTime() < now ? 'post' : 'pre',
            icon_primary: this.icon,
            home_team: race.location?.split(',')[0].toUpperCase() || "ARCA MENARDS",
            away_team: null,
            home_score: "0",
            away_score: "0",
            home_logo: null,
            away_logo: null
          });
        });
      } catch (e) {}
    }
    return normalizedEvents;
  }
}

class ARCAEastAdapter {
  constructor() { 
    this.name = 'ARCA East Static JSON'; 
    this.leagueName = 'ARCA EAST'; 
    this.icon = '🏁'; 
  }

  async fetchEvents() {
    let normalizedEvents = [];
    const now = new Date().getTime();
    
    for (const season of targetSeasons) {
      const url = `https://raw.githubusercontent.com/benwelner/bw_sports/main/_db/arca_east/${season}.json`;
      
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const data = await response.json();
        
        (data.races || []).forEach(race => {
          const start = race.start_time;
          if (!start) return;
          
          normalizedEvents.push({
            slug: `ARCAEAST-${season}-${race.id || Math.random().toString(36).substring(7)}`,
            league_name: this.leagueName,
            event_name: race.name || "ARCA East Race",
            sub_text: race.location?.toUpperCase() || "TBD",
            display_clock: "",
            start_time: start,
            status: new Date(start).getTime() < now ? 'post' : 'pre',
            icon_primary: this.icon,
            home_team: race.location?.split(',')[0].toUpperCase() || "ARCA EAST",
            away_team: null,
            home_score: "0",
            away_score: "0",
            home_logo: null,
            away_logo: null
          });
        });
      } catch (e) {}
    }
    return normalizedEvents;
  }
}

class ARCAWestAdapter {
  constructor() { 
    this.name = 'ARCA West Static JSON'; 
    this.leagueName = 'ARCA WEST'; 
    this.icon = '🏁'; 
  }

  async fetchEvents() {
    let normalizedEvents = [];
    const now = new Date().getTime();
    
    for (const season of targetSeasons) {
      const url = `https://raw.githubusercontent.com/benwelner/bw_sports/main/_db/arca_west/${season}.json`;
      
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const data = await response.json();
        
        (data.races || []).forEach(race => {
          const start = race.start_time;
          if (!start) return;
          
          normalizedEvents.push({
            slug: `ARCAWEST-${season}-${race.id || Math.random().toString(36).substring(7)}`,
            league_name: this.leagueName,
            event_name: race.name || "ARCA West Race",
            sub_text: race.location?.toUpperCase() || "TBD",
            display_clock: "",
            start_time: start,
            status: new Date(start).getTime() < now ? 'post' : 'pre',
            icon_primary: this.icon,
            home_team: race.location?.split(',')[0].toUpperCase() || "ARCA WEST",
            away_team: null,
            home_score: "0",
            away_score: "0",
            home_logo: null,
            away_logo: null
          });
        });
      } catch (e) {}
    }
    return normalizedEvents;
  }
}

class WECAdapter {
  constructor() { 
    this.name = 'WEC Static JSON'; 
    this.leagueName = 'WEC'; 
    this.icon = '🏎️'; 
  }

  async fetchEvents() {
    let normalizedEvents = [];
    const now = new Date().getTime();
    
    for (const season of targetSeasons) {
      const url = `https://raw.githubusercontent.com/benwelner/bw_sports/main/_db/wec/${season}.json`;
      
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const data = await response.json();
        
        (data.races || []).forEach(race => {
          const start = race.start_time;
          if (!start) return;
          
          normalizedEvents.push({
            slug: `WEC-${season}-${race.id || Math.random().toString(36).substring(7)}`,
            league_name: this.leagueName,
            event_name: race.name || "WEC Race",
            sub_text: race.location?.toUpperCase() || "TBD",
            display_clock: "",
            start_time: start,
            status: new Date(start).getTime() < now ? 'post' : 'pre',
            icon_primary: this.icon,
            home_team: race.location?.split(',')[0].toUpperCase() || "WEC",
            away_team: null,
            home_score: "0",
            away_score: "0",
            home_logo: null,
            away_logo: null
          });
        });
      } catch (e) {}
    }
    return normalizedEvents;
  }
}

class IMSAAdapter {
  constructor() { 
    this.name = 'IMSA API'; 
    this.leagueName = 'IMSA'; 
    this.icon = '🏎️'; 
  }

  async fetchEvents() {
    let normalizedEvents = [];
    const now = new Date().getTime();
    
    for (const season of targetSeasons) {
      const url = `https://raw.githubusercontent.com/benwelner/bw_sports/main/_db/imsa/${season}.json`;
      
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const data = await response.json();
        
        (data.races || []).forEach(race => {
          const start = race.start_time;
          if (!start) return;
          
          normalizedEvents.push({
            slug: `IMSA-${season}-${race.id || Math.random().toString(36).substring(7)}`,
            league_name: this.leagueName,
            event_name: race.name || "IMSA Race",
            sub_text: race.location?.toUpperCase() || "TBD",
            display_clock: "",
            start_time: start,
            status: new Date(start).getTime() < now ? 'post' : 'pre',
            icon_primary: this.icon,
            home_team: race.location?.split(',')[0].toUpperCase() || "IMSA",
            away_team: null,
            home_score: "0",
            away_score: "0",
            home_logo: null,
            away_logo: null
          });
        });
      } catch (e) {}
    }
    return normalizedEvents;
  }
}

// ==========================================
// 5. THE BULLETPROOF NASCAR ADAPTER
// ==========================================
class NASCARAdapter {
  constructor() {
    this.name = 'NASCAR Bulletproof Adapter';
    this.icon = '🏁';
    this.headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
    
    // Removed ARCA APIs to allow static JSON files to take priority without duplicate conflicts
    this.seriesMap = {
      1: 'NASCAR CUP',
      10: 'NASCAR CUP', 
      2: 'NASCAR XFINITY', 
      3: 'NASCAR TRUCKS'
    };
  }

  async fetchEvents() {
    let normalizedEvents = [];
    const now = new Date();
    const foundSeriesIds = new Set();

    for (const season of targetSeasons) {
      const masterUrl = `https://cf.nascar.com/cacher/${season}/race_list_basic.json`;
      console.log(`  📡 [${this.name}] Checking Master Feed...`);

      try {
        const response = await fetch(masterUrl, { headers: this.headers });
        if (response.ok) {
          const data = await response.json();
          const raceArrays = Array.isArray(data) ? [data] : Object.values(data);
          
          for (const races of raceArrays) {
            if (!Array.isArray(races)) continue;
            races.forEach(race => {
              const sId = Number(race.series_id);
              if (this.seriesMap[sId]) {
                foundSeriesIds.add(sId);
                const ev = this.formatRace(race, sId, this.seriesMap[sId], now);
                if (ev) normalizedEvents.push(ev);
              }
            });
          }
        }
      } catch (e) { console.log(`    ⚠️ Master Feed skip: ${e.message}`); }

      for (const [idStr, leagueName] of Object.entries(this.seriesMap)) {
        const id = Number(idStr);
        if (foundSeriesIds.has(id)) continue; 
        
        const slug = id === 4 ? "arca" : (id === 5 ? "arcaeast" : (id === 6 ? "arcawest" : id));
        const backupUrls = [
          `https://cf.nascar.com/cacher/${season}/${slug}/race_list.json`,
          `https://cf.nascar.com/cacher/${slug}/${season}/race_list.json`
        ];

        for (const url of backupUrls) {
          try {
            const res = await fetch(url, { headers: this.headers });
            if (!res.ok) continue;
            const data = await res.json();
            const races = Array.isArray(data) ? data : (data[`series_${id}`] || data.race_list || Object.values(data).flat());
            
            if (Array.isArray(races) && races.length > 0) {
              console.log(`    📡 [${this.name}] Fallback hunt successful for series ${id}`);
              races.forEach(race => {
                const ev = this.formatRace(race, id, leagueName, now);
                if (ev) normalizedEvents.push(ev);
              });
              foundSeriesIds.add(id);
              break; 
            }
          } catch (e) {}
        }
      }
    }
    return normalizedEvents;
  }

  formatRace(race, id, leagueName, now) {
    const rawDate = race.scheduled_que_utc || race.start_time_utc || race.scheduled_date || race.date || race.date_scheduled;
    const rawTime = race.scheduled_time || race.time || race.start_time || "00:00:00";
    let startTime = null;
    
    if (rawDate && String(rawDate).includes('T')) {
        startTime = rawDate;
    } else if (rawDate) {
        startTime = `${String(rawDate).split(' ')[0]}T${String(rawTime).replace('Z', '')}Z`;
    }

    if (!startTime || String(startTime).includes("undefined")) return null;

    return {
      slug: `NASCAR-${id}-${race.race_id || race.id || Math.random()}`,
      league_name: leagueName,
      event_name: race.race_name || race.name || "Race",
      sub_text: String(race.track_name || race.track || "TBD").toUpperCase(),
      display_clock: "", start_time: startTime,
      status: new Date(startTime) < now ? 'post' : 'pre',
      icon_primary: this.icon, home_team: String(race.track_name || race.track || "NASCAR").toUpperCase(),
      away_team: null, home_score: "0", away_score: "0", home_logo: null, away_logo: null
    };
  }
}

// ==========================================
// 6. ORCHESTRATOR
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
  await loadTeamCache();
  
  const adapters = [
    new JolpicaF1Adapter(), 
    new Formula2Adapter(), 
    new Formula3Adapter(), 
    new F1AcademyAdapter(),
    new IndyCarAdapter(),
    new IndyNXTAdapter(),
    new NHLAdapter(), 
    new NBAAdapter(), 
    new NASCARAdapter(),
    new ARCAMenardsAdapter(),
    new ARCAEastAdapter(),
    new ARCAWestAdapter(),
    new WECAdapter(),
    new IMSAAdapter()
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
    const { count } = await supabase.from('events').delete({ count: 'exact' }).lt('last_updated_at', syncStartTime);
    console.log(`✅ Cleaned up ${count || 0} stale records.`);
  }
  console.log("\n🏆 MASTER SYNC COMPLETE!");
}

syncLeagues();