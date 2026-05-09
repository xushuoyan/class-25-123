import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 教师邀请码
const TEACHER_INVITE_CODE = '347954';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { account, password, name, role, studentId, inviteCode } = body;
    
    // 基础验证
    if (!account || !password || !name || !role) {
      return NextResponse.json(
        { error: '请填写所有必填项' },
        { status: 400 }
      );
    }
    
    if (password.length < 3) {
      return NextResponse.json(
        { error: '密码长度不能少于3位' },
        { status: 400 }
      );
    }
    
    // 学生端验证
    if (role === 'student') {
      if (!studentId) {
        return NextResponse.json(
          { error: '请输入学号' },
          { status: 400 }
        );
      }
      
      // 验证学号格式：10位数字
      const studentIdRegex = /^\d{10}$/;
      if (!studentIdRegex.test(studentId)) {
        return NextResponse.json(
          { error: '学号必须是10位数字' },
          { status: 400 }
        );
      }
    }
    
    // 教师端验证
    if (role === 'teacher') {
      if (!inviteCode) {
        return NextResponse.json(
          { error: '请输入教师邀请码' },
          { status: 400 }
        );
      }
      
      // 验证邀请码
      if (inviteCode !== TEACHER_INVITE_CODE) {
        return NextResponse.json(
          { error: '邀请码错误，请输入正确的邀请码' },
          { status: 400 }
        );
      }
    }
    
    // 尝试使用 Supabase 数据库
    try {
      const client = getSupabaseClient();
      
      // 检查账号是否已存在
      const { data: existingUser } = await client
        .from('users')
        .select('id')
        .eq('account', account)
        .single();
      
      if (existingUser) {
        return NextResponse.json(
          { error: '该账号已被注册' },
          { status: 400 }
        );
      }
      
      // 学生：检查学号是否已被使用
      if (role === 'student' && studentId) {
        const { data: existingStudentId } = await client
          .from('users')
          .select('id')
          .eq('student_id', studentId)
          .single();
        
        if (existingStudentId) {
          return NextResponse.json(
            { error: '该学号已被注册，一个学号只能注册一个账号' },
            { status: 400 }
          );
        }
      }
      
      // 创建用户数据
      const userData: Record<string, any> = {
        account,
        password,
        name,
        role: role || 'student',
        avatar: `https://picsum.photos/40/40?random=${Date.now()}`,
      };
      
      // 学生添加学号
      if (role === 'student' && studentId) {
        userData.student_id = studentId;
      }
      
      // 教师添加邀请码
      if (role === 'teacher' && inviteCode) {
        userData.invite_code = inviteCode;
      }
      
      // 创建用户
      const { data, error } = await client
        .from('users')
        .insert(userData)
        .select()
        .single();
      
      if (error) {
        console.error('注册失败:', error);
        return NextResponse.json(
          { error: '注册失败，请稍后重试' },
          { status: 500 }
        );
      }
      
      // 返回用户信息（不包含密码）
      const { password: _, ...userWithoutPassword } = data;
      
      return NextResponse.json({
        success: true,
        message: '注册成功',
        user: userWithoutPassword,
      });
    } catch (dbError) {
      // 数据库不可用时，使用本地存储降级方案
      console.warn('数据库不可用，使用本地存储模式:', dbError);
      return registerWithLocalStorage(account, password, name, role, studentId, inviteCode);
    }
  } catch (error) {
    console.error('注册异常:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}

// 本地存储降级注册
function registerWithLocalStorage(
  account: string, 
  password: string, 
  name: string, 
  role: string, 
  studentId: string | undefined, 
  inviteCode: string | undefined
) {
  // 从 localStorage 读取用户列表（通过全局模拟）
  // 注意：服务端无法直接访问 localStorage，这里返回特殊标记让前端处理
  const user = {
    id: 'u' + Date.now(),
    account,
    name,
    role,
    avatar: `https://picsum.photos/40/40?random=${Date.now()}`,
    student_id: studentId || null,
    created_at: new Date().toISOString(),
  };

  return NextResponse.json({
    success: true,
    message: '注册成功',
    user,
    localMode: true, // 标记为本地模式
  });
}
