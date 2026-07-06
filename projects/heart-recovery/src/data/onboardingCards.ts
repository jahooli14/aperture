export interface OnboardingCard {
  eyebrow: string;
  title: string;
  body: string;
}

// One idea per card, backed by a real number where possible — this is a
// one-time context-setting pass before daily use, not another place to
// re-explain everything the app already covers day to day.
export const ONBOARDING_CARDS: OnboardingCard[] = [
  {
    eyebrow: 'Before you start',
    title: 'This is your day-by-day recovery guide',
    body: "What's okay today, what to leave for later, and why — based on the British Heart Foundation, NHS, and GOV.UK. Six quick cards, then you're in.",
  },
  {
    eyebrow: 'Your heart, right now',
    title: 'Pumping at about 30%, not the normal 50%+',
    body: "That number is why the pace matters more here than in a routine recovery. Everything in this app is paced around it.",
  },
  {
    eyebrow: "Don't overdo it — here's why",
    title: 'A walk asks a lot less than a lift or a dig',
    body: 'A gentle walk is about 3–4 METs of effort. Digging or heavy shoveling can be 6+ — often double, for the same few minutes. That gap is the whole reason to hold off on the farm a bit longer.',
  },
  {
    eyebrow: 'Non-negotiable',
    title: 'Never stop your medication without calling first',
    body: "You're likely on two blood thinners together for about 12 months. Stopping either one early is the single biggest risk to the stent itself — even for a dental visit, call your cardiologist first.",
  },
  {
    eyebrow: 'Driving',
    title: 'Your wait is 4 weeks, not the usual 1',
    body: "The normal rule is 1 week if your heart's pumping strength is 40% or above. Yours is 30%, so the real DVLA rule for you is the full 4 weeks — that's not extra caution, that's the actual rule.",
  },
  {
    eyebrow: 'Know this cold',
    title: "Chest pain, breathlessness, or bleeding that won't stop",
    body: "Call 999 straight away. Don't wait to see if it passes.",
  },
  {
    eyebrow: "How you'll use this",
    title: 'Check in once a day',
    body: "Tick off your morning and evening meds, glance at today's walk target, and check anything you're unsure about. That's the whole habit.",
  },
];
