import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取文件夹列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get('creatorId');
    const parentId = searchParams.get('parentId'); // null表示根目录

    const client = getSupabaseClient();

    let query = client
      .from('folders')
      .select('*')
      .order('created_at', { ascending: true });

    if (creatorId) {
      query = query.eq('creator_id', creatorId);
    }

    if (parentId === 'null' || parentId === 'root') {
      query = query.is('parent_id', null);
    } else if (parentId) {
      query = query.eq('parent_id', parentId);
    }

    const { data: folders, error } = await query;

    if (error) {
      console.error('获取文件夹列表失败:', error);
      return NextResponse.json({ error: '获取失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, folders: folders || [] });
  } catch (error) {
    console.error('获取文件夹列表异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 创建文件夹
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, parentId, creatorId } = body;

    if (!name || !creatorId) {
      return NextResponse.json({ error: '文件夹名称和创建者ID不能为空' }, { status: 400 });
    }

    const client = getSupabaseClient();

    const { data, error } = await client
      .from('folders')
      .insert({
        name,
        parent_id: parentId || null,
        creator_id: creatorId,
      })
      .select()
      .single();

    if (error) {
      console.error('创建文件夹失败:', error);
      return NextResponse.json({ error: '创建失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, folder: data });
  } catch (error) {
    console.error('创建文件夹异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 更新文件夹
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { folderId, name, parentId } = body;

    if (!folderId) {
      return NextResponse.json({ error: '文件夹ID不能为空' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const updateData: Record<string, any> = {};
    
    if (name) updateData.name = name;
    if (parentId !== undefined) updateData.parent_id = parentId || null;

    const { error } = await client
      .from('folders')
      .update(updateData)
      .eq('id', folderId);

    if (error) {
      console.error('更新文件夹失败:', error);
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '文件夹已更新' });
  } catch (error) {
    console.error('更新文件夹异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 删除文件夹
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');

    if (!folderId) {
      return NextResponse.json({ error: '文件夹ID不能为空' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 将文件夹内的文件的folder_id设为null
    await client
      .from('files')
      .update({ folder_id: null })
      .eq('folder_id', folderId);

    // 删除子文件夹（或将其移到根目录）
    await client
      .from('folders')
      .update({ parent_id: null })
      .eq('parent_id', folderId);

    // 删除文件夹
    const { error } = await client
      .from('folders')
      .delete()
      .eq('id', folderId);

    if (error) {
      console.error('删除文件夹失败:', error);
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '文件夹已删除' });
  } catch (error) {
    console.error('删除文件夹异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
