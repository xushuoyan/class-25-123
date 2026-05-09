import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { S3Storage } from 'coze-coding-dev-sdk';

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const uploaderId = searchParams.get('uploaderId');
    const folderId = searchParams.get('folderId');
    
    const client = getSupabaseClient();
    
    let query = client
      .from('files')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (type && type !== '全部') {
      query = query.eq('type', type);
    }
    
    if (uploaderId) {
      query = query.eq('uploader_id', uploaderId);
    }

    if (folderId === 'null' || folderId === 'root') {
      query = query.is('folder_id', null);
    } else if (folderId) {
      query = query.eq('folder_id', folderId);
    }
    
    const { data: files, error } = await query;
    
    if (error) {
      console.error('查询文件列表失败:', error);
      return NextResponse.json(
        { error: '查询文件列表失败' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      files: files || [],
    });
  } catch (error) {
    console.error('获取文件列表异常:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}

// 更新文件信息或下载次数
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, name, type, folderId, incrementDownloads } = body;
    
    if (!fileId) {
      return NextResponse.json(
        { error: '文件ID不能为空' },
        { status: 400 }
      );
    }
    
    const client = getSupabaseClient();
    const updateData: Record<string, any> = {};

    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (folderId !== undefined) updateData.folder_id = folderId || null;

    if (incrementDownloads) {
      // 先获取当前下载次数
      const { data: file } = await client
        .from('files')
        .select('downloads')
        .eq('id', fileId)
        .single();
      
      if (file) {
        updateData.downloads = (file.downloads || 0) + 1;
      }
    }
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: '没有要更新的内容' },
        { status: 400 }
      );
    }

    const { error } = await client
      .from('files')
      .update(updateData)
      .eq('id', fileId);
    
    if (error) {
      console.error('更新文件失败:', error);
      return NextResponse.json(
        { error: '更新失败' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: '文件已更新',
    });
  } catch (error) {
    console.error('更新文件异常:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}

// 删除文件
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    
    if (!fileId) {
      return NextResponse.json(
        { error: '文件ID不能为空' },
        { status: 400 }
      );
    }
    
    const client = getSupabaseClient();
    
    // 获取文件信息
    const { data: file } = await client
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();
    
    if (!file) {
      return NextResponse.json(
        { error: '文件不存在' },
        { status: 404 }
      );
    }
    
    // 删除对象存储中的文件
    try {
      await storage.deleteFile({ fileKey: file.storage_key });
    } catch (deleteError) {
      console.error('删除存储文件失败:', deleteError);
      // 继续删除数据库记录
    }
    
    // 删除数据库记录
    const { error } = await client
      .from('files')
      .delete()
      .eq('id', fileId);
    
    if (error) {
      console.error('删除文件记录失败:', error);
      return NextResponse.json(
        { error: '删除失败' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: '文件已删除',
    });
  } catch (error) {
    console.error('删除文件异常:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
