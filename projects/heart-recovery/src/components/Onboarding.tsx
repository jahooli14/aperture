import { useRef, useState, type TouchEvent } from 'react';
import { ONBOARDING_CARDS } from '../data/onboardingCards';

interface OnboardingProps {
  onDone: () => void;
}

const SWIPE_THRESHOLD_PX = 50;

export default function Onboarding({ onDone }: OnboardingProps) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const isLast = index === ONBOARDING_CARDS.length - 1;
  const card = ONBOARDING_CARDS[index];

  const goNext = () => {
    if (isLast) {
      onDone();
    } else {
      setIndex((i) => Math.min(i + 1, ONBOARDING_CARDS.length - 1));
    }
  };

  const goBack = () => setIndex((i) => Math.max(i - 1, 0));

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta < -SWIPE_THRESHOLD_PX) goNext();
    else if (delta > SWIPE_THRESHOLD_PX) goBack();
    touchStartX.current = null;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div
        className="card max-w-md w-full text-center py-8"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <p className="text-recovery-teal font-semibold uppercase tracking-wide text-sm mb-2">
          {card.eyebrow}
        </p>
        <h1 className="text-2xl font-bold mb-3 leading-snug">{card.title}</h1>
        <p className="text-recovery-ink/75 leading-relaxed">{card.body}</p>
      </div>

      <div className="flex gap-1.5 mt-5" aria-hidden="true">
        {ONBOARDING_CARDS.map((c, i) => (
          <div
            key={c.title}
            className={`w-2 h-2 rounded-full ${i === index ? 'bg-recovery-teal' : 'bg-black/15'}`}
          />
        ))}
      </div>

      <div className="flex items-center gap-4 mt-6 w-full max-w-md">
        {index > 0 ? (
          <button type="button" onClick={goBack} className="text-recovery-ink/50 tap-target px-2">
            Back
          </button>
        ) : (
          <button type="button" onClick={onDone} className="text-recovery-ink/50 tap-target px-2">
            Skip
          </button>
        )}
        <button type="button" onClick={goNext} className="btn-primary flex-1">
          {isLast ? "Let's go" : 'Next'}
        </button>
      </div>
    </div>
  );
}
