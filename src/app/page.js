/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// CONSOLIDATED FAVORITES ARRAY (Official Names Only)
const FAVORITE_TEAMS = [
  "CANADA", 
  "HURRICANES",
  "HORNETS",
  "CAROLINA HURRICANES", 
  "CAROLINA PANTHERS", 
  "CHARLOTTE HORNETS",
  "PANTHERS",
  "CHARLOTTE FC",
  "HICKORY FC",
  "ARCA MENARDS"
];

// OFFICIAL LOGOS FOR FAVORITES (Using fast local Next.js routing for custom logos)
const FAVORITE_LOGOS = {
  "CANADA": "/logos/canada.png",
  "CAROLINA HURRICANES": "https://a.espncdn.com/i/teamlogos/nhl/500/scoreboard/car.png",
  "CAROLINA PANTHERS": "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/car.png",
  "CHARLOTTE HORNETS": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/cha.png",
  "CHARLOTTE FC": "/logos/charlotte-fc.png",
  "HICKORY FC": "/logos/hky.webp",
  "FORMULA 1": "/logos/f1.png",
  "FORMULA 2": "/logos/f2.png",
  "FORMULA 3": "/logos/f3.png",
  "F1 ACADEMY": "/logos/f1-academy.png",
  "CARVANA PPA TOUR": "/logos/ppa-tour.png",
  "ARCA MENARDS": "/logos/arca_menards.png"
};

// STRICT KEYS: Decoupled from Display Names to prevent SQL/URL parsing errors
const RACING_LEAGUES = [
  'FORMULA 1', 'FORMULA 2', 'FORMULA 3', 'FORMULA E', 'F1 ACADEMY',
  'INDYCAR', 'INDYNXT', 'SUPER FORMULA',
  'NASCAR CUP', 'NASCAR XFINITY', 'NASCAR TRUCKS',
  'ARCA MENARDS', 'ARCA EAST', 'ARCA WEST',
  'WEC', 'IMSA', 'WRC', 'SUPERCARS', 'BTCC', 'DAKAR RALLY', 'NÜRBURGRING 24H', 'CARS TOUR', 'ASIAN LE MANS', 'ADAC GT MASTERS', 'EUROPEAN LE MANS', 'EXTREME H'
];

const DISPLAY_NAMES = {
  "FORMULA 1": "F1",
  "FORMULA 2": "F2",
  "FORMULA 3": "F3",
  "FORMULA E": "Formula E",
  "F1 ACADEMY": "F1 Academy",
  "INDYCAR": "IndyCar",
  "INDYNXT": "Indy NXT",
  "SUPER FORMULA": "Super Formula",
  "NASCAR CUP": "NASCAR", 
  "NASCAR XFINITY": "O'Reilly",
  "NASCAR TRUCKS": "Craftsman",
  "ARCA MENARDS": "ARCA",
  "ARCA EAST": "ARCA East",
  "ARCA WEST": "ARCA West",
  "WEC": "WEC",
  "IMSA": "IMSA",
  "WRC": "WRC",
  "SUPERCARS": "Supercars",
  "BTCC": "BTCC",
  "DAKAR RALLY": "Dakar Rally",
  "NÜRBURGRING 24H": "Nürburgring 24H",
  "CARS TOUR": "CARS Tour",
  "ASIAN LE MANS": "Asian Le Mans",
  "ADAC GT MASTERS": "ADAC GT Masters",
  "EUROPEAN LE MANS": "European Le Mans",
  "EXTREME H": "Extreme H",
  "NFL": "NFL",
  "NHL": "NHL",
  "NBA": "NBA",
  "MLS": "MLS",
  "USL LEAGUE TWO": "USL2",
  "WORLD CUP": "World Cup",
  "CARVANA PPA TOUR": "PPA Tour"
};

const LEAGUE_LINKS = {
  'FORMULA 1': 'https://www.formula1.com/en/results.html/2026/drivers.html',
  'FORMULA 2': 'https://www.fiaformula2.com/Standings/Driver',
  'FORMULA 3': 'https://www.fiaformula3.com/Standings/Driver',
  'FORMULA E': 'https://www.fiaformulae.com/en/standings',
  'F1 ACADEMY': 'https://www.f1academy.com/Racing-Series/Standings/Driver',
  'INDYCAR': 'https://www.indycar.com/Standings',
  'INDYNXT': 'https://www.indynxt.com/Standings',
  'SUPER FORMULA': 'https://www.motorsport.com/super-formula/standings/2025/',
  'NHL': 'https://www.nhl.com/playoffs/2026/bracket',
  'NBA': 'https://www.nba.com/standings',
  'NFL': 'https://www.nfl.com/standings/',
  'MLS': 'https://www.mlssoccer.com/standings/conference/#season=MLS-SEA-0001KA&live=true',
  'USL LEAGUE TWO': 'https://www.uslleaguetwo.com/league-standings',
  'WORLD CUP': 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/standings', 
  'CARVANA PPA TOUR': 'https://ppatour.com/player-rankings/',
  'NASCAR CUP': 'https://www.nascar.com/standings/nascar-cup-series/',
  'NASCAR XFINITY': 'https://www.nascar.com/standings/nascar-oreilly-auto-parts-series',
  'NASCAR TRUCKS': 'https://www.nascar.com/standings/nascar-craftsman-truck-series',
  'ARCA MENARDS': 'https://www.racing-reference.info/standings/2026/A',
  'ARCA EAST': 'https://www.racing-reference.info/yeardet/2026/AE',
  'ARCA WEST': 'https://www.racing-reference.info/standings/2026/AW',
  'WEC': 'https://www.fiawec.com/en/page/manufacturers-classification',
  'IMSA': 'https://www.imsa.com/weathertech/standings/',
  'WRC': 'https://www.wrc.com/en/results-and-standings/championship-standings',
  'SUPERCARS': 'https://www.supercars.com/standings/2026/supercars',
  'BTCC': 'https://btcc.net/standings/drivers/',
  'DAKAR RALLY': 'https://www.dakar.com/en/rankings',
  'NÜRBURGRING 24H': 'https://www.24h-rennen.de/en/results/',
  'CARS TOUR': 'https://www.carsracingtour.com/standings-lmsc/',
  'ASIAN LE MANS': 'https://www.asianlemansseries.com/calendar/2025-2026/drivers-championship',
  'ADAC GT MASTERS': 'https://www.adac-motorsport.de/en/adac-gt-masters/rankings/2026/',
  'EUROPEAN LE MANS': 'https://www.europeanlemansseries.com/en/page/classification-2',
  'EXTREME H': 'https://www.fiaextremeh.com/results'
};

