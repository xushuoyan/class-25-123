import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取班级列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const role = searchParams.get('role');
    const code = searchParams.get('code');

    const client = getSupabaseClient();

    // 通过班级码查询班级信息
    if (code) {
      const { data: classInfo, error } = await client
        .from('classes')
        .select('*')
        .eq('code', code.toUpperCase())
        .single();

      if (error || !classInfo) {
        return NextResponse.json({ error: '班级码无效' }, { status: 404 });
      }

      return NextResponse.json({ success: true, classInfo });
    }

    if (!userId) {
      return NextResponse.json({ error: '用户ID不能为空' }, { status: 400 });
    }

    if (role === 'teacher') {
      // 教师查看自己创建的班级
      const { data: classes, error } = await client
        .from('classes')
        .select('*')
        .eq('creator_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('查询班级列表失败:', error);
        return NextResponse.json({ error: '查询失败' }, { status: 500 });
      }

      // 为每个班级获取成员数量
      const classesWithCount = await Promise.all(
        (classes || []).map(async (cls) => {
          const { count } = await client
            .from('class_members')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', cls.id);
          return {
            ...cls,
            class_members: [{ count: count || 0 }]
          };
        })
      );

      return NextResponse.json({ success: true, classes: classesWithCount });
    } else {
      // 学生查看已加入的班级
      const { data: memberships, error } = await client
        .from('class_members')
        .select('*, classes(*)')
        .eq('user_id', userId);

      if (error) {
        console.error('查询班级列表失败:', error);
        return NextResponse.json({ error: '查询失败' }, { status: 500 });
      }

      const classes = memberships?.map(m => ({
        ...m.classes,
        nickname: m.nickname,
        memberRole: m.role,
      })) || [];

      return NextResponse.json({ success: true, classes });
    }
  } catch (error) {
    console.error('获取班级列表异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 创建班级
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, creatorId } = body;

    if (!name || !creatorId) {
      return NextResponse.json({ error: '班级名称和创建者ID不能为空' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 生成6位班级码
    let code = '';
    let attempts = 0;
    while (attempts < 10) {
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data: existing } = await client
        .from('classes')
        .select('id')
        .eq('code', code)
        .single();
      
      if (!existing) break;
      attempts++;
    }

    // 创建班级
    const { data: newClass, error } = await client
      .from('classes')
      .insert({
        name,
        description,
        code,
        creator_id: creatorId,
      })
      .select()
      .single();

    if (error) {
      console.error('创建班级失败:', error);
      return NextResponse.json({ error: '创建失败' }, { status: 500 });
    }

    // 将教师自动加入班级成员
    await client
      .from('class_members')
      .insert({
        class_id: newClass.id,
        user_id: creatorId,
        role: 'teacher',
      });

    return NextResponse.json({ success: true, class: newClass });
  } catch (error) {
    console.error('创建班级异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 加入班级
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, userId, userName } = body;

    if (!code || !userId) {
      return NextResponse.json({ error: '班级码和用户ID不能为空' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 查找班级
    const { data: classInfo, error: classError } = await client
      .from('classes')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (classError || !classInfo) {
      return NextResponse.json({ error: '班级码无效' }, { status: 404 });
    }

    // 检查是否已加入
    const { data: existing } = await client
      .from('class_members')
      .select('*')
      .eq('class_id', classInfo.id)
      .eq('user_id', userId)
      .single();

    if (existing) {
      return NextResponse.json({ error: '您已加入该班级', status: 'already_joined' });
    }

    // 加入班级
    const { error } = await client
      .from('class_members')
      .insert({
        class_id: classInfo.id,
        user_id: userId,
        nickname: userName,
        role: 'student',
      });

    if (error) {
      console.error('加入班级失败:', error);
      return NextResponse.json({ error: '加入失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '加入成功', class: classInfo });
  } catch (error) {
    console.error('加入班级异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 删除班级或踢出成员
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const memberId = searchParams.get('memberId');
    const userId = searchParams.get('userId');

    if (!classId) {
      return NextResponse.json({ error: '班级ID不能为空' }, { status: 400 });
    }

    const client = getSupabaseClient();

    if (memberId) {
      // 踢出成员
      const { error } = await client
        .from('class_members')
        .delete()
        .eq('id', memberId)
        .eq('class_id', classId);

      if (error) {
        console.error('踢出成员失败:', error);
        return NextResponse.json({ error: '操作失败' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: '已踢出成员' });
    } else if (userId) {
      // 学生退出班级
      const { error } = await client
        .from('class_members')
        .delete()
        .eq('class_id', classId)
        .eq('user_id', userId);

      if (error) {
        console.error('退出班级失败:', error);
        return NextResponse.json({ error: '操作失败' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: '已退出班级' });
    } else {
      // 删除整个班级
      // 先删除所有成员
      await client.from('class_members').delete().eq('class_id', classId);
      // 删除所有消息
      await client.from('chat_messages').delete().eq('class_id', classId);
      // 删除班级
      const { error } = await client.from('classes').delete().eq('id', classId);

      if (error) {
        console.error('删除班级失败:', error);
        return NextResponse.json({ error: '删除失败' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: '班级已删除' });
    }
  } catch (error) {
    console.error('删除操作异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 更新成员信息
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { memberId, nickname, classId, name, description } = body;

    const client = getSupabaseClient();

    if (memberId && nickname !== undefined) {
      // 更新成员昵称
      const { error } = await client
        .from('class_members')
        .update({ nickname })
        .eq('id', memberId);

      if (error) {
        console.error('更新昵称失败:', error);
        return NextResponse.json({ error: '更新失败' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: '昵称已更新' });
    }

    if (classId) {
      // 更新班级信息
      const updateData: Record<string, any> = {};
      if (name) updateData.name = name;
      if (description !== undefined) updateData.description = description;

      const { error } = await client
        .from('classes')
        .update(updateData)
        .eq('id', classId);

      if (error) {
        console.error('更新班级信息失败:', error);
        return NextResponse.json({ error: '更新失败' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: '班级信息已更新' });
    }

    return NextResponse.json({ error: '缺少参数' }, { status: 400 });
  } catch (error) {
    console.error('更新操作异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
