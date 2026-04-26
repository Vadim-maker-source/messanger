// app/api/mobile/auth/register/route.ts
import { registerUser } from '@/app/lib/api/user';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, username, displayName } = body;
    
    // Вызываем вашу существующую Server Action
    const result = await registerUser({
      email,
      password,
      username,
      displayName
    });
    
    return NextResponse.json({ 
      success: true, 
      userId: result.userId 
    });
    
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Registration failed' 
      },
      { status: 400 }
    );
  }
}