import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { insertExamSchema } from '@/storage/database/shared/schema';

// 获取考试列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const creatorId = searchParams.get('creatorId');
    const studentId = searchParams.get('studentId');

    const client = getSupabaseClient();

    if (studentId) {
      // 学生视角：获取可参加的考试和考试记录
      const { data: exams, error } = await client
        .from('exams')
        .select('*')
        .in('status', ['published', 'ended'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('查询考试失败:', error);
        return NextResponse.json({ error: '查询失败' }, { status: 500 });
      }

      // 获取学生的考试记录
      const { data: records } = await client
        .from('exam_records')
        .select('*')
        .eq('student_id', studentId);

      return NextResponse.json({
        success: true,
        exams: exams || [],
        records: records || [],
      });
    }

    let query = client
      .from('exams')
      .select('*')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (creatorId) {
      query = query.eq('creator_id', creatorId);
    }

    const { data: exams, error } = await query;

    if (error) {
      console.error('查询考试列表失败:', error);
      return NextResponse.json({ error: '查询失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, exams: exams || [] });
  } catch (error) {
    console.error('获取考试列表异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 创建考试
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = insertExamSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: '数据格式错误' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const { questionConfig, bankId } = body;
    
    // 验证题目配置
    const totalQuestionsNeeded = Object.values(questionConfig as Record<string, number>)
      .reduce((sum: number, count) => sum + (count as number), 0);
    
    if (totalQuestionsNeeded === 0) {
      return NextResponse.json({ error: '请至少选择一种题目类型' }, { status: 400 });
    }

    // 检查题库中是否有足够的题目
    const questionCounts: Record<string, number> = {};
    const warnings: string[] = [];
    
    for (const [type, count] of Object.entries(questionConfig as Record<string, number>)) {
      if (count > 0) {
        let query = client
          .from('questions')
          .select('id', { count: 'exact', head: true })
          .eq('type', type);
        
        // 如果指定了题库，则从该题库抽题
        if (bankId) {
          query = query.eq('bank_id', bankId);
        }
        
        const { count: availableCount } = await query;
        questionCounts[type] = availableCount || 0;
        
        if ((availableCount || 0) < count) {
          const typeName: Record<string, string> = {
            single: '单选题',
            multiple: '多选题',
            judge: '判断题',
            short: '简答题'
          };
          warnings.push(`${typeName[type] || type}题目不足：需要${count}道，仅有${availableCount || 0}道`);
        }
      }
    }

    // 如果题目不足，返回警告
    if (warnings.length > 0) {
      return NextResponse.json({ 
        error: '题目数量不足', 
        warnings,
        questionCounts
      }, { status: 400 });
    }

    // 随机抽取题目
    const questionIds: string[] = [];
    const questionDetails: any[] = [];

    for (const [type, count] of Object.entries(questionConfig as Record<string, number>)) {
      if (count > 0) {
        let query = client
          .from('questions')
          .select('id, score')
          .eq('type', type);
        
        if (bankId) {
          query = query.eq('bank_id', bankId);
        }
        
        const { data: questions } = await query;

        if (questions && questions.length > 0) {
          // 随机选择指定数量
          const shuffled = [...questions].sort(() => Math.random() - 0.5);
          const selected = shuffled.slice(0, count);
          questionIds.push(...selected.map(q => q.id));
          questionDetails.push(...selected.map(q => ({ id: q.id, score: q.score })));
        }
      }
    }

    // 计算总分
    const totalScore = questionDetails.reduce((sum, q) => sum + (q.score || 2), 0);

    const { data, error } = await client
      .from('exams')
      .insert({
        title: parsed.data.title,
        description: parsed.data.description,
        duration: parsed.data.duration,
        total_score: totalScore,
        question_config: parsed.data.questionConfig,
        question_ids: questionIds,
        anti_cheat: parsed.data.antiCheat ?? true,
        status: 'draft',
        creator_id: parsed.data.creatorId,
      })
      .select()
      .single();

    if (error) {
      console.error('创建考试失败:', error);
      return NextResponse.json({ error: '创建失败' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      exam: data,
      message: `考试创建成功，共抽取${questionIds.length}道题目，总分${totalScore}分`
    });
  } catch (error) {
    console.error('创建考试异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 更新考试状态
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { examId, status, questionIds, title, description, duration, gradePublicType, gradingCompleted } = body;

    if (!examId) {
      return NextResponse.json({ error: '考试ID不能为空' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const updateData: Record<string, any> = {};

    if (status) {
      // 发布前检查
      if (status === 'published') {
        const { data: exam } = await client
          .from('exams')
          .select('question_ids')
          .eq('id', examId)
          .single();
        
        if (!exam?.question_ids || exam.question_ids.length === 0) {
          return NextResponse.json({ error: '请先抽取题目再发布考试' }, { status: 400 });
        }
        
        updateData.status = status;
        updateData.start_time = new Date().toISOString();
      } else if (status === 'ended') {
        updateData.status = status;
        updateData.end_time = new Date().toISOString();
      } else {
        updateData.status = status;
      }
    }
    
    if (questionIds) {
      updateData.question_ids = questionIds;
    }
    
    if (title) {
      updateData.title = title;
    }
    
    if (description !== undefined) {
      updateData.description = description;
    }
    
    if (duration) {
      updateData.duration = duration;
    }
    
    // 成绩公开类型
    if (gradePublicType) {
      updateData.grade_public_type = gradePublicType;
    }
    
    // 批阅完成标记
    if (gradingCompleted !== undefined) {
      updateData.grading_completed = gradingCompleted;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '没有要更新的内容' }, { status: 400 });
    }

    const { error } = await client
      .from('exams')
      .update(updateData)
      .eq('id', examId);

    if (error) {
      console.error('更新考试失败:', error);
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新考试异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 删除考试
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '考试ID不能为空' }, { status: 400 });
    }

    const client = getSupabaseClient();
    
    // 先删除相关的考试记录
    await client
      .from('exam_records')
      .delete()
      .eq('exam_id', id);
    
    // 再删除考试
    const { error } = await client.from('exams').delete().eq('id', id);

    if (error) {
      console.error('删除考试失败:', error);
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除考试异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
