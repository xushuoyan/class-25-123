import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { insertSignInSchema } from '@/storage/database/shared/schema';

// 获取签到列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const creatorId = searchParams.get('creatorId');
    const studentId = searchParams.get('studentId');

    const client = getSupabaseClient();

    if (studentId) {
      // 学生视角：获取可参与的签到
      const { data: signIns, error } = await client
        .from('sign_ins')
        .select('*, sign_in_records!sign_in_records_sign_in_id_fkey(*)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('查询签到失败:', error);
        return NextResponse.json({ error: '查询失败' }, { status: 500 });
      }

      // 获取学生的签到记录
      const { data: records } = await client
        .from('sign_in_records')
        .select('*')
        .eq('student_id', studentId);

      return NextResponse.json({
        success: true,
        signIns: signIns || [],
        records: records || [],
      });
    }

    let query = client
      .from('sign_ins')
      .select('*')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (creatorId) {
      query = query.eq('creator_id', creatorId);
    }

    const { data: signIns, error } = await query;

    if (error) {
      console.error('查询签到列表失败:', error);
      return NextResponse.json({ error: '查询失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, signIns: signIns || [] });
  } catch (error) {
    console.error('获取签到列表异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 创建签到
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = insertSignInSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: '数据格式错误' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 如果是签到码签到，生成随机签到码
    let code = parsed.data.code;
    if (parsed.data.type === 'code' && !code) {
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    const { data, error } = await client
      .from('sign_ins')
      .insert({
        title: parsed.data.title,
        type: parsed.data.type,
        code,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        radius: parsed.data.radius,
        duration: parsed.data.duration,
        status: 'active',
        creator_id: parsed.data.creatorId,
        end_time: new Date(Date.now() + (parsed.data.duration || 5) * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('创建签到失败:', error);
      return NextResponse.json({ error: '创建失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, signIn: data });
  } catch (error) {
    console.error('创建签到异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 结束签到
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { signInId, status } = body;

    if (!signInId) {
      return NextResponse.json({ error: '签到ID不能为空' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const { error } = await client
      .from('sign_ins')
      .update({
        status: status || 'ended',
        end_time: new Date().toISOString(),
      })
      .eq('id', signInId);

    if (error) {
      console.error('更新签到失败:', error);
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新签到异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 删除签到
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '签到ID不能为空' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const { error } = await client.from('sign_ins').delete().eq('id', id);

    if (error) {
      console.error('删除签到失败:', error);
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除签到异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
