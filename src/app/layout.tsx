import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '数字图像处理AI赋能课程平台',
    template: '%s | 课程平台',
  },
  description:
    '数字图像处理AI赋能课程平台 - 高效便捷的课堂互动解决方案',
  keywords: [
    '课程平台',
    '数字图像处理',
    'AI课程',
    '在线学习',
    '课堂互动',
  ],
  authors: [{ name: 'Course Platform Team' }],
  generator: 'Coze Code',
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
