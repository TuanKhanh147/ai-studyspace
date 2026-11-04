import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI StudySpace',
  description: 'Hệ thống học tập cá nhân hóa bằng AI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
