import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取题库列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get('creatorId');

    const client = getSupabaseClient();

    let query = client
      .from('question_banks')
      .select('*')
      .order('created_at', { ascending: false });

    if (creatorId) {
      query = query.eq('creator_id', creatorId);
    }

    const { data: banks, error } = await query;

    if (error) {
      console.error('获取题库列表失败:', error);
      return NextResponse.json({ error: '获取失败' }, { status: 500 });
    }

    // 获取每个题库的题目数量
    const banksWithCount = await Promise.all(
      (banks || []).map(async (bank) => {
        const { count } = await client
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .eq('bank_id', bank.id);
        return {
          ...bank,
          question_count: count || 0
        };
      })
    );

    return NextResponse.json({ success: true, banks: banksWithCount });
  } catch (error) {
    console.error('获取题库列表异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 创建题库
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, subject, creatorId } = body;

    if (!name || !creatorId) {
      return NextResponse.json({ error: '题库名称和创建者ID不能为空' }, { status: 400 });
    }

    const client = getSupabaseClient();

    const { data, error } = await client
      .from('question_banks')
      .insert({
        name,
        description,
        subject,
        creator_id: creatorId,
      })
      .select()
      .single();

    if (error) {
      console.error('创建题库失败:', error);
      return NextResponse.json({ error: '创建失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, bank: data });
  } catch (error) {
    console.error('创建题库异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 更新题库
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { bankId, name, description, subject } = body;

    if (!bankId) {
      return NextResponse.json({ error: '题库ID不能为空' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const updateData: Record<string, any> = {};
    
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (subject !== undefined) updateData.subject = subject;

    const { error } = await client
      .from('question_banks')
      .update(updateData)
      .eq('id', bankId);

    if (error) {
      console.error('更新题库失败:', error);
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '题库已更新' });
  } catch (error) {
    console.error('更新题库异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 删除题库
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bankId = searchParams.get('bankId');

    if (!bankId) {
      return NextResponse.json({ error: '题库ID不能为空' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 将题库内的题目的bank_id设为null
    await client
      .from('questions')
      .update({ bank_id: null })
      .eq('bank_id', bankId);

    // 删除题库
    const { error } = await client
      .from('question_banks')
      .delete()
      .eq('id', bankId);

    if (error) {
      console.error('删除题库失败:', error);
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '题库已删除' });
  } catch (error) {
    console.error('删除题库异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
