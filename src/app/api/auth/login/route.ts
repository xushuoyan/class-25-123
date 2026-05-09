import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { account, password } = body;
    
    if (!account || !password) {
      return NextResponse.json(
        { error: '账号和密码不能为空' },
        { status: 400 }
      );
    }
    
    const client = getSupabaseClient();
    
    // 查询用户
    const { data: user, error } = await client
      .from('users')
      .select('*')
      .eq('account', account)
      .single();
    
    if (error || !user) {
      return NextResponse.json(
        { error: '账号不存在' },
        { status: 401 }
      );
    }
    
    // 验证密码
    if (user.password !== password) {
      return NextResponse.json(
        { error: '密码错误' },
        { status: 401 }
      );
    }
    
    // 返回用户信息（不包含密码）
    const { password: _, ...userWithoutPassword } = user;
    
    return NextResponse.json({
      success: true,
      message: '登录成功',
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('登录异常:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
