import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');

  if (!path) return NextResponse.json({ error: 'No path provided' }, { status: 400 });

  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/playoffs`, {
      next: { revalidate: 300 } // Cache for 5 minutes
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}