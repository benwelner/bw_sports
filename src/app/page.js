"use client";

import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// Added "CANADA" to favorite teams
const FAVORITE_TEAMS = ["HURRICANES", "HORNETS", "CAROLINA HURRICANES", "CHARLOTTE HORNETS", "PANTHERS", "CAROLINA PANTHERS", "CANADA"];

// STRICT KEYS: Decoupled from Display Names to prevent SQL/URL parsing errors
const RACING_LEAGUES = [
  'FORMULA 1', 'FORMULA 2', 'FORMULA 3', 'F1 ACADEMY',
  'INDYCAR', 'INDYNXT', 
  'NASCAR CUP', 'NASCAR XFINITY', 'NASCAR TRUCKS',
  'ARCA MENARDS', 'ARCA EAST', 'ARCA WEST',
  'WEC', 'IMSA', 'SUPERCARS'
];

const DISPLAY_NAMES = {
  "FORMULA 1": "F1",
  "FORMULA 2": "F2",
  "FORMULA 3": "F3",
  "F1 ACADEMY": "F1 Academy",
  "INDYCAR": "IndyCar",
  "INDYNXT": "Indy NXT",
  "NASCAR CUP": "NASCAR", 
  "NASCAR XFINITY": "O'Reilly",
  "NASCAR TRUCKS": "Craftsman",
  "ARCA MENARDS": "ARCA",
  "ARCA EAST": "ARCA East",
  "ARCA WEST": "ARCA West",
  "WEC": "WEC",
  "IMSA": "IMSA",
  "SUPERCARS": "Supercars",
  "NFL": "NFL",
  "WORLD CUP": "World Cup" // Added World Cup display name
};

const LEAGUE_LINKS = {
  'FORMULA 1': 'https://www.formula1.com/en/results.html/2026/drivers.html',
  'FORMULA 2': 'https://www.fiaformula2.com/Standings/Driver',
  'FORMULA 3': 'https://www.fiaformula3.com/Standings/Driver',
  'F1 ACADEMY': 'https://www.f1academy.com/Racing-Series/Standings/Driver',
  'INDYCAR': 'https://www.indycar.com/Standings',
  'INDYNXT': 'https://www.indynxt.com/Standings',
  'NHL': 'https://www.nhl.com/playoffs/2026/bracket',
  'NBA': 'https://www.nba.com/standings',
  'NFL': 'https://www.nfl.com/standings/',
  'WORLD CUP': 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/standings', // Added standings link
  'NASCAR CUP': 'https://www.nascar.com/standings/nascar-cup-series/',
  'NASCAR XFINITY': 'https://www.nascar.com/standings/nascar-oreilly-auto-parts-series',
  'NASCAR TRUCKS': 'https://www.nascar.com/standings/nascar-craftsman-truck-series',
  'ARCA MENARDS': 'https://www.racing-reference.info/standings/2026/A',
  'ARCA EAST': 'https://www.racing-reference.info/yeardet/2026/AE',
  'ARCA WEST': 'https://www.racing-reference.info/standings/2026/AW',
  'WEC': 'https://www.fiawec.com/en/page/manufacturers-classification',
  'IMSA': 'https://www.imsa.com/weathertech/standings/',
  'SUPERCARS': 'https://www.supercars.com/standings/2026/supercars'
};

