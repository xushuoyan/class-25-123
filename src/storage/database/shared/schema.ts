import { pgTable, serial, timestamp, varchar, text, boolean, integer, index, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"

// 系统健康检查表（保留）
export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 用户表
export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    account: varchar("account", { length: 50 }).notNull().unique(),
    password: varchar("password", { length: 255 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    role: varchar("role", { length: 20 }).notNull().default("student"),
    avatar: varchar("avatar", { length: 500 }),
    // 学生专用字段
    studentId: varchar("student_id", { length: 10 }).unique(), // 学号，10位数字
    // 教师专用字段
    inviteCode: varchar("invite_code", { length: 6 }), // 教师邀请码
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index("users_account_idx").on(table.account),
    index("users_student_id_idx").on(table.studentId),
  ]
);

// 文件表
export const files = pgTable(
  "files",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    size: integer("size").notNull(),
    storageKey: varchar("storage_key", { length: 500 }).notNull(),
    downloadUrl: text("download_url"),
    uploaderId: varchar("uploader_id", { length: 36 }).notNull(),
    folderId: varchar("folder_id", { length: 36 }),
    downloads: integer("downloads").notNull().default(0),
    isPublic: boolean("is_public").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("files_uploader_idx").on(table.uploaderId),
    index("files_type_idx").on(table.type),
    index("files_folder_idx").on(table.folderId),
  ]
);

// 题库分区表
export const questionBanks = pgTable(
  "question_banks",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    subject: varchar("subject", { length: 100 }),
    creatorId: varchar("creator_id", { length: 36 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index("question_banks_creator_idx").on(table.creatorId),
  ]
);

// 题库表
export const questions = pgTable(
  "questions",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    content: text("content").notNull(), // 题目内容
    type: varchar("type", { length: 20 }).notNull(), // single(单选), multiple(多选), judge(判断), short(简答)
    options: jsonb("options"), // 选项数组，如 ["A. xxx", "B. xxx", "C. xxx", "D. xxx"]
    answer: text("answer").notNull(), // 正确答案
    analysis: text("analysis"), // 解析
    difficulty: varchar("difficulty", { length: 20 }).notNull().default("medium"), // easy, medium, hard
    score: integer("score").notNull().default(2), // 分值
    subject: varchar("subject", { length: 100 }), // 科目/章节
    bankId: varchar("bank_id", { length: 36 }), // 所属题库分区ID
    sourceFileId: varchar("source_file_id", { length: 36 }), // 来源文件ID（AI提取时关联）
    creatorId: varchar("creator_id", { length: 36 }).notNull(), // 创建者ID
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index("questions_type_idx").on(table.type),
    index("questions_creator_idx").on(table.creatorId),
    index("questions_bank_idx").on(table.bankId),
    index("questions_source_idx").on(table.sourceFileId),
  ]
);

