import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/db';
import { hashPassword } from '@/lib/auth/crypto';
import { signToken } from '@/lib/auth/jwt';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Query admin user from database
    const { data: user, error } = await supabase
      .from('discovery_admins')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (error || !user) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Verify password hash
    const computedHash = await hashPassword(password, user.salt);
    if (computedHash !== user.password_hash) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Generate signed session token
    const token = await signToken({
      userId: user.id,
      username: user.username
    });

    // Set secure HTTP-only cookie
    const response = NextResponse.json({ success: true });
    
    // Cookie options
    const cookieString = `squirryfy_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
    response.headers.set('Set-Cookie', cookieString);

    return response;
  } catch (error: any) {
    console.error('[Login API] Error:', error.message);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
