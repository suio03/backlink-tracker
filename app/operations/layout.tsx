import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: '外链运营台 · Backlink Tracker',
  description: '各网站投递进度、资源验证与对方收录报表。',
  robots: { index: false, follow: false },
};
export default function OperationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
