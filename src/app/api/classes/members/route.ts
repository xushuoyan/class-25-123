import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取班级成员列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');

    if (!classId) {
      return NextResponse.json({ error: '班级ID不能为空' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const { data: members, error } = await client
      .from('class_members')
      .select('*, users(name, account, avatar)')
      .eq('class_id', classId)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('获取成员列表失败:', error);
      return NextResponse.json({ error: '获取失败' }, { status: 500 });
    }

    // 格式化返回数据
    const formattedMembers = members?.map(m => ({
      id: m.id,
      userId: m.user_id,
      classId: m.class_id,
      nickname: m.nickname || m.users?.name,
      role: m.role,
      joinedAt: m.joined_at,
      name: m.users?.name,
      account: m.users?.account,
      avatar: m.users?.avatar,
    })) || [];

    return NextResponse.json({ success: true, members: formattedMembers });
  } catch (error) {
    console.error('获取成员列表异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
