import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 800);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-5 left-4 sm:bottom-6 sm:left-6 z-40 w-12 h-12 min-w-[44px] min-h-[44px] rounded-full bg-white/95 shadow-lg border border-gray-100 flex items-center justify-center hover:shadow-xl transition-all"
      aria-label="Remonter en haut"
    >
      <ArrowUp size={20} className="text-brand-black" />
    </button>
  );
}
