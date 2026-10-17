import { Link } from 'react-router-dom';
import { MODULES } from '../data/asso';
import { QUIZ_QUESTIONS } from '../lib/quizCours';

/**
 * Bandeau « Vous hésitez entre plusieurs cours ? » vers le quiz (modules.quiz). Sur /essai, le résultat du quiz
 * revient au formulaire avec le cours déjà choisi (/essai?cours=…).
 */
export default function QuizBandeau({ className = '' }: { className?: string }) {
  if (!MODULES.quiz) return null;
  return (
    <div
      className={`${className} max-w-[760px] mx-auto rounded-3xl bg-[#F3EEE4] ring-1 ring-black/10 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between`}
    >
      <div>
        <p className="font-display font-black text-[22px] sm:text-[24px] text-brand-black leading-tight">
          Vous hésitez entre plusieurs cours ?
        </p>
        <p className="font-body text-[16px] text-brand-gray mt-1">
          {QUIZ_QUESTIONS.length} questions, une minute. Rien n’est enregistré.
        </p>
      </div>
      <Link
        to="/quiz"
        className="inline-flex items-center justify-center min-h-[52px] px-7 rounded-full bg-orange-primary hover:bg-orange-hover text-white font-body font-semibold text-[16px] shrink-0"
      >
        Trouver mon cours
      </Link>
    </div>
  );
}
