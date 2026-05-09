import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { insertQuestionSchema } from '@/storage/database/shared/schema';

// 获取题目列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const difficulty = searchParams.get('difficulty');
    const creatorId = searchParams.get('creatorId');
    const bankId = searchParams.get('bankId');

    const client = getSupabaseClient();

    let query = client
      .from('questions')
      .select('*')
      .order('created_at', { ascending: false });

    if (type && type !== 'all') {
      query = query.eq('type', type);
    }
    if (difficulty && difficulty !== 'all') {
      query = query.eq('difficulty', difficulty);
    }
    if (creatorId) {
      query = query.eq('creator_id', creatorId);
    }
    if (bankId === 'null' || bankId === 'none') {
      query = query.is('bank_id', null);
    } else if (bankId) {
      query = query.eq('bank_id', bankId);
    }

    const { data: questions, error } = await query;

    if (error) {
      console.error('查询题目列表失败:', error);
      return NextResponse.json({ error: '查询失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, questions: questions || [] });
  } catch (error) {
    console.error('获取题目列表异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 添加题目（手动或AI生成）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = insertQuestionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: '数据格式错误' }, { status: 400 });
    }

    const client = getSupabaseClient();
    
    // 转换字段名为snake_case格式
    const dataToInsert: Record<string, any> = {
      content: parsed.data.content,
      type: parsed.data.type,
      options: parsed.data.options,
      answer: parsed.data.answer,
      analysis: parsed.data.analysis,
      difficulty: parsed.data.difficulty,
      score: parsed.data.score,
      subject: parsed.data.subject,
      source_file_id: parsed.data.sourceFileId,
      creator_id: parsed.data.creatorId,
    };
    
    // 支持题库ID
    if (body.bankId) {
      dataToInsert.bank_id = body.bankId;
    }
    
    const { data, error } = await client
      .from('questions')
      .insert(dataToInsert)
      .select()
      .single();

    if (error) {
      console.error('添加题目失败:', error);
      return NextResponse.json({ error: '添加失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, question: data });
  } catch (error) {
    console.error('添加题目异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 编辑题目
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { questionId, content, type, options, answer, analysis, difficulty, score, subject, bankId } = body;

    if (!questionId) {
      return NextResponse.json({ error: '题目ID不能为空' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const updateData: Record<string, any> = {};
    
    if (content !== undefined) updateData.content = content;
    if (type !== undefined) updateData.type = type;
    if (options !== undefined) updateData.options = options;
    if (answer !== undefined) updateData.answer = answer;
    if (analysis !== undefined) updateData.analysis = analysis;
    if (difficulty !== undefined) updateData.difficulty = difficulty;
    if (score !== undefined) updateData.score = score;
    if (subject !== undefined) updateData.subject = subject;
    if (bankId !== undefined) updateData.bank_id = bankId || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '没有要更新的内容' }, { status: 400 });
    }

    const { error } = await client
      .from('questions')
      .update(updateData)
      .eq('id', questionId);

    if (error) {
      console.error('更新题目失败:', error);
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '题目已更新' });
  } catch (error) {
    console.error('更新题目异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 删除题目
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '题目ID不能为空' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const { error } = await client.from('questions').delete().eq('id', id);

    if (error) {
      console.error('删除题目失败:', error);
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除题目异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
