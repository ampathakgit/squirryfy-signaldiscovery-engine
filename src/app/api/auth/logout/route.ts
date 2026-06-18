import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const response = NextResponse.json({ success: true });
    
    // Clear cookie by setting its expiration to the past
    const cookieString = 'squirryfy_session=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
    response.headers.set('Set-Cookie', cookieString);

    return response;
  } catch (error: any) {
    console.error('[Logout API] Error:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
