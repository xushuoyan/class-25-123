import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { S3Storage, LLMClient, FetchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

// 支持的文件类型
const SUPPORTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

const FILE_TYPE_NAMES: Record<string, string> = {
  'application/pdf': 'PDF文档',
  'application/msword': 'Word文档',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word文档',
  'text/plain': '文本文件',
  'text/markdown': 'Markdown文件',
  'application/vnd.ms-powerpoint': 'PPT演示文稿',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPT演示文稿',
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;
    const type = formData.get('type') as string || '课件';
    const uploaderId = formData.get('uploaderId') as string;
    const isPublic = formData.get('isPublic') === 'true';
    const folderId = formData.get('folderId') as string || null;
    const autoExtract = formData.get('autoExtract') === 'true';
    const bankId = formData.get('bankId') as string || null;
    const questionCount = parseInt(formData.get('questionCount') as string || '5');
    
    if (!file || !uploaderId) {
      return NextResponse.json(
        { error: '文件和上传者ID不能为空' },
        { status: 400 }
      );
    }

    // 验证文件类型
    if (!SUPPORTED_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: `不支持的文件类型: ${file.type}。支持的类型: PDF、Word、TXT、Markdown、PPT、图片` },
        { status: 400 }
      );
    }

    // 验证文件大小 (最大50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: '文件大小不能超过50MB' },
        { status: 400 }
      );
    }
    
    // 读取文件内容
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = `course-files/${Date.now()}_${file.name}`;
    
    // 上传到对象存储
    const storageKey = await storage.uploadFile({
      fileContent: fileBuffer,
      fileName: fileName,
      contentType: file.type,
    });
    
    // 生成下载链接（有效期30天）
    const downloadUrl = await storage.generatePresignedUrl({
      key: storageKey,
      expireTime: 2592000,
    });
    
    // 保存文件记录到数据库
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('files')
      .insert({
        name: name || file.name,
        type,
        size: file.size,
        storage_key: storageKey,
        download_url: downloadUrl,
        uploader_id: uploaderId,
        is_public: isPublic,
        folder_id: folderId || null,
      })
      .select()
      .single();
    
    if (error) {
      console.error('保存文件记录失败:', error);
      return NextResponse.json(
        { error: '保存文件记录失败' },
        { status: 500 }
      );
    }

    // 如果启用了自动提取题目，异步处理
    let extractResult = null;
    if (autoExtract && SUPPORTED_TYPES.includes(file.type)) {
      try {
        extractResult = await extractQuestionsFromFile(
          data.id,
          downloadUrl,
          file.name,
          uploaderId,
          bankId,
          questionCount,
          request.headers
        );
      } catch (extractError) {
        console.error('自动提取题目失败:', extractError);
        // 不影响文件上传成功
      }
    }
    
    return NextResponse.json({
      success: true,
      message: '文件上传成功',
      file: data,
      extractResult: extractResult ? {
        success: true,
        questionCount: extractResult.length,
        message: `成功提取${extractResult.length}道题目`
      } : null,
    });
  } catch (error) {
    console.error('文件上传异常:', error);
    return NextResponse.json(
      { error: '文件上传失败' },
      { status: 500 }
    );
  }
}

// 从文件提取题目的核心函数
async function extractQuestionsFromFile(
  fileId: string,
  fileUrl: string,
  fileName: string,
  creatorId: string,
  bankId: string | null,
  questionCount: number,
  headers: Headers
): Promise<any[]> {
  const customHeaders = HeaderUtils.extractForwardHeaders(headers);
  
  // 步骤1: 使用FetchClient获取文件内容
  const fetchClient = new FetchClient(new Config(), customHeaders);
  
  console.log('正在获取文件内容:', fileUrl);
  const fetchResponse = await fetchClient.fetch(fileUrl);
  
  if (fetchResponse.status_code !== 0) {
    throw new Error(`获取文件内容失败: ${fetchResponse.status_message || '未知错误'}`);
  }

  // 提取文本内容
  const textContent = fetchResponse.content
    .filter((item: any) => item.type === 'text')
    .map((item: any) => item.text)
    .join('\n');

  if (!textContent || textContent.length < 50) {
    throw new Error('文件内容太少，无法提取题目');
  }

  console.log('文件内容长度:', textContent.length);

  // 步骤2: 使用LLM从文件内容生成题目
  const llmClient = new LLMClient(new Config(), customHeaders);

  const prompt = `你是一个专业的试题生成助手。请根据以下文件内容，生成${questionCount}道考试题目。

要求：
1. 题目类型包括：单选题(single)、多选题(multiple)、判断题(judge)、简答题(short)
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

文件名：${fileName}

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
    let jsonStr = response.content;
    
    const jsonBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
      jsonStr = jsonBlockMatch[1].trim();
    }
    
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
    throw new Error('AI生成内容解析失败');
  }

  if (questions.length === 0) {
    throw new Error('未能生成有效题目');
  }

  // 批量插入题目到数据库
  const client = getSupabaseClient();
  const questionsToInsert = questions.map((q: any) => ({
    content: q.content,
    type: q.type || 'single',
    options: q.options || null,
    answer: q.answer,
    analysis: q.analysis || null,
    difficulty: q.difficulty || 'medium',
    score: q.score || 2,
    subject: fileName.replace(/\.[^/.]+$/, ''),
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
    throw new Error('保存题目失败');
  }

  console.log('成功生成题目数量:', insertedQuestions?.length);
  return insertedQuestions || [];
}
