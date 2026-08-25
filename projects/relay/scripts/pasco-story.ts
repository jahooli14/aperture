/**
 * The story as written in WhatsApp and then Signal, transcribed verbatim.
 *
 * Spelling, punctuation and the odd typo are left exactly as they were sent —
 * it's a record of what was written, not a tidy-up. Authorship alternates
 * strictly Dan, Ben, Dan, Ben throughout, which is how it was written.
 */
export interface SeedLine {
  author: 'dan' | 'ben'
  body: string
  chapter?: string
}

const BODIES: { body: string; chapter?: string }[] = [
  { body: "Pasco knew he was in trouble when he realised he'd never eaten a peanut before." },
  { body: 'He had always preferred skittles to M&Ms. BLTs to PBJs.' },
  { body: 'But his recent carelessness meant he was now pulling up a chair at his very own banquet of consequences.' },
  { body: "It was open buffet. All you can eat. But what if you can't? He was about to find out." },
  { body: 'Out of nowhere, a wild fox burst into the room and garrotted his faux pet echidna' },
  { body: "As the fox attacked, the stuffed critter's plastic spikes dug into its soft belly. Dazed and confused, it slunk away to the safety of the dimly lit street." },
  { body: "Seeking further refuge, he spied an open door. He'd usually stick to alleyways and garden boundaries, but the gradual shapeshifting of his thoughts into dreams meant that he needed somewhere to lay his weary head." },
  { body: "There, in the back - a disorderly pile of bin bags, full and untouched, possibly less than a day old. He couldn't believe his luck - breakfast will be a feast. Nestled amongst his pungent pillows, he surrendered to the dreams. They enveloped him." },
  { body: 'His breathing slowed. The only movement was the rhythmic rise and fall, rise and fall of his chest. Soon, that too stuck fast in time and his earthly being was left to resemble no more than a chrysalis.' },
  { body: 'An elite crack squad of bin men burst into the room. A truck\'s tank engine roars outside. "Put your paws in the air!" they scream.' },
  { body: "Our vulpine friend didn't even stir." },
  { body: 'In a flash of movement, he launched a beer bottle at one and a broken syringe at another. The binmen, weary from their early morning exertions, had no riposte. The fox melted into the thick fog of the city.' },
  { body: 'Now, all was still. The only movement was the city itself breathing in, out, in, out, swaying rhythmically to its chosen beat.' },
  { body: "the faint sound of an ambulance rang out in the distance. Its two notes floated in the air, conversing, punctuating the city's breathing." },
  { body: 'They emerged to punctuate the former sparseness of the air, intertwined like two birds courting.' },
  {
    chapter: 'Chapter 2',
    body: 'As the plant grew, its flowers blossomed. Slender stems (known as pegs) pushed down, carrying the beginnings of the peanut beneath the earth. Safely nestled underground, the peanut slowly and surely matured inside its shell.',
  },
  { body: 'All was calm - at least on the inside. Externally, though, there was change in the world.' },
  { body: "The West African peanut industry was undergoing deep, structural changes. Gone were the days of small scale subsistence farmers cultivating the nuts to meet the needs of their communities. Our peanut friend was destined for bigger, greater things - a journey through M&M's vertically integrated value chain." },
  { body: "And boy what value he could bring! From field to food, this journey was on the frontier of peanut progression. Time for him to explore his very own wonderland - let's go down the rabbit hole." },
  { body: 'Kano State, Nigeria. Once home to the famous "Groundnut Pyramids" that symbolised the region\'s agricultural might. Once picked, the arachid is driven with thousands of his fellow peanuts to the port of Lagos.' },
  { body: 'A city which conjures a patchwork of associations in ways few others can. An assault on the senses, where humanity drives sub Saharan pursuits in fashion, arts, economics... And would you believe it, peanuts.' },
  { body: 'But this peanut had no time for art or fashion. For its purpose had been dictated long ago by the powerful and visionary architects of the global confectionary trade. Along with thousands of other peanuts, in a shipping container among hundreds of other shipping containers, it was headed across the ocean. On a frosty November morning, the air brimming with opportunity, the peanut arrived in Newark, New Jersey. But his journey would not end here.' },
  { body: 'See the thing with shipping containers is they all look very much alike. So whilst this was meant to be a brief adjournment on shores of hope and glory, the overeager transit network snaffled our peanut pals and set them on their way to the Motor City.' },
  { body: 'Detroit, Detroit. Industrial grit pounds to the drum of a house baseline. Uprooted from the safety of their supply chain, the nuts were lost and helpless. But they were also free. Free from marketing and safety labels.' },
  { body: 'freedom is a wonderful asset, and in a place like Detroit it blooms like a flower in the mind. Deshackled from said safety labels, it was time for the nuts to grasp the nettle and explore.' },
  { body: 'Soon enough they found their way into some of the city\'s seediest corner shops. "Mixed nuts - unsalted - 99 cents a bag. Origin unknown". Most customers were wary of the lack of branding, but not Jimmy.' },
  { body: 'you see, Jimmy was the type of man you could sense before you saw him. He was a good bloke, fairly, but got well lary when geezers looked at him funny.' },
  { body: "Jimmy was moulded in the blasting furnaces of Motor City. His father, John P Pasco, was a steel company man - hard as nails. He met Cheryl, Jimmy's mum, in a pub in Poplar at the 1967 International Dockers Union Congress." },
  { body: 'There was a certain sense of kismet to their meeting - Cheryl was meant to be on the campaign trail that day, but her longtime friend Veronica suggested they hit the docks. Skeptical as she was, Cheryl decided why not.' },
  { body: "They chose the Grapes, an old dockers pub with a view on the Thames. Veronika's brother Igor, a freshly emigrated Russian menchevik, had just been hired there to pull pints." },
  { body: "Most people associate the Russians with vodka, but if there's one thing communism is good for it's forcing you to embrace alternative specialities. He learned his trade under the manifesto in southern Stalingrad. Then he spread the love in Limehouse." },
  { body: 'He had to have his wits about him. Ever since his father Dimitri, close confidant to top menshevik Fyodor Dan, was killed in the aftermath of the disastrous Kronstadt rebellion, the bolsheviks had been hunting him.' },
  { body: "It wasn't the Bolsheviks that worried Igor the most though - it was Jimmy's gambling addiction." },
  { body: "Sometimes lucky, mostly not. Change was getting short, IOUs quickly becoming you owe me's." },
  { body: "They in turn became favours to pay back, and then favours which couldn't be paid back. Luckily for Jimmy, Igor was a pro." },
  { body: '"How many times do I have to save this lad\'s bacon before he changes his ways?" Igor asked his sister, exasperated. "I swear to God ill send him to the Gulag if he keeps this up. Straighten the boy up".' },
  { body: '"Igor, don\'t forget your roots." shot back Veronika. "You could\'ve spent your life in a Gulag if it wasnt for Rod Stewart stepping in when he did. I\'ve always wondered why he\'s one of the few Western men to have true influence in the Eastern bloc."' },
  { body: '1971, Moscow. Roderick was back in the USSR, riding a Maggie shaped wave.' },
  { body: "who'd have thought that the depths of the communist monotony would be punctuated by the song of a showgirl? Only a man with forenames for days it turns out." },
  { body: 'Igor was in a Saint Pete cell, awaiting his sentence for smuggling free world contraband. After sharing a few sigareties with the guard, he learned that the his daughter was a big Rod fan.' },
  { body: 'Not wanting to come across as sleazy, he danced around the subject to gather a little more intel. First Roxy Music, then Chris Rea - the young lady loved them all it turned out. With her father confirming absolute infatuation with Hot Rod himself, the makings of a plan began to take shape - this was his chance to get back out to where he belonged on icy russian streets.' },
  { body: 'All it took was a promise. "I\'m very close to Mister Steward\'s local agent, Vladimir Petrovich. Friends call him Vlad. I\'m sure he can bag us a couple seats at the opera house next week, if you\'d like that".' },
  { body: '"Save your favours for my daughter - she\'s wanted to see Rod her whole life. If you can guarantee it, I\'ll get you out of here. If you don\'t, I\'ll see to it that only half of your limbs do."' },
  { body: "Three weeks later they were playing Durak in Igor's basement, betting fool's gold until the early hours. Suppose the apple fell close to the tree after all." },
  {
    chapter: 'III: When in Rome',
    body: 'The emperor had been growing bored with the monotony or running an empire, and had recently started to pass the time whiling away the day by carving fruits into increasingly curious shapes.',
  },
  { body: 'It all went pear shaped when he cut himself sculpting a large fig into a small crown. Stained with his blood, it will ripen, and inevitably rot.' },
  { body: 'not that it matters - nearly everything is temporary when you stretch the timescale out long enough. Even empires. But not his.' },
  { body: "The emperor had it all - wealth, fame, territory, power, fresh fruit. For all this, one thing evaded him still - Livia's heart." },
  { body: "Her heart had always been free as the wind, that was the beauty of her. Just when you thought you'd figured her out, she'd surprise you. There are few good surprises when you're an emperor. So that made them even more special when they did come along on days like today." },
  { body: "Livia courted Rome's most powerful men. But though her heart was divided, it would not be conquered. So when her father, a great tactician of the 15th Legion died on the Nabatean front, the air was ripe with opportunity." },
  { body: 'An opportunity to find Graceland' },
  { body: 'The emperor was following the roman road, through the cradle of his own civil war.' },
  { body: 'For Livia, opportunity meant not riches nor power, but something much more meaningful - freedom.' },
  { body: "After her father's death, Livia vanished. Some of Emperor's spies reported seeing her drinking wine in Tolosa, others buying cattle in Sardinia." },
  { body: 'funny how times change. These days, you want real cattle ranchers and you need to go to the depths of the Outback. That\'s where you would meet a man like Cliff.' },
  { body: 'Cliff claimed to care for all his animals equally, but one cow held a special place in his heart.' },
  { body: 'She owned those plains, and had been with him for 10 years, longer than the life of many bovine brethren. In truth, that vaste experience had taught her only one thing:' },
  { body: "There's no such thing as free milk." },
  { body: "Cliff utilised this hard nosed approach to motivate the rest of the herd. And would you believe it, like stars intertwined in the night sky, this brought his and Livia's paths into orbit." },
  { body: 'As a young calf, Livia was unremarkable. She liked to graze on the wild grasses and shrubs, and socialised well with the rest of the herd.' },
  { body: 'she had inherited not just her name from the emperors daughter, but many of her tendencies too. That being said, veganism was more of a modern thing' },
  { body: 'Livia had the talent to be in the right place at the right time. Cliff never forgot how she saved his life once.' },
  { body: "this was in the depths of Aussie winter when the sun plays a far more minor role than you'd expect. The threat? A cattle rustler looking for some business. Livia's answer? Not today, matey" },
  { body: "After a potentially lucrative business deal turned sour, the rustler got desperate. He torched Cliff's house in the depths of the night, hoping to take over his ranch." },
]

// Dan opened it, and it has alternated ever since.
export const PASCO_STORY: SeedLine[] = BODIES.map((line, index) => ({
  ...line,
  author: index % 2 === 0 ? 'dan' : 'ben',
}))

export const PASCO_TITLE = 'Pasco'
export const PASCO_BLURB = 'A line each, no plan. Started in WhatsApp, moved to Signal, now here.'
