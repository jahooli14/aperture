export type ActivityStatus = 'go' | 'not-yet' | 'ask-first';

export interface ActivityGuidance {
  activity: string;
  status: ActivityStatus;
  detail: string;
  why?: string;
  action?: { label: string; href: string };
}

export interface FarmGuidance {
  headline: string;
  ifTempted: string;
  canDoInstead: string[];
  askYourTeam?: string[];
}

export interface RecoveryPhase {
  id: string;
  dayRange: { start: number; end: number | null };
  weekLabel: string;
  title: string;
  encouragement: string;
  activities: ActivityGuidance[];
  why?: string;
  milestone?: string;
  farm: FarmGuidance;
}

const CALL_TEAM_ACTION = {
  label: 'Call the BHF heart helpline',
  href: 'tel:08088021234',
};

export const RECOVERY_PHASES: RecoveryPhase[] = [
  {
    id: 'week-0-1',
    dayRange: { start: 1, end: 7 },
    weekLabel: 'Week 0–1',
    title: 'Just home',
    encouragement: "You're a week in. The main job right now is rest and short walks — that's not slacking, that's the plan working.",
    why: 'Both the heart muscle and the puncture site are still healing. Pacing now protects everything you build after this.',
    milestone: 'Cardiac rehab usually makes first contact around the end of this week.',
    activities: [
      { activity: 'Driving', status: 'not-yet', detail: 'No driving at all yet — this comes later, and only once your doctor confirms it.', why: 'Your heart and the puncture site both need this first week to settle before you’re behind the wheel.' },
      { activity: 'Farm / manual work', status: 'not-yet', detail: 'Nothing beyond a short walk around the yard.', why: 'Manual work asks a lot more of your heart than a walk does — even a short burst of heavy effort is more strain than it’s ready for yet.' },
      { activity: 'Lifting', status: 'not-yet', detail: 'Avoid lifting anything heavier than a full kettle.', why: 'A sudden strain from lifting pushes your blood pressure up fast — not what a healing heart needs right now.' },
      { activity: 'Walking / exercise', status: 'go', detail: 'Short walks around the house or garden are good — build up gradually.' },
      { activity: 'Return to work', status: 'not-yet', detail: 'Too soon either way — revisit this in a couple of weeks.', why: 'Even a desk job means travel, sitting up, concentrating — all real load this early on.' },
      { activity: 'Alcohol', status: 'ask-first', detail: 'Check with your care team before any alcohol while medication doses are still settling.', why: 'Alcohol interacts with several heart medications, and your doses are still being finalised.', action: CALL_TEAM_ACTION },
      { activity: 'Diet & salt', status: 'go', detail: 'Eat well, go easy on salt — helps your heart do less work while it heals.' },
    ],
    farm: {
      headline: "You're probably already eyeing the yard from the window. Fair enough — but not yet.",
      ifTempted: "If you're itching to get out there, make a list instead — what needs doing, in what order. That list is real progress, and you'll use it later.",
      canDoInstead: ['Make a list of what needs fixing or doing around the farm', 'Watch from the porch, not the fence line — yet'],
    },
  },
  {
    id: 'week-1-2',
    dayRange: { start: 8, end: 14 },
    weekLabel: 'Week 1–2',
    title: 'Building the habit of moving',
    encouragement: "Second week — walks a bit longer each day is exactly the right shape of progress.",
    why: 'The puncture site is close to healed, but the heart itself is still the priority — steady, gradual load beats a big push.',
    milestone: 'Cardiac rehab contact usually starts properly in this window.',
    activities: [
      { activity: 'Driving', status: 'not-yet', detail: 'Still not yet — the usual wait after a heart attack like this is around 4 weeks.', why: 'The 4-week guideline gives your heart’s recovery and the driving decision time to get made together, not guessed at early.' },
      { activity: 'Farm / manual work', status: 'not-yet', detail: 'Still off the table — same reasoning as driving.', why: 'Manual work is a bigger, more sustained load on your heart than anything you’re cleared for yet.' },
      { activity: 'Lifting', status: 'not-yet', detail: 'Light household items only, nothing that makes you strain.', why: 'The puncture site and your medication levels are still settling — heavy lifting is one of the more strain-heavy things you could do to either.' },
      { activity: 'Walking / exercise', status: 'go', detail: 'Slightly longer, slightly more often — let it feel easy, not a workout.' },
      { activity: 'Return to work', status: 'ask-first', detail: 'Light desk work might be possible with your doctor’s sign-off — ask.', why: 'It depends entirely on your specific job and how your doctor reads your progress so far.', action: CALL_TEAM_ACTION },
      { activity: 'Alcohol', status: 'ask-first', detail: 'Still worth checking with your care team first.', why: 'Your medications may still be settling, so it’s worth a quick check rather than assuming.', action: CALL_TEAM_ACTION },
      { activity: 'Diet & salt', status: 'go', detail: 'Keep it up — this one matters for the long run, not just recovery.' },
    ],
    farm: {
      headline: 'Still holding the line on the farm — you’re doing the right thing.',
      ifTempted: 'If you’re tempted to do "just one small job," swap it for a slow walk of the fence line instead — looking, not lifting.',
      canDoInstead: ['Walk the fence line and note what needs doing (no tools)', 'Plan the season’s jobs in order of priority', 'Point someone else at anything urgent'],
    },
  },
  {
    id: 'week-2-4',
    dayRange: { start: 15, end: 28 },
    weekLabel: 'Week 2–4',
    title: 'Steady progress',
    encouragement: "You're most of the way to the 4-week mark now — this is where most people start feeling like themselves again.",
    why: 'The standard wait after a heart attack like this is about 4 weeks, mainly so your heart’s recovery and any driving/exertion decisions are made with proper information, not guesswork.',
    milestone: 'Driving clearance and cardiac rehab follow-up both typically land around the end of this window.',
    activities: [
      { activity: 'Driving', status: 'ask-first', detail: 'Getting close — this is your doctor’s call to make, not a date on a calendar.', why: 'You’re close to the usual 4-week mark, but the actual go-ahead depends on how you’re doing, not the calendar alone.', action: CALL_TEAM_ACTION },
      { activity: 'Farm / manual work', status: 'not-yet', detail: 'Not yet, even though driving is close — manual work is a different, higher load on the heart.', why: 'Clearing driving doesn’t clear manual work — they put very different demands on your heart.' },
      { activity: 'Lifting', status: 'not-yet', detail: 'Still light only — save the heavier stuff for once you’re properly cleared.', why: 'Same reasoning throughout recovery — heavy lifting is a sudden strain you’re not fully cleared for yet.' },
      { activity: 'Walking / exercise', status: 'go', detail: 'Longer, more frequent walks — this is genuinely building your capacity back up.' },
      { activity: 'Return to work', status: 'ask-first', detail: 'Depends on the job — ask your care team specifically about yours.', why: 'Desk work and physical work put very different demands on you, so this one’s genuinely job-specific.', action: CALL_TEAM_ACTION },
      { activity: 'Alcohol', status: 'ask-first', detail: 'Check current guidance with your care team — depends on your medications.', why: 'Depends on your current medications, so it’s worth a quick confirm rather than assuming.', action: CALL_TEAM_ACTION },
      { activity: 'Diet & salt', status: 'go', detail: 'Still the quiet workhorse of recovery — keep it up.' },
    ],
    farm: {
      headline: 'This is often the hardest stretch — driving’s nearly back, so the farm feels close too. It isn’t, quite yet.',
      ifTempted: 'If you’re tempted to grab a tool "just for five minutes," do the fence-line walk instead and add to your list.',
      canDoInstead: ['Walk the fence line and keep building the job list', 'Plan out the season’s work in detail', 'Direct someone else for anything that can’t wait'],
    },
  },
  {
    id: 'week-4-8',
    dayRange: { start: 29, end: 56 },
    weekLabel: 'Week 4–8',
    title: 'Cleared for the everyday, not the heavy stuff yet',
    encouragement: "This is roughly where you are right now — cleared for a lot of normal life, with the heaviest work still to come.",
    why: 'Driving comes back once your doctor confirms it. Manual farm work is a bigger, more sustained load on the heart than driving, so it sits on its own, later timeline.',
    milestone: 'Cardiac rehab follow-up typically happens in this window.',
    activities: [
      { activity: 'Driving', status: 'go', detail: 'Cleared once your doctor has confirmed it — many people get the go-ahead right in this window.' },
      { activity: 'Farm / manual work', status: 'not-yet', detail: 'Still not yet — this needs its own clearance, separate from driving.', why: 'Manual work needs its own clearance because it’s a bigger, more sustained load on your heart than getting behind the wheel.' },
      { activity: 'Lifting', status: 'ask-first', detail: 'Ask specifically about weight limits at your next rehab appointment.', why: 'Limits usually start easing around now, but your rehab team needs to confirm what’s safe for you specifically.', action: CALL_TEAM_ACTION },
      { activity: 'Walking / exercise', status: 'go', detail: 'Keep building — cardiac rehab will start structuring this properly.' },
      { activity: 'Return to work', status: 'ask-first', detail: 'Ask your team about your specific job — desk work and physical work differ a lot here.', why: 'Desk work and physical work differ a lot here, so ask about your specific job rather than work in general.', action: CALL_TEAM_ACTION },
      { activity: 'Alcohol', status: 'ask-first', detail: 'Confirm with your team, especially if your medications have changed.', why: 'Worth confirming again if your medications have changed since your last check-in.', action: CALL_TEAM_ACTION },
      { activity: 'Diet & salt', status: 'go', detail: 'This is now just how you eat, not a temporary recovery measure.' },
    ],
    farm: {
      headline: "You're probably itching to get back to the farm about now. Not yet — here's exactly what to leave for a few more weeks, and why.",
      ifTempted: "If you're tempted to grab the post driver, do the fence-line walk instead — you'll know exactly what needs doing when you're properly cleared.",
      canDoInstead: ['Walk the fence line and note repairs needed', 'Plan the season’s work in detail', 'Direct someone else for anything heavy'],
      askYourTeam: [
        'Ask specifically about weight limits for lifting',
        'Ask how long you can be out working before you should stop and rest',
        'Ask whether heat or exertion limits apply to outdoor work',
      ],
    },
  },
  {
    id: 'week-8-12',
    dayRange: { start: 57, end: 84 },
    weekLabel: 'Week 8–12',
    title: 'Rebuilding strength',
    encouragement: "You're building real capacity back now, under supervision — this is the phase that gets you to the farm properly.",
    why: 'Cardiac rehab builds tolerance gradually and safely, which is exactly what gets you back to heavier work sooner rather than later.',
    milestone: 'A supervised exercise test near the end of rehab usually decides readiness for heavier work.',
    activities: [
      { activity: 'Driving', status: 'go', detail: 'Should be settled by now.' },
      { activity: 'Farm / manual work', status: 'ask-first', detail: 'Light, short farm tasks may start being discussed with your rehab team — ask specifically.', why: 'Light, short tasks might be realistic now, but your rehab team is best placed to say which ones and for how long.', action: CALL_TEAM_ACTION },
      { activity: 'Lifting', status: 'ask-first', detail: 'Limits usually ease here, but confirm before anything heavy.', why: 'Limits usually ease in this window, but confirm before anything genuinely heavy.', action: CALL_TEAM_ACTION },
      { activity: 'Walking / exercise', status: 'go', detail: 'Rehab-supervised exercise should be building real capacity now.' },
      { activity: 'Return to work', status: 'go', detail: 'Most people are back to their normal work pattern by now, with clearance.' },
      { activity: 'Alcohol', status: 'ask-first', detail: 'Confirm current limits with your team.', why: 'Limits can shift as your medications change — quick to confirm, easy to get wrong by guessing.', action: CALL_TEAM_ACTION },
      { activity: 'Diet & salt', status: 'go', detail: 'Long-term habit now.' },
    ],
    farm: {
      headline: 'This is the phase where "ask your team" starts turning into real answers.',
      ifTempted: 'Bring your list to the rehab appointment and ask about it item by item — that turns a vague "not yet" into a real plan.',
      canDoInstead: ['Start with the lightest jobs on your list once your team gives the go-ahead', 'Keep directing the heavier jobs to someone else a little longer'],
      askYourTeam: [
        'Ask specifically about weight limits for lifting',
        'Ask how long you can be out working before you should stop and rest',
        'Ask whether heat or exertion limits apply to outdoor work',
      ],
    },
  },
  {
    id: '12-weeks-plus',
    dayRange: { start: 85, end: null },
    weekLabel: '12 weeks+',
    title: 'Back to it, on your terms',
    encouragement: "You've done the patient part. Most normal activity is realistic from here, with your team's clearance.",
    why: 'Farm and manual work becomes realistic for a lot of people around here — but with your heart function, your team decides this one, not a calendar.',
    activities: [
      { activity: 'Driving', status: 'go', detail: 'Normal.' },
      { activity: 'Farm / manual work', status: 'ask-first', detail: 'Realistic for many people by now — get your team’s specific sign-off before going back to full manual work.', why: 'Realistic for a lot of people by now — but with your heart function specifically, this needs your team’s direct sign-off rather than a general rule.', action: CALL_TEAM_ACTION },
      { activity: 'Lifting', status: 'ask-first', detail: 'Confirm your limits directly with your rehab team.', why: 'Your rehab team can confirm real limits based on how your heart’s actually performing, not a generic guideline.', action: CALL_TEAM_ACTION },
      { activity: 'Walking / exercise', status: 'go', detail: 'Keep going — rehab if you’re enrolled, otherwise your own routine.' },
      { activity: 'Return to work', status: 'go', detail: 'Normal, if not already back.' },
      { activity: 'Alcohol', status: 'ask-first', detail: 'Confirm current limits with your team, since they can change with medication.', why: 'Limits can still shift with medication changes, so it’s worth confirming rather than assuming it’s fully open-ended.', action: CALL_TEAM_ACTION },
      { activity: 'Diet & salt', status: 'go', detail: 'This is the steady state now — daily weight checks and taking every medication as prescribed matter just as much as the exercise.' },
    ],
    farm: {
      headline: 'Your team decides this one, not a calendar — but you’re close.',
      ifTempted: 'Take your specific questions to the appointment rather than guessing at home.',
      canDoInstead: ['Ease back in gradually once cleared — start with the lightest jobs on your list', 'Keep the weight/heat questions in mind even after clearance'],
      askYourTeam: [
        'Ask specifically about weight limits for lifting',
        'Ask how long you can be out working before you should stop and rest',
        'Ask whether heat or exertion limits apply to outdoor work',
      ],
    },
  },
];

