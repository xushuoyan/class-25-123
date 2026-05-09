'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Home, FileText, BookOpen, PenSquare, CheckSquare, 
  Upload, Download, Plus, Trash2, Timer, Users, MapPin,
  LogOut, GraduationCap, FileDown, Eye, EyeOff, AlertTriangle,
  Play, StopCircle, Send, RefreshCw, Check, X, FolderOpen,
  MessageCircle, Settings, Edit, FolderPlus, Move, Copy, Menu
} from 'lucide-react';

// 类型定义
interface User {
  id: string;
  account: string;
  name: string;
  role: 'teacher' | 'student' | 'admin';
  avatar?: string;
  student_id?: string;
}

// 管理员账号配置
const ADMIN_ACCOUNT = 'worker';
const ADMIN_PASSWORD = '347954';

// 切屏警告次数限制
const MAX_TAB_SWITCHES = 3;

interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  download_url: string;
  folder_id?: string;
  uploader_id: string;
  downloads: number;
  created_at: string;
}

interface Folder {
  id: string;
  name: string;
  parent_id?: string;
  creator_id: string;
  created_at: string;
}

interface Question {
  id: string;
  content: string;
  type: 'single' | 'multiple' | 'judge' | 'short';
  options?: string[];
  answer: string;
  analysis?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  score: number;
  subject?: string;
  bank_id?: string;
  created_at: string;
}

interface QuestionBank {
  id: string;
  name: string;
  description?: string;
  subject?: string;
  creator_id: string;
  question_count?: number;
  created_at: string;
}

interface Exam {
  id: string;
  title: string;
  description?: string;
  duration: number;
  total_score: number;
  question_config: Record<string, number>;
  question_ids?: string[];
  anti_cheat: boolean;
  status: 'draft' | 'published' | 'ongoing' | 'ended';
  creator_id: string;
  start_time?: string;
  end_time?: string;
  created_at: string;
  grade_public_type: 'none' | 'personal' | 'all';
  grading_completed: boolean;
}

interface ExamRecord {
  id: string;
  exam_id: string;
  student_id: string;
  answers?: Record<string, string>;
  score?: number | null;
  status: 'not_started' | 'ongoing' | 'submitted' | 'graded';
  start_time?: string;
  submit_time?: string;
  anti_cheat_flags?: Array<{ type: string; timestamp: string }>;
  graded_at?: string;
  graded_answers?: Record<string, {
    answer: string;
    correct: boolean | null;
    score: number | null;
    autoGraded: boolean;
    needsGrading?: boolean;
  }>;
  // 关联的用户信息
  users?: { name: string; account: string };
}

interface SignIn {
  id: string;
  title: string;
  type: 'location' | 'code';
  code?: string;
  latitude?: string;
  longitude?: string;
  radius?: number;
  duration: number;
  status: 'active' | 'ended';
  creator_id: string;
  end_time?: string;
  created_at: string;
}

interface SignInRecord {
  id: string;
  sign_in_id: string;
  student_id: string;
  student_name: string;
  latitude?: string;
  longitude?: string;
  status: 'success' | 'late' | 'invalid_location';
  signed_at: string;
}

interface ClassInfo {
  id: string;
  name: string;
  description?: string;
  code: string;
  creator_id: string;
  created_at: string;
  class_members?: Array<{ count: number }>;
  nickname?: string;
  memberRole?: string;
}

interface ClassMember {
  id: string;
  userId: string;
  classId: string;
  nickname: string;
  role: 'teacher' | 'student';
  joinedAt: string;
  name?: string;
  account?: string;
  avatar?: string;
}

interface ChatMessage {
  id: string;
  class_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  created_at: string;
}

