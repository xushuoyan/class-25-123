import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取聊天记录
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before'); // 用于分页，获取此ID之前的消息

    if (!classId) {
      return NextResponse.json({ error: '班级ID不能为空' }, { status: 400 });
    }

    const client = getSupabaseClient();

    let query = client
      .from('chat_messages')
      .select('*')
      .eq('class_id', classId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('id', before);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error('获取聊天记录失败:', error);
      return NextResponse.json({ error: '获取失败' }, { status: 500 });
    }

    // 反转顺序，使最新消息在底部
    const sortedMessages = (messages || []).reverse();

    return NextResponse.json({ success: true, messages: sortedMessages });
  } catch (error) {
    console.error('获取聊天记录异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 发送消息
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { classId, senderId, senderName, senderRole, content } = body;

    if (!classId || !senderId || !senderName || !content) {
      return NextResponse.json({ error: '参数不完整' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 验证用户是否是班级成员
    const { data: membership } = await client
      .from('class_members')
      .select('*')
      .eq('class_id', classId)
      .eq('user_id', senderId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: '您不是该班级成员' }, { status: 403 });
    }

    const { data, error } = await client
      .from('chat_messages')
      .insert({
        class_id: classId,
        sender_id: senderId,
        sender_name: senderName,
        sender_role: senderRole || membership.role,
        content: content.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('发送消息失败:', error);
      return NextResponse.json({ error: '发送失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: data });
  } catch (error) {
    console.error('发送消息异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 删除消息
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');
    const userId = searchParams.get('userId');

    if (!messageId || !userId) {
      return NextResponse.json({ error: '参数不完整' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 验证消息发送者
    const { data: message } = await client
      .from('chat_messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (!message) {
      return NextResponse.json({ error: '消息不存在' }, { status: 404 });
    }

    if (message.sender_id !== userId) {
      // 检查是否是教师
      const { data: membership } = await client
        .from('class_members')
        .select('*')
        .eq('class_id', message.class_id)
        .eq('user_id', userId)
        .single();

      if (!membership || membership.role !== 'teacher') {
        return NextResponse.json({ error: '无权删除此消息' }, { status: 403 });
      }
    }

    const { error } = await client
      .from('chat_messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      console.error('删除消息失败:', error);
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '消息已删除' });
  } catch (error) {
    console.error('删除消息异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
