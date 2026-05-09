import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 管理员账号配置
const ADMIN_ACCOUNT = 'worker';
const ADMIN_PASSWORD = '347954';

// 验证管理员身份
function verifyAdmin(authHeader: string | null): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.substring(7);
  return token === `${ADMIN_ACCOUNT}:${ADMIN_PASSWORD}`;
}

// 获取所有账号列表
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!verifyAdmin(authHeader)) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const client = getSupabaseClient();
    
    // 获取所有用户，按角色和学号排序
    const { data: users, error } = await client
      .from('users')
      .select('id, account, name, role, student_id, created_at')
      .order('role', { ascending: false })
      .order('student_id', { ascending: true });

    if (error) {
      console.error('获取用户列表失败:', error);
      return NextResponse.json({ error: '获取失败' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      users: users || [] 
    });
  } catch (error) {
    console.error('管理员获取用户列表异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 删除账号
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!verifyAdmin(authHeader)) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: '用户ID不能为空' }, { status: 400 });
    }

    const client = getSupabaseClient();
    
    // 检查是否为管理员账号
    const { data: user } = await client
      .from('users')
      .select('account')
      .eq('id', userId)
      .single();
    
    if (user?.account === ADMIN_ACCOUNT) {
      return NextResponse.json({ error: '不能删除管理员账号' }, { status: 403 });
    }

    // 删除用户相关的考试记录
    await client
      .from('exam_records')
      .delete()
      .eq('student_id', userId);

    // 删除用户
    const { error } = await client
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) {
      console.error('删除用户失败:', error);
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: '账号已删除' 
    });
  } catch (error) {
    console.error('管理员删除用户异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 更新账号信息
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!verifyAdmin(authHeader)) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, name, studentId, role } = body;

    if (!userId) {
      return NextResponse.json({ error: '用户ID不能为空' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const updateData: Record<string, any> = {};

    if (name) updateData.name = name;
    if (role) updateData.role = role;
    if (studentId !== undefined) updateData.student_id = studentId;

    const { error } = await client
      .from('users')
      .update(updateData)
      .eq('id', userId);

    if (error) {
      console.error('更新用户失败:', error);
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: '账号信息已更新' 
    });
  } catch (error) {
    console.error('管理员更新用户异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
