import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取考试详情（包含题目）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('examId');
    const recordId = searchParams.get('recordId');
    const studentId = searchParams.get('studentId');

    const client = getSupabaseClient();

    if (recordId) {
      // 获取考试记录详情（用于批改）
      const { data: record, error } = await client
        .from('exam_records')
        .select('*, exams(*), users!exam_records_student_id_fkey(name, account)')
        .eq('id', recordId)
        .single();

      if (error) {
        console.error('查询考试记录失败:', error);
        return NextResponse.json({ error: '查询失败' }, { status: 500 });
      }

      // 获取题目详情
      if (record.exams?.question_ids) {
        const { data: questions } = await client
          .from('questions')
          .select('*')
          .in('id', record.exams.question_ids);
        return NextResponse.json({ success: true, record, questions: questions || [] });
      }

      return NextResponse.json({ success: true, record, questions: [] });
    }

    if (examId && studentId) {
      // 学生获取考试详情（不包含答案）
      const { data: exam, error } = await client
        .from('exams')
        .select('*')
        .eq('id', examId)
        .single();

      if (error) {
        console.error('查询考试失败:', error);
        return NextResponse.json({ error: '考试不存在' }, { status: 404 });
      }

      // 检查考试状态
      if (exam.status !== 'published') {
        return NextResponse.json({ error: '考试未发布或已结束' }, { status: 400 });
      }

      // 获取学生的考试记录
      const { data: record } = await client
        .from('exam_records')
        .select('*')
        .eq('exam_id', examId)
        .eq('student_id', studentId)
        .single();

      // 获取题目详情（不包含答案，学生考试时）
      if (exam.question_ids && exam.question_ids.length > 0) {
        const { data: questions } = await client
          .from('questions')
          .select('id, content, type, options, difficulty, score, subject')
          .in('id', exam.question_ids);

        return NextResponse.json({ 
          success: true, 
          exam, 
          questions: questions || [],
          record: record || null
        });
      }

      return NextResponse.json({ success: true, exam, questions: [], record: record || null });
    }

    if (examId) {
      // 教师获取考试详情（包含答案）
      const { data: exam, error } = await client
        .from('exams')
        .select('*')
        .eq('id', examId)
        .single();

      if (error) {
        console.error('查询考试失败:', error);
        return NextResponse.json({ error: '考试不存在' }, { status: 404 });
      }

      // 获取题目详情
      if (exam.question_ids && exam.question_ids.length > 0) {
        const { data: questions } = await client
          .from('questions')
          .select('*')
          .in('id', exam.question_ids);

        // 获取所有考试记录
        const { data: records } = await client
          .from('exam_records')
          .select('*, users!exam_records_student_id_fkey(name, account)')
          .eq('exam_id', examId);

        return NextResponse.json({ 
          success: true, 
          exam, 
          questions: questions || [],
          records: records || []
        });
      }

      return NextResponse.json({ success: true, exam, questions: [], records: [] });
    }

    return NextResponse.json({ error: '缺少参数' }, { status: 400 });
  } catch (error) {
    console.error('获取考试详情异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 开始考试 / 提交考试 / 自动保存
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { examId, studentId, action, answers, antiCheatFlags } = body;

    if (!examId || !studentId) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const client = getSupabaseClient();

    if (action === 'start') {
      // 开始考试
      const { data: existingRecord } = await client
        .from('exam_records')
        .select('*')
        .eq('exam_id', examId)
        .eq('student_id', studentId)
        .single();

      if (existingRecord) {
        // 已有记录，返回现有记录
        if (existingRecord.status === 'submitted' || existingRecord.status === 'graded') {
          return NextResponse.json({ 
            error: '您已提交过考试', 
            record: existingRecord 
          }, { status: 400 });
        }
        return NextResponse.json({ success: true, record: existingRecord });
      }

      // 创建新记录
      const { data, error } = await client
        .from('exam_records')
        .insert({
          exam_id: examId,
          student_id: studentId,
          status: 'ongoing',
          start_time: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('开始考试失败:', error);
        return NextResponse.json({ error: '开始考试失败' }, { status: 500 });
      }

      return NextResponse.json({ success: true, record: data });
    }

    if (action === 'save') {
      // 自动保存答案
      const { error } = await client
        .from('exam_records')
        .update({
          answers,
        })
        .eq('exam_id', examId)
        .eq('student_id', studentId);

      if (error) {
        console.error('保存答案失败:', error);
        return NextResponse.json({ error: '保存失败' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: '答案已保存' });
    }

    if (action === 'submit') {
      // 提交考试并自动批改客观题
      const { data: exam } = await client
        .from('exams')
        .select('question_ids')
        .eq('id', examId)
        .single();

      if (!exam || !exam.question_ids) {
        return NextResponse.json({ error: '考试不存在' }, { status: 404 });
      }

      // 获取所有题目
      const { data: questions } = await client
        .from('questions')
        .select('*')
        .in('id', exam.question_ids);

      // 自动批改客观题
      let autoScore = 0;
      let autoGradedCount = 0;
      const gradedAnswers: Record<string, any> = {};

      if (questions && answers) {
        for (const question of questions) {
          const studentAnswer = answers[question.id];
          
          if (studentAnswer) {
            // 单选题、判断题、多选题可以自动批改
            if (question.type === 'single' || question.type === 'judge') {
              if (studentAnswer === question.answer) {
                autoScore += question.score || 2;
                gradedAnswers[question.id] = {
                  answer: studentAnswer,
                  correct: true,
                  score: question.score || 2
                };
              } else {
                gradedAnswers[question.id] = {
                  answer: studentAnswer,
                  correct: false,
                  score: 0
                };
              }
              autoGradedCount++;
            } else if (question.type === 'multiple') {
              // 多选题：答案可能是多个字母，如 "AB" 或 "A,B"
              const correctAnswer = question.answer.replace(/[,，\s]/g, '').split('').sort().join('');
              const studentAns = studentAnswer.replace(/[,，\s]/g, '').split('').sort().join('');
              
              if (correctAnswer === studentAns) {
                autoScore += question.score || 2;
                gradedAnswers[question.id] = {
                  answer: studentAnswer,
                  correct: true,
                  score: question.score || 2
                };
              } else {
                gradedAnswers[question.id] = {
                  answer: studentAnswer,
                  correct: false,
                  score: 0
                };
              }
              autoGradedCount++;
            } else {
              // 简答题需要人工批改
              gradedAnswers[question.id] = {
                answer: studentAnswer,
                correct: null,
                score: null,
                needsGrading: true
              };
            }
          }
        }
      }

      // 检查是否全部是客观题
      const hasSubjectiveQuestions = questions?.some(q => q.type === 'short') || false;
      const finalStatus = hasSubjectiveQuestions ? 'submitted' : 'graded';

      const { error } = await client
        .from('exam_records')
        .update({
          answers: { ...answers, _graded: gradedAnswers },
          score: hasSubjectiveQuestions ? null : autoScore,
          status: finalStatus,
          submit_time: new Date().toISOString(),
          anti_cheat_flags: antiCheatFlags,
          graded_at: hasSubjectiveQuestions ? null : new Date().toISOString(),
        })
        .eq('exam_id', examId)
        .eq('student_id', studentId);

      if (error) {
        console.error('提交考试失败:', error);
        return NextResponse.json({ error: '提交失败' }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        message: '提交成功',
        autoScore: hasSubjectiveQuestions ? null : autoScore,
        autoGradedCount,
        needsManualGrading: hasSubjectiveQuestions
      });
    }

    if (action === 'anticheat') {
      // 记录防作弊事件
      const { data: record } = await client
        .from('exam_records')
        .select('anti_cheat_flags')
        .eq('exam_id', examId)
        .eq('student_id', studentId)
        .single();

      const existingFlags = record?.anti_cheat_flags || [];
      existingFlags.push({
        ...antiCheatFlags,
        timestamp: new Date().toISOString(),
      });

      await client
        .from('exam_records')
        .update({ anti_cheat_flags: existingFlags })
        .eq('exam_id', examId)
        .eq('student_id', studentId);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (error) {
    console.error('考试操作异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 批改考试（主观题）
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { recordId, score, gradedBy, gradedAnswers } = body;

    if (!recordId) {
      return NextResponse.json({ error: '记录ID不能为空' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 获取考试记录
    const { data: record } = await client
      .from('exam_records')
      .select('answers, exam_id')
      .eq('id', recordId)
      .single();

    if (!record) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    }

    // 更新批改结果
    const updatedAnswers = { ...record.answers };
    if (gradedAnswers) {
      updatedAnswers._graded = {
        ...updatedAnswers._graded,
        ...gradedAnswers
      };
    }

    const { error } = await client
      .from('exam_records')
      .update({
        score,
        status: 'graded',
        graded_at: new Date().toISOString(),
        graded_by: gradedBy,
        answers: updatedAnswers,
      })
      .eq('id', recordId);

    if (error) {
      console.error('批改考试失败:', error);
      return NextResponse.json({ error: '批改失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '批改成功' });
  } catch (error) {
    console.error('批改考试异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