export function getPhaseForDay(day: number): RecoveryPhase | null {
  return (
    RECOVERY_PHASES.find(
      (p) => day >= p.dayRange.start && (p.dayRange.end === null || day <= p.dayRange.end),
    ) ?? null
  );
}

export interface NextMilestone {
  daysUntil: number;
  weekLabel: string;
  title: string;
}

/**
 * How many days until the next phase starts, so the app can show a live,
 * day-by-day countdown even though the underlying content only changes at
 * phase boundaries. Returns null once in the final, open-ended phase.
 */
export function getNextMilestone(day: number, phases: RecoveryPhase[]): NextMilestone | null {
  const currentIndex = phases.findIndex(
    (p) => day >= p.dayRange.start && (p.dayRange.end === null || day <= p.dayRange.end),
  );
  if (currentIndex === -1) return null;

  const current = phases[currentIndex];
  const next = phases[currentIndex + 1];
  if (current.dayRange.end === null || !next) return null;

  return { daysUntil: next.dayRange.start - day, weekLabel: next.weekLabel, title: next.title };
}

export const EMERGENCY_SIGNS_999: string[] = [
  'Severe chest pain, pressure, or tightness — or pain spreading to your arm, jaw, or back',
  'Severe breathlessness, gasping, choking, or being unable to get your words out',
  'Lips turning blue',
  'Sweating or feeling clammy along with chest discomfort',
  'Nausea or vomiting along with chest discomfort',
  'Sudden severe dizziness or fainting',
  'Bleeding at the puncture site that won’t stop',
  'Sudden weakness, numbness, or trouble speaking',
];