export default function Home() {
  const [hasMounted, setHasMounted] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [activeLeague, setActiveLeague] = useState("All");
  const [availableLeagues, setAvailableLeagues] = useState(["All"]);
  const [leagueDetails, setLeagueDetails] = useState([]);
  const [events, setEvents] = useState([]);
  const [isDark, setIsDark] = useState(true);
  const [activeTab, setActiveTab] = useState("events");
  const [lastSync, setLastSync] = useState(null);

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

  const PULL_THRESHOLD = 60;
  const SWIPE_THRESHOLD = 60; // Slightly higher threshold feels more deliberate for UI transforms

  useEffect(() => { setHasMounted(true); }, []);

  const colors = {
    bgApp: isDark ? 'bg-neutral-900' : 'bg-gray-100',
    bgHeader: isDark ? 'bg-neutral-800' : 'bg-white',
    textMain: isDark ? 'text-white' : 'text-gray-900',
    textSub: isDark ? 'text-neutral-400' : 'text-neutral-500',
    border: isDark ? 'border-neutral-700' : 'border-gray-300',
    navBg: isDark ? 'bg-neutral-950' : 'bg-white',
    pillBg: isDark ? 'bg-neutral-800' : 'bg-gray-200',
    accentText: isDark ? 'text-teal-400' : 'text-teal-600',
    accentBorder: 'border-teal-500',
  };

  const showDateBar = activeLeague === "All" || !RACING_LEAGUES.includes(activeLeague);

  const daysToShow = hasMounted ? Array.from({length: 186}, (_, i) => {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + (i - 30)); return d;
  }) : [];
  
  const today = new Date();
  const isSameDay = (date1, date2) => date1.toDateString() === date2.toDateString();

  const isFavorite = (teamName) => {
    if (!teamName) return false;
    return FAVORITE_TEAMS.some(fav => teamName.toUpperCase().includes(fav));
  };

  useLayoutEffect(() => {
    if (hasMounted && selectedDateRef.current && activeTab === 'events' && showDateBar) {
      const timer = setTimeout(() => {
        selectedDateRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [selectedDate, activeLeague, activeTab, hasMounted, showDateBar]);

  useEffect(() => {
    if (activePillRef.current) {
      activePillRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center' });
    }
  }, [activeLeague]);

  useEffect(() => {
    if (activeLeague !== "All" && upcomingEventRef.current) {
      setTimeout(() => { upcomingEventRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 400);
    }
  }, [events, activeLeague]);

  useEffect(() => {
    async function initMetadata() {
      const { data, error } = await supabase
        .from('events')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (!error && data && data.length > 0) {
        setLastSync(new Date(data[0].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
     
      // Updated order to include WORLD CUP
      const order = ["FORMULA 1", "FORMULA 2", "FORMULA 3", "F1 ACADEMY", "INDYCAR", "INDYNXT", "WEC", "IMSA", "SUPERCARS", "WORLD CUP", "NFL", "NHL", "NBA", "NASCAR CUP", "NASCAR XFINITY", "NASCAR TRUCKS", "ARCA MENARDS", "ARCA EAST", "ARCA WEST"];
      
      const LEAGUE_ICONS = {
        "FORMULA 1": "🏎️", "FORMULA 2": "🏁", "FORMULA 3": "🏁", "F1 ACADEMY": "🏁",
        "INDYCAR": "🏎️", "INDYNXT": "🏁", "WEC": "🏎️", "IMSA": "🏎️", "SUPERCARS": "🏎️",
        "WORLD CUP": "⚽", "NFL": "🏈", "NHL": "🏒", "NBA": "🏀", "NASCAR CUP": "🏁", 
        "NASCAR XFINITY": "🏁", "NASCAR TRUCKS": "🏁",
        "ARCA MENARDS": "🏁", "ARCA EAST": "🏁", "ARCA WEST": "🏁"
      };

      setAvailableLeagues(["All", ...order]);
     
      const details = order.map(name => ({
        name: name,
        icon: LEAGUE_ICONS[name] || "🏁"
      }));
      
      setLeagueDetails(details);
    }
    
    if (hasMounted) initMetadata();
  }, [hasMounted]);

  const fetchEventsData = useCallback(async () => {
    if (!hasMounted) return;
    let query = supabase.from('events').select('*');
   
    if (activeLeague === "All") {
      const start = new Date(selectedDate); start.setHours(0,0,0,0);
      const end = new Date(selectedDate); end.setHours(23,59,59,999);
      query = query.gte('start_time', start.toISOString()).lte('start_time', end.toISOString());
    } else {
      query = query.eq('league_name', activeLeague);
      
      // Enforce date filter for non-racing leagues even when a specific league is selected
      if (!RACING_LEAGUES.includes(activeLeague)) {
        const start = new Date(selectedDate); start.setHours(0,0,0,0);
        const end = new Date(selectedDate); end.setHours(23,59,59,999);
        query = query.gte('start_time', start.toISOString()).lte('start_time', end.toISOString());
      }
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
      const aIsPriority = isFavorite(a.home_team) || isFavorite(a.away_team) || RACING_LEAGUES.includes(a.league_name);
      const bIsPriority = isFavorite(b.home_team) || isFavorite(b.away_team) || RACING_LEAGUES.includes(b.league_name);
      if (aIsPriority && !bIsPriority) return -1;
      if (!aIsPriority && bIsPriority) return 1;
      return dateA.getTime() - dateB.getTime();
    });
    
    setEvents(sorted);
  }, [activeLeague, selectedDate, hasMounted]);

  useEffect(() => { fetchEventsData(); }, [fetchEventsData]);

  // ==========================================
  // UPDATED TOUCH HANDLERS (WITH VISUAL DRAG)
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

    // Lock axis after minor movement to prevent glitching between scroll and swipe
    if (!isSwipingHorizontal.current && Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
      isSwipingHorizontal.current = true;
    }

    if (isSwipingHorizontal.current) {
      currentX.current = touchX;
      setSwipeDistance(deltaX); // 1:1 finger tracking
      return; 
    }

    if (mainScrollRef.current && mainScrollRef.current.scrollTop === 0 && deltaY > 0) {
      setPullDistance(Math.min(deltaY, PULL_THRESHOLD * 1.5));
      setRefreshState(deltaY > PULL_THRESHOLD ? 'release' : 'pulling');
    }
  };

  const handleTouchEnd = async () => {
    if (startX.current === null) return;
    
    // Calculate final translation delta only if tracking occurred
    const finalX = currentX.current !== null ? currentX.current : startX.current;
    const deltaX = finalX - startX.current;

    if (isSwipingHorizontal.current) {
      if (Math.abs(deltaX) >= SWIPE_THRESHOLD) {
        const newDate = new Date(selectedDate);
        if (deltaX < 0) {
          newDate.setDate(newDate.getDate() + 1); // Swipe Left -> Forward in time
        } else {
          newDate.setDate(newDate.getDate() - 1); // Swipe Right -> Backward in time
        }
        newDate.setHours(0, 0, 0, 0);
        setSelectedDate(newDate);
      }
    } else if (refreshState === 'release') {
      setRefreshState('refreshing'); 
      setPullDistance(40);
      await fetchEventsData();
    }

    // Reset all Touch Tracking Refs
    setRefreshState(''); 
    setPullDistance(0); 
    setSwipeDistance(0); 
    startY.current = null;
    startX.current = null;
    currentX.current = null;
    isSwipingHorizontal.current = false;
  };

  if (!hasMounted) return <div className="h-screen w-full bg-neutral-900" />;

  let foundUpcoming = false;

  return (
    <div className={`fixed inset-0 flex flex-col w-full overflow-hidden font-sans ${colors.bgApp} ${colors.textMain}`}>
      <header className={`${colors.bgHeader} p-3 flex justify-between items-center z-10 shrink-0 border-b ${colors.border}`}>
        <div className="w-10 h-10 flex flex-col items-center justify-center">
          <img src="/logo.png" alt="Logo" className="max-w-full max-h-full object-contain" style={{ filter: isDark ? 'invert(1) grayscale(1) brightness(1.8)' : 'none' }} />
        </div>
        <div className="flex flex-col items-center flex-1">
          <h1 className="text-[15px] font-black uppercase tracking-tighter">BETTER THAN THE SCORE</h1>
        </div>
        <button onClick={() => setIsDark(!isDark)} className="w-10 text-lg"> {isDark ? '☀️' : '🌙'} </button>
      </header>

      {activeTab === 'events' ? (
        <div 
          onTouchStart={handleTouchStart} 
          onTouchMove={handleTouchMove} 
          onTouchEnd={handleTouchEnd}
          style={{ 
            transform: `translateX(${swipeDistance}px)`,
            transition: isSwipingHorizontal.current ? 'none' : 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
          }}
          className="flex-1 flex flex-col w-full overflow-hidden"
        >
          <div className={`${colors.bgHeader} flex items-end justify-between w-full shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${showDateBar ? `max-h-[80px] opacity-100 border-b ${colors.border}` : 'max-h-0 opacity-0 border-b-0 border-transparent'}`}>
            <div className="flex items-end gap-2 overflow-x-auto p-2 no-scrollbar scroll-smooth flex-1 min-w-0">
              {daysToShow.map((day) => {
                const isSelected = isSameDay(day, selectedDate);
                return (
                  <button key={day.toISOString()} ref={isSelected ? selectedDateRef : null} onClick={() => setSelectedDate(day)} className={`flex flex-col items-center min-w-[75px] pb-2 border-b-2 transition-all shrink-0 ${isSelected ? `${colors.accentBorder} ${colors.accentText} font-bold` : `border-transparent ${colors.textSub}`}`}>
                    <span className="text-[10px] uppercase">{isSameDay(day, today) ? 'TODAY' : day.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                    <span className="text-[10px]">{day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </button>
                );
              })}
            </div>
            <div className="relative mb-2 mx-2 pl-2 border-l border-neutral-700">
                <button className={`w-8 h-8 flex items-center justify-center rounded-full ${colors.pillBg} ${colors.textSub}`}>📅</button>
                <input type="date" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                  const d = new Date(e.target.value + 'T12:00:00'); d.setHours(0,0,0,0); setSelectedDate(d);
                }} />
            </div>
          </div>
         
          <div className="p-3 flex gap-2 overflow-x-auto no-scrollbar shrink-0 border-b border-neutral-700 w-full">
            {availableLeagues.map((l) => (
              <button key={l} ref={activeLeague === l ? activePillRef : null} onClick={() => setActiveLeague(l)} className={`px-4 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors shrink-0 ${activeLeague === l ? 'bg-teal-500 text-white' : `${colors.pillBg} text-neutral-400`}`}>
                {DISPLAY_NAMES[l] || l}
              </button>
            ))}
          </div>

          <main ref={mainScrollRef} className="flex-1 overflow-x-hidden overflow-y-auto relative w-full overscroll-y-none">
            <div className="w-full flex items-center justify-center overflow-hidden transition-[height] duration-200" style={{ height: `${pullDistance}px` }}>
              <span className={`text-[11px] font-bold tracking-widest uppercase ${colors.textSub}`}>
                {refreshState === 'pulling' && '↓ Pull to refresh'}
                {refreshState === 'release' && '↑ Release to refresh'}
                {refreshState === 'refreshing' && '↻ Updating...'}
              </span>
            </div>

            <div className="w-full flex-col flex min-h-full">
              {events.map((event) => {
                const isFinished = event.status === 'post';
                const hFav = isFavorite(event.home_team), aFav = isFavorite(event.away_team);
                let isCurrentTarget = false;
                if (activeLeague !== "All" && !foundUpcoming && !isFinished) { foundUpcoming = true; isCurrentTarget = true; }
                const eventDateLabel = new Date(event.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
                
                let logoScale = event.league_name === 'NHL' ? 'scale-[1.2]' : (event.league_name === 'NBA' ? 'scale-95' : 'scale-100');

                return (
                  <div key={event.id} ref={isCurrentTarget ? upcomingEventRef : null} className={`border-b ${colors.border} px-4 py-2.5 flex justify-between items-center hover:bg-neutral-500/5 transition-colors`}>
                    <div className="flex-1 flex flex-col gap-1">
                      {event.away_team ? (
                        <>
                          <div className="flex items-center justify-between pr-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 overflow-hidden border border-gray-300">
                                {event.away_logo ? <img src={event.away_logo} alt={event.away_team} className={`w-7 h-7 object-contain transition-transform ${logoScale}`} /> : <span className="text-[14px]">🛡️</span>}
                              </div>
                              <span className={`font-semibold text-sm capitalize tracking-wide ${aFav ? colors.accentText : ''}`}>{event.away_team.toLowerCase()}</span>
                            </div>
                            <span className="font-semibold">{event.away_score}</span>
                          </div>
                          <div className="flex items-center justify-between pr-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 overflow-hidden border border-gray-300">
                                {event.home_logo ? <img src={event.home_logo} alt={event.home_team} className={`w-7 h-7 object-contain transition-transform ${logoScale}`} /> : <span className="text-[14px]">🛡️</span>}
                              </div>
                              <span className={`font-semibold text-sm capitalize tracking-wide ${hFav ? colors.accentText : ''}`}>{event.home_team.toLowerCase()}</span>
                            </div>
                            <span className="font-semibold">{event.home_score}</span>
                          </div>
                          {event.sub_text && (
                            <div className="pl-12">
                              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{event.sub_text}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{event.icon_primary}</span>
                          <div className="flex flex-col">
                             <span className="font-semibold text-sm tracking-wide leading-tight">{event.event_name}</span>
                             <span className="text-[11px] opacity-60 font-medium tracking-wide uppercase mt-0.5">{event.sub_text}</span>
                          </div>
                        </div>
                      )}
                    </div>
                   
                    <div className="w-24 text-center border-l pl-3 flex flex-col items-center justify-center gap-1">
                       <span className={`text-[8px] font-black tracking-widest ${colors.textSub} opacity-70`}>{DISPLAY_NAMES[event.league_name] || event.league_name}</span>
                       <span className="text-[9px] font-bold text-teal-500">{eventDateLabel}</span>
                       {isFinished ? <span className="text-[10px] font-bold uppercase text-neutral-500">Final</span> : <span className={`${colors.accentText} font-bold text-[10px]`}>{new Date(event.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </main>
        </div>
      ) : (
        <main className="flex-1 p-4 space-y-3 overflow-y-auto w-full">
          {leagueDetails.map((league) => (
            <a key={league.name} href={LEAGUE_LINKS[league.name]} target="_blank" rel="noopener noreferrer" className={`flex items-center justify-between p-4 rounded-xl border ${colors.border} ${isDark ? 'bg-neutral-800' : 'bg-white shadow-sm'}`}>
              <div className="flex items-center gap-4">
                <span className="text-xl">{league.icon}</span>
                <span className="font-black text-[11px]">{DISPLAY_NAMES[league.name] || league.name}</span>
              </div>
              <span className="opacity-20 text-xs">↗</span>
            </a>
          ))}
        </main>
      )}

      <nav className={`${colors.navBg} border-t ${colors.border} p-4 pb-4 flex justify-around items-end w-full shrink-0`}>
        <button onClick={() => setActiveTab('standings')} className={`flex flex-col items-center flex-1 ${activeTab === 'standings' ? colors.accentText : 'text-neutral-500'}`}><span className="text-xl mb-1">🏆</span><span className="text-[9px] font-bold uppercase">Standings</span></button>
        <button onClick={() => setActiveTab('events')} className={`flex flex-col items-center flex-1 ${activeTab === 'events' ? 'text-white' : 'text-neutral-500'}`}><span className="text-xl mb-1">🗓️</span><span className="text-[9px] font-bold uppercase">Events</span></button>
        <a href="https://www.youtube.com/playlist?list=PLhD6ew1b_cO6WIx-VbwLGJ5rdMmurrRC9" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center flex-1 text-neutral-500"><span className="text-xl mb-1">🎬</span><span className="text-[9px] font-bold uppercase">Feed</span></a>
      </nav>
    </div>
  );
}