export default function CoursePlatform() {
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [examRecords, setExamRecords] = useState<ExamRecord[]>([]);
  const [signIns, setSignIns] = useState<SignIn[]>([]);
  const [signInRecords, setSignInRecords] = useState<SignInRecord[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [currentClass, setCurrentClass] = useState<ClassInfo | null>(null);
  const [classMembers, setClassMembers] = useState<ClassMember[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  
  const [loginForm, setLoginForm] = useState({ account: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ 
    account: '', 
    password: '', 
    name: '', 
    role: 'student',
    studentId: '',
    inviteCode: ''
  });
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  
  // 移动端菜单状态
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // 文件相关
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({ name: '', type: '课件', file: null as File | null, folderId: '' });
  const [filterType, setFilterType] = useState('全部');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderForm, setFolderForm] = useState({ name: '', parentId: '' });
  const [editFileDialogOpen, setEditFileDialogOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<FileItem | null>(null);
  
  // 题库相关
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [extractDialogOpen, setExtractDialogOpen] = useState(false);
  const [editQuestionDialogOpen, setEditQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>('all');
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [bankForm, setBankForm] = useState({ name: '', description: '', subject: '' });
  const [questionForm, setQuestionForm] = useState({
    content: '', type: 'single' as 'single' | 'multiple' | 'judge' | 'short',
    options: ['', '', '', ''], answer: '', analysis: '', difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    score: 2, subject: '', bankId: ''
  });
  const [questionFilter, setQuestionFilter] = useState({ type: 'all', difficulty: 'all' });
  const [extractForm, setExtractForm] = useState({ fileId: '', questionCount: 5, questionTypes: ['single', 'multiple', 'judge'] as string[] });
  
  // 考试相关
  const [examDialogOpen, setExamDialogOpen] = useState(false);
  const [examDetailOpen, setExamDetailOpen] = useState(false);
  const [examForm, setExamForm] = useState({
    title: '', description: '', duration: 30, totalScore: 100,
    questionConfig: { single: 10, multiple: 5, judge: 10, short: 2 },
    antiCheat: true
  });
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);
  const [currentExamQuestions, setCurrentExamQuestions] = useState<Question[]>([]);
  const [examAnswers, setExamAnswers] = useState<Record<string, string>>({});
  const [examTimer, setExamTimer] = useState(0);
  const [examTaking, setExamTaking] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<ExamRecord | null>(null);
  // 成绩查看相关
  const [examResultsOpen, setExamResultsOpen] = useState(false);
  const [examResultRecords, setExamResultRecords] = useState<Array<ExamRecord & { users?: { name: string; account: string } }>>([]);
  const [examResultExam, setExamResultExam] = useState<Exam | null>(null);
  
  // 考试进行中的状态
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);
  
  // 成绩分析相关
  const [examAnalysisOpen, setExamAnalysisOpen] = useState(false);
  const [examAnalysisData, setExamAnalysisData] = useState<{
    exam: Exam | null;
    records: ExamRecord[];
    questionStats: any[];
    scoreDistribution: Record<string, number>;
    avgScore: number;
    maxScore: number;
    passCount: number;
  } | null>(null);
  
  // 学生查看成绩/试卷相关
  const [studentExamResultOpen, setStudentExamResultOpen] = useState(false);
  const [studentExamPaperOpen, setStudentExamPaperOpen] = useState(false);
  const [studentExamView, setStudentExamView] = useState<Exam | null>(null);
  const [studentRecordView, setStudentRecordView] = useState<ExamRecord | null>(null);
  
  // 教师查看学生名单相关
  const [studentsListOpen, setStudentsListOpen] = useState(false);
  const [allStudents, setAllStudents] = useState<User[]>([]);
  
  // 管理员相关
  const [adminPage, setAdminPage] = useState('accounts');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  
  // 签到相关
  const [signInDialogOpen, setSignInDialogOpen] = useState(false);
  const [signInDetailOpen, setSignInDetailOpen] = useState(false);
  const [signInForm, setSignInForm] = useState({
    title: '', type: 'code' as 'location' | 'code',
    code: '', latitude: '', longitude: '', radius: 100, duration: 5
  });
  const [currentSignIn, setCurrentSignIn] = useState<SignIn | null>(null);
  const [studentSignInCode, setStudentSignInCode] = useState('');
  const [studentLocation, setStudentLocation] = useState<{ lat: string; lng: string } | null>(null);

  // 班级相关
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [classForm, setClassForm] = useState({ name: '', description: '' });
  const [joinClassCode, setJoinClassCode] = useState('');
  const [memberManageOpen, setMemberManageOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // 检查登录状态
  useEffect(() => {
    const savedUser = localStorage.getItem('courseUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // 获取文件列表
  const fetchFiles = useCallback(async () => {
    try {
      const folderParam = currentFolderId || 'root';
      const res = await fetch(`/api/files?type=${filterType}&folderId=${folderParam}`);
      const data = await res.json();
      if (data.success) setFiles(data.files);
    } catch (error) {
      console.error('获取文件列表失败:', error);
    }
  }, [filterType, currentFolderId]);

  // 获取文件夹列表
  const fetchFolders = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/folders?creatorId=${user.id}&parentId=${currentFolderId || 'root'}`);
      const data = await res.json();
      if (data.success) setFolders(data.folders);
    } catch (error) {
      console.error('获取文件夹列表失败:', error);
    }
  }, [user, currentFolderId]);

  // 获取题库分区列表
  const fetchQuestionBanks = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/question-banks?creatorId=${user.id}`);
      const data = await res.json();
      if (data.success) setQuestionBanks(data.banks);
    } catch (error) {
      console.error('获取题库分区列表失败:', error);
    }
  }, [user]);

  // 获取题目列表
  const fetchQuestions = useCallback(async () => {
    try {
      let url = `/api/questions?type=${questionFilter.type}&difficulty=${questionFilter.difficulty}`;
      if (selectedBankId && selectedBankId !== 'all') {
        url += `&bankId=${selectedBankId}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setQuestions(data.questions);
    } catch (error) {
      console.error('获取题目列表失败:', error);
    }
  }, [questionFilter, selectedBankId]);

  // 获取考试列表
  const fetchExams = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/exams?creatorId=${user.id}`);
      const data = await res.json();
      if (data.success) setExams(data.exams);
    } catch (error) {
      console.error('获取考试列表失败:', error);
    }
  }, [user]);

  // 获取签到列表
  const fetchSignIns = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/signins?creatorId=${user.id}`);
      const data = await res.json();
      if (data.success) setSignIns(data.signIns);
    } catch (error) {
      console.error('获取签到列表失败:', error);
    }
  }, [user]);

  // 获取班级列表
  const fetchClasses = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/classes?userId=${user.id}&role=${user.role}`);
      const data = await res.json();
      if (data.success) setClasses(data.classes);
    } catch (error) {
      console.error('获取班级列表失败:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchFiles();
      fetchFolders();
      fetchQuestions();
      fetchQuestionBanks();
      fetchClasses();
      if (user.role === 'teacher') {
        fetchExams();
        fetchSignIns();
      } else {
        fetchStudentExams();
        fetchStudentSignIns();
      }
    }
  }, [user, fetchFiles, fetchFolders, fetchQuestions, fetchQuestionBanks, fetchExams, fetchSignIns, fetchClasses]);

  // 学生获取考试列表
  const fetchStudentExams = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/exams?studentId=${user.id}`);
      const data = await res.json();
      if (data.success) {
        setExams(data.exams);
        setExamRecords(data.records);
      }
    } catch (error) {
      console.error('获取考试列表失败:', error);
    }
  };

  // 学生获取签到列表
  const fetchStudentSignIns = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/signins?studentId=${user.id}`);
      const data = await res.json();
      if (data.success) {
        setSignIns(data.signIns);
        setSignInRecords(data.records);
      }
    } catch (error) {
      console.error('获取签到列表失败:', error);
    }
  };

  // 登录
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // 管理员登录
    if (loginForm.account === ADMIN_ACCOUNT && loginForm.password === ADMIN_PASSWORD) {
      const adminUser: User = {
        id: 'admin',
        account: ADMIN_ACCOUNT,
        name: '管理员',
        role: 'admin',
        avatar: 'https://picsum.photos/40/40?random=admin'
      };
      setUser(adminUser);
      localStorage.setItem('courseUser', JSON.stringify(adminUser));
      setLoginForm({ account: '', password: '' });
      setLoading(false);
      return;
    }
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        localStorage.setItem('courseUser', JSON.stringify(data.user));
        setLoginForm({ account: '', password: '' });
      } else {
        // 数据库登录失败时，尝试本地存储匹配
        const localUsers = JSON.parse(localStorage.getItem('localUsers') || '[]');
        const localUser = localUsers.find(
          (u: any) => u.account === loginForm.account && u.password === loginForm.password
        );
        if (localUser) {
          const { password: _, ...userWithoutPassword } = localUser;
          setUser(userWithoutPassword);
          localStorage.setItem('courseUser', JSON.stringify(userWithoutPassword));
          setLoginForm({ account: '', password: '' });
        } else {
          alert(data.error);
        }
      }
    } catch (error) {
      // 网络异常时也尝试本地匹配
      const localUsers = JSON.parse(localStorage.getItem('localUsers') || '[]');
      const localUser = localUsers.find(
        (u: any) => u.account === loginForm.account && u.password === loginForm.password
      );
      if (localUser) {
        const { password: _, ...userWithoutPassword } = localUser;
        setUser(userWithoutPassword);
        localStorage.setItem('courseUser', JSON.stringify(userWithoutPassword));
        setLoginForm({ account: '', password: '' });
      } else {
        alert('登录失败，请稍后重试');
      }
    }
    setLoading(false);
  };

  // 注册
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm),
      });
      const data = await res.json();
      if (data.success) {
        // 本地模式：将用户（含密码）存入 localStorage 以支持登录
        if (data.localMode) {
          const localUsers = JSON.parse(localStorage.getItem('localUsers') || '[]');
          // 检查本地是否已存在该账号
          if (localUsers.find((u: any) => u.account === registerForm.account)) {
            alert('该账号已被注册');
            setLoading(false);
            return;
          }
          localUsers.push({
            ...data.user,
            password: registerForm.password,
          });
          localStorage.setItem('localUsers', JSON.stringify(localUsers));
        }
        setUser(data.user);
        localStorage.setItem('courseUser', JSON.stringify(data.user));
        setRegisterForm({ account: '', password: '', name: '', role: 'student', studentId: '', inviteCode: '' });
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('注册失败，请稍后重试');
    }
    setLoading(false);
  };

  // 登出
  const handleLogout = () => {
    // 清除考试状态
    if (examTaking) {
      setExamTaking(false);
      setCurrentExam(null);
      setCurrentExamQuestions([]);
      setExamAnswers({});
      setCurrentQuestionIndex(0);
      setTabSwitchCount(0);
    }
    setUser(null);
    localStorage.removeItem('courseUser');
    setCurrentPage('dashboard');
  };

  // 获取所有学生列表（教师用）
  const fetchAllStudents = async () => {
    try {
      const res = await fetch('/api/users?role=student');
      const data = await res.json();
      if (data.success) {
        setAllStudents(data.users);
      }
    } catch (error) {
      console.error('获取学生列表失败:', error);
    }
  };

  // 获取所有用户列表（管理员用）
  const fetchAllUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success) {
        setAllUsers(data.users);
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
    }
  };

  // 删除用户（管理员用）
  const handleDeleteUser = async (userId: string) => {
    if (!confirm('确定要删除该账号吗？此操作不可恢复。')) return;
    try {
      const res = await fetch(`/api/users?userId=${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert('账号已删除');
        fetchAllUsers();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('删除失败');
    }
  };

  // 查看成绩分析（教师）
  const handleViewExamAnalysis = (exam: Exam) => {
    const records = examRecords.filter(r => r.exam_id === exam.id && (r.status === 'submitted' || r.status === 'graded'));
    const questions = currentExamQuestions.length > 0 ? currentExamQuestions : [];
    
    // 计算每题正确率
    const questionStats = questions.map(q => {
      let correctCount = 0;
      const optionStats: Record<string, number> = {};
      
      if (q.options) {
        q.options.forEach((_, idx) => {
          optionStats[String.fromCharCode(65 + idx)] = 0;
        });
      }
      
      records.forEach(r => {
        const answer = r.answers?.[q.id];
        const graded = r.graded_answers?.[q.id];
        
        if (graded && graded.correct) correctCount++;
        
        if (answer && q.options) {
          if (q.type === 'multiple') {
            answer.split('').forEach(letter => {
              if (optionStats[letter] !== undefined) optionStats[letter]++;
            });
          } else {
            if (optionStats[answer] !== undefined) optionStats[answer]++;
          }
        }
      });
      
      return {
        ...q,
        correctRate: records.length > 0 ? (correctCount / records.length * 100).toFixed(1) : 0,
        correctCount,
        totalCount: records.length,
        optionStats
      };
    });
    
    // 计算分数段分布
    const scoreDistribution: Record<string, number> = {
      '90-100': 0, '80-89': 0, '70-79': 0, '60-69': 0, '0-59': 0
    };
    let totalScore = 0;
    let maxScore = 0;
    
    records.forEach(r => {
      if (r.score !== null && r.score !== undefined) {
        totalScore += r.score;
        maxScore = Math.max(maxScore, r.score);
        if (r.score >= 90) scoreDistribution['90-100']++;
        else if (r.score >= 80) scoreDistribution['80-89']++;
        else if (r.score >= 70) scoreDistribution['70-79']++;
        else if (r.score >= 60) scoreDistribution['60-69']++;
        else scoreDistribution['0-59']++;
      }
    });
    
    const avgScore = records.length > 0 ? (totalScore / records.length).toFixed(1) : 0;
    const passCount = scoreDistribution['60-69'] + scoreDistribution['70-79'] + scoreDistribution['80-89'] + scoreDistribution['90-100'];
    
    setExamAnalysisData({
      exam,
      records,
      questionStats,
      scoreDistribution,
      avgScore: parseFloat(avgScore as string),
      maxScore,
      passCount
    });
    setExamAnalysisOpen(true);
  };

  // 公开成绩（教师）
  const handlePublicGrades = async (examId: string, type: 'personal' | 'all') => {
    try {
      const res = await fetch('/api/exams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId, grade_public_type: type }),
      });
      const data = await res.json();
      if (data.success) {
        alert(type === 'personal' ? '个人成绩已公开，学生可查看自己的成绩' : '全部成绩已公开，学生可查看所有成绩排名');
        fetchExams();
        // 刷新成绩弹窗
        setExamResultsOpen(false);
        const exam = exams.find(e => e.id === examId);
        if (exam) {
          setTimeout(() => handleViewExamResults(exam), 100);
        }
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('操作失败');
    }
  };

  // 确认批阅完成（教师）
  const handleConfirmGradingComplete = async (examId: string) => {
    if (!confirm('确认批阅完成？确认后将进行成绩汇总。')) return;
    try {
      const res = await fetch('/api/exams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId, grading_completed: true }),
      });
      const data = await res.json();
      if (data.success) {
        alert('批阅完成！成绩已汇总。');
        fetchExams();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('操作失败');
    }
  };

  // 查看学生试卷（教师）
  const handleViewStudentPaper = (record: ExamRecord) => {
    const exam = exams.find(e => e.id === record.exam_id);
    if (exam) {
      setStudentExamView(exam);
      setStudentRecordView(record);
      setStudentExamPaperOpen(true);
    }
  };

  // 批改主观题（教师）
  const handleGradeQuestion = async (recordId: string, questionId: string, score: number, maxScore: number) => {
    if (score < 0 || score > maxScore) {
      alert(`请输入0-${maxScore}之间的分数`);
      return;
    }
    
    try {
      const res = await fetch('/api/exams/records', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId,
          questionId,
          score,
          correct: score === maxScore
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('评分已保存');
        // 刷新视图
        fetchExams();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('保存失败');
    }
  };

  // 学生查看成绩
  const handleViewMyExamResult = (exam: Exam, record: ExamRecord) => {
    // 检查成绩是否公开
    if (exam.grade_public_type === 'none') {
      alert('成绩尚未公开，请耐心等待');
      return;
    }
    setStudentExamView(exam);
    setStudentRecordView(record);
    setStudentExamResultOpen(true);
  };

  // 学生查看试卷
  const handleViewExamPaper = (exam: Exam, record: ExamRecord) => {
    setStudentExamView(exam);
    setStudentRecordView(record);
    setStudentExamPaperOpen(true);
  };

  // 上传文件
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.file || !user) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', uploadForm.file);
    formData.append('name', uploadForm.name || uploadForm.file.name);
    formData.append('type', uploadForm.type);
    formData.append('uploaderId', user.id);
    formData.append('isPublic', 'true');
    if (uploadForm.folderId) {
      formData.append('folderId', uploadForm.folderId);
    }

    try {
      const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        alert('文件上传成功！');
        setUploadDialogOpen(false);
        setUploadForm({ name: '', type: '课件', file: null, folderId: '' });
        fetchFiles();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('文件上传失败');
    }
    setLoading(false);
  };

  // 下载文件
  const handleDownload = async (file: FileItem) => {
    await fetch('/api/files', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: file.id, incrementDownloads: true }),
    });
    const response = await fetch(file.download_url);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    window.URL.revokeObjectURL(url);
    fetchFiles();
  };

  // 删除文件
  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('确定删除该文件？')) return;
    try {
      const res = await fetch(`/api/files?fileId=${fileId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert('文件已删除');
        fetchFiles();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('删除失败');
    }
  };

  // 编辑文件
  const handleEditFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFile) return;
    try {
      const res = await fetch('/api/files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: editingFile.id,
          name: editingFile.name,
          type: editingFile.type,
          folderId: editingFile.folder_id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('文件已更新');
        setEditFileDialogOpen(false);
        setEditingFile(null);
        fetchFiles();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('更新失败');
    }
  };

  // 创建文件夹
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: folderForm.name,
          parentId: currentFolderId,
          creatorId: user.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('文件夹创建成功！');
        setFolderDialogOpen(false);
        setFolderForm({ name: '', parentId: '' });
        fetchFolders();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('创建文件夹失败');
    }
    setLoading(false);
  };

  // 删除文件夹
  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('确定删除该文件夹？文件夹内的文件将移至根目录。')) return;
    try {
      const res = await fetch(`/api/folders?folderId=${folderId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert('文件夹已删除');
        fetchFolders();
        fetchFiles();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('删除失败');
    }
  };

  // 添加题目
  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...questionForm, creatorId: user.id }),
      });
      const data = await res.json();
      if (data.success) {
        alert('题目添加成功！');
        setQuestionDialogOpen(false);
        resetQuestionForm();
        fetchQuestions();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('添加题目失败');
    }
    setLoading(false);
  };

  // 重置题目表单
  const resetQuestionForm = () => {
    setQuestionForm({
      content: '', type: 'single', options: ['', '', '', ''],
      answer: '', analysis: '', difficulty: 'medium', score: 2, subject: '', bankId: ''
    });
  };

  // 创建题库分区
  const handleCreateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/question-banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bankForm, creatorId: user.id }),
      });
      const data = await res.json();
      if (data.success) {
        alert('题库分区创建成功！');
        setBankDialogOpen(false);
        setBankForm({ name: '', description: '', subject: '' });
        fetchQuestionBanks();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('创建题库分区失败');
    }
    setLoading(false);
  };

  // 删除题库分区
  const handleDeleteBank = async (bankId: string) => {
    if (!confirm('确定要删除这个题库分区吗？分区内的题目将移至未分类。')) return;
    try {
      const res = await fetch(`/api/question-banks?bankId=${bankId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert('题库分区已删除');
        fetchQuestionBanks();
        fetchQuestions();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('删除失败');
    }
  };

  // 编辑题目 - 打开编辑对话框
  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    setQuestionForm({
      content: question.content,
      type: question.type,
      options: question.options || ['', '', '', ''],
      answer: question.answer,
      analysis: question.analysis || '',
      difficulty: question.difficulty,
      score: question.score,
      subject: question.subject || '',
      bankId: question.bank_id || ''
    });
    setEditQuestionDialogOpen(true);
  };

  // 编辑题目 - 保存
  const handleSaveEditQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;
    setLoading(true);
    try {
      const res = await fetch('/api/questions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: editingQuestion.id,
          content: questionForm.content,
          type: questionForm.type,
          options: questionForm.options,
          answer: questionForm.answer,
          analysis: questionForm.analysis,
          difficulty: questionForm.difficulty,
          score: questionForm.score,
          subject: questionForm.subject,
          bankId: questionForm.bankId || null
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('题目修改成功！');
        setEditQuestionDialogOpen(false);
        setEditingQuestion(null);
        resetQuestionForm();
        fetchQuestions();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('修改题目失败');
    }
    setLoading(false);
  };

  // AI提取题目
  const handleExtractQuestions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/questions/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...extractForm, creatorId: user.id }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        setExtractDialogOpen(false);
        fetchQuestions();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('AI提取题目失败');
    }
    setLoading(false);
  };

  // 删除题目
  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('确定删除该题目？')) return;
    try {
      await fetch(`/api/questions?id=${id}`, { method: 'DELETE' });
      fetchQuestions();
    } catch (error) {
      alert('删除失败');
    }
  };

  // 创建考试
  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...examForm, creatorId: user.id }),
      });
      const data = await res.json();
      if (data.success) {
        alert('考试创建成功！');
        setExamDialogOpen(false);
        resetExamForm();
        fetchExams();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('创建考试失败');
    }
    setLoading(false);
  };

  // 重置考试表单
  const resetExamForm = () => {
    setExamForm({
      title: '', description: '', duration: 30, totalScore: 100,
      questionConfig: { single: 10, multiple: 5, judge: 10, short: 2 },
      antiCheat: true
    });
  };

  // 发布考试
  const handlePublishExam = async (examId: string) => {
    if (!confirm('确定发布该考试？')) return;
    try {
      await fetch('/api/exams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId, status: 'published' }),
      });
      alert('考试已发布！');
      fetchExams();
    } catch (error) {
      alert('发布失败');
    }
  };

  // 结束考试
  const handleEndExam = async (examId: string) => {
    if (!confirm('确定结束该考试？')) return;
    try {
      await fetch('/api/exams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId, status: 'ended' }),
      });
      alert('考试已结束！');
      fetchExams();
    } catch (error) {
      alert('结束失败');
    }
  };

  // 查看考试成绩（教师）
  const handleViewExamResults = async (exam: Exam) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/exams/records?examId=${exam.id}`);
      const data = await res.json();
      if (data.success) {
        setExamResultExam(data.exam);
        setExamResultRecords(data.records || []);
        setExamResultsOpen(true);
      } else {
        alert(data.error || '获取成绩失败');
      }
    } catch (error) {
      alert('获取成绩失败');
    }
    setLoading(false);
  };

  // 开始考试（学生）
  const handleStartExam = async (exam: Exam) => {
    if (!user) return;
    
    // 检查是否已提交
    const existingRecord = examRecords.find(r => r.exam_id === exam.id && r.student_id === user.id);
    if (existingRecord && existingRecord.status === 'submitted') {
      alert('您已完成该考试，无法再次作答');
      return;
    }
    
    if (!confirm('即将开始考试，考试期间请勿切屏或退出。是否继续？')) return;
    
    setLoading(true);
    try {
      // 获取考试详情和题目
      const res = await fetch(`/api/exams/records?examId=${exam.id}`);
      const data = await res.json();
      if (!data.success) {
        alert(data.error || '获取考试信息失败');
        setLoading(false);
        return;
      }
      
      // 创建或获取考试记录
      const recordRes = await fetch('/api/exams/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId: exam.id, studentId: user.id, action: 'start' }),
      });
      const recordData = await recordRes.json();
      if (recordData.success) {
        setCurrentExam(data.exam);
        setCurrentExamQuestions(data.questions || []);
        setCurrentRecord(recordData.record);
        setExamTaking(true);
        setExamTimer(exam.duration * 60);
        setExamAnswers(recordData.record?.answers || {});
        setCurrentQuestionIndex(0);
        setTabSwitchCount(0);
        setShowTabWarning(false);
      } else {
        alert(recordData.error || '开始考试失败');
      }
    } catch (error) {
      console.error('开始考试异常:', error);
      alert('开始考试失败，请稍后重试');
    }
    setLoading(false);
  };

  // 考试计时器
  useEffect(() => {
    if (examTaking && examTimer > 0) {
      const timer = setInterval(() => {
        setExamTimer(prev => {
          if (prev <= 1) {
            handleSubmitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [examTaking, examTimer]);

  // 防作弊：检测切换标签页
  useEffect(() => {
    if (examTaking && currentExam?.anti_cheat && user) {
      const handleVisibilityChange = () => {
        if (document.hidden) {
          setTabSwitchCount(prev => {
            const newCount = prev + 1;
            setShowTabWarning(true);
            
            // 发送切屏记录到服务器
            fetch('/api/exams/records', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                examId: currentExam.id,
                studentId: user.id,
                action: 'anticheat',
                antiCheatFlags: { type: 'tab_switch', count: newCount }
              }),
            });
            
            // 超过3次自动交卷
            if (newCount >= MAX_TAB_SWITCHES) {
              alert('切屏次数超过限制，系统将自动交卷');
              handleSubmitExam();
            } else {
              alert(`警告：检测到切屏行为！\n已切屏 ${newCount} 次，超过 ${MAX_TAB_SWITCHES} 次将自动交卷`);
            }
            
            return newCount;
          });
        }
      };
      
      const handleWindowBlur = () => {
        if (examTaking && currentExam?.anti_cheat) {
          handleVisibilityChange();
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('blur', handleWindowBlur);
      
      // 尝试进入全屏
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(err => console.log('全屏请求失败:', err));
      }
      
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('blur', handleWindowBlur);
      };
    }
  }, [examTaking, currentExam, user]);

  // 提交考试
  const handleSubmitExam = async () => {
    if (!currentExam || !user || !currentRecord) return;
    if (!confirm('确定要提交试卷吗？提交后不可修改。')) return;
    
    try {
      // 自动批改客观题
      let score = 0;
      const gradedAnswers: Record<string, any> = {};
      
      currentExamQuestions.forEach(q => {
        const studentAnswer = examAnswers[q.id];
        if (studentAnswer) {
          if (q.type === 'single' || q.type === 'judge') {
            const isCorrect = studentAnswer === q.answer;
            score += isCorrect ? q.score : 0;
            gradedAnswers[q.id] = {
              answer: studentAnswer,
              correct: isCorrect,
              score: isCorrect ? q.score : 0,
              autoGraded: true
            };
          } else if (q.type === 'multiple') {
            const correctAnswer = q.answer.split('').sort().join('');
            const studentAns = studentAnswer.split('').sort().join('');
            const isCorrect = correctAnswer === studentAns;
            score += isCorrect ? q.score : 0;
            gradedAnswers[q.id] = {
              answer: studentAnswer,
              correct: isCorrect,
              score: isCorrect ? q.score : 0,
              autoGraded: true
            };
          } else {
            // 主观题待批改
            gradedAnswers[q.id] = {
              answer: studentAnswer,
              correct: null,
              score: null,
              autoGraded: false,
              needsGrading: true
            };
          }
        }
      });
      
      await fetch('/api/exams/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId: currentExam.id,
          studentId: user.id,
          action: 'submit',
          answers: examAnswers,
          score: score,
          gradedAnswers: gradedAnswers,
        }),
      });
      
      // 退出全屏
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      
      alert('试卷已提交！客观题已自动批改。');
      setExamTaking(false);
      setCurrentExam(null);
      setCurrentExamQuestions([]);
      setExamAnswers({});
      setCurrentQuestionIndex(0);
      setTabSwitchCount(0);
      fetchStudentExams();
    } catch (error) {
      alert('提交失败');
    }
  };

  // 创建签到
  const handleCreateSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/signins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...signInForm, creatorId: user.id }),
      });
      const data = await res.json();
      if (data.success) {
        alert('签到创建成功！' + (data.signIn.type === 'code' ? ` 签到码：${data.signIn.code}` : ''));
        setSignInDialogOpen(false);
        resetSignInForm();
        fetchSignIns();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('创建签到失败');
    }
    setLoading(false);
  };

  // 重置签到表单
  const resetSignInForm = () => {
    setSignInForm({
      title: '', type: 'code', code: '', latitude: '', longitude: '', radius: 100, duration: 5
    });
  };

  // 结束签到
  const handleEndSignIn = async (signInId: string) => {
    if (!confirm('确定结束该签到？')) return;
    try {
      await fetch('/api/signins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signInId, status: 'ended' }),
      });
      alert('签到已结束！');
      fetchSignIns();
    } catch (error) {
      alert('结束失败');
    }
  };

  // 查看签到记录
  const handleViewSignInRecords = async (signIn: SignIn) => {
    try {
      const res = await fetch(`/api/signins/records?signInId=${signIn.id}`);
      const data = await res.json();
      if (data.success) {
        setCurrentSignIn(signIn);
        setSignInRecords(data.records);
        setSignInDetailOpen(true);
      }
    } catch (error) {
      alert('获取签到记录失败');
    }
  };

  // 学生签到
  const handleStudentSignIn = async (signIn: SignIn) => {
    if (!user) return;
    try {
      const body: any = {
        signInId: signIn.id,
        studentId: user.id,
        studentName: user.name,
      };

      if (signIn.type === 'code') {
        body.code = studentSignInCode;
      } else if (signIn.type === 'location' && studentLocation) {
        body.latitude = studentLocation.lat;
        body.longitude = studentLocation.lng;
      }

      const res = await fetch('/api/signins/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        setStudentSignInCode('');
        fetchStudentSignIns();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('签到失败');
    }
  };

  // 获取学生位置
  const getStudentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setStudentLocation({
            lat: position.coords.latitude.toString(),
            lng: position.coords.longitude.toString(),
          });
          alert('位置获取成功！');
        },
        () => {
          alert('无法获取位置，请授权定位权限');
        }
      );
    } else {
      alert('您的浏览器不支持定位功能');
    }
  };

  // 创建班级
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...classForm, creatorId: user.id }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`班级创建成功！班级码：${data.class.code}`);
        setClassDialogOpen(false);
        setClassForm({ name: '', description: '' });
        fetchClasses();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('创建班级失败');
    }
    setLoading(false);
  };

  // 加入班级
  const handleJoinClass = async () => {
    if (!user || !joinClassCode) return;
    setLoading(true);
    try {
      const res = await fetch('/api/classes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinClassCode, userId: user.id, userName: user.name }),
      });
      const data = await res.json();
      if (data.success) {
        alert('加入班级成功！');
        setJoinClassCode('');
        fetchClasses();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('加入班级失败');
    }
    setLoading(false);
  };

  // 获取班级成员
  const fetchClassMembers = async (classId: string) => {
    try {
      const res = await fetch(`/api/classes/members?classId=${classId}`);
      const data = await res.json();
      if (data.success) {
        setClassMembers(data.members);
      }
    } catch (error) {
      console.error('获取成员列表失败:', error);
    }
  };

  // 踢出成员
  const handleKickMember = async (classId: string, memberId: string) => {
    if (!confirm('确定踢出该成员？')) return;
    try {
      const res = await fetch(`/api/classes?classId=${classId}&memberId=${memberId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert('已踢出成员');
        fetchClassMembers(classId);
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('操作失败');
    }
  };

  // 更新成员昵称
  const handleUpdateNickname = async (memberId: string, nickname: string) => {
    try {
      const res = await fetch('/api/classes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, nickname }),
      });
      const data = await res.json();
      if (data.success) {
        alert('昵称已更新');
        if (currentClass) fetchClassMembers(currentClass.id);
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('更新失败');
    }
  };

  // 获取聊天记录
  const fetchChatMessages = async (classId: string) => {
    try {
      const res = await fetch(`/api/chat?classId=${classId}`);
      const data = await res.json();
      if (data.success) {
        setChatMessages(data.messages);
      }
    } catch (error) {
      console.error('获取聊天记录失败:', error);
    }
  };

  // 发送消息
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentClass || !chatInput.trim()) return;
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: currentClass.id,
          senderId: user.id,
          senderName: user.name,
          senderRole: user.role,
          content: chatInput.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setChatInput('');
        fetchChatMessages(currentClass.id);
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('发送失败');
    }
  };

  // 退出班级
  const handleLeaveClass = async (classId: string) => {
    if (!user || !confirm('确定退出该班级？')) return;
    try {
      const res = await fetch(`/api/classes?classId=${classId}&userId=${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert('已退出班级');
        fetchClasses();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('操作失败');
    }
  };

  // 删除班级
  const handleDeleteClass = async (classId: string) => {
    if (!confirm('确定删除该班级？所有成员和聊天记录将被清除。')) return;
    try {
      const res = await fetch(`/api/classes?classId=${classId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert('班级已删除');
        fetchClasses();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('删除失败');
    }
  };

  // 格式化文件大小
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
  };

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 获取题型名称
  const getQuestionTypeName = (type: string) => {
    const map: Record<string, string> = {
      single: '单选题', multiple: '多选题', judge: '判断题', short: '简答题'
    };
    return map[type] || type;
  };

  // 获取难度名称
  const getDifficultyName = (diff: string) => {
    const map: Record<string, string> = {
      easy: '简单', medium: '中等', hard: '困难'
    };
    return map[diff] || diff;
  };

  // 获取难度颜色
  const getDifficultyColor = (diff: string) => {
    const map: Record<string, string> = {
      easy: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      hard: 'bg-red-100 text-red-800'
    };
    return map[diff] || '';
  };

  // 获取考试状态
  const getExamStatusBadge = (status: string) => {
    const map: Record<string, { label: string; class: string }> = {
      draft: { label: '草稿', class: 'bg-gray-100 text-gray-800' },
      published: { label: '已发布', class: 'bg-blue-100 text-blue-800' },
      ongoing: { label: '进行中', class: 'bg-green-100 text-green-800' },
      ended: { label: '已结束', class: 'bg-red-100 text-red-800' },
    };
    const item = map[status] || { label: status, class: '' };
    return <Badge className={item.class}>{item.label}</Badge>;
  };

  // 打开班级群聊
  const openClassChat = (classInfo: ClassInfo) => {
    setCurrentClass(classInfo);
    fetchChatMessages(classInfo.id);
    setChatOpen(true);
  };

  // 打开成员管理
  const openMemberManage = (classInfo: ClassInfo) => {
    setCurrentClass(classInfo);
    fetchClassMembers(classInfo.id);
    setMemberManageOpen(true);
  };

  // 聊天消息自动滚动到底部
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // 登录/注册页面
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <GraduationCap className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">数字图像处理AI赋能课程平台</CardTitle>
            <p className="text-gray-500 mt-2">高效便捷的课堂互动解决方案</p>
          </CardHeader>
          <CardContent>
            <Tabs value={authTab} onValueChange={(v) => setAuthTab(v as 'login' | 'register')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">登录</TabsTrigger>
                <TabsTrigger value="register">注册</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="space-y-4 mt-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="loginAccount">账号</Label>
                    <Input
                      id="loginAccount"
                      placeholder="请输入账号"
                      value={loginForm.account}
                      onChange={(e) => setLoginForm({ ...loginForm, account: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="loginPwd">密码</Label>
                    <Input
                      id="loginPwd"
                      type="password"
                      placeholder="请输入密码"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? '登录中...' : '登录系统'}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="register" className="space-y-4 mt-4">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <Label htmlFor="regAccount">账号</Label>
                    <Input
                      id="regAccount"
                      placeholder="请设置登录账号"
                      value={registerForm.account}
                      onChange={(e) => setRegisterForm({ ...registerForm, account: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="regName">姓名</Label>
                    <Input
                      id="regName"
                      placeholder="请输入真实姓名"
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="regPwd">密码</Label>
                    <Input
                      id="regPwd"
                      type="password"
                      placeholder="请设置密码"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>身份</Label>
                    <div className="flex gap-6 mt-2">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio" name="role" value="teacher"
                          checked={registerForm.role === 'teacher'}
                          onChange={(e) => setRegisterForm({ ...registerForm, role: e.target.value })}
                          className="h-4 w-4"
                        />
                        <span className="ml-2 text-sm">教师</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio" name="role" value="student"
                          checked={registerForm.role === 'student'}
                          onChange={(e) => setRegisterForm({ ...registerForm, role: e.target.value })}
                          className="h-4 w-4"
                        />
                        <span className="ml-2 text-sm">学生</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* 学生端：学号输入 */}
                  {registerForm.role === 'student' && (
                    <div>
                      <Label htmlFor="regStudentId">学号</Label>
                      <Input
                        id="regStudentId"
                        placeholder="请输入10位学号"
                        maxLength={10}
                        value={registerForm.studentId}
                        onChange={(e) => {
                          // 只允许输入数字
                          const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setRegisterForm({ ...registerForm, studentId: value });
                        }}
                        required={registerForm.role === 'student'}
                      />
                      <p className="text-xs text-gray-400 mt-1">学号必须为10位数字，一个学号只能注册一个账号</p>
                    </div>
                  )}
                  
                  {/* 教师端：邀请码输入 */}
                  {registerForm.role === 'teacher' && (
                    <div>
                      <Label htmlFor="regInviteCode">教师邀请码</Label>
                      <Input
                        id="regInviteCode"
                        placeholder="请输入6位邀请码"
                        maxLength={6}
                        value={registerForm.inviteCode}
                        onChange={(e) => setRegisterForm({ ...registerForm, inviteCode: e.target.value })}
                        required={registerForm.role === 'teacher'}
                      />
                      <p className="text-xs text-gray-400 mt-1">请输入教师邀请码完成注册</p>
                    </div>
                  )}
                  
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? '注册中...' : '注册账号'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 考试进行中界面
  if (examTaking && currentExam && currentExamQuestions.length > 0) {
    const currentQ = currentExamQuestions[currentQuestionIndex];
    const isFirstQuestion = currentQuestionIndex === 0;
    const isLastQuestion = currentQuestionIndex === currentExamQuestions.length - 1;
    
    return (
      <div className="min-h-screen bg-gray-50">
        {/* 切屏警告 */}
        {showTabWarning && (
          <div className="fixed top-0 left-0 right-0 bg-red-500 text-white px-6 py-3 text-center z-[60]">
            <span className="font-bold">⚠️ 警告：检测到切屏行为！</span>
            <span className="ml-2">已切屏 {tabSwitchCount} 次，超过 {MAX_TAB_SWITCHES} 次将自动交卷</span>
          </div>
        )}
        
        <div className={`fixed top-0 left-0 right-0 bg-white border-b shadow-sm z-50 ${showTabWarning ? 'mt-12' : ''}`}>
          <div className="max-w-4xl mx-auto px-3 md:px-4 py-2 md:py-3">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0 mr-2">
                <h1 className="font-bold text-sm md:text-lg truncate">{currentExam.title}</h1>
                <p className="text-xs md:text-sm text-gray-500 hidden sm:block">
                  第 {currentQuestionIndex + 1} / {currentExamQuestions.length} 题，总分 {currentExam.total_score} 分
                </p>
              </div>
              <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                {currentExam.anti_cheat && (
                  <Badge variant="outline" className="text-amber-600 text-xs hidden md:flex">
                    <AlertTriangle className="h-3 w-3 mr-1" /> 防作弊监控中
                  </Badge>
                )}
                <div className={`text-lg md:text-2xl font-mono ${examTimer < 300 ? 'text-red-500' : ''}`}>
                  <Timer className="inline h-4 w-4 md:h-5 md:w-5 mr-1" />
                  {formatTime(examTimer)}
                </div>
                <Button onClick={handleSubmitExam} variant="destructive" size="sm" className="md:size-default">
                  <Send className="h-4 w-4 md:mr-1" /> <span className="hidden md:inline">交卷</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className={`max-w-4xl mx-auto px-3 md:px-4 ${showTabWarning ? 'pt-28' : 'pt-20'} md:pt-24 pb-8`}>
          {/* 当前题目 */}
          <Card className="mb-4 md:mb-6">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-start gap-3 md:gap-4 mb-4">
                <span className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs md:text-sm font-medium">
                  {currentQuestionIndex + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1 md:gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">{getQuestionTypeName(currentQ.type)}</Badge>
                    <Badge className={`${getDifficultyColor(currentQ.difficulty)} text-xs`}>{getDifficultyName(currentQ.difficulty)}</Badge>
                    <span className="text-xs md:text-sm text-gray-500">{currentQ.score}分</span>
                  </div>
                  <p className="text-gray-800 whitespace-pre-wrap text-sm md:text-base">{currentQ.content}</p>
                </div>
              </div>
              
              {currentQ.type === 'single' && currentQ.options && (
                <div className="ml-8 md:ml-12 space-y-2">
                  {currentQ.options.map((opt, optIdx) => (
                    <label key={optIdx} className={`flex items-start cursor-pointer p-3 rounded border transition-colors ${
                      examAnswers[currentQ.id] === String.fromCharCode(65 + optIdx) 
                        ? 'border-primary bg-primary/5' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                      <input
                        type="radio"
                        name={`question_${currentQ.id}`}
                        value={String.fromCharCode(65 + optIdx)}
                        checked={examAnswers[currentQ.id] === String.fromCharCode(65 + optIdx)}
                        onChange={() => setExamAnswers({ ...examAnswers, [currentQ.id]: String.fromCharCode(65 + optIdx) })}
                        className="h-4 w-4 mt-0.5 flex-shrink-0"
                      />
                      <span className="ml-2 text-sm md:text-base">{opt}</span>
                    </label>
                  ))}
                </div>
              )}
              
              {currentQ.type === 'multiple' && currentQ.options && (
                <div className="ml-8 md:ml-12 space-y-2">
                  {currentQ.options.map((opt, optIdx) => {
                    const letter = String.fromCharCode(65 + optIdx);
                    const isSelected = examAnswers[currentQ.id]?.includes(letter);
                    return (
                      <label key={optIdx} className={`flex items-start cursor-pointer p-3 rounded border transition-colors ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'
                      }`}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            const current = examAnswers[currentQ.id] || '';
                            if (checked) {
                              setExamAnswers({ ...examAnswers, [currentQ.id]: current + letter });
                            } else {
                              setExamAnswers({ ...examAnswers, [currentQ.id]: current.replace(letter, '') });
                            }
                          }}
                          className="mt-0.5"
                        />
                        <span className="ml-2 text-sm md:text-base">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              
              {currentQ.type === 'judge' && (
                <div className="ml-8 md:ml-12 space-y-2">
                  <label className={`flex items-center cursor-pointer p-3 rounded border transition-colors ${
                    examAnswers[currentQ.id] === 'T' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name={`question_${currentQ.id}`}
                      value="T"
                      checked={examAnswers[currentQ.id] === 'T'}
                      onChange={() => setExamAnswers({ ...examAnswers, [currentQ.id]: 'T' })}
                      className="h-4 w-4"
                    />
                    <span className="ml-2">正确</span>
                  </label>
                  <label className={`flex items-center cursor-pointer p-3 rounded border transition-colors ${
                    examAnswers[currentQ.id] === 'F' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name={`question_${currentQ.id}`}
                      value="F"
                      checked={examAnswers[currentQ.id] === 'F'}
                      onChange={() => setExamAnswers({ ...examAnswers, [currentQ.id]: 'F' })}
                      className="h-4 w-4"
                    />
                    <span className="ml-2">错误</span>
                  </label>
                </div>
              )}
              
              {currentQ.type === 'short' && (
                <div className="ml-8 md:ml-12">
                  <Textarea
                    placeholder="请输入您的答案..."
                    value={examAnswers[currentQ.id] || ''}
                    onChange={(e) => setExamAnswers({ ...examAnswers, [currentQ.id]: e.target.value })}
                    className="min-h-32"
                  />
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* 导航按钮 */}
          <div className="flex justify-between mb-6">
            <Button
              variant="outline"
              onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
              disabled={isFirstQuestion}
            >
              ← 上一题
            </Button>
            <Button
              onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
              disabled={isLastQuestion}
            >
              下一题 →
            </Button>
          </div>
          
          {/* 题目导航 */}
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">题目导航</p>
              <div className="flex flex-wrap gap-2">
                {currentExamQuestions.map((q, idx) => {
                  const isAnswered = !!examAnswers[q.id];
                  const isCurrent = idx === currentQuestionIndex;
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestionIndex(idx)}
                      className={`w-10 h-10 rounded-lg font-medium text-sm transition-colors ${
                        isCurrent 
                          ? 'bg-primary text-white' 
                          : isAnswered 
                            ? 'bg-green-100 text-green-700 border border-green-300' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 管理员界面
  if (user.role === 'admin') {
    return (
      <div className="flex h-screen overflow-hidden bg-gray-50">
        {/* 侧边栏 */}
        <aside className="w-64 bg-gray-900 text-white flex flex-col flex-shrink-0">
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center font-bold">管</div>
              <div>
                <p className="font-medium">管理员</p>
                <p className="text-xs text-gray-400">系统管理</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            <button
              onClick={() => setAdminPage('accounts')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-colors ${
                adminPage === 'accounts' ? 'bg-gray-800' : 'hover:bg-gray-800'
              }`}
            >
              <Users className="h-5 w-5" />
              <span className="font-medium">账号管理</span>
            </button>
          </nav>
          <div className="p-4 border-t border-gray-800">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg hover:bg-red-900/50 text-red-400 transition-colors"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium">退出登录</span>
            </button>
          </div>
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto">
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">管理员控制台</h2>
              <div className="text-sm text-gray-500">系统管理后台</div>
            </div>
          </div>
          
          <div className="p-6">
            {/* 账号管理 */}
            {adminPage === 'accounts' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-gray-900">账号管理</h3>
                  <Button variant="outline" onClick={fetchAllUsers}>刷新列表</Button>
                </div>
                
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">账号</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">姓名</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">身份</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">学号</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {allUsers.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                暂无用户数据，点击刷新列表获取
                              </td>
                            </tr>
                          )}
                          {allUsers.sort((a, b) => {
                            if (a.role === 'student' && b.role === 'student') {
                              return (a.student_id || '').localeCompare(b.student_id || '');
                            }
                            return a.role.localeCompare(b.role);
                          }).map(userItem => (
                            <tr key={userItem.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 font-medium text-gray-900">{userItem.account}</td>
                              <td className="px-6 py-4 text-gray-700">{userItem.name}</td>
                              <td className="px-6 py-4">
                                <Badge className={
                                  userItem.role === 'teacher' ? 'bg-purple-100 text-purple-700' :
                                  userItem.role === 'admin' ? 'bg-red-100 text-red-700' :
                                  'bg-blue-100 text-blue-700'
                                }>
                                  {userItem.role === 'teacher' ? '教师' : userItem.role === 'admin' ? '管理员' : '学生'}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 text-gray-500">{userItem.student_id || '-'}</td>
                              <td className="px-6 py-4">
                                {userItem.role !== 'admin' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-600 hover:text-red-800"
                                    onClick={() => handleDeleteUser(userItem.id)}
                                  >
                                    删除
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // 主系统页面
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* 移动端遮罩层 */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      
      {/* 侧边栏 - 响应式设计 */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0
        transform transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-primary flex-shrink-0" />
            <span className="font-bold text-sm leading-tight">数字图像处理AI赋能课程平台</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden" 
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          {user.role === 'teacher' ? (
            <ul className="space-y-1">
              {[
                { id: 'dashboard', icon: Home, label: '首页' },
                { id: 'students', icon: Users, label: '学生名单' },
                { id: 'classes', icon: Users, label: '班级管理' },
                { id: 'files', icon: FileText, label: '文件资源分享' },
                { id: 'questions', icon: BookOpen, label: '题库管理' },
                { id: 'exams', icon: PenSquare, label: '考试管理' },
                { id: 'signins', icon: CheckSquare, label: '签到管理' },
              ].map(item => (
                <li key={item.id}>
                  <button
                    onClick={() => { 
                      setCurrentPage(item.id); 
                      setMobileMenuOpen(false); 
                      if (item.id === 'students') fetchAllStudents();
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                      currentPage === item.id ? 'bg-primary/10 text-primary border-l-4 border-primary' : 'hover:bg-gray-50'
                    }`}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-1">
              {[
                { id: 'dashboard', icon: Home, label: '我的学习' },
                { id: 'classes', icon: Users, label: '我的班级' },
                { id: 'files', icon: FileDown, label: '资源下载' },
                { id: 'exams', icon: PenSquare, label: '我的考试' },
                { id: 'signins', icon: CheckSquare, label: '我的签到' },
              ].map(item => (
                <li key={item.id}>
                  <button
                    onClick={() => { setCurrentPage(item.id); setMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                      currentPage === item.id ? 'bg-primary/10 text-primary border-l-4 border-primary' : 'hover:bg-gray-50'
                    }`}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>

        <div className="p-4 border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <img src={user.avatar || 'https://picsum.photos/40/40'} alt="头像" className="w-10 h-10 rounded-full flex-shrink-0" />
            <div className="overflow-hidden">
              <p className="font-medium text-sm truncate">{user.name}</p>
              <p className="text-xs text-gray-500">{user.role === 'teacher' ? '教师' : '学生'}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="flex-shrink-0">
            <LogOut className="h-5 w-5 text-gray-500" />
          </Button>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-y-auto">
        {/* 移动端顶部导航栏 */}
        <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)}>
            <Menu className="h-6 w-6" />
          </Button>
          <h1 className="font-semibold text-lg truncate mx-4">
            {user.role === 'teacher' 
              ? ['首页', '班级管理', '文件资源分享', '题库管理', '考试管理', '签到管理'][['dashboard', 'classes', 'files', 'questions', 'exams', 'signins'].indexOf(currentPage)]
              : ['我的学习', '我的班级', '资源下载', '我的考试', '我的签到'][['dashboard', 'classes', 'files', 'exams', 'signins'].indexOf(currentPage)]
            }
          </h1>
          <div className="w-10" /> {/* 占位 */}
        </div>
        
        <div className="p-4 md:p-6">
          {/* 首页 */}
          {currentPage === 'dashboard' && (
            <div>
              <div className="mb-4 md:mb-6">
                <h2 className="text-lg md:text-xl font-bold text-gray-800">
                {user.role === 'teacher' ? '首页' : '我的学习'}
              </h2>
              <p className="text-gray-500 mt-1 text-sm md:text-base hidden md:block">欢迎使用数字图像处理AI赋能课程平台</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setCurrentPage('files'); setMobileMenuOpen(false); }}>
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs md:text-sm text-gray-500">已分享文件</p>
                      <p className="text-xl md:text-2xl font-bold">{files.length}</p>
                    </div>
                    <FileText className="h-6 w-6 md:h-8 md:w-8 text-primary/30" />
                  </div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setCurrentPage('questions'); setMobileMenuOpen(false); }}>
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs md:text-sm text-gray-500">题库题目</p>
                      <p className="text-xl md:text-2xl font-bold">{questions.length}</p>
                    </div>
                    <BookOpen className="h-6 w-6 md:h-8 md:w-8 text-green-500/30" />
                  </div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setCurrentPage('exams'); setMobileMenuOpen(false); }}>
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs md:text-sm text-gray-500">考试数量</p>
                      <p className="text-xl md:text-2xl font-bold">{exams.length}</p>
                    </div>
                    <PenSquare className="h-6 w-6 md:h-8 md:w-8 text-amber-500/30" />
                  </div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setCurrentPage('classes'); setMobileMenuOpen(false); }}>
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs md:text-sm text-gray-500">班级数量</p>
                      <p className="text-xl md:text-2xl font-bold">{classes.length}</p>
                    </div>
                    <Users className="h-6 w-6 md:h-8 md:w-8 text-blue-500/30" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {user.role === 'teacher' && (
              <Card>
                <CardContent className="p-4 md:p-6">
                  <h3 className="font-semibold mb-4">快捷操作</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                    <Button variant="outline" size="sm" className="md:size-default text-xs md:text-sm" onClick={() => { setCurrentPage('files'); setUploadDialogOpen(true); }}>
                      <Upload className="h-4 w-4 md:mr-2 text-primary" /> <span className="hidden md:inline">上传</span>文件
                    </Button>
                    <Button variant="outline" size="sm" className="md:size-default text-xs md:text-sm" onClick={() => setCurrentPage('questions')}>
                      <Plus className="h-4 w-4 md:mr-2 text-primary" /> <span className="hidden md:inline">添加</span>题目
                    </Button>
                    <Button variant="outline" size="sm" className="md:size-default text-xs md:text-sm" onClick={() => setCurrentPage('exams')}>
                      <PenSquare className="h-4 w-4 md:mr-2 text-primary" /> <span className="hidden md:inline">创建</span>考试
                    </Button>
                    <Button variant="outline" size="sm" className="md:size-default text-xs md:text-sm" onClick={() => setCurrentPage('classes')}>
                      <Users className="h-4 w-4 md:mr-2 text-primary" /> <span className="hidden md:inline">创建</span>班级
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {user.role === 'student' && (
              <Card>
                <CardContent className="p-4 md:p-6">
                  <h3 className="font-semibold mb-4">快捷操作</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                    <Button variant="outline" size="sm" className="md:size-default text-xs md:text-sm" onClick={() => setCurrentPage('files')}>
                      <FileDown className="h-4 w-4 md:mr-2 text-primary" /> 下载资源
                    </Button>
                    <Button variant="outline" size="sm" className="md:size-default text-xs md:text-sm" onClick={() => setCurrentPage('exams')}>
                      <PenSquare className="h-4 w-4 md:mr-2 text-primary" /> 参加考试
                    </Button>
                    <Button variant="outline" size="sm" className="md:size-default text-xs md:text-sm col-span-2 md:col-span-1" onClick={() => setCurrentPage('classes')}>
                      <Users className="h-4 w-4 md:mr-2 text-primary" /> 加入班级
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* 班级管理 */}
        {currentPage === 'classes' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  {user.role === 'teacher' ? '班级管理' : '我的班级'}
                </h2>
                <p className="text-gray-500 mt-1">
                  {user.role === 'teacher' ? '创建班级，管理成员，开启群聊' : '查看已加入的班级，参与群聊'}
                </p>
              </div>
              {user.role === 'teacher' ? (
                <Dialog open={classDialogOpen} onOpenChange={setClassDialogOpen}>
                  <DialogTrigger asChild>
                    <Button><Plus className="h-4 w-4 mr-2" /> 创建班级</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>创建班级</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreateClass} className="space-y-4 mt-4">
                      <div>
                        <Label>班级名称</Label>
                        <Input placeholder="请输入班级名称" value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} required />
                      </div>
                      <div>
                        <Label>班级描述</Label>
                        <Textarea placeholder="请输入班级描述（可选）" value={classForm.description} onChange={(e) => setClassForm({ ...classForm, description: e.target.value })} />
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setClassDialogOpen(false)}>取消</Button>
                        <Button type="submit" disabled={loading}>{loading ? '创建中...' : '确认创建'}</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              ) : (
                <div className="flex gap-2">
                  <Input placeholder="输入班级码" value={joinClassCode} onChange={(e) => setJoinClassCode(e.target.value.toUpperCase())} className="w-40" maxLength={6} />
                  <Button onClick={handleJoinClass} disabled={!joinClassCode || loading}>加入班级</Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.map((cls) => (
                <Card key={cls.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-medium">{cls.name}</h3>
                        {cls.description && <p className="text-sm text-gray-500 mt-1">{cls.description}</p>}
                      </div>
                      {user.role === 'teacher' && (
                        <Badge variant="outline" className="font-mono">{cls.code}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                      <Users className="h-4 w-4" />
                      <span>{cls.class_members?.[0]?.count || 0} 成员</span>
                      {cls.nickname && <span className="ml-2">· 昵称：{cls.nickname}</span>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openClassChat(cls)}>
                        <MessageCircle className="h-4 w-4 mr-1" /> 群聊
                      </Button>
                      {user.role === 'teacher' ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => openMemberManage(cls)}>
                            <Settings className="h-4 w-4 mr-1" /> 管理
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteClass(cls.id)}>删除</Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => handleLeaveClass(cls.id)}>退出</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {classes.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500">
                  {user.role === 'teacher' ? '暂无班级，点击上方按钮创建' : '暂未加入班级，输入班级码加入'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 文件资源 */}
        {currentPage === 'files' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">文件资源分享</h2>
                <p className="text-gray-500 mt-1">{user.role === 'teacher' ? '上传和管理教学资源' : '下载学习资料'}</p>
              </div>
              {user.role === 'teacher' && (
                <div className="flex gap-2">
                  <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline"><FolderPlus className="h-4 w-4 mr-2" /> 新建文件夹</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>新建文件夹</DialogTitle></DialogHeader>
                      <form onSubmit={handleCreateFolder} className="space-y-4 mt-4">
                        <div>
                          <Label>文件夹名称</Label>
                          <Input placeholder="请输入文件夹名称" value={folderForm.name} onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })} required />
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setFolderDialogOpen(false)}>取消</Button>
                          <Button type="submit" disabled={loading}>{loading ? '创建中...' : '确认创建'}</Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                  <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                    <DialogTrigger asChild>
                      <Button><Upload className="h-4 w-4 mr-2" /> 上传文件</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>上传文件</DialogTitle></DialogHeader>
                      <form onSubmit={handleUpload} className="space-y-4 mt-4">
                        <div>
                          <Label>文件名称</Label>
                          <Input placeholder="请输入文件名称" value={uploadForm.name} onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })} />
                        </div>
                        <div>
                          <Label>文件类型</Label>
                          <Select value={uploadForm.type} onValueChange={(v) => setUploadForm({ ...uploadForm, type: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="教案">教案</SelectItem>
                              <SelectItem value="课件">课件</SelectItem>
                              <SelectItem value="习题">习题</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>选择文件</Label>
                          <Input type="file" onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })} />
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setUploadDialogOpen(false)}>取消</Button>
                          <Button type="submit" disabled={loading || !uploadForm.file}>{loading ? '上传中...' : '确认上传'}</Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>

            {/* 面包屑导航 */}
            {currentFolderId && (
              <div className="mb-4">
                <Button variant="ghost" size="sm" onClick={() => setCurrentFolderId(null)}>
                  <FolderOpen className="h-4 w-4 mr-1" /> 返回上级
                </Button>
              </div>
            )}

            <Card className="mb-6">
              <CardContent className="p-4 flex gap-4">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部类型</SelectItem>
                    <SelectItem value="教案">教案</SelectItem>
                    <SelectItem value="课件">课件</SelectItem>
                    <SelectItem value="习题">习题</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* 文件夹列表 */}
            {folders.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-4">
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer group"
                    onDoubleClick={() => setCurrentFolderId(folder.id)}
                  >
                    <FolderOpen className="h-12 w-12 text-amber-500 mb-2" />
                    <span className="text-sm text-center truncate w-full">{folder.name}</span>
                    {user.role === 'teacher' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 mt-1"
                        onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 文件列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {files.map((file) => (
                <Card key={file.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <FileText className="h-8 w-8 text-primary/50" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{file.name}</h4>
                        <p className="text-xs text-gray-500">{formatSize(file.size)} · {formatDate(file.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{file.type}</Badge>
                      <div className="flex gap-1">
                        {user.role === 'teacher' && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => { setEditingFile(file); setEditFileDialogOpen(true); }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDeleteFile(file.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleDownload(file)}>
                          <Download className="h-4 w-4 mr-1" /> 下载
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {files.length === 0 && folders.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500">
                  暂无文件
                </div>
              )}
            </div>

            {/* 编辑文件弹窗 */}
            <Dialog open={editFileDialogOpen} onOpenChange={setEditFileDialogOpen}>
              <DialogContent>
                <DialogHeader><DialogTitle>编辑文件</DialogTitle></DialogHeader>
                <form onSubmit={handleEditFile} className="space-y-4 mt-4">
                  <div>
                    <Label>文件名称</Label>
                    <Input value={editingFile?.name || ''} onChange={(e) => setEditingFile(prev => prev ? { ...prev, name: e.target.value } : null)} />
                  </div>
                  <div>
                    <Label>文件类型</Label>
                    <Select value={editingFile?.type || ''} onValueChange={(v) => setEditingFile(prev => prev ? { ...prev, type: v } : null)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="教案">教案</SelectItem>
                        <SelectItem value="课件">课件</SelectItem>
                        <SelectItem value="习题">习题</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setEditFileDialogOpen(false)}>取消</Button>
                    <Button type="submit">保存</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* 题库管理 */}
        {currentPage === 'questions' && user.role === 'teacher' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">题库管理</h2>
                <p className="text-gray-500 mt-1">管理试题，支持手动添加和AI提取</p>
              </div>
              <div className="flex gap-2">
                <Dialog open={extractDialogOpen} onOpenChange={setExtractDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline"><RefreshCw className="h-4 w-4 mr-2" /> AI提取题目</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>AI提取题目</DialogTitle></DialogHeader>
                    <form onSubmit={handleExtractQuestions} className="space-y-4 mt-4">
                      <div>
                        <Label>选择文件</Label>
                        <Select value={extractForm.fileId} onValueChange={(v) => setExtractForm({ ...extractForm, fileId: v })}>
                          <SelectTrigger><SelectValue placeholder="选择要提取的文件" /></SelectTrigger>
                          <SelectContent>
                            {files.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>题目数量</Label>
                        <Input type="number" min={1} max={20} value={extractForm.questionCount} onChange={(e) => setExtractForm({ ...extractForm, questionCount: parseInt(e.target.value) })} />
                      </div>
                      <div>
                        <Label>题目类型</Label>
                        <div className="flex gap-4 mt-2">
                          {['single', 'multiple', 'judge', 'short'].map(t => (
                            <label key={t} className="flex items-center">
                              <Checkbox checked={extractForm.questionTypes.includes(t)} onCheckedChange={(checked) => {
                                if (checked) {
                                  setExtractForm({ ...extractForm, questionTypes: [...extractForm.questionTypes, t] });
                                } else {
                                  setExtractForm({ ...extractForm, questionTypes: extractForm.questionTypes.filter(x => x !== t) });
                                }
                              }} />
                              <span className="ml-2 text-sm">{getQuestionTypeName(t)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setExtractDialogOpen(false)}>取消</Button>
                        <Button type="submit" disabled={loading || !extractForm.fileId}>{loading ? '提取中...' : '开始提取'}</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
                <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button><Plus className="h-4 w-4 mr-2" /> 添加题目</Button>
                  </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>添加题目</DialogTitle></DialogHeader>
                    <form onSubmit={handleAddQuestion} className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>题目类型</Label>
                          <Select value={questionForm.type} onValueChange={(v) => setQuestionForm({ ...questionForm, type: v as any })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="single">单选题</SelectItem>
                              <SelectItem value="multiple">多选题</SelectItem>
                              <SelectItem value="judge">判断题</SelectItem>
                              <SelectItem value="short">简答题</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>所属分区</Label>
                          <Select value={questionForm.bankId} onValueChange={(v) => setQuestionForm({ ...questionForm, bankId: v })}>
                            <SelectTrigger><SelectValue placeholder="选择分区（可选）" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">不选择分区</SelectItem>
                              {questionBanks.map(bank => (
                                <SelectItem key={bank.id} value={bank.id}>{bank.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label>题目内容</Label>
                        <Textarea placeholder="请输入题目内容" value={questionForm.content} onChange={(e) => setQuestionForm({ ...questionForm, content: e.target.value })} required />
                      </div>
                      {(questionForm.type === 'single' || questionForm.type === 'multiple') && (
                        <div>
                          <Label>选项（每行一个选项）</Label>
                          <Textarea placeholder="A. 选项1&#10;B. 选项2&#10;C. 选项3&#10;D. 选项4" value={questionForm.options.join('\n')} onChange={(e) => setQuestionForm({ ...questionForm, options: e.target.value.split('\n') })} />
                        </div>
                      )}
                      <div>
                        <Label>正确答案</Label>
                        <Input placeholder={questionForm.type === 'judge' ? 'T 或 F' : questionForm.type === 'multiple' ? '如：ABC' : '如：A'} value={questionForm.answer} onChange={(e) => setQuestionForm({ ...questionForm, answer: e.target.value })} required />
                      </div>
                      <div>
                        <Label>答案解析</Label>
                        <Textarea placeholder="请输入答案解析（可选）" value={questionForm.analysis} onChange={(e) => setQuestionForm({ ...questionForm, analysis: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>难度</Label>
                          <Select value={questionForm.difficulty} onValueChange={(v) => setQuestionForm({ ...questionForm, difficulty: v as any })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="easy">简单</SelectItem>
                              <SelectItem value="medium">中等</SelectItem>
                              <SelectItem value="hard">困难</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>分值</Label>
                          <Input type="number" min={1} value={questionForm.score} onChange={(e) => setQuestionForm({ ...questionForm, score: parseInt(e.target.value) })} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setQuestionDialogOpen(false)}>取消</Button>
                        <Button type="submit" disabled={loading}>{loading ? '添加中...' : '确认添加'}</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
                {/* 编辑题目对话框 */}
                <Dialog open={editQuestionDialogOpen} onOpenChange={setEditQuestionDialogOpen}>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>编辑题目</DialogTitle></DialogHeader>
                    <form onSubmit={handleSaveEditQuestion} className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>题目类型</Label>
                          <Select value={questionForm.type} onValueChange={(v) => setQuestionForm({ ...questionForm, type: v as any })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="single">单选题</SelectItem>
                              <SelectItem value="multiple">多选题</SelectItem>
                              <SelectItem value="judge">判断题</SelectItem>
                              <SelectItem value="short">简答题</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>所属分区</Label>
                          <Select value={questionForm.bankId} onValueChange={(v) => setQuestionForm({ ...questionForm, bankId: v })}>
                            <SelectTrigger><SelectValue placeholder="选择分区（可选）" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">不选择分区</SelectItem>
                              {questionBanks.map(bank => (
                                <SelectItem key={bank.id} value={bank.id}>{bank.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label>题目内容</Label>
                        <Textarea placeholder="请输入题目内容" value={questionForm.content} onChange={(e) => setQuestionForm({ ...questionForm, content: e.target.value })} required />
                      </div>
                      {(questionForm.type === 'single' || questionForm.type === 'multiple') && (
                        <div>
                          <Label>选项（每行一个选项）</Label>
                          <Textarea placeholder="A. 选项1&#10;B. 选项2&#10;C. 选项3&#10;D. 选项4" value={questionForm.options.join('\n')} onChange={(e) => setQuestionForm({ ...questionForm, options: e.target.value.split('\n') })} />
                        </div>
                      )}
                      <div>
                        <Label>正确答案</Label>
                        <Input placeholder={questionForm.type === 'judge' ? 'T 或 F' : questionForm.type === 'multiple' ? '如：ABC' : '如：A'} value={questionForm.answer} onChange={(e) => setQuestionForm({ ...questionForm, answer: e.target.value })} required />
                      </div>
                      <div>
                        <Label>答案解析</Label>
                        <Textarea placeholder="请输入答案解析（可选）" value={questionForm.analysis} onChange={(e) => setQuestionForm({ ...questionForm, analysis: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>难度</Label>
                          <Select value={questionForm.difficulty} onValueChange={(v) => setQuestionForm({ ...questionForm, difficulty: v as any })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="easy">简单</SelectItem>
                              <SelectItem value="medium">中等</SelectItem>
                              <SelectItem value="hard">困难</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>分值</Label>
                          <Input type="number" min={1} value={questionForm.score} onChange={(e) => setQuestionForm({ ...questionForm, score: parseInt(e.target.value) })} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => { setEditQuestionDialogOpen(false); setEditingQuestion(null); }}>取消</Button>
                        <Button type="submit" disabled={loading}>{loading ? '保存中...' : '保存修改'}</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <Card className="mb-6">
              <CardContent className="p-4 flex gap-4 items-center flex-wrap">
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-gray-500">题库分区:</Label>
                  <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部题目</SelectItem>
                      <SelectItem value="none">未分类</SelectItem>
                      {questionBanks.map(bank => (
                        <SelectItem key={bank.id} value={bank.id}>{bank.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" /> 新建分区</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>创建题库分区</DialogTitle></DialogHeader>
                      <form onSubmit={handleCreateBank} className="space-y-4 mt-4">
                        <div>
                          <Label>分区名称</Label>
                          <Input placeholder="如：第一章 基础知识" value={bankForm.name} onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })} required />
                        </div>
                        <div>
                          <Label>科目</Label>
                          <Input placeholder="如：数字图像处理" value={bankForm.subject} onChange={(e) => setBankForm({ ...bankForm, subject: e.target.value })} />
                        </div>
                        <div>
                          <Label>描述</Label>
                          <Textarea placeholder="可选的描述信息" value={bankForm.description} onChange={(e) => setBankForm({ ...bankForm, description: e.target.value })} />
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setBankDialogOpen(false)}>取消</Button>
                          <Button type="submit" disabled={loading}>{loading ? '创建中...' : '确认创建'}</Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="border-l pl-4 flex items-center gap-2">
                  <Select value={questionFilter.type} onValueChange={(v) => setQuestionFilter({ ...questionFilter, type: v })}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部类型</SelectItem>
                      <SelectItem value="single">单选题</SelectItem>
                      <SelectItem value="multiple">多选题</SelectItem>
                      <SelectItem value="judge">判断题</SelectItem>
                      <SelectItem value="short">简答题</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={questionFilter.difficulty} onValueChange={(v) => setQuestionFilter({ ...questionFilter, difficulty: v })}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部难度</SelectItem>
                      <SelectItem value="easy">简单</SelectItem>
                      <SelectItem value="medium">中等</SelectItem>
                      <SelectItem value="hard">困难</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* 题库分区列表 */}
            {questionBanks.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {questionBanks.map(bank => (
                  <Card key={bank.id} className={`cursor-pointer hover:border-primary transition-colors ${selectedBankId === bank.id ? 'border-primary bg-primary/5' : ''}`} onClick={() => setSelectedBankId(bank.id)}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-sm">{bank.name}</h4>
                          <p className="text-xs text-gray-500 mt-1">{bank.question_count || 0} 道题目</p>
                        </div>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-400 hover:text-red-500" onClick={(e) => { e.stopPropagation(); handleDeleteBank(bank.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs text-gray-500">题目内容</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-500 w-20">类型</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-500 w-20">难度</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-500 w-16">分值</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-500 w-24">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {questions.map((q) => (
                        <tr key={q.id}>
                          <td className="px-4 py-3 text-sm max-w-md truncate">{q.content}</td>
                          <td className="px-4 py-3 text-sm"><Badge variant="outline">{getQuestionTypeName(q.type)}</Badge></td>
                          <td className="px-4 py-3"><Badge className={getDifficultyColor(q.difficulty)}>{getDifficultyName(q.difficulty)}</Badge></td>
                          <td className="px-4 py-3 text-sm text-gray-500">{q.score}分</td>
                          <td className="px-4 py-3 text-sm space-x-1">
                            <Button size="sm" variant="ghost" onClick={() => handleEditQuestion(q)}><Edit className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDeleteQuestion(q.id)}>删除</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {questions.length === 0 && (
                  <div className="text-center py-12 text-gray-500">暂无题目，点击上方按钮添加</div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* 考试管理 - 教师 */}
        {currentPage === 'exams' && user.role === 'teacher' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">考试管理</h2>
                <p className="text-gray-500 mt-1">创建考试、发布、查看成绩</p>
              </div>
              <Dialog open={examDialogOpen} onOpenChange={setExamDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" /> 创建考试</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader><DialogTitle>创建考试</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreateExam} className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>考试名称</Label>
                        <Input placeholder="请输入考试名称" value={examForm.title} onChange={(e) => setExamForm({ ...examForm, title: e.target.value })} required />
                      </div>
                      <div>
                        <Label>考试时长（分钟）</Label>
                        <Input type="number" min={10} value={examForm.duration} onChange={(e) => setExamForm({ ...examForm, duration: parseInt(e.target.value) })} />
                      </div>
                    </div>
                    <div>
                      <Label>考试说明</Label>
                      <Textarea placeholder="请输入考试说明（可选）" value={examForm.description} onChange={(e) => setExamForm({ ...examForm, description: e.target.value })} />
                    </div>
                    <div>
                      <Label>题目配置（从题库随机抽取）</Label>
                      <div className="grid grid-cols-4 gap-4 mt-2">
                        <div>
                          <Label className="text-xs text-gray-500">单选题</Label>
                          <Input type="number" min={0} value={examForm.questionConfig.single} onChange={(e) => setExamForm({ ...examForm, questionConfig: { ...examForm.questionConfig, single: parseInt(e.target.value) } })} />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">多选题</Label>
                          <Input type="number" min={0} value={examForm.questionConfig.multiple} onChange={(e) => setExamForm({ ...examForm, questionConfig: { ...examForm.questionConfig, multiple: parseInt(e.target.value) } })} />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">判断题</Label>
                          <Input type="number" min={0} value={examForm.questionConfig.judge} onChange={(e) => setExamForm({ ...examForm, questionConfig: { ...examForm.questionConfig, judge: parseInt(e.target.value) } })} />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">简答题</Label>
                          <Input type="number" min={0} value={examForm.questionConfig.short} onChange={(e) => setExamForm({ ...examForm, questionConfig: { ...examForm.questionConfig, short: parseInt(e.target.value) } })} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={examForm.antiCheat} onCheckedChange={(checked) => setExamForm({ ...examForm, antiCheat: !!checked })} />
                      <Label className="text-sm">开启防作弊监控（检测切屏行为）</Label>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setExamDialogOpen(false)}>取消</Button>
                      <Button type="submit" disabled={loading}>{loading ? '创建中...' : '确认创建'}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs text-gray-500">考试名称</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-500 w-24">时长</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-500 w-24">防作弊</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-500 w-20">状态</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-500 w-32">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {exams.map((exam) => (
                        <tr key={exam.id}>
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium">{exam.title}</p>
                              <p className="text-xs text-gray-500">{formatDate(exam.created_at)}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{exam.duration}分钟</td>
                          <td className="px-4 py-3">
                            <Badge variant={exam.anti_cheat ? 'default' : 'outline'}>{exam.anti_cheat ? '已开启' : '未开启'}</Badge>
                          </td>
                          <td className="px-4 py-3">{getExamStatusBadge(exam.status)}</td>
                          <td className="px-4 py-3 text-sm space-x-1">
                            {exam.status === 'draft' && (
                              <Button size="sm" onClick={() => handlePublishExam(exam.id)}>发布</Button>
                            )}
                            {exam.status === 'published' && (
                              <Button size="sm" variant="destructive" onClick={() => handleEndExam(exam.id)}>结束</Button>
                            )}
                            {exam.status === 'ended' && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => handleViewExamResults(exam)}>查看成绩</Button>
                                <Button size="sm" variant="outline" className="text-purple-600" onClick={() => handleViewExamAnalysis(exam)}>成绩分析</Button>
                                {!exam.grading_completed && (
                                  <Button size="sm" variant="outline" className="text-green-600" onClick={() => handleConfirmGradingComplete(exam.id)}>确认批阅完成</Button>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {exams.length === 0 && (
                  <div className="text-center py-12 text-gray-500">暂无考试，点击上方按钮创建</div>
                )}
              </CardContent>
            </Card>

            {/* 成绩查看弹窗 */}
            <Dialog open={examResultsOpen} onOpenChange={setExamResultsOpen}>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>考试成绩 - {examResultExam?.title}</DialogTitle>
                </DialogHeader>
                {examResultExam && (
                  <div className="space-y-4 mt-4">
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500 items-center">
                      <span>总分：{examResultExam.total_score}分</span>
                      <span>时长：{examResultExam.duration}分钟</span>
                      <span>题目数：{examResultExam.question_ids?.length || 0}题</span>
                      {examResultExam.grade_public_type !== 'none' && (
                        <Badge className="bg-blue-100 text-blue-700">
                          成绩已公开{examResultExam.grade_public_type === 'personal' ? '（个人）' : '（全部）'}
                        </Badge>
                      )}
                      {examResultExam.grading_completed && (
                        <Badge className="bg-green-100 text-green-700">批阅完成</Badge>
                      )}
                    </div>
                    
                    {/* 成绩公开按钮 */}
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-blue-600"
                        onClick={() => handlePublicGrades(examResultExam.id, 'personal')}
                        disabled={examResultExam.grade_public_type === 'personal'}
                      >
                        公开个人成绩
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-green-600"
                        onClick={() => handlePublicGrades(examResultExam.id, 'all')}
                        disabled={examResultExam.grade_public_type === 'all'}
                      >
                        公开全部成绩
                      </Button>
                    </div>
                    
                    {examResultRecords.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">暂无学生提交记录</div>
                    ) : (
                      <>
                        <div className="text-sm text-gray-500">
                          共 {examResultRecords.length} 人提交，{examResultRecords.filter(r => r.status === 'graded').length} 人已批改
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left">学生</th>
                                <th className="px-3 py-2 text-left">状态</th>
                                <th className="px-3 py-2 text-left">得分</th>
                                <th className="px-3 py-2 text-left">提交时间</th>
                                <th className="px-3 py-2 text-left">操作</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {examResultRecords.map((record) => (
                                <tr key={record.id}>
                                  <td className="px-3 py-2">
                                    <div>
                                      <p className="font-medium">{record.users?.name || '未知'}</p>
                                      <p className="text-xs text-gray-400">{record.users?.account || ''}</p>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2">
                                    <Badge className={
                                      record.status === 'graded' ? 'bg-green-100 text-green-800' :
                                      record.status === 'submitted' ? 'bg-amber-100 text-amber-800' :
                                      record.status === 'ongoing' ? 'bg-blue-100 text-blue-800' :
                                      'bg-gray-100 text-gray-800'
                                    }>
                                      {record.status === 'graded' ? '已批改' :
                                       record.status === 'submitted' ? '待批改' :
                                       record.status === 'ongoing' ? '进行中' : '未开始'}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-2 font-medium">
                                    {record.score !== null && record.score !== undefined 
                                      ? <span className={record.score >= examResultExam.total_score * 0.6 ? 'text-green-600' : 'text-red-600'}>{record.score}分</span>
                                      : <span className="text-gray-400">-</span>
                                    }
                                  </td>
                                  <td className="px-3 py-2 text-gray-500">
                                    {record.submit_time ? formatDate(record.submit_time) : '-'}
                                  </td>
                                  <td className="px-3 py-2">
                                    <Button size="sm" variant="ghost" onClick={() => handleViewStudentPaper(record)}>
                                      查看试卷
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* 我的考试 - 学生 */}
        {currentPage === 'exams' && user.role === 'student' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-800">我的考试</h2>
              <p className="text-gray-500 mt-1">查看和参加考试</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {exams.filter(e => e.status === 'published' || e.status === 'ended').map((exam) => {
                const record = examRecords.find(r => r.exam_id === exam.id);
                const isEnded = exam.status === 'ended';
                const canViewGrade = exam.grade_public_type !== 'none' && record;
                return (
                  <Card key={exam.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-medium">{exam.title}</h3>
                        {isEnded ? (
                          <Badge className="bg-red-100 text-red-800">已结束</Badge>
                        ) : record?.status === 'submitted' || record?.status === 'graded' ? (
                          <Badge variant="outline" className="text-green-600">已完成</Badge>
                        ) : record?.status === 'ongoing' ? (
                          <Badge className="bg-amber-100 text-amber-800">进行中</Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-800">待参加</Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 space-y-1 mb-4">
                        <p>时长：{exam.duration}分钟</p>
                        <p>总分：{exam.total_score}分</p>
                        {record?.score !== null && record?.score !== undefined && (
                          <p>得分：<span className={record.score! >= exam.total_score * 0.6 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{record.score}分</span></p>
                        )}
                      </div>
                      {exam.anti_cheat && !isEnded && (
                        <Alert className="mb-4">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription className="text-xs">该考试已开启防作弊监控</AlertDescription>
                        </Alert>
                      )}
                      <div className="space-y-2">
                        {!isEnded && !record?.submit_time && (
                          <Button className="w-full" onClick={() => handleStartExam(exam)}>
                            <Play className="h-4 w-4 mr-1" /> {record ? '继续考试' : '开始考试'}
                          </Button>
                        )}
                        {record?.submit_time && (
                          <>
                            {canViewGrade && (
                              <Button 
                                className="w-full" 
                                variant="outline"
                                onClick={() => record && handleViewMyExamResult(exam, record)}
                              >
                                <Eye className="h-4 w-4 mr-1" /> 查看成绩
                              </Button>
                            )}
                            {exam.grade_public_type === 'none' && (
                              <Button className="w-full" variant="outline" disabled>
                                成绩未公开
                              </Button>
                            )}
                            <Button 
                              className="w-full" 
                              variant="outline"
                              onClick={() => record && handleViewExamPaper(exam, record)}
                            >
                              <FileText className="h-4 w-4 mr-1" /> 查看试题
                            </Button>
                          </>
                        )}
                        {isEnded && !record?.submit_time && (
                          <Button className="w-full" variant="outline" disabled>未参加</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {exams.filter(e => e.status === 'published' || e.status === 'ended').length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500">暂无考试</div>
              )}
            </div>
          </div>
        )}

        {/* 学生名单 - 教师 */}
        {currentPage === 'students' && user.role === 'teacher' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">学生名单</h2>
                <p className="text-gray-500 mt-1">查看所有注册的学生账号</p>
              </div>
              <Button variant="outline" onClick={fetchAllStudents}>刷新列表</Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">学号</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">姓名</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">账号</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">注册时间</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {allStudents.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                            暂无学生数据，点击刷新列表获取
                          </td>
                        </tr>
                      )}
                      {allStudents.sort((a, b) => (a.student_id || '').localeCompare(b.student_id || '')).map(student => (
                        <tr key={student.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-mono text-gray-900">{student.student_id || '-'}</td>
                          <td className="px-6 py-4 font-medium text-gray-900">{student.name}</td>
                          <td className="px-6 py-4 text-gray-500">{student.account}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">-</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 签到管理 - 教师 */}
        {currentPage === 'signins' && user.role === 'teacher' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">签到管理</h2>
                <p className="text-gray-500 mt-1">发起定位签到或签到码签到</p>
              </div>
              <Dialog open={signInDialogOpen} onOpenChange={setSignInDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" /> 发起签到</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>发起签到</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreateSignIn} className="space-y-4 mt-4">
                    <div>
                      <Label>签到标题</Label>
                      <Input placeholder="如：周三课堂签到" value={signInForm.title} onChange={(e) => setSignInForm({ ...signInForm, title: e.target.value })} required />
                    </div>
                    <div>
                      <Label>签到方式</Label>
                      <Select value={signInForm.type} onValueChange={(v) => setSignInForm({ ...signInForm, type: v as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="code">签到码</SelectItem>
                          <SelectItem value="location">定位签到</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {signInForm.type === 'code' && (
                      <div>
                        <Label>签到码（留空自动生成）</Label>
                        <Input placeholder="如：ABC123" value={signInForm.code} onChange={(e) => setSignInForm({ ...signInForm, code: e.target.value.toUpperCase() })} maxLength={6} />
                      </div>
                    )}
                    {signInForm.type === 'location' && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>纬度</Label>
                            <Input placeholder="如：39.9042" value={signInForm.latitude} onChange={(e) => setSignInForm({ ...signInForm, latitude: e.target.value })} />
                          </div>
                          <div>
                            <Label>经度</Label>
                            <Input placeholder="如：116.4074" value={signInForm.longitude} onChange={(e) => setSignInForm({ ...signInForm, longitude: e.target.value })} />
                          </div>
                        </div>
                        <div>
                          <Label>允许范围（米）</Label>
                          <Input type="number" min={50} value={signInForm.radius} onChange={(e) => setSignInForm({ ...signInForm, radius: parseInt(e.target.value) })} />
                        </div>
                      </>
                    )}
                    <div>
                      <Label>签到时长（分钟）</Label>
                      <Input type="number" min={1} max={60} value={signInForm.duration} onChange={(e) => setSignInForm({ ...signInForm, duration: parseInt(e.target.value) })} />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setSignInDialogOpen(false)}>取消</Button>
                      <Button type="submit" disabled={loading}>{loading ? '创建中...' : '确认发起'}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs text-gray-500">签到标题</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-500 w-24">类型</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-500 w-20">状态</th>
                        <th className="px-4 py-3 text-left text-xs text-gray-500 w-32">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {signIns.map((si) => (
                        <tr key={si.id}>
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium">{si.title}</p>
                              <p className="text-xs text-gray-500">{formatDate(si.created_at)}</p>
                              {si.type === 'code' && si.status === 'active' && (
                                <p className="text-xs text-primary font-mono">签到码：{si.code}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline">{si.type === 'code' ? '签到码' : '定位'}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={si.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                              {si.status === 'active' ? '进行中' : '已结束'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm space-x-1">
                            <Button size="sm" variant="ghost" onClick={() => handleViewSignInRecords(si)}>查看</Button>
                            {si.status === 'active' && (
                              <Button size="sm" variant="destructive" onClick={() => handleEndSignIn(si.id)}>结束</Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {signIns.length === 0 && (
                  <div className="text-center py-12 text-gray-500">暂无签到记录，点击上方按钮发起</div>
                )}
              </CardContent>
            </Card>

            <Dialog open={signInDetailOpen} onOpenChange={setSignInDetailOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>签到记录 - {currentSignIn?.title}</DialogTitle>
                </DialogHeader>
                <div className="mt-4 max-h-96 overflow-y-auto">
                  {signInRecords.length > 0 ? (
                    <div className="space-y-2">
                      {signInRecords.map((r) => (
                        <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            <span className="font-medium">{r.student_name}</span>
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatDate(r.signed_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">暂无签到记录</div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* 我的签到 - 学生 */}
        {currentPage === 'signins' && user.role === 'student' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-800">我的签到</h2>
              <p className="text-gray-500 mt-1">参与课堂签到</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {signIns.filter(s => s.status === 'active').map((si) => {
                const record = signInRecords.find(r => r.sign_in_id === si.id);
                return (
                  <Card key={si.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-medium">{si.title}</h3>
                        {record ? (
                          <Badge className="bg-green-100 text-green-800"><Check className="h-3 w-3 mr-1" />已签到</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800">待签到</Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 space-y-1 mb-4">
                        <p>类型：{si.type === 'code' ? '签到码签到' : '定位签到'}</p>
                        <p>剩余时间：{si.end_time ? Math.max(0, Math.floor((new Date(si.end_time).getTime() - Date.now()) / 60000)) : 0}分钟</p>
                      </div>

                      {si.type === 'code' && !record && (
                        <div className="flex gap-2">
                          <Input placeholder="请输入签到码" value={studentSignInCode} onChange={(e) => setStudentSignInCode(e.target.value.toUpperCase())} maxLength={6} />
                          <Button onClick={() => handleStudentSignIn(si)}>签到</Button>
                        </div>
                      )}

                      {si.type === 'location' && !record && (
                        <div className="space-y-2">
                          {studentLocation ? (
                            <>
                              <p className="text-xs text-gray-500">已获取位置</p>
                              <Button className="w-full" onClick={() => handleStudentSignIn(si)}>
                                <MapPin className="h-4 w-4 mr-1" /> 确认签到
                              </Button>
                            </>
                          ) : (
                            <Button className="w-full" variant="outline" onClick={getStudentLocation}>
                              <MapPin className="h-4 w-4 mr-1" /> 获取位置
                            </Button>
                          )}
                        </div>
                      )}

                      {record && (
                        <Button className="w-full" variant="outline" disabled>
                          <Check className="h-4 w-4 mr-1" /> 已完成签到
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {signIns.filter(s => s.status === 'active').length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500">暂无进行中的签到</div>
              )}
            </div>
          </div>
        )}
        </div>
      </main>

      {/* 群聊弹窗 */}
      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="max-w-lg h-[600px] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              {currentClass?.name} - 班级群聊
            </DialogTitle>
          </DialogHeader>
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 rounded-lg">
            {chatMessages.length > 0 ? (
              chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] ${msg.sender_id === user?.id ? 'bg-primary text-white' : 'bg-white'} rounded-lg p-3 shadow-sm`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs ${msg.sender_id === user?.id ? 'text-white/80' : 'text-gray-500'}`}>
                        {msg.sender_name}
                      </span>
                      {msg.sender_role === 'teacher' && (
                        <Badge variant="outline" className="text-xs h-4">教师</Badge>
                      )}
                    </div>
                    <p className="text-sm">{msg.content}</p>
                    <p className={`text-xs mt-1 ${msg.sender_id === user?.id ? 'text-white/60' : 'text-gray-400'}`}>
                      {formatDate(msg.created_at)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">暂无消息，开始聊天吧！</div>
            )}
          </div>
          <form onSubmit={handleSendMessage} className="flex gap-2 mt-4">
            <Input
              placeholder="输入消息..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={!chatInput.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* 成员管理弹窗 */}
      <Dialog open={memberManageOpen} onOpenChange={setMemberManageOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{currentClass?.name} - 成员管理</DialogTitle>
          </DialogHeader>
          <div className="mt-4 max-h-96 overflow-y-auto">
            {classMembers.length > 0 ? (
              <div className="space-y-2">
                {classMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <img src={member.avatar || 'https://picsum.photos/40/40'} alt="头像" className="w-10 h-10 rounded-full" />
                      <div>
                        <p className="font-medium">{member.nickname || member.name}</p>
                        <p className="text-xs text-gray-500">
                          {member.role === 'teacher' ? '教师' : '学生'}
                        </p>
                      </div>
                    </div>
                    {member.role !== 'teacher' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const newNickname = prompt('输入新昵称：', member.nickname || member.name);
                            if (newNickname) handleUpdateNickname(member.id, newNickname);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500"
                          onClick={() => currentClass && handleKickMember(currentClass.id, member.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">暂无成员</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 成绩分析弹窗 */}
      <Dialog open={examAnalysisOpen} onOpenChange={setExamAnalysisOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>成绩分析 - {examAnalysisData?.exam?.title}</DialogTitle>
          </DialogHeader>
          {examAnalysisData && (
            <div className="space-y-6 mt-4">
              {/* 总体统计 */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">{examAnalysisData.records.length}</div>
                  <div className="text-sm text-gray-600">参考人数</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">{examAnalysisData.avgScore}</div>
                  <div className="text-sm text-gray-600">平均分</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-purple-600">{examAnalysisData.maxScore}</div>
                  <div className="text-sm text-gray-600">最高分</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-orange-600">{examAnalysisData.passCount}</div>
                  <div className="text-sm text-gray-600">及格人数</div>
                </div>
              </div>
              
              {/* 分数段分布 */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-4">分数段分布</h4>
                <div className="space-y-3">
                  {Object.entries(examAnalysisData.scoreDistribution).map(([range, count]) => (
                    <div key={range} className="flex items-center gap-4">
                      <span className="w-16 text-sm text-gray-600">{range}分</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full transition-all" 
                          style={{ width: `${examAnalysisData.records.length > 0 ? (count / examAnalysisData.records.length * 100) : 0}%` }}
                        />
                      </div>
                      <span className="w-12 text-sm text-gray-700 text-right">{count}人</span>
                      <span className="w-16 text-sm text-gray-500">
                        {examAnalysisData.records.length > 0 ? (count / examAnalysisData.records.length * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* 各题正确率 */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-4">各题正确率</h4>
                <div className="space-y-4">
                  {examAnalysisData.questionStats.map((q: any, idx: number) => (
                    <Card key={q.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">{getQuestionTypeName(q.type)}</Badge>
                              <span className="text-sm text-gray-500">{q.score}分</span>
                            </div>
                            <p className="font-medium text-gray-900">{idx + 1}. {q.content}</p>
                          </div>
                          <div className="text-right ml-4">
                            <div className={`text-2xl font-bold ${parseFloat(q.correctRate) >= 60 ? 'text-green-600' : 'text-red-600'}`}>
                              {q.correctRate}%
                            </div>
                            <div className="text-sm text-gray-500">{q.correctCount}/{q.totalCount}人正确</div>
                          </div>
                        </div>
                        {q.options && Object.keys(q.optionStats).length > 0 && (
                          <div className={`grid gap-2 mt-3 ${q.options.length <= 4 ? 'grid-cols-4' : 'grid-cols-2'}`}>
                            {q.options.map((opt: string, optIdx: number) => {
                              const letter = String.fromCharCode(65 + optIdx);
                              const count = q.optionStats[letter] || 0;
                              const isCorrect = q.answer.includes(letter);
                              return (
                                <div key={optIdx} className={`text-center p-2 rounded ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                                  <div className={`text-lg font-bold ${isCorrect ? 'text-green-600' : 'text-gray-600'}`}>{letter}</div>
                                  <div className="text-xs text-gray-500">{count}人</div>
                                  <div className="text-xs text-gray-400">
                                    {q.totalCount > 0 ? (count / q.totalCount * 100).toFixed(1) : 0}%
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 学生查看成绩弹窗 */}
      <Dialog open={studentExamResultOpen} onOpenChange={setStudentExamResultOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>我的成绩 - {studentExamView?.title}</DialogTitle>
          </DialogHeader>
          {studentExamView && studentRecordView && (
            <div className="space-y-6 mt-4">
              {/* 成绩统计 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">{studentRecordView.score ?? '-'}</div>
                  <div className="text-sm text-gray-600">我的得分</div>
                </div>
                {studentExamView.grade_public_type === 'all' && (
                  <>
                    <div className="bg-green-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {examRecords.filter(r => r.exam_id === studentExamView.id && (r.status === 'submitted' || r.status === 'graded')).sort((a, b) => (b.score || 0) - (a.score || 0)).findIndex(r => r.id === studentRecordView.id) + 1}
                      </div>
                      <div className="text-sm text-gray-600">排名</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {studentRecordView.score !== null ? (studentRecordView.score / studentExamView.total_score * 100).toFixed(1) : '-'}%
                      </div>
                      <div className="text-sm text-gray-600">正确率</div>
                    </div>
                  </>
                )}
              </div>
              
              {/* 全部成绩排名（如果公开） */}
              {studentExamView.grade_public_type === 'all' && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-4">成绩排名</h4>
                  <div className="bg-gray-50 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">排名</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">得分</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">正确率</th>
                        </tr>
                      </thead>
                      <tbody>
                        {examRecords
                          .filter(r => r.exam_id === studentExamView.id && (r.status === 'submitted' || r.status === 'graded'))
                          .sort((a, b) => (b.score || 0) - (a.score || 0))
                          .slice(0, 10)
                          .map((r, idx) => {
                            const isMe = r.id === studentRecordView.id;
                            return (
                              <tr key={r.id} className={isMe ? 'bg-blue-50' : ''}>
                                <td className="px-4 py-2 font-medium">{idx + 1}</td>
                                <td className="px-4 py-2 font-medium">{r.score !== null ? r.score + '分' : '-'}</td>
                                <td className="px-4 py-2">{r.score !== null ? (r.score / studentExamView.total_score * 100).toFixed(1) : '-'}%</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {/* 答题详情 */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-4">答题详情</h4>
                <div className="space-y-2">
                  {currentExamQuestions.map((q, idx) => {
                    const graded = studentRecordView.graded_answers?.[q.id];
                    const isCorrect = graded?.correct;
                    return (
                      <div key={q.id} className={`flex items-center justify-between p-3 rounded-lg ${isCorrect ? 'bg-green-50' : graded ? 'bg-red-50' : 'bg-gray-50'}`}>
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${isCorrect ? 'bg-green-500 text-white' : graded ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-600'}`}>
                            {idx + 1}
                          </span>
                          <span className="text-sm text-gray-700">{q.content.substring(0, 30)}{q.content.length > 30 ? '...' : ''}</span>
                        </div>
                        <div className="text-sm">
                          {graded ? (
                            <span className={isCorrect ? 'text-green-600' : 'text-red-600 font-medium'}>{graded.score}分</span>
                          ) : (
                            <span className="text-gray-400">待批改</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 学生/教师查看试卷弹窗 */}
      <Dialog open={studentExamPaperOpen} onOpenChange={setStudentExamPaperOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>试题回顾 - {studentExamView?.title}</DialogTitle>
          </DialogHeader>
          {studentExamView && studentRecordView && (
            <div className="space-y-6 mt-4">
              <div className="text-sm text-gray-500">
                得分：{studentRecordView.score ?? '待批改'}分 / {studentExamView.total_score}分
              </div>
              
              <div className="space-y-4">
                {currentExamQuestions.map((q, idx) => {
                  const studentAnswer = studentRecordView.answers?.[q.id];
                  const graded = studentRecordView.graded_answers?.[q.id];
                  const isCorrect = graded?.correct;
                  
                  return (
                    <Card key={q.id} className={`border ${isCorrect ? 'border-green-200' : graded ? 'border-red-200' : 'border-gray-200'}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant="outline">{getQuestionTypeName(q.type)}</Badge>
                          <span className="text-sm text-gray-500">{q.score}分</span>
                          {graded && (
                            <Badge className={isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                              {isCorrect ? '✓ 正确' : '✗ 错误'} {graded.score}分
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium text-gray-900 mb-3">{idx + 1}. {q.content}</p>
                        
                        {q.options ? (
                          <div className="space-y-1 mb-3">
                            {q.options.map((opt, optIdx) => {
                              const letter = String.fromCharCode(65 + optIdx);
                              const isSelected = studentAnswer && (q.type === 'multiple' ? studentAnswer.includes(letter) : studentAnswer === letter);
                              const isCorrectOpt = q.answer.includes(letter);
                              return (
                                <div key={optIdx} className={`flex items-center gap-2 p-2 rounded ${isSelected ? (isCorrectOpt ? 'bg-green-100' : 'bg-red-100') : (isCorrectOpt ? 'bg-green-50' : '')}`}>
                                  <span className={`font-medium ${isSelected ? (isCorrectOpt ? 'text-green-700' : 'text-red-700') : (isCorrectOpt ? 'text-green-600' : 'text-gray-600')}`}>
                                    {opt}
                                  </span>
                                  {isSelected && <span className="text-xs">（你的选择）</span>}
                                  {isCorrectOpt && <span className="text-xs text-green-600">（正确答案）</span>}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="bg-gray-50 p-3 rounded mb-3">
                            <p className="text-sm text-gray-600">你的答案：</p>
                            <p className="mt-1">{studentAnswer || '未作答'}</p>
                          </div>
                        )}
                        
                        {q.analysis && (
                          <div className="mt-3 text-sm text-gray-500 bg-blue-50 p-3 rounded">
                            <span className="font-medium">解析：</span>{q.analysis}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 教师查看学生试卷弹窗（带批改功能） */}
      <Dialog open={examResultsOpen} onOpenChange={setExamResultsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>学生答卷 - {examResultExam?.title}</DialogTitle>
          </DialogHeader>
          {examResultExam && examResultRecords.length > 0 && (
            <div className="space-y-6 mt-4">
              {examResultRecords.map(record => {
                const student = record.users;
                return (
                  <div key={record.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-semibold">{student?.name || '未知学生'}</h4>
                        <p className="text-sm text-gray-500">当前得分：{record.score ?? '待批改'}分</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      {currentExamQuestions.map((q, idx) => {
                        const studentAnswer = record.answers?.[q.id];
                        const graded = record.graded_answers?.[q.id];
                        const isCorrect = graded?.correct;
                        const needsGrading = q.type === 'short' && (!graded || graded.needsGrading);
                        
                        return (
                          <div key={q.id} className={`border rounded-lg p-4 ${isCorrect ? 'border-green-200 bg-green-50' : graded && !isCorrect ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <Badge variant="outline">{getQuestionTypeName(q.type)}</Badge>
                                <span className="ml-2 text-sm text-gray-500">{q.score}分</span>
                              </div>
                              {graded && !needsGrading ? (
                                <Badge className={isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                  {isCorrect ? '✓ 正确' : '✗ 错误'} {graded.score}分
                                </Badge>
                              ) : needsGrading ? (
                                <Badge className="bg-amber-100 text-amber-700">待批改</Badge>
                              ) : null}
                            </div>
                            <p className="font-medium text-gray-900 mb-3">{idx + 1}. {q.content}</p>
                            
                            {q.options ? (
                              <div className="space-y-1 mb-3">
                                {q.options.map((opt, optIdx) => {
                                  const letter = String.fromCharCode(65 + optIdx);
                                  const isSelected = studentAnswer && (q.type === 'multiple' ? studentAnswer.includes(letter) : studentAnswer === letter);
                                  const isCorrectOpt = q.answer.includes(letter);
                                  return (
                                    <div key={optIdx} className={`flex items-center gap-2 p-2 rounded ${isSelected ? (isCorrectOpt ? 'bg-green-100' : 'bg-red-100') : (isCorrectOpt ? 'bg-green-50' : '')}`}>
                                      <span className={`font-medium ${isSelected ? (isCorrectOpt ? 'text-green-700' : 'text-red-700') : (isCorrectOpt ? 'text-green-600' : 'text-gray-600')}`}>
                                        {opt}
                                      </span>
                                      {isSelected && <span className="text-xs">（学生选择）</span>}
                                      {isCorrectOpt && <span className="text-xs text-green-600">（正确答案）</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="bg-gray-50 p-3 rounded mb-3">
                                <p className="text-sm text-gray-600">学生答案：</p>
                                <p className="mt-1">{studentAnswer || '未作答'}</p>
                              </div>
                            )}
                            
                            {needsGrading && (
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <div className="flex items-center gap-4">
                                  <Label className="text-sm font-medium">评分：</Label>
                                  <Input 
                                    type="number" 
                                    min={0} 
                                    max={q.score} 
                                    className="w-20" 
                                    placeholder={`0-${q.score}`}
                                    onChange={(e) => {
                                      const score = parseInt(e.target.value);
                                      if (!isNaN(score)) {
                                        handleGradeQuestion(record.id, q.id, score, q.score);
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                            
                            {q.analysis && (
                              <div className="mt-3 text-sm text-gray-500">
                                <span className="font-medium">解析：</span>{q.analysis}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