// ==========================================
// HELPER: Bulletproof URL Parsing
// ==========================================
// Strips lingering markdown and forces local paths to resolve externally
const parseLogoUrl = (url) => {
  if (!url) return null;
  let cleaned = url.trim();
  if (cleaned === 'null' || cleaned === '') return null;
  
  // 1. Strip Markdown if the database is polluted: [URL](URL) -> URL
  const match = cleaned.match(/\[.*?\]\((.*?)\)/);
  if (match) {
    cleaned = match[1];
  }

  return cleaned;
};

export default function Home() {
  const [hasMounted, setHasMounted] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [activeLeague, setActiveLeague] = useState("All");
  const [availableLeagues, setAvailableLeagues] = useState(["All"]);
  const [leagueDetails, setLeagueDetails] = useState([]);
  const [events, setEvents] = useState([]);
  const [isDark, setIsDark] = useState(true);
  
  // Navigation State Management
  const [activeTab, setActiveTab] = useState("events");
  const [activeSubTab, setActiveSubTab] = useState('standings');
  const [selectedFavorite, setSelectedFavorite] = useState(null);

  // Vertical Pull-to-Refresh State
  const [refreshState, setRefreshState] = useState(''); 
  const [pullDistance, setPullDistance] = useState(0);

  // Horizontal Swipe Visual State
  const [swipeDistance, setSwipeDistance] = useState(0);
  
  const selectedDateRef = useRef(null);
  const activePillRef = useRef(null);
  const upcomingEventRef = useRef(null);
  const mainScrollRef = useRef(null);
  
  // Touch Tracking Refs
  const startY = useRef(null);
  const startX = useRef(null);
  const currentX = useRef(null);
  const isSwipingHorizontal = useRef(false);

  const PULL_THRESHOLD = 65;
  const SWIPE_THRESHOLD = 50; 
  const MAX_SWIPE_DISTANCE = 90;

  useEffect(() => { setHasMounted(true); }, []);

  const colors = {
    bgApp: isDark ? 'bg-neutral-900' : 'bg-gray-100',
    bgHeader: isDark ? 'bg-neutral-900/80 backdrop-blur-xl' : 'bg-white/80 backdrop-blur-xl',
    textMain: isDark ? 'text-white' : 'text-gray-900',
    textSub: isDark ? 'text-neutral-400' : 'text-neutral-500',
    border: isDark ? 'border-neutral-800' : 'border-gray-200',
    navBg: isDark ? 'bg-neutral-950/90 backdrop-blur-xl' : 'bg-white/90 backdrop-blur-xl',
    pillBg: isDark ? 'bg-neutral-800' : 'bg-gray-200',
    accentText: isDark ? 'text-teal-400' : 'text-teal-600',
    accentBorder: 'border-teal-500',
  };

  const showDateBar = !selectedFavorite && activeLeague === "All";

  const daysToShow = useMemo(() => {
    if (!hasMounted) return [];
    return Array.from({length: 365}, (_, i) => {
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + (i - 182)); return d;
    });
  }, [hasMounted]);
  
  const today = useMemo(() => new Date(), []);
  const isSameDay = (date1, date2) => date1.toDateString() === date2.toDateString();

  const isFavorite = useCallback((teamName) => {
    if (!teamName) return false;
    return FAVORITE_TEAMS.some(fav => teamName.toUpperCase().trim().includes(fav));
  }, []);

  const calculateStatus = useCallback((startTime, nowMs, leagueName) => {
    if (!startTime) return 'pre';
    const startMs = new Date(startTime).getTime();
    
    let durationHours = 3; 
    const cleanLeague = leagueName ? leagueName.toUpperCase().trim() : '';
    
    if (['WORLD CUP', 'MLS', 'USL LEAGUE TWO'].includes(cleanLeague)) {
      durationHours = 2.25; 
    } else if (['NFL'].includes(cleanLeague)) {
      durationHours = 3.5;  
    } else if (['FORMULA 1', 'INDYCAR', 'FORMULA E', 'F1 ACADEMY'].includes(cleanLeague)) {
      durationHours = 2.5; 
    } else if (['WEC', 'ASIAN LE MANS', 'EUROPEAN LE MANS', 'CARVANA PPA TOUR'].includes(cleanLeague)) {
      durationHours = 6;    
    } else if (['IMSA'].includes(cleanLeague)) {
      durationHours = 10;   
    } else if (['NÜRBURGRING 24H', 'DAKAR RALLY'].includes(cleanLeague)) {
      durationHours = 24;   
    }
    
    const durationMs = durationHours * 60 * 60 * 1000;
    
    if (nowMs < startMs) return 'pre';
    if (nowMs >= startMs && nowMs <= startMs + durationMs) return 'in';
    return 'post';
  }, []);

  useEffect(() => {
    if (hasMounted && selectedDateRef.current && activeTab === 'events' && showDateBar) {
      const timer = setTimeout(() => {
        selectedDateRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedDate, activeLeague, activeTab, hasMounted, showDateBar]);

  useEffect(() => {
    if (activePillRef.current) {
      activePillRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center' });
    }
  }, [activeLeague]);

  useEffect(() => {
    if ((activeLeague !== "All" || selectedFavorite) && upcomingEventRef.current) {
      setTimeout(() => { upcomingEventRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 250);
    }
  }, [events, activeLeague, selectedFavorite]);

  useEffect(() => {
    async function initMetadata() {
      const now = new Date().toISOString();
      const { data: upcomingEvents, error: eventsError } = await supabase
        .from('events')
        .select('league_name, start_time')
        .gte('start_time', now)
        .order('start_time', { ascending: true });
     
      const fallbackOrder = ["FORMULA 1", "FORMULA 2", "FORMULA 3", "FORMULA E", "F1 ACADEMY", "INDYCAR", "INDYNXT", "SUPER FORMULA", "WEC", "IMSA", "WRC", "BTCC", "DAKAR RALLY", "EUROPEAN LE MANS", "ASIAN LE MANS", "ADAC GT MASTERS", "EXTREME H", "SUPERCARS", "NÜRBURGRING 24H", "CARS TOUR", "WORLD CUP", "NFL", "NHL", "NBA", "MLS", "USL LEAGUE TWO", "CARVANA PPA TOUR", "NASCAR CUP", "NASCAR XFINITY", "NASCAR TRUCKS", "ARCA MENARDS", "ARCA EAST", "ARCA WEST"];
      
      let dynamicOrder = [...fallbackOrder];

      if (!eventsError && upcomingEvents && upcomingEvents.length > 0) {
        const nextEventTimes = {};
        for (const event of upcomingEvents) {
          const cleanLeagueName = event.league_name ? event.league_name.toUpperCase().trim() : '';
          if (!nextEventTimes[cleanLeagueName]) {
            nextEventTimes[cleanLeagueName] = new Date(event.start_time).getTime();
          }
        }
        dynamicOrder.sort((a, b) => {
          const timeA = nextEventTimes[a] || Infinity;
          const timeB = nextEventTimes[b] || Infinity;
          if (timeA !== timeB) return timeA - timeB;
          return fallbackOrder.indexOf(a) - fallbackOrder.indexOf(b);
        });
      }
      
      const LEAGUE_ICONS = {
        "FORMULA 1": "🏎️", "FORMULA 2": "🏁", "FORMULA 3": "🏁", "FORMULA E": "🏎️", "F1 ACADEMY": "🏁",
        "INDYCAR": "🏎️", "INDYNXT": "🏁", "SUPER FORMULA": "🏎️", "WEC": "🏎️", "IMSA": "🏎️", "WRC": "🏎️", "BTCC": "🏎️", "DAKAR RALLY": "🏁", "EUROPEAN LE MANS": "🏎️", "ASIAN LE MANS": "🏎️", "ADAC GT MASTERS": "🏎️", "EXTREME H": "🏁", "SUPERCARS": "🏎️", "NÜRBURGRING 24H": "🏁", "CARS TOUR": "🏁",
        "WORLD CUP": "⚽", "NFL": "🏈", "NHL": "🏒", "NBA": "🏀", "MLS": "⚽", "USL LEAGUE TWO": "⚽", "CARVANA PPA TOUR": "🏓", "NASCAR CUP": "🏁", 
        "NASCAR XFINITY": "🏁", "NASCAR TRUCKS": "🏁",
        "ARCA MENARDS": "🏁", "ARCA EAST": "🏁", "ARCA WEST": "🏁"
      };

      setAvailableLeagues(["All", ...dynamicOrder]);
     
      const details = dynamicOrder.map(name => ({
        name: name,
        icon: LEAGUE_ICONS[name] || "🏁"
      }));
      setLeagueDetails(details);
    }
    
    if (hasMounted) initMetadata();
  }, [hasMounted]);

  const fetchEventsData = useCallback(async () => {
    if (!hasMounted) return;
    
    let query = supabase.from('events').select('*').limit(10000);
   
    if (selectedFavorite) {
      const cleanFav = selectedFavorite.trim();
      query = query.or(`home_team.ilike.%${cleanFav}%,away_team.ilike.%${cleanFav}%,league_name.ilike.%${cleanFav}%`);
    } else if (activeLeague === "All") {
      const start = new Date(selectedDate); start.setHours(0,0,0,0);
      const end = new Date(selectedDate); end.setHours(23,59,59,999);
      query = query.gte('start_time', start.toISOString()).lte('start_time', end.toISOString());
    } else {
      query = query.eq('league_name', activeLeague);
    }
   
    const { data, error } = await query;
    if (error || !data) return;

    const cleanData = data.filter(e => e.league_name !== 'F1');

    const sorted = cleanData.sort((a, b) => {
      const dateA = new Date(a.start_time);
      const dateB = new Date(b.start_time);
      const dayA = new Date(dateA.getFullYear(), dateA.getMonth(), dateA.getDate()).getTime();
      const dayB = new Date(dateB.getFullYear(), dateB.getMonth(), dateB.getDate()).getTime();
      if (dayA !== dayB) return dayA - dayB;
      
      const aLeague = a.league_name ? a.league_name.toUpperCase().trim() : '';
      const bLeague = b.league_name ? b.league_name.toUpperCase().trim() : '';
      const aIsPriority = isFavorite(a.home_team) || isFavorite(a.away_team) || RACING_LEAGUES.includes(aLeague);
      const bIsPriority = isFavorite(b.home_team) || isFavorite(b.away_team) || RACING_LEAGUES.includes(bLeague);
      
      if (aIsPriority && !bIsPriority) return -1;
      if (!aIsPriority && bIsPriority) return 1;
      return dateA.getTime() - dateB.getTime();
    });
    
    setEvents(sorted);
  }, [activeLeague, selectedDate, hasMounted, selectedFavorite, isFavorite]);

  useEffect(() => { fetchEventsData(); }, [fetchEventsData]);

  // ==========================================
  // BUTTERY SMOOTH RUBBER-BAND TOUCH HANDLERS
  // ==========================================
  const handleTouchStart = (e) => { 
    startX.current = e.touches[0].clientX;
    currentX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isSwipingHorizontal.current = false;
    setSwipeDistance(0); 
  };

  const handleTouchMove = (e) => {
    if (startX.current === null || startY.current === null) return;
    
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    
    const deltaX = touchX - startX.current;
    const deltaY = touchY - startY.current;

    if (!isSwipingHorizontal.current && Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
      isSwipingHorizontal.current = true;
    }

    if (isSwipingHorizontal.current) {
      currentX.current = touchX;
      let rawDistance = deltaX;
      let calculatedDistance = rawDistance * 0.5; 
      const resistance = 1 - Math.min(Math.abs(calculatedDistance) / (MAX_SWIPE_DISTANCE * 2.5), 0.8);
      setSwipeDistance(calculatedDistance * resistance); 
      return; 
    }

    if (mainScrollRef.current && mainScrollRef.current.scrollTop === 0 && deltaY > 0) {
      const rawPull = deltaY;
      const pullResistance = 1 - Math.min(rawPull / 400, 0.75); 
      const calculatedPull = rawPull * 0.4 * pullResistance;
      setPullDistance(calculatedPull);
      
      if (calculatedPull > PULL_THRESHOLD) {
        setRefreshState('ready');
      } else {
        setRefreshState('pulling');
      }
    }
  };

  const handleTouchEnd = async () => {
    if (startX.current === null) return;
    
    const finalX = currentX.current !== null ? currentX.current : startX.current;
    const deltaX = finalX - startX.current;

    if (isSwipingHorizontal.current) {
      if (Math.abs(deltaX) >= SWIPE_THRESHOLD) {
        const newDate = new Date(selectedDate);
        if (deltaX < 0) {
          newDate.setDate(newDate.getDate() + 1); 
        } else {
          newDate.setDate(newDate.getDate() - 1); 
        }
        newDate.setHours(0, 0, 0, 0);
        setSelectedDate(newDate);
      }
      setSwipeDistance(0); 
      isSwipingHorizontal.current = false;
    } else if (refreshState === 'ready') {
      setRefreshState('refreshing'); 
      setPullDistance(45); 
      await fetchEventsData();
      setRefreshState(''); 
      setPullDistance(0); 
    } else {
      setRefreshState(''); 
      setPullDistance(0); 
    }

    startY.current = null;
    startX.current = null;
    currentX.current = null;
  };

  // SVG Fallback Generator for Broken URLs
  const getFallbackSvg = (emoji) => `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="20">${emoji}</text></svg>`;

  if (!hasMounted) return <div className="h-screen w-full bg-neutral-900" />;

  let foundUpcoming = false;
  
  const dragPercentage = Math.min(Math.abs(swipeDistance) / MAX_SWIPE_DISTANCE, 1);
  const currentOpacity = 1 - (dragPercentage * 0.5); 
  const renderTimeMs = Date.now();

  return (
    <div className={`fixed inset-0 flex flex-col w-full overflow-hidden font-sans overscroll-none ${colors.bgApp} ${colors.textMain}`}>
      <header className={`${colors.bgHeader} p-3 flex justify-between items-center z-20 shrink-0 border-b ${colors.border}`}>
        <div className="w-10 h-10 flex flex-col items-center justify-center">
          <img src="/app/_images/logos/logo.png" alt="Logo" className="max-w-full max-h-full object-contain" style={{ filter: isDark ? 'invert(1) grayscale(1) brightness(1.8)' : 'none' }} />
        </div>
        <div className="flex flex-col items-center flex-1">
          <h1 className="text-[15px] font-black uppercase tracking-tighter">B SPORTS</h1>
        </div>
        <button onClick={() => setIsDark(!isDark)} className="w-10 text-lg active:scale-90 transition-transform"> {isDark ? '☀️' : '🌙'} </button>
      </header>

      {activeTab === 'events' ? (
        <div 
          onTouchStart={handleTouchStart} 
          onTouchMove={handleTouchMove} 
          onTouchEnd={handleTouchEnd}
          style={{ 
            transform: `translate3d(${swipeDistance}px, 0, 0)`,
            opacity: currentOpacity,
            transition: isSwipingHorizontal.current ? 'none' : 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.5s cubic-bezier(0.25, 1, 0.5, 1)'
          }}
          className="flex-1 flex flex-col w-full overflow-hidden will-change-transform"
        >
          {!selectedFavorite ? (
            <>
              <div className={`${colors.bgHeader} flex items-end justify-between w-full shrink-0 overflow-hidden transition-all duration-300 ease-in-out z-10 ${showDateBar ? `max-h-[80px] opacity-100 border-b ${colors.border}` : 'max-h-0 opacity-0 border-b-0 border-transparent'}`}>
                <div className="flex items-end gap-2 overflow-x-auto p-2 no-scrollbar scroll-smooth flex-1 min-w-0">
                  {daysToShow.map((day) => {
                    const isSelected = isSameDay(day, selectedDate);
                    return (
                      <button key={day.toISOString()} ref={isSelected ? selectedDateRef : null} onClick={() => setSelectedDate(day)} className={`flex flex-col items-center min-w-[75px] pb-2 border-b-2 transition-all shrink-0 active:scale-95 ${isSelected ? `${colors.accentBorder} ${colors.accentText} font-bold` : `border-transparent ${colors.textSub} hover:text-neutral-300`}`}>
                        <span className="text-[10px] uppercase">{isSameDay(day, today) ? 'TODAY' : day.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                        <span className="text-[10px]">{day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="relative mb-2 mx-2 pl-2 border-l border-neutral-700">
                    <button className={`w-8 h-8 flex items-center justify-center rounded-full ${colors.pillBg} ${colors.textSub} active:scale-90 transition-transform`}>📅</button>
                    <input type="date" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                      const d = new Date(e.target.value + 'T12:00:00'); d.setHours(0,0,0,0); setSelectedDate(d);
                    }} />
                </div>
              </div>
            
              <div className={`p-3 flex gap-2 overflow-x-auto no-scrollbar shrink-0 border-b z-10 ${colors.border} ${colors.bgHeader} w-full`}>
                {availableLeagues.map((l) => {
                  const lKey = l.toUpperCase().trim();
                  return (
                  <button key={l} ref={activeLeague === l ? activePillRef : null} onClick={() => setActiveLeague(l)} className={`px-4 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all shrink-0 active:scale-[0.97] shadow-sm ${activeLeague === l ? 'bg-teal-500 text-white shadow-teal-500/20' : `${colors.pillBg} text-neutral-400 hover:brightness-110`}`}>
                    {DISPLAY_NAMES[lKey] || l.trim()}
                  </button>
                )})}
              </div>
            </>
          ) : (
            <div className={`p-3 flex items-center justify-between shrink-0 border-b z-10 ${colors.border} ${colors.bgHeader}`}>
              <div className="flex items-center gap-2">
                {selectedFavorite && FAVORITE_LOGOS[selectedFavorite.toUpperCase().trim()] ? (
                  <img 
                    src={FAVORITE_LOGOS[selectedFavorite.toUpperCase().trim()]} 
                    alt={selectedFavorite} 
                    loading="lazy" 
                    decoding="async" 
                    className="w-6 h-6 object-contain drop-shadow-sm scale-110" 
                    onError={(e) => { e.currentTarget.src = getFallbackSvg('⭐️'); }}
                  />
                ) : (
                  <span className="text-xl">⭐️</span>
                )}
                <span className="font-black text-[13px] uppercase text-teal-500">{selectedFavorite.trim()}</span>
              </div>
              <button 
                onClick={() => { 
                  setSelectedFavorite(null); 
                  setActiveTab('sportsList'); 
                  setActiveSubTab('favorites'); 
                }} 
                className="px-4 py-1.5 rounded-full text-[10px] font-bold bg-teal-500 text-white shadow-md active:scale-95 transition-transform"
              >
                ← Back
              </button>
            </div>
          )}

          <main ref={mainScrollRef} className="flex-1 overflow-x-hidden overflow-y-auto relative w-full overscroll-y-none">
            <div className="w-full flex items-center justify-center overflow-hidden transition-[height] duration-300 ease-out will-change-[height]" style={{ height: `${pullDistance}px` }}>
              <span className={`text-[11px] font-bold tracking-widest uppercase ${colors.textSub}`}>
                {refreshState === 'pulling' && '↓ Pull to refresh...'}
                {refreshState === 'ready' && '↑ Release to refresh...'}
                {refreshState === 'refreshing' && (
                  <span className="flex items-center gap-2 text-teal-500">
                    <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Updating...
                  </span>
                )}
              </span>
            </div>

            <div className="w-full flex-col flex min-h-full">
              {events.map((event, index) => {
                const currentStatus = calculateStatus(event.start_time, renderTimeMs, event.league_name);
                const isFinished = currentStatus === 'post';
                const isLive = currentStatus === 'in';
                
                const hFav = isFavorite(event.home_team), aFav = isFavorite(event.away_team);
                let isCurrentTarget = false;
                
                if ((activeLeague !== "All" || selectedFavorite) && !foundUpcoming && !isFinished) { 
                  foundUpcoming = true; 
                  isCurrentTarget = true; 
                }
                
                const eventDateLabel = new Date(event.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
                
                let logoScale = 'scale-90';
                if (event.league_name === 'NHL') logoScale = 'scale-[1.3]';
                else if (event.league_name === 'NBA') logoScale = 'scale-95';
                else if (event.league_name === 'NFL') logoScale = 'scale-110';

                const leagueKey = event.league_name ? event.league_name.toUpperCase().trim() : '';
                const displayLeagueName = DISPLAY_NAMES[leagueKey] || (event.league_name ? event.league_name.trim() : '');

                // MARKDOWN PROTECTION (Vercel overrides removed)
                const cleanAwayLogo = parseLogoUrl(event.away_logo);
                const cleanHomeLogo = parseLogoUrl(event.home_logo);

                return (
                  <div key={event.slug || event.id || index} ref={isCurrentTarget ? upcomingEventRef : null} className={`border-b ${colors.border} px-4 py-2.5 flex justify-between items-center hover:bg-neutral-500/10 active:bg-neutral-500/20 transition-colors`}>
                    <div className="flex-1 flex flex-col gap-1">
                      {event.away_team?.trim() ? (
                        <>
                          <div className="flex items-center justify-between pr-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 flex items-center justify-center shrink-0">
                                {cleanAwayLogo ? (
                                  <img src={cleanAwayLogo} alt={event.away_team} loading="lazy" decoding="async" className={`w-8 h-8 object-contain drop-shadow-sm transition-transform ${logoScale}`} onError={(e) => { e.currentTarget.src = getFallbackSvg('🛡️'); }} />
                                ) : (
                                  <span className="text-lg opacity-80">🛡️</span>
                                )}
                              </div>
                              <span className={`font-semibold text-sm capitalize tracking-wide ${aFav ? colors.accentText : ''}`}>{event.away_team.trim().toLowerCase()}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pr-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 flex items-center justify-center shrink-0">
                                {cleanHomeLogo ? (
                                  <img src={cleanHomeLogo} alt={event.home_team} loading="lazy" decoding="async" className={`w-8 h-8 object-contain drop-shadow-sm transition-transform ${logoScale}`} onError={(e) => { e.currentTarget.src = getFallbackSvg('🛡️'); }} />
                                ) : (
                                  <span className="text-lg opacity-80">🛡️</span>
                                )}
                              </div>
                              <span className={`font-semibold text-sm capitalize tracking-wide ${hFav ? colors.accentText : ''}`}>{event.home_team.trim().toLowerCase()}</span>
                            </div>
                          </div>
                          {event.sub_text?.trim() && (
                            <div className="pl-12">
                              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{event.sub_text.trim()}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 flex items-center justify-center shrink-0">
                            {cleanHomeLogo ? (
                              <img src={cleanHomeLogo} alt={event.league_name} loading="lazy" decoding="async" className={`w-8 h-8 object-contain drop-shadow-sm transition-transform ${logoScale}`} onError={(e) => { e.currentTarget.src = getFallbackSvg(event.icon_primary || '🏁'); }} />
                            ) : FAVORITE_LOGOS[leagueKey] ? (
                              <img src={FAVORITE_LOGOS[leagueKey]} alt={event.league_name} loading="lazy" decoding="async" className={`w-8 h-8 object-contain drop-shadow-sm transition-transform ${logoScale}`} onError={(e) => { e.currentTarget.src = getFallbackSvg(event.icon_primary || '🏁'); }} />
                            ) : (
                              <span className="text-xl opacity-80">{event.icon_primary}</span>
                            )}
                          </div>
                          <div className="flex flex-col">
                             <span className="font-semibold text-sm tracking-wide leading-tight">{event.event_name?.trim()}</span>
                             {event.sub_text?.trim() && (
                               <span className="text-[11px] opacity-60 font-medium tracking-wide uppercase mt-0.5">{event.sub_text.trim()}</span>
                             )}
                          </div>
                        </div>
                      )}
                      
                      {/* Broadcast & Favorites Context */}
                      {(event.broadcast_info || event.favorites_subtext) && (
                        <div className="p-2 text-xs">
                          {event.broadcast_info && (
                            <div className="font-bold text-blue-500">📺 {event.broadcast_info}</div>
                          )}
                          {event.favorites_subtext && (
                            <div className="text-yellow-600 italic">⭐ {event.favorites_subtext}</div>
                          )}
                        </div>
                      )}
                    </div>
                   
                    <div className="w-24 text-center border-l border-neutral-700/50 pl-3 flex flex-col items-center justify-center gap-1">
                       <span className={`text-[8px] font-black tracking-widest ${colors.textSub} opacity-70`}>{displayLeagueName}</span>
                       <span className="text-[9px] font-bold text-teal-500">{eventDateLabel}</span>
                       
                       {isLive ? (
                         <div className="flex flex-col items-center">
                           <span className="text-[10px] font-black text-teal-500 tracking-widest uppercase mt-0.5 text-center animate-pulse">IN PROGRESS</span>
                         </div>
                       ) : isFinished ? (
                         <span className="text-[10px] font-bold uppercase text-neutral-500">Final</span>
                       ) : event.sub_text?.includes('TBD') || event.start_time?.includes('12:00:00Z') ? (
                         <span className={`${colors.accentText} font-bold text-[10px]`}>TBD</span>
                       ) : (
                         <span className={`${colors.accentText} font-bold text-[10px]`}>{new Date(event.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                       )}
                    </div>
                  </div>
                );
              })}
            </div>
          </main>
        </div>
      ) : (
        <div className="flex-1 flex flex-col w-full overflow-hidden">
          <div className={`p-3 flex gap-2 overflow-x-auto no-scrollbar shrink-0 border-b ${colors.border} ${colors.bgHeader} w-full`}>
            {[
              { id: 'standings', label: 'Standings' },
              { id: 'favorites', label: 'Favorites' }
            ].map(subTab => (
              <button 
                key={subTab.id} 
                onClick={() => { setActiveSubTab(subTab.id); setSelectedFavorite(null); }}
                className={`px-4 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all shrink-0 active:scale-[0.97] ${activeSubTab === subTab.id ? 'bg-teal-500 text-white shadow-sm shadow-teal-500/20' : `${colors.pillBg} ${colors.textSub}`}`}
              >
                {subTab.label}
              </button>
            ))}
          </div>

          <main className="flex-1 p-4 space-y-3 overflow-y-auto w-full">
            {activeSubTab === 'standings' && (
              leagueDetails.map((league) => {
                const lKey = league.name.toUpperCase().trim();
                return (
                <a key={league.name} href={LEAGUE_LINKS[lKey] || LEAGUE_LINKS[league.name.trim()]} target="_blank" rel="noopener noreferrer" className={`flex items-center justify-between p-4 rounded-xl border ${colors.border} ${isDark ? 'bg-neutral-800' : 'bg-white shadow-sm'} hover:opacity-80 active:scale-[0.98] transition-all`}>
                  <div className="flex items-center gap-4">
                    <div className="w-6 h-6 flex items-center justify-center shrink-0">
                      {FAVORITE_LOGOS[lKey] ? (
                        <img src={FAVORITE_LOGOS[lKey]} alt={league.name} loading="lazy" className="w-6 h-6 object-contain drop-shadow-sm" onError={(e) => { e.currentTarget.src = getFallbackSvg(league.icon); }} />
                      ) : (
                        <span className="text-xl">{league.icon}</span>
                      )}
                    </div>
                    <span className="font-black text-[11px] uppercase">{DISPLAY_NAMES[lKey] || league.name.trim()}</span>
                  </div>
                  <span className="opacity-20 text-xl">↗</span>
                </a>
              )})
            )}

            {activeSubTab === 'favorites' && (
              selectedFavorite === null ? (
                FAVORITE_TEAMS.slice().sort().map(fav => {
                  const favKey = fav.toUpperCase().trim();
                  return (
                  <button 
                    key={fav} 
                    onClick={() => {
                      setSelectedFavorite(fav);
                      setActiveTab('events');
                    }} 
                    className={`w-full flex items-center justify-between p-4 rounded-xl border ${colors.border} ${isDark ? 'bg-neutral-800' : 'bg-white shadow-sm'} hover:bg-neutral-500/10 active:scale-[0.98] transition-all text-left`}
                  >
                    <div className="flex items-center gap-4">
                      {FAVORITE_LOGOS[favKey] ? (
                        <div className="w-8 h-8 flex items-center justify-center shrink-0">
                          <img src={FAVORITE_LOGOS[favKey]} alt={fav} loading="lazy" decoding="async" className="w-8 h-8 object-contain drop-shadow-sm scale-110" onError={(e) => { e.currentTarget.src = getFallbackSvg('⭐️'); }} />
                        </div>
                      ) : (
                        <span className="text-xl w-8 text-center">⭐️</span>
                      )}
                      <span className="font-black text-[11px] uppercase">{fav.trim()}</span>
                    </div>
                    <span className="opacity-20 text-xl">→</span>
                  </button>
                )})
              ) : (
                <div className="flex flex-col w-full -m-4">
                  <div className="p-4 pb-2">
                    <button onClick={() => setSelectedFavorite(null)} className={`px-4 py-1.5 rounded-full text-[10px] font-bold bg-teal-500 text-white shadow-md active:scale-95 transition-transform`}>
                      ← Back to Favorites
                    </button>
                  </div>
                  <div className="flex flex-col border-t border-neutral-700/50">
                  {events
                    .filter(e => {
                        if (!selectedFavorite) return false;
                        const favUpper = selectedFavorite.toUpperCase().trim();
                        return (e.home_team && e.home_team.toUpperCase().trim().includes(favUpper)) || 
                               (e.away_team && e.away_team.toUpperCase().trim().includes(favUpper)) ||
                               (e.league_name && e.league_name.toUpperCase().trim().includes(favUpper));
                    })
                    .map((event, index) => {
                      const currentStatus = calculateStatus(event.start_time, renderTimeMs, event.league_name);
                      const isFinished = currentStatus === 'post';
                      const isLive = currentStatus === 'in';
                      
                      const hFav = isFavorite(event.home_team), aFav = isFavorite(event.away_team);
                      const eventDateLabel = new Date(event.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
                      
                      let logoScale = 'scale-90';
                      if (event.league_name === 'NHL') logoScale = 'scale-[1.3]';
                      else if (event.league_name === 'NBA') logoScale = 'scale-95';
                      else if (event.league_name === 'NFL') logoScale = 'scale-110';

                      const leagueKey = event.league_name ? event.league_name.toUpperCase().trim() : '';
                      const displayLeagueName = DISPLAY_NAMES[leagueKey] || (event.league_name ? event.league_name.trim() : '');

                      // MARKDOWN PROTECTION (Vercel overrides removed)
                      const cleanAwayLogo = parseLogoUrl(event.away_logo);
                      const cleanHomeLogo = parseLogoUrl(event.home_logo);

                      return (
                        <div key={`fav-${event.slug || index}`} className={`border-b ${colors.border} px-4 py-2.5 flex justify-between items-center hover:bg-neutral-500/5 active:bg-neutral-500/10 transition-colors`}>
                          <div className="flex-1 flex flex-col gap-1">
                            {event.away_team?.trim() ? (
                              <>
                                <div className="flex items-center justify-between pr-6">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 flex items-center justify-center shrink-0">
                                      {cleanAwayLogo ? (
                                        <img src={cleanAwayLogo} alt={event.away_team} loading="lazy" decoding="async" className={`w-8 h-8 object-contain drop-shadow-sm transition-transform ${logoScale}`} onError={(e) => { e.currentTarget.src = getFallbackSvg('🛡️'); }} />
                                      ) : (
                                        <span className="text-lg opacity-80">🛡️</span>
                                      )}
                                    </div>
                                    <span className={`font-semibold text-sm capitalize tracking-wide ${aFav ? colors.accentText : ''}`}>{event.away_team.trim().toLowerCase()}</span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between pr-6">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 flex items-center justify-center shrink-0">
                                      {cleanHomeLogo ? (
                                        <img src={cleanHomeLogo} alt={event.home_team} loading="lazy" decoding="async" className={`w-8 h-8 object-contain drop-shadow-sm transition-transform ${logoScale}`} onError={(e) => { e.currentTarget.src = getFallbackSvg('🛡️'); }} />
                                      ) : (
                                        <span className="text-lg opacity-80">🛡️</span>
                                      )}
                                    </div>
                                    <span className={`font-semibold text-sm capitalize tracking-wide ${hFav ? colors.accentText : ''}`}>{event.home_team.trim().toLowerCase()}</span>
                                  </div>
                                </div>
                                {event.sub_text?.trim() && (
                                  <div className="pl-12">
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{event.sub_text.trim()}</span>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 flex items-center justify-center shrink-0">
                                  {cleanHomeLogo ? (
                                    <img src={cleanHomeLogo} alt={event.league_name} loading="lazy" decoding="async" className={`w-8 h-8 object-contain drop-shadow-sm transition-transform ${logoScale}`} onError={(e) => { e.currentTarget.src = getFallbackSvg(event.icon_primary || '🏁'); }} />
                                  ) : FAVORITE_LOGOS[leagueKey] ? (
                                    <img src={FAVORITE_LOGOS[leagueKey]} alt={event.league_name} loading="lazy" decoding="async" className={`w-8 h-8 object-contain drop-shadow-sm transition-transform ${logoScale}`} onError={(e) => { e.currentTarget.src = getFallbackSvg(event.icon_primary || '🏁'); }} />
                                  ) : (
                                    <span className="text-xl opacity-80">{event.icon_primary}</span>
                                  )}
                                </div>
                                <div className="flex flex-col">
                                   <span className="font-semibold text-sm tracking-wide leading-tight">{event.event_name?.trim()}</span>
                                   {event.sub_text?.trim() && (
                                     <span className="text-[11px] opacity-60 font-medium tracking-wide uppercase mt-0.5">{event.sub_text.trim()}</span>
                                   )}
                                </div>
                              </div>
                            )}
                            
                            {/* Broadcast & Favorites Context */}
                            {(event.broadcast_info || event.favorites_subtext) && (
                              <div className="p-2 text-xs">
                                {event.broadcast_info && (
                                  <div className="font-bold text-blue-500">📺 {event.broadcast_info}</div>
                                )}
                                {event.favorites_subtext && (
                                  <div className="text-yellow-600 italic">⭐ {event.favorites_subtext}</div>
                                )}
                              </div>
                            )}
                          </div>
                         
                          <div className="w-24 text-center border-l border-neutral-700/50 pl-3 flex flex-col items-center justify-center gap-1">
                             <span className={`text-[8px] font-black tracking-widest ${colors.textSub} opacity-70`}>{displayLeagueName}</span>
                             <span className="text-[9px] font-bold text-teal-500">{eventDateLabel}</span>
                             
                             {isLive ? (
                               <div className="flex flex-col items-center">
                                 <span className="text-[10px] font-black text-teal-500 tracking-widest uppercase mt-0.5 text-center animate-pulse">IN PROGRESS</span>
                               </div>
                             ) : isFinished ? (
                               <span className="text-[10px] font-bold uppercase text-neutral-500">Final</span>
                             ) : event.sub_text?.includes('TBD') || event.start_time?.includes('12:00:00Z') ? (
                               <span className={`${colors.accentText} font-bold text-[10px]`}>TBD</span>
                             ) : (
                               <span className={`${colors.accentText} font-bold text-[10px]`}>{new Date(event.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                             )}
                          </div>
                        </div>
                      );
                    })
                  }
                  </div>
                </div>
              )
            )}
          </main>
        </div>
      )}

      <nav className={`${colors.navBg} border-t ${colors.border} p-4 pb-6 flex justify-around items-end w-full shrink-0 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]`}>
        <button onClick={() => { setActiveTab('sportsList'); }} className={`flex flex-col items-center flex-1 transition-all active:scale-90 ${activeTab === 'sportsList' ? colors.accentText : 'text-neutral-500'}`}><span className="text-xl mb-1">🗂️</span><span className="text-[9px] font-bold uppercase">MORE</span></button>
        <button onClick={() => { setActiveTab('events'); setSelectedFavorite(null); }} className={`flex flex-col items-center flex-1 transition-all active:scale-90 ${activeTab === 'events' && !selectedFavorite ? 'text-white' : 'text-neutral-500'}`}><span className="text-xl mb-1">🗓️</span><span className="text-[9px] font-bold uppercase">Events</span></button>
        <a href="https://www.youtube.com/playlist?list=PLhD6ew1b_cO6WIx-VbwLGJ5rdMmurrRC9" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center flex-1 transition-all active:scale-90 text-neutral-500"><span className="text-xl mb-1">🎬</span><span className="text-[9px] font-bold uppercase">Feed</span></a>
      </nav>
    </div>
  );
}