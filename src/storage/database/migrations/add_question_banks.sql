-- Migration: 添加题库分区功能
-- Date: 2025-01-13

-- 1. 创建题库分区表
CREATE TABLE IF NOT EXISTS question_banks (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  subject VARCHAR(100),
  creator_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS question_banks_creator_idx ON question_banks(creator_id);

-- 3. 在questions表中添加bank_id字段
ALTER TABLE questions ADD COLUMN IF NOT EXISTS bank_id VARCHAR(36);

-- 4. 创建索引
CREATE INDEX IF NOT EXISTS questions_bank_idx ON questions(bank_id);