export const CONTACT_CARE_TEAM_SIGNS: string[] = [
  'Redness, warmth, or mild swelling at the puncture site, without severe bleeding',
  'A low-grade fever',
  'Steady weight gain over a few days',
  'Increasing swelling in your ankles or legs',
  'New or worse breathlessness when lying flat',
  'Feeling low or frustrated that isn’t lifting — common after a heart attack, worth mentioning',
];

export const MEDICATION_NOTES = {
  dapt:
    "You're likely on two blood-thinning medications together (aspirin plus a second one, often clopidogrel or ticagrelor) for about 12 months after this stent. Don't stop either one — even for a dental appointment or minor procedure — without calling your cardiologist first. Stopping early is the single biggest risk to the stent itself.",
  fourPillars:
    "Heart failure medication after a heart attack like this is usually four different pills working together, not just one — each one matters even if it doesn't feel “for the heart” specifically. Take all of them exactly as prescribed.",
  nsaidCaution:
    'Avoid ibuprofen and similar painkillers for aches from getting back into activity — they can work against a recovering heart. Paracetamol is the usual safe choice; check with your care team if you need something stronger.',
};

export const SOURCES: { title: string; url: string }[] = [
  { title: 'British Heart Foundation — Coronary angioplasty and stents', url: 'https://www.bhf.org.uk/informationsupport/treatments/coronary-angioplasty-and-stents' },
  { title: 'British Heart Foundation — Heart failure', url: 'https://www.bhf.org.uk/informationsupport/conditions/heart-failure' },
  { title: 'NHS — Coronary angioplasty recovery', url: 'https://www.nhs.uk/tests-and-treatments/coronary-angioplasty/recovery/' },
  { title: 'GOV.UK — Heart attacks, angioplasty and driving', url: 'https://www.gov.uk/heart-attacks-and-driving' },
  { title: 'GOV.UK — Cardiovascular disorders: assessing fitness to drive', url: 'https://www.gov.uk/guidance/cardiovascular-disorders-assessing-fitness-to-drive' },
];

export const BHF_HELPLINE = '0808 802 1234';

export const GENERAL_DISCLAIMER =
  "This is general recovery information for people who've had a stent, adapted from the British Heart Foundation, NHS, and GOV.UK — not advice about you specifically. Always follow what your own cardiologist and cardiac rehab team tell you. If in doubt, call your care team, the BHF nurse helpline, or 999.";
