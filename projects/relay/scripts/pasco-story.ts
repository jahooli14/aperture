/**
 * The story as written, transcribed from the original threads.
 *
 * Spelling, punctuation and the odd typo are left exactly as they were sent —
 * it's a record of what was written, not a tidy-up. `sentAt` is the real
 * timestamp each line was written, taken from the WhatsApp export (lines
 * 1-27) and the Signal screenshots (28-64). One deliberate correction: line 7's text
 * was retyped by Ben at Dan's request to fix a typo Dan couldn't edit
 * ("Your move still, edits don't count") — the timestamp and author here are
 * Dan's original 15:45 send, not Ben's 21:24 retype.
 *
 * Authorship alternates strictly Dan, Ben, Dan, Ben throughout, which is how
 * it was written — confirmed against all 64 real timestamps without a single
 * exception.
 */
export interface SeedLine {
  author: 'dan' | 'ben'
  body: string
  chapter?: string
  /** ISO 8601, with the real UTC offset for the date (BST or GMT). */
  sentAt: string
}

interface RawLine {
  body: string
  chapter?: string
  sentAt: string
}

const BODIES: RawLine[] = [
  { body: "Pasco knew he was in trouble when he realised he'd never eaten a peanut before.", sentAt: '2025-08-25T10:29:00+01:00' },
  { body: 'He had always preferred skittles to M&Ms. BLTs to PBJs.', sentAt: '2025-08-25T22:12:00+01:00' },
  { body: 'But his recent carelessness meant he was now pulling up a chair at his very own banquet of consequences.', sentAt: '2025-08-26T22:25:00+01:00' },
  { body: "It was open buffet. All you can eat. But what if you can't? He was about to find out.", sentAt: '2025-08-29T18:45:00+01:00' },
  { body: 'Out of nowhere, a wild fox burst into the room and garrotted his faux pet echidna', sentAt: '2025-08-29T20:34:00+01:00' },
  { body: "As the fox attacked, the stuffed critter's plastic spikes dug into its soft belly. Dazed and confused, it slunk away to the safety of the dimly lit street.", sentAt: '2025-09-06T10:45:00+01:00' },
  { body: "Seeking further refuge, he spied an open door. He'd usually stick to alleyways and garden boundaries, but the gradual shapeshifting of his thoughts into dreams meant that he needed somewhere to lay his weary head.", sentAt: '2025-09-08T15:45:00+01:00' },
  { body: "There, in the back - a disorderly pile of bin bags, full and untouched, possibly less than a day old. He couldn't believe his luck - breakfast will be a feast. Nestled amongst his pungent pillows, he surrendered to the dreams. They enveloped him.", sentAt: '2025-09-12T14:42:00+01:00' },
  { body: 'His breathing slowed. The only movement was the rhythmic rise and fall, rise and fall of his chest. Soon, that too stuck fast in time and his earthly being was left to resemble no more than a chrysalis.', sentAt: '2025-09-12T19:25:00+01:00' },
  { body: 'An elite crack squad of bin men burst into the room. A truck\'s tank engine roars outside. "Put your paws in the air!" they scream.', sentAt: '2025-09-13T13:00:00+01:00' },
  { body: "Our vulpine friend didn't even stir.", sentAt: '2025-09-14T15:35:00+01:00' },
  { body: 'In a flash of movement, he launched a beer bottle at one and a broken syringe at another. The binmen, weary from their early morning exertions, had no riposte. The fox melted into the thick fog of the city.', sentAt: '2025-09-21T10:19:00+01:00' },
  { body: 'Now, all was still. The only movement was the city itself breathing in, out, in, out, swaying rhythmically to its chosen beat.', sentAt: '2025-09-24T11:53:00+01:00' },
  { body: "the faint sound of an ambulance rang out in the distance. Its two notes floated in the air, conversing, punctuating the city's breathing.", sentAt: '2025-09-30T21:15:00+01:00' },
  { body: 'They emerged to punctuate the former sparseness of the air, intertwined like two birds courting.', sentAt: '2025-10-01T09:40:00+01:00' },
  { chapter: 'Chapter 2', body: 'As the plant grew, its flowers blossomed. Slender stems (known as pegs) pushed down, carrying the beginnings of the peanut beneath the earth. Safely nestled underground, the peanut slowly and surely matured inside its shell.', sentAt: '2025-10-02T17:13:00+01:00' },
  { body: 'All was calm - at least on the inside. Externally, though, there was change in the world.', sentAt: '2025-10-06T10:15:00+01:00' },
  { body: "The West African peanut industry was undergoing deep, structural changes. Gone were the days of small scale subsistence farmers cultivating the nuts to meet the needs of their communities. Our peanut friend was destined for bigger, greater things - a journey through M&M's vertically integrated value chain.", sentAt: '2025-10-08T10:04:00+01:00' },
  { body: "And boy what value he could bring! From field to food, this journey was on the frontier of peanut progression. Time for him to explore his very own wonderland - let's go down the rabbit hole.", sentAt: '2025-10-12T10:48:00+01:00' },
  { body: 'Kano State, Nigeria. Once home to the famous "Groundnut Pyramids" that symbolised the region\'s agricultural might. Once picked, the arachid is driven with thousands of his fellow peanuts to the port of Lagos.', sentAt: '2025-10-30T18:58:00+00:00' },
  { body: 'A city which conjures a patchwork of associations in ways few others can. An assault on the senses, where humanity drives sub Saharan pursuits in fashion, arts, economics... And would you believe it, peanuts.', sentAt: '2025-11-01T13:24:00+00:00' },
  { body: 'But this peanut had no time for art or fashion. For its purpose had been dictated long ago by the powerful and visionary architects of the global confectionary trade. Along with thousands of other peanuts, in a shipping container among hundreds of other shipping containers, it was headed across the ocean. On a frosty November morning, the air brimming with opportunity, the peanut arrived in Newark, New Jersey. But his journey would not end here.', sentAt: '2025-11-05T12:21:00+00:00' },
  { body: 'See the thing with shipping containers is they all look very much alike. So whilst this was meant to be a brief adjournment on shores of hope and glory, the overeager transit network snaffled our peanut pals and set them on their way to the Motor City.', sentAt: '2025-11-10T12:19:00+00:00' },
  { body: 'Detroit, Detroit. Industrial grit pounds to the drum of a house baseline. Uprooted from the safety of their supply chain, the nuts were lost and helpless. But they were also free. Free from marketing and safety labels.', sentAt: '2025-11-21T16:43:00+00:00' },
  { body: 'freedom is a wonderful asset, and in a place like Detroit it blooms like a flower in the mind. Deshackled from said safety labels, it was time for the nuts to grasp the nettle and explore.', sentAt: '2025-11-21T19:14:00+00:00' },
  { body: 'Soon enough they found their way into some of the city\'s seediest corner shops. "Mixed nuts - unsalted - 99 cents a bag. Origin unknown". Most customers were wary of the lack of branding, but not Jimmy.', sentAt: '2025-11-22T10:45:00+00:00' },
  { body: 'you see, Jimmy was the type of man you could sense before you saw him. He was a good bloke, fairly, but got well lary when geezers looked at him funny.', sentAt: '2025-11-29T12:28:00+00:00' },
  { body: "Jimmy was moulded in the blasting furnaces of Motor City. His father, John P Pasco, was a steel company man - hard as nails. He met Cheryl, Jimmy's mum, in a pub in Poplar at the 1967 International Dockers Union Congress.", sentAt: '2025-12-05T07:11:00+00:00' },
  { body: 'There was a certain sense of kismet to their meeting - Cheryl was meant to be on the campaign trail that day, but her longtime friend Veronica suggested they hit the docks. Skeptical as she was, Cheryl decided why not.', sentAt: '2025-12-06T22:15:00+00:00' },
  { body: "They chose the Grapes, an old dockers pub with a view on the Thames. Veronika's brother Igor, a freshly emigrated Russian menchevik, had just been hired there to pull pints.", sentAt: '2025-12-07T21:25:00+00:00' },
  { body: "Most people associate the Russians with vodka, but if there's one thing communism is good for it's forcing you to embrace alternative specialities. He learned his trade under the manifesto in southern Stalingrad. Then he spread the love in Limehouse.", sentAt: '2025-12-07T22:41:00+00:00' },
  { body: 'He had to have his wits about him. Ever since his father Dimitri, close confidant to top menshevik Fyodor Dan, was killed in the aftermath of the disastrous Kronstadt rebellion, the bolsheviks had been hunting him.', sentAt: '2025-12-08T09:19:00+00:00' },
  { body: "It wasn't the Bolsheviks that worried Igor the most though - it was Jimmy's gambling addiction.", sentAt: '2025-12-08T18:57:00+00:00' },
  { body: "Sometimes lucky, mostly not. Change was getting short, IOUs quickly becoming you owe me's.", sentAt: '2025-12-13T12:44:00+00:00' },
  { body: "They in turn became favours to pay back, and then favours which couldn't be paid back. Luckily for Jimmy, Igor was a pro.", sentAt: '2025-12-13T13:36:00+00:00' },
  { body: '"How many times do I have to save this lad\'s bacon before he changes his ways?" Igor asked his sister, exasperated. "I swear to God ill send him to the Gulag if he keeps this up. Straighten the boy up".', sentAt: '2025-12-17T17:35:00+00:00' },
  { body: '"Igor, don\'t forget your roots." shot back Veronika. "You could\'ve spent your life in a Gulag if it wasnt for Rod Stewart stepping in when he did. I\'ve always wondered why he\'s one of the few Western men to have true influence in the Eastern bloc."', sentAt: '2025-12-17T17:41:00+00:00' },
  { body: '1971, Moscow. Roderick was back in the USSR, riding a Maggie shaped wave.', sentAt: '2025-12-18T18:27:00+00:00' },
  { body: "who'd have thought that the depths of the communist monotony would be punctuated by the song of a showgirl? Only a man with forenames for days it turns out.", sentAt: '2025-12-18T21:47:00+00:00' },
  { body: 'Igor was in a Saint Pete cell, awaiting his sentence for smuggling free world contraband. After sharing a few sigareties with the guard, he learned that the his daughter was a big Rod fan.', sentAt: '2025-12-27T10:38:00+00:00' },
  { body: 'Not wanting to come across as sleazy, he danced around the subject to gather a little more intel. First Roxy Music, then Chris Rea - the young lady loved them all it turned out. With her father confirming absolute infatuation with Hot Rod himself, the makings of a plan began to take shape - this was his chance to get back out to where he belonged on icy russian streets.', sentAt: '2025-12-27T20:49:00+00:00' },
  { body: 'All it took was a promise. "I\'m very close to Mister Steward\'s local agent, Vladimir Petrovich. Friends call him Vlad. I\'m sure he can bag us a couple seats at the opera house next week, if you\'d like that".', sentAt: '2025-12-28T13:10:00+00:00' },
  { body: '"Save your favours for my daughter - she\'s wanted to see Rod her whole life. If you can guarantee it, I\'ll get you out of here. If you don\'t, I\'ll see to it that only half of your limbs do."', sentAt: '2025-12-29T15:50:00+00:00' },
  { body: "Three weeks later they were playing Durak in Igor's basement, betting fool's gold until the early hours. Suppose the apple fell close to the tree after all.", sentAt: '2026-01-05T20:38:00+00:00' },
  { chapter: 'III: When in Rome', body: 'The emperor had been growing bored with the monotony or running an empire, and had recently started to pass the time whiling away the day by carving fruits into increasingly curious shapes.', sentAt: '2026-01-06T15:50:00+00:00' },
  { body: 'It all went pear shaped when he cut himself sculpting a large fig into a small crown. Stained with his blood, it will ripen, and inevitably rot.', sentAt: '2026-01-07T13:17:00+00:00' },
  { body: 'not that it matters - nearly everything is temporary when you stretch the timescale out long enough. Even empires. But not his.', sentAt: '2026-01-08T20:40:00+00:00' },
  { body: "The emperor had it all - wealth, fame, territory, power, fresh fruit. For all this, one thing evaded him still - Livia's heart.", sentAt: '2026-01-09T16:26:00+00:00' },
  { body: "Her heart had always been free as the wind, that was the beauty of her. Just when you thought you'd figured her out, she'd surprise you. There are few good surprises when you're an emperor. So that made them even more special when they did come along on days like today.", sentAt: '2026-01-17T11:46:00+00:00' },
  { body: "Livia courted Rome's most powerful men. But though her heart was divided, it would not be conquered. So when her father, a great tactician of the 15th Legion died on the Nabatean front, the air was ripe with opportunity.", sentAt: '2026-01-26T10:38:00+00:00' },
  { body: 'An opportunity to find Graceland', sentAt: '2026-01-31T11:12:00+00:00' },
  { body: 'The emperor was following the roman road, through the cradle of his own civil war.', sentAt: '2026-02-11T17:02:00+00:00' },
  { body: 'For Livia, opportunity meant not riches nor power, but something much more meaningful - freedom.', sentAt: '2026-03-10T08:39:00+00:00' },
  { body: "After her father's death, Livia vanished. Some of Emperor's spies reported seeing her drinking wine in Tolosa, others buying cattle in Sardinia.", sentAt: '2026-08-06T07:20:00+01:00' },
  { body: "funny how times change. These days, you want real cattle ranchers and you need to go to the depths of the Outback. That's where you would meet a man like Cliff.", sentAt: '2026-08-06T08:09:00+01:00' },
  { body: 'Cliff claimed to care for all his animals equally, but one cow held a special place in his heart.', sentAt: '2026-08-07T08:01:00+01:00' },
  { body: 'She owned those plains, and had been with him for 10 years, longer than the life of many bovine brethren. In truth, that vaste experience had taught her only one thing:', sentAt: '2026-08-07T12:28:00+01:00' },
  { body: "There's no such thing as free milk.", sentAt: '2026-08-07T13:51:00+01:00' },
  { body: "Cliff utilised this hard nosed approach to motivate the rest of the herd. And would you believe it, like stars intertwined in the night sky, this brought his and Livia's paths into orbit.", sentAt: '2026-08-10T20:34:00+01:00' },
  { body: 'As a young calf, Livia was unremarkable. She liked to graze on the wild grasses and shrubs, and socialised well with the rest of the herd.', sentAt: '2026-08-11T20:31:00+01:00' },
  { body: 'she had inherited not just her name from the emperors daughter, but many of her tendencies too. That being said, veganism was more of a modern thing', sentAt: '2026-08-14T11:47:00+01:00' },
  { body: 'Livia had the talent to be in the right place at the right time. Cliff never forgot how she saved his life once.', sentAt: '2026-08-15T18:56:00+01:00' },
  { body: "this was in the depths of Aussie winter when the sun plays a far more minor role than you'd expect. The threat? A cattle rustler looking for some business. Livia's answer? Not today, matey", sentAt: '2026-08-15T19:13:00+01:00' },
  { body: "After a potentially lucrative business deal turned sour, the rustler got desperate. He torched Cliff's house in the depths of the night, hoping to take over his ranch.", sentAt: '2026-08-19T15:03:00+01:00' },
]

// Dan opened it, and it has alternated ever since.
export const PASCO_STORY: SeedLine[] = BODIES.map((line, index) => ({
  ...line,
  author: index % 2 === 0 ? 'dan' : 'ben',
}))

export const PASCO_TITLE = 'Pasco'
export const PASCO_BLURB = 'A line each, no plan. Started in WhatsApp, moved to Signal, now here.'
