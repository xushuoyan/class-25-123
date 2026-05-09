import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 学生签到
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { signInId, studentId, studentName, code, latitude, longitude } = body;

    if (!signInId || !studentId || !studentName) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 获取签到信息
    const { data: signIn, error: signInError } = await client
      .from('sign_ins')
      .select('*')
      .eq('id', signInId)
      .single();

    if (signInError || !signIn) {
      return NextResponse.json({ error: '签到不存在' }, { status: 404 });
    }

    // 检查签到是否已结束
    if (signIn.status === 'ended') {
      return NextResponse.json({ error: '签到已结束' }, { status: 400 });
    }

    // 检查是否已签到
    const { data: existingRecord } = await client
      .from('sign_in_records')
      .select('*')
      .eq('sign_in_id', signInId)
      .eq('student_id', studentId)
      .single();

    if (existingRecord) {
      return NextResponse.json({ error: '您已签到', status: 'already_signed' });
    }

    let status = 'success';

    // 验证签到码
    if (signIn.type === 'code') {
      if (!code || code.toUpperCase() !== signIn.code?.toUpperCase()) {
        return NextResponse.json({ error: '签到码错误' }, { status: 400 });
      }
    }

    // 验证位置（定位签到）
    if (signIn.type === 'location' && latitude && longitude && signIn.latitude && signIn.longitude) {
      const distance = calculateDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        parseFloat(signIn.latitude),
        parseFloat(signIn.longitude)
      );

      if (distance > (signIn.radius || 100)) {
        status = 'invalid_location';
      }
    }

    // 创建签到记录
    const { data, error } = await client
      .from('sign_in_records')
      .insert({
        sign_in_id: signInId,
        student_id: studentId,
        student_name: studentName,
        latitude,
        longitude,
        status,
      })
      .select()
      .single();

    if (error) {
      console.error('签到失败:', error);
      return NextResponse.json({ error: '签到失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: status === 'success' ? '签到成功' : status === 'invalid_location' ? '签到成功（位置异常）' : '签到成功',
      record: data,
      status,
    });
  } catch (error) {
    console.error('签到异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 获取签到记录
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const signInId = searchParams.get('signInId');

    if (!signInId) {
      return NextResponse.json({ error: '缺少签到ID' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const { data: records, error } = await client
      .from('sign_in_records')
      .select('*')
      .eq('sign_in_id', signInId)
      .order('signed_at', { ascending: false });

    if (error) {
      console.error('查询签到记录失败:', error);
      return NextResponse.json({ error: '查询失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, records: records || [] });
  } catch (error) {
    console.error('获取签到记录异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 计算两点间距离（米）
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // 地球半径（米）
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
