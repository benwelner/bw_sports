import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vkwjwbnfkosdtbegtxry.supabase.co'; 
const supabaseKey = 'sb_publishable_Fukj3WTtVt88uLHsaJfKfg_CG5icIkp'; 
const supabase = createClient(supabaseUrl, supabaseKey);

const leagueConfigs = [
  { name: 'NHL', path: 'hockey/nhl', icon: '🏒' },
  { name: 'NBA', path: 'basketball/nba', icon: '🏀' },
  { name: 'MLS', path: 'soccer/usa.1', icon: '⚽' },
  { name: 'F1', path: 'racing/f1', icon: '🏎️' },
  { name: 'NASCAR Cup', path: 'racing/nascar-premier', icon: '🏁' },
  { name: 'NASCAR Xfinity', path: 'racing/nascar-xfinity', icon: '🏁' },
  { name: 'NASCAR Trucks', path: 'racing/nascar-truck', icon: '🏁' }
];

export async function POST(req) {
  try {
    const { dateStr, league } = await req.json(); 
    
    // If a specific league is selected, only sync that one for maximum speed
    let configsToSync = leagueConfigs;
    if (league !== 'All') {
      configsToSync = leagueConfigs.filter(c => c.name === league);
    }

    const allGames = [];

    for (const config of configsToSync) {
      const url = `https://site.api.espn.com/apis/site/v2/sports/${config.path}/scoreboard?dates=${dateStr}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (!data.events || data.events.length === 0) continue;

      const games = data.events.map(event => {
        const state = event.status.type.state;
        const comps = event.competitions?.[0]?.competitors;
        const home = comps?.find(c => c.homeAway === 'home');
        const away = comps?.find(c => c.homeAway === 'away');

        return {
          slug: `${config.name}-${event.name.replace(/\s+/g, '-')}-${event.date.split('T')[0].replace(/-/g, '')}`,
          league_name: config.name,
          event_name: event.name,
          sub_text: event.status.type.detail, 
          start_time: event.date,
          status: state,
          icon_primary: config.icon,
          home_team: home?.team?.displayName || event.name,
          away_team: away?.team?.displayName || null,
          home_score: home?.score || "0",
          away_score: away?.score || "0",
          home_logo: home?.team?.logo || null,
          away_logo: away?.team?.logo || null
        };
      });
      allGames.push(...games);
    }

    // Push the fresh data to Supabase
    if (allGames.length > 0) {
      await supabase.from('events').upsert(allGames, { onConflict: 'slug' });
    }

    return NextResponse.json({ success: true, updated: allGames.length });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}