// 考试表
export const exams = pgTable(
  "exams",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    duration: integer("duration").notNull(), // 考试时长（分钟）
    totalScore: integer("total_score").notNull(), // 总分
    questionConfig: jsonb("question_config").notNull(), // 题目配置，如 {single: 10, multiple: 5, judge: 10, short: 3}
    questionIds: jsonb("question_ids"), // 已抽取的题目ID数组
    antiCheat: boolean("anti_cheat").notNull().default(true), // 是否开启防作弊
    gradePublicType: varchar("grade_public_type", { length: 20 }).default("none"), // none, personal, all - 成绩公开类型
    gradingCompleted: boolean("grading_completed").default(false), // 批阅是否完成
    startTime: timestamp("start_time", { withTimezone: true, mode: 'string' }),
    endTime: timestamp("end_time", { withTimezone: true, mode: 'string' }),
    status: varchar("status", { length: 20 }).notNull().default("draft"), // draft, published, ongoing, ended
    creatorId: varchar("creator_id", { length: 36 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index("exams_status_idx").on(table.status),
    index("exams_creator_idx").on(table.creatorId),
  ]
);

// 考试记录表（学生考试记录）
export const examRecords = pgTable(
  "exam_records",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    examId: varchar("exam_id", { length: 36 }).notNull(),
    studentId: varchar("student_id", { length: 36 }).notNull(),
    answers: jsonb("answers"), // 学生答案
    score: integer("score"), // 得分
    startTime: timestamp("start_time", { withTimezone: true, mode: 'string' }),
    submitTime: timestamp("submit_time", { withTimezone: true, mode: 'string' }),
    status: varchar("status", { length: 20 }).notNull().default("not_started"), // not_started, ongoing, submitted, graded
    antiCheatFlags: jsonb("anti_cheat_flags"), // 防作弊标记
    gradedAt: timestamp("graded_at", { withTimezone: true, mode: 'string' }),
    gradedBy: varchar("graded_by", { length: 36 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("exam_records_exam_idx").on(table.examId),
    index("exam_records_student_idx").on(table.studentId),
  ]
);

// 签到表
export const signIns = pgTable(
  "sign_ins",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    title: varchar("title", { length: 255 }).notNull(),
    type: varchar("type", { length: 20 }).notNull(), // location(定位), code(签到码)
    code: varchar("code", { length: 10 }), // 签到码
    latitude: varchar("latitude", { length: 50 }), // 纬度
    longitude: varchar("longitude", { length: 50 }), // 经度
    radius: integer("radius").default(100), // 允许范围（米）
    duration: integer("duration").notNull().default(5), // 签到时长（分钟）
    status: varchar("status", { length: 20 }).notNull().default("active"), // active, ended
    creatorId: varchar("creator_id", { length: 36 }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true, mode: 'string' }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("sign_ins_status_idx").on(table.status),
    index("sign_ins_creator_idx").on(table.creatorId),
  ]
);

// 签到记录表
export const signInRecords = pgTable(
  "sign_in_records",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    signInId: varchar("sign_in_id", { length: 36 }).notNull(),
    studentId: varchar("student_id", { length: 36 }).notNull(),
    studentName: varchar("student_name", { length: 100 }).notNull(),
    latitude: varchar("latitude", { length: 50 }),
    longitude: varchar("longitude", { length: 50 }),
    signedAt: timestamp("signed_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    status: varchar("status", { length: 20 }).notNull().default("success"), // success, late, invalid_location
  },
  (table) => [
    index("sign_in_records_signin_idx").on(table.signInId),
    index("sign_in_records_student_idx").on(table.studentId),
  ]
);

// 班级表
export const classes = pgTable(
  "classes",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    code: varchar("code", { length: 6 }).notNull().unique(),
    creatorId: varchar("creator_id", { length: 36 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index("classes_code_idx").on(table.code),
    index("classes_creator_idx").on(table.creatorId),
  ]
);

// 班级成员表
export const classMembers = pgTable(
  "class_members",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    classId: varchar("class_id", { length: 36 }).notNull(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    nickname: varchar("nickname", { length: 100 }),
    role: varchar("role", { length: 20 }).notNull().default("student"), // teacher, student
    joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("class_members_class_idx").on(table.classId),
    index("class_members_user_idx").on(table.userId),
  ]
);

// 群聊消息表
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    classId: varchar("class_id", { length: 36 }).notNull(),
    senderId: varchar("sender_id", { length: 36 }).notNull(),
    senderName: varchar("sender_name", { length: 100 }).notNull(),
    senderRole: varchar("sender_role", { length: 20 }).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("chat_messages_class_idx").on(table.classId),
    index("chat_messages_created_idx").on(table.createdAt),
  ]
);

// 文件夹表
export const folders = pgTable(
  "folders",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 100 }).notNull(),
    parentId: varchar("parent_id", { length: 36 }),
    creatorId: varchar("creator_id", { length: 36 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("folders_creator_idx").on(table.creatorId),
    index("folders_parent_idx").on(table.parentId),
  ]
);

// Zod schemas
const { createInsertSchema: createCoercedInsertSchema } = createSchemaFactory({
  coerce: { date: true },
});

export const insertUserSchema = createCoercedInsertSchema(users).pick({
  account: true,
  password: true,
  name: true,
  role: true,
});

export const insertFileSchema = createCoercedInsertSchema(files).pick({
  name: true,
  type: true,
  size: true,
  storageKey: true,
  downloadUrl: true,
  uploaderId: true,
  isPublic: true,
});

export const insertQuestionSchema = createCoercedInsertSchema(questions).pick({
  content: true,
  type: true,
  options: true,
  answer: true,
  analysis: true,
  difficulty: true,
  score: true,
  subject: true,
  sourceFileId: true,
  creatorId: true,
});

export const insertExamSchema = createCoercedInsertSchema(exams).pick({
  title: true,
  description: true,
  duration: true,
  totalScore: true,
  questionConfig: true,
  antiCheat: true,
  startTime: true,
  endTime: true,
  creatorId: true,
});

export const insertSignInSchema = createCoercedInsertSchema(signIns).pick({
  title: true,
  type: true,
  code: true,
  latitude: true,
  longitude: true,
  radius: true,
  duration: true,
  creatorId: true,
});

// TypeScript types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type File = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Exam = typeof exams.$inferSelect;
export type InsertExam = z.infer<typeof insertExamSchema>;
export type ExamRecord = typeof examRecords.$inferSelect;
export type SignIn = typeof signIns.$inferSelect;
export type InsertSignIn = z.infer<typeof insertSignInSchema>;
export type Class = typeof classes.$inferSelect;
export type ClassMember = typeof classMembers.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type Folder = typeof folders.$inferSelect;
export type SignInRecord = typeof signInRecords.$inferSelect;
export type QuestionBank = typeof questionBanks.$inferSelect;
