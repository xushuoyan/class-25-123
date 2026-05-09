import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { LLMClient, FetchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

// AI从文件提取题目
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, creatorId, questionCount = 5, questionTypes = ['single', 'multiple', 'judge'], bankId } = body;

    if (!fileId || !creatorId) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 获取文件信息
    const { data: file, error: fileError } = await client
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fileError || !file) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    }

    if (!file.download_url) {
      return NextResponse.json({ error: '文件下载链接不存在' }, { status: 400 });
    }

    // 提取请求头用于SDK调用
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    // 步骤1: 使用FetchClient获取文件内容
    const fetchClient = new FetchClient(new Config(), customHeaders);
    
    console.log('正在获取文件内容:', file.download_url);
    const fetchResponse = await fetchClient.fetch(file.download_url);
    
    if (fetchResponse.status_code !== 0) {
      console.error('获取文件内容失败:', fetchResponse.status_message);
      return NextResponse.json({ error: `获取文件内容失败: ${fetchResponse.status_message || '未知错误'}` }, { status: 500 });
    }

    // 提取文本内容
    const textContent = fetchResponse.content
      .filter((item: any) => item.type === 'text')
      .map((item: any) => item.text)
      .join('\n');

    if (!textContent || textContent.length < 50) {
      return NextResponse.json({ error: '文件内容太少，无法提取题目' }, { status: 400 });
    }

    console.log('文件内容长度:', textContent.length);

    // 步骤2: 使用LLM从文件内容生成题目
    const llmClient = new LLMClient(new Config(), customHeaders);

    const typeNameMap: Record<string, string> = {
      single: '单选题',
      multiple: '多选题',
      judge: '判断题',
      short: '简答题'
    };

    const prompt = `你是一个专业的试题生成助手。请根据以下文件内容，生成${questionCount}道考试题目。

要求：
1. 题目类型包括：${questionTypes.map((t: string) => typeNameMap[t] || t).join('、')}
2. 每道题必须包含：题目内容、选项（单选/多选需要）、正确答案、解析
3. 难度分为：easy（简单）、medium（中等）、hard（困难）
4. 请严格按照JSON数组格式返回，不要包含其他文字说明
5. 返回格式如下：
[
  {
    "content": "题目内容",
    "type": "single",
    "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
    "answer": "A",
    "analysis": "答案解析",
    "difficulty": "easy",
    "score": 2
  }
]

文件名：${file.name}

文件内容：
${textContent.substring(0, 15000)}

请生成${questionCount}道题目，直接返回JSON数组：`;

    const messages = [{ role: 'user' as const, content: prompt }];
    
    console.log('正在调用LLM生成题目...');
    const response = await llmClient.invoke(messages, { temperature: 0.7 });

    console.log('LLM响应:', response.content.substring(0, 500));

    // 解析LLM返回的JSON
    let questions = [];
    try {
      // 提取JSON部分 - 尝试多种方式
      let jsonStr = response.content;
      
      // 尝试匹配 ```json ... ``` 格式
      const jsonBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonBlockMatch) {
        jsonStr = jsonBlockMatch[1].trim();
      }
      
      // 尝试匹配 [...] 数组
      const jsonArrayMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (jsonArrayMatch) {
        jsonStr = jsonArrayMatch[0];
      }
      
      questions = JSON.parse(jsonStr);
      
      if (!Array.isArray(questions)) {
        throw new Error('返回内容不是数组');
      }
    } catch (parseError) {
      console.error('解析AI返回内容失败:', parseError);
      console.error('原始内容:', response.content);
      return NextResponse.json({ error: 'AI生成内容解析失败，请重试' }, { status: 500 });
    }

    if (questions.length === 0) {
      return NextResponse.json({ error: '未能生成有效题目，请检查文件内容' }, { status: 400 });
    }

    // 批量插入题目到数据库
    const questionsToInsert = questions.map((q: any) => ({
      content: q.content,
      type: q.type || 'single',
      options: q.options || null,
      answer: q.answer,
      analysis: q.analysis || null,
      difficulty: q.difficulty || 'medium',
      score: q.score || 2,
      subject: file.name.replace(/\.[^/.]+$/, ''),
      source_file_id: fileId,
      bank_id: bankId || null,
      creator_id: creatorId,
    }));

    const { data: insertedQuestions, error: insertError } = await client
      .from('questions')
      .insert(questionsToInsert)
      .select();

    if (insertError) {
      console.error('插入题目失败:', insertError);
      return NextResponse.json({ error: '保存题目失败' }, { status: 500 });
    }

    console.log('成功生成题目数量:', insertedQuestions?.length);

    return NextResponse.json({
      success: true,
      message: `成功生成${insertedQuestions?.length || 0}道题目`,
      questions: insertedQuestions,
    });
  } catch (error) {
    console.error('AI提取题目异常:', error);
    return NextResponse.json({ error: '服务器错误: ' + (error instanceof Error ? error.message : '未知错误') }, { status: 500 });
  }
}
