import { useEffect, lazy, Suspense } from 'react';
import HeroSection from '../sections/HeroSection';
import ScheduleSection from '../sections/ScheduleSection';
import ActivitiesSection from '../sections/ActivitiesSection';
import HowItWorksSection from '../sections/HowItWorksSection';
import TeamSection from '../sections/TeamSection';
import QuizBandeau from '../components/QuizBandeau';
import StickyOfferBar from '../components/StickyOfferBar';
import BackToTop from '../components/BackToTop';
import { usePageMeta } from '../hooks/usePageMeta';
import { buildHomeSchema } from '../lib/schema';
import { HOME_DESCRIPTION, HOME_TITLE } from '../lib/seoText';

const ContactSection = lazy(() => import('../sections/ContactSection'));
const BlogSection = lazy(() => import('../sections/BlogSection'));

function SectionFallback() {
  return <div className="min-h-[120px]" aria-hidden="true" />;
}

export default function HomePage() {
  usePageMeta({
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    path: '/',
    scrollToTop: typeof window === 'undefined' ? true : !window.location.hash,
  });

  useEffect(() => {
    document.fonts.ready.then(() => {
      document.body.classList.add('fonts-loaded');
    });
  }, []);

  useEffect(() => {
    const raw = window.location.hash.replace('#', '');
    if (!raw) return;
    if (raw === 'mentions-legales') {
      window.location.replace('/mentions-legales');
      return;
    }
    if (raw === 'faq') {
      window.location.replace('/faq');
      return;
    }
    const hash = raw;
    const go = () => {
      const el = document.getElementById(hash);
      if (!el) return false;
      const header = document.querySelector('header');
      const headerH = header ? header.getBoundingClientRect().height : 80;
      const y = el.getBoundingClientRect().top + window.scrollY - headerH - 8;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      return true;
    };
    if (go()) return;
    const t = window.setTimeout(go, 180);
    const t2 = window.setTimeout(go, 500);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, []);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildHomeSchema()) }}
      />
      <main id="main-content">
        {/*
          1. Hero
          2. Cours & horaires, puis descriptifs
          3. Comment ça se passe → adhésion
          4. Coachs → association → blog → contact
        */}
        <HeroSection />
        <ScheduleSection />
        {/* Juste après le planning : « Vous hésitez ? » (modules.quiz). */}
        <div className="content-max-width">
          <QuizBandeau className="mb-10" />
        </div>
        <ActivitiesSection />
        <HowItWorksSection />
        <TeamSection part="coaches" />
        <TeamSection part="club" />

        <div className="cv-auto">
          <Suspense fallback={<SectionFallback />}>
            <BlogSection />
            <ContactSection />
          </Suspense>
        </div>
      </main>

      <FooterLazy />

      <StickyOfferBar />
      <BackToTop />
    </>
  );
}

const Footer = lazy(() => import('../sections/Footer'));
function FooterLazy() {
  return (
    <Suspense fallback={<SectionFallback />}>
      <Footer />
    </Suspense>
  );
}
