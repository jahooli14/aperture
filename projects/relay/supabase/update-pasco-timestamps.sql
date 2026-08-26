-- Corrects an already-seeded Pasco story's timestamps to the real ones.
--
-- Only needed if the story was seeded before every line had a real sentAt —
-- that seed spread the lines evenly across a guessed date range. This
-- matches each line by its position and sets created_at to when it was
-- genuinely written, then fixes the story and story_members rows to match.
--
-- Paste into the Supabase SQL editor and run it. Safe to run more than once.

do $fix$
declare
  dan_email text := 'you@example.com';
  ben_email text := 'ben@example.com';

  dan_id uuid;
  ben_id uuid;
  story  uuid;
  fixed  int;
begin
  select id into dan_id from auth.users where lower(email) = lower(btrim(dan_email));
  select id into ben_id from auth.users where lower(email) = lower(btrim(ben_email));

  if dan_id is null or ben_id is null then
    raise exception 'Could not find both accounts — check the emails above.';
  end if;

  select id into story from relay.stories
    where title = $ln$Pasco$ln$ and created_by = dan_id;

  if story is null then
    raise exception 'No "%" story found for that account. Run the seed first.', $ln$Pasco$ln$;
  end if;

  update relay.lines as l
     set created_at = seed.sent_at
    from (values
    (dan_id, 1, $ln$Pasco knew he was in trouble when he realised he'd never eaten a peanut before.$ln$, null, timestamptz $ln$2025-08-25T10:29:00+01:00$ln$),
    (ben_id, 2, $ln$He had always preferred skittles to M&Ms. BLTs to PBJs.$ln$, null, timestamptz $ln$2025-08-25T22:12:00+01:00$ln$),
    (dan_id, 3, $ln$But his recent carelessness meant he was now pulling up a chair at his very own banquet of consequences.$ln$, null, timestamptz $ln$2025-08-26T22:25:00+01:00$ln$),
    (ben_id, 4, $ln$It was open buffet. All you can eat. But what if you can't? He was about to find out.$ln$, null, timestamptz $ln$2025-08-29T18:45:00+01:00$ln$),
    (dan_id, 5, $ln$Out of nowhere, a wild fox burst into the room and garrotted his faux pet echidna$ln$, null, timestamptz $ln$2025-08-29T20:34:00+01:00$ln$),
    (ben_id, 6, $ln$As the fox attacked, the stuffed critter's plastic spikes dug into its soft belly. Dazed and confused, it slunk away to the safety of the dimly lit street.$ln$, null, timestamptz $ln$2025-09-06T10:45:00+01:00$ln$),
    (dan_id, 7, $ln$Seeking further refuge, he spied an open door. He'd usually stick to alleyways and garden boundaries, but the gradual shapeshifting of his thoughts into dreams meant that he needed somewhere to lay his weary head.$ln$, null, timestamptz $ln$2025-09-08T15:45:00+01:00$ln$),
    (ben_id, 8, $ln$There, in the back - a disorderly pile of bin bags, full and untouched, possibly less than a day old. He couldn't believe his luck - breakfast will be a feast. Nestled amongst his pungent pillows, he surrendered to the dreams. They enveloped him.$ln$, null, timestamptz $ln$2025-09-12T14:42:00+01:00$ln$),
    (dan_id, 9, $ln$His breathing slowed. The only movement was the rhythmic rise and fall, rise and fall of his chest. Soon, that too stuck fast in time and his earthly being was left to resemble no more than a chrysalis.$ln$, null, timestamptz $ln$2025-09-12T19:25:00+01:00$ln$),
    (ben_id, 10, $ln$An elite crack squad of bin men burst into the room. A truck's tank engine roars outside. "Put your paws in the air!" they scream.$ln$, null, timestamptz $ln$2025-09-13T13:00:00+01:00$ln$),
    (dan_id, 11, $ln$Our vulpine friend didn't even stir.$ln$, null, timestamptz $ln$2025-09-14T15:35:00+01:00$ln$),
    (ben_id, 12, $ln$In a flash of movement, he launched a beer bottle at one and a broken syringe at another. The binmen, weary from their early morning exertions, had no riposte. The fox melted into the thick fog of the city.$ln$, null, timestamptz $ln$2025-09-21T10:19:00+01:00$ln$),
    (dan_id, 13, $ln$Now, all was still. The only movement was the city itself breathing in, out, in, out, swaying rhythmically to its chosen beat.$ln$, null, timestamptz $ln$2025-09-24T11:53:00+01:00$ln$),
    (ben_id, 14, $ln$the faint sound of an ambulance rang out in the distance. Its two notes floated in the air, conversing, punctuating the city's breathing.$ln$, null, timestamptz $ln$2025-09-30T21:15:00+01:00$ln$),
    (dan_id, 15, $ln$They emerged to punctuate the former sparseness of the air, intertwined like two birds courting.$ln$, null, timestamptz $ln$2025-10-01T09:40:00+01:00$ln$),
    (ben_id, 16, $ln$As the plant grew, its flowers blossomed. Slender stems (known as pegs) pushed down, carrying the beginnings of the peanut beneath the earth. Safely nestled underground, the peanut slowly and surely matured inside its shell.$ln$, $ln$Chapter 2$ln$, timestamptz $ln$2025-10-02T17:13:00+01:00$ln$),
    (dan_id, 17, $ln$All was calm - at least on the inside. Externally, though, there was change in the world.$ln$, null, timestamptz $ln$2025-10-06T10:15:00+01:00$ln$),
    (ben_id, 18, $ln$The West African peanut industry was undergoing deep, structural changes. Gone were the days of small scale subsistence farmers cultivating the nuts to meet the needs of their communities. Our peanut friend was destined for bigger, greater things - a journey through M&M's vertically integrated value chain.$ln$, null, timestamptz $ln$2025-10-08T10:04:00+01:00$ln$),
    (dan_id, 19, $ln$And boy what value he could bring! From field to food, this journey was on the frontier of peanut progression. Time for him to explore his very own wonderland - let's go down the rabbit hole.$ln$, null, timestamptz $ln$2025-10-12T10:48:00+01:00$ln$),
    (ben_id, 20, $ln$Kano State, Nigeria. Once home to the famous "Groundnut Pyramids" that symbolised the region's agricultural might. Once picked, the arachid is driven with thousands of his fellow peanuts to the port of Lagos.$ln$, null, timestamptz $ln$2025-10-30T18:58:00+00:00$ln$),
    (dan_id, 21, $ln$A city which conjures a patchwork of associations in ways few others can. An assault on the senses, where humanity drives sub Saharan pursuits in fashion, arts, economics... And would you believe it, peanuts.$ln$, null, timestamptz $ln$2025-11-01T13:24:00+00:00$ln$),
    (ben_id, 22, $ln$But this peanut had no time for art or fashion. For its purpose had been dictated long ago by the powerful and visionary architects of the global confectionary trade. Along with thousands of other peanuts, in a shipping container among hundreds of other shipping containers, it was headed across the ocean. On a frosty November morning, the air brimming with opportunity, the peanut arrived in Newark, New Jersey. But his journey would not end here.$ln$, null, timestamptz $ln$2025-11-05T12:21:00+00:00$ln$),
    (dan_id, 23, $ln$See the thing with shipping containers is they all look very much alike. So whilst this was meant to be a brief adjournment on shores of hope and glory, the overeager transit network snaffled our peanut pals and set them on their way to the Motor City.$ln$, null, timestamptz $ln$2025-11-10T12:19:00+00:00$ln$),
    (ben_id, 24, $ln$Detroit, Detroit. Industrial grit pounds to the drum of a house baseline. Uprooted from the safety of their supply chain, the nuts were lost and helpless. But they were also free. Free from marketing and safety labels.$ln$, null, timestamptz $ln$2025-11-21T16:43:00+00:00$ln$),
    (dan_id, 25, $ln$freedom is a wonderful asset, and in a place like Detroit it blooms like a flower in the mind. Deshackled from said safety labels, it was time for the nuts to grasp the nettle and explore.$ln$, null, timestamptz $ln$2025-11-21T19:14:00+00:00$ln$),
    (ben_id, 26, $ln$Soon enough they found their way into some of the city's seediest corner shops. "Mixed nuts - unsalted - 99 cents a bag. Origin unknown". Most customers were wary of the lack of branding, but not Jimmy.$ln$, null, timestamptz $ln$2025-11-22T10:45:00+00:00$ln$),
    (dan_id, 27, $ln$you see, Jimmy was the type of man you could sense before you saw him. He was a good bloke, fairly, but got well lary when geezers looked at him funny.$ln$, null, timestamptz $ln$2025-11-29T12:28:00+00:00$ln$),
    (ben_id, 28, $ln$Jimmy was moulded in the blasting furnaces of Motor City. His father, John P Pasco, was a steel company man - hard as nails. He met Cheryl, Jimmy's mum, in a pub in Poplar at the 1967 International Dockers Union Congress.$ln$, null, timestamptz $ln$2025-12-05T07:11:00+00:00$ln$),
    (dan_id, 29, $ln$There was a certain sense of kismet to their meeting - Cheryl was meant to be on the campaign trail that day, but her longtime friend Veronica suggested they hit the docks. Skeptical as she was, Cheryl decided why not.$ln$, null, timestamptz $ln$2025-12-06T22:15:00+00:00$ln$),
    (ben_id, 30, $ln$They chose the Grapes, an old dockers pub with a view on the Thames. Veronika's brother Igor, a freshly emigrated Russian menchevik, had just been hired there to pull pints.$ln$, null, timestamptz $ln$2025-12-07T21:25:00+00:00$ln$),
    (dan_id, 31, $ln$Most people associate the Russians with vodka, but if there's one thing communism is good for it's forcing you to embrace alternative specialities. He learned his trade under the manifesto in southern Stalingrad. Then he spread the love in Limehouse.$ln$, null, timestamptz $ln$2025-12-07T22:41:00+00:00$ln$),
    (ben_id, 32, $ln$He had to have his wits about him. Ever since his father Dimitri, close confidant to top menshevik Fyodor Dan, was killed in the aftermath of the disastrous Kronstadt rebellion, the bolsheviks had been hunting him.$ln$, null, timestamptz $ln$2025-12-08T09:19:00+00:00$ln$),
    (dan_id, 33, $ln$It wasn't the Bolsheviks that worried Igor the most though - it was Jimmy's gambling addiction.$ln$, null, timestamptz $ln$2025-12-08T18:57:00+00:00$ln$),
    (ben_id, 34, $ln$Sometimes lucky, mostly not. Change was getting short, IOUs quickly becoming you owe me's.$ln$, null, timestamptz $ln$2025-12-13T12:44:00+00:00$ln$),
    (dan_id, 35, $ln$They in turn became favours to pay back, and then favours which couldn't be paid back. Luckily for Jimmy, Igor was a pro.$ln$, null, timestamptz $ln$2025-12-13T13:36:00+00:00$ln$),
    (ben_id, 36, $ln$"How many times do I have to save this lad's bacon before he changes his ways?" Igor asked his sister, exasperated. "I swear to God ill send him to the Gulag if he keeps this up. Straighten the boy up".$ln$, null, timestamptz $ln$2025-12-17T17:35:00+00:00$ln$),
    (dan_id, 37, $ln$"Igor, don't forget your roots." shot back Veronika. "You could've spent your life in a Gulag if it wasnt for Rod Stewart stepping in when he did. I've always wondered why he's one of the few Western men to have true influence in the Eastern bloc."$ln$, null, timestamptz $ln$2025-12-17T17:41:00+00:00$ln$),
    (ben_id, 38, $ln$1971, Moscow. Roderick was back in the USSR, riding a Maggie shaped wave.$ln$, null, timestamptz $ln$2025-12-18T18:27:00+00:00$ln$),
    (dan_id, 39, $ln$who'd have thought that the depths of the communist monotony would be punctuated by the song of a showgirl? Only a man with forenames for days it turns out.$ln$, null, timestamptz $ln$2025-12-18T21:47:00+00:00$ln$),
    (ben_id, 40, $ln$Igor was in a Saint Pete cell, awaiting his sentence for smuggling free world contraband. After sharing a few sigareties with the guard, he learned that the his daughter was a big Rod fan.$ln$, null, timestamptz $ln$2025-12-27T10:38:00+00:00$ln$),
    (dan_id, 41, $ln$Not wanting to come across as sleazy, he danced around the subject to gather a little more intel. First Roxy Music, then Chris Rea - the young lady loved them all it turned out. With her father confirming absolute infatuation with Hot Rod himself, the makings of a plan began to take shape - this was his chance to get back out to where he belonged on icy russian streets.$ln$, null, timestamptz $ln$2025-12-27T20:49:00+00:00$ln$),
    (ben_id, 42, $ln$All it took was a promise. "I'm very close to Mister Steward's local agent, Vladimir Petrovich. Friends call him Vlad. I'm sure he can bag us a couple seats at the opera house next week, if you'd like that".$ln$, null, timestamptz $ln$2025-12-28T13:10:00+00:00$ln$),
    (dan_id, 43, $ln$"Save your favours for my daughter - she's wanted to see Rod her whole life. If you can guarantee it, I'll get you out of here. If you don't, I'll see to it that only half of your limbs do."$ln$, null, timestamptz $ln$2025-12-29T15:50:00+00:00$ln$),
    (ben_id, 44, $ln$Three weeks later they were playing Durak in Igor's basement, betting fool's gold until the early hours. Suppose the apple fell close to the tree after all.$ln$, null, timestamptz $ln$2026-01-05T20:38:00+00:00$ln$),
    (dan_id, 45, $ln$The emperor had been growing bored with the monotony or running an empire, and had recently started to pass the time whiling away the day by carving fruits into increasingly curious shapes.$ln$, $ln$III: When in Rome$ln$, timestamptz $ln$2026-01-06T15:50:00+00:00$ln$),
    (ben_id, 46, $ln$It all went pear shaped when he cut himself sculpting a large fig into a small crown. Stained with his blood, it will ripen, and inevitably rot.$ln$, null, timestamptz $ln$2026-01-07T13:17:00+00:00$ln$),
    (dan_id, 47, $ln$not that it matters - nearly everything is temporary when you stretch the timescale out long enough. Even empires. But not his.$ln$, null, timestamptz $ln$2026-01-08T20:40:00+00:00$ln$),
    (ben_id, 48, $ln$The emperor had it all - wealth, fame, territory, power, fresh fruit. For all this, one thing evaded him still - Livia's heart.$ln$, null, timestamptz $ln$2026-01-09T16:26:00+00:00$ln$),
    (dan_id, 49, $ln$Her heart had always been free as the wind, that was the beauty of her. Just when you thought you'd figured her out, she'd surprise you. There are few good surprises when you're an emperor. So that made them even more special when they did come along on days like today.$ln$, null, timestamptz $ln$2026-01-17T11:46:00+00:00$ln$),
    (ben_id, 50, $ln$Livia courted Rome's most powerful men. But though her heart was divided, it would not be conquered. So when her father, a great tactician of the 15th Legion died on the Nabatean front, the air was ripe with opportunity.$ln$, null, timestamptz $ln$2026-01-26T10:38:00+00:00$ln$),
    (dan_id, 51, $ln$An opportunity to find Graceland$ln$, null, timestamptz $ln$2026-01-31T11:12:00+00:00$ln$),
    (ben_id, 52, $ln$The emperor was following the roman road, through the cradle of his own civil war.$ln$, null, timestamptz $ln$2026-02-11T17:02:00+00:00$ln$),
    (dan_id, 53, $ln$For Livia, opportunity meant not riches nor power, but something much more meaningful - freedom.$ln$, null, timestamptz $ln$2026-03-10T08:39:00+00:00$ln$),
    (ben_id, 54, $ln$After her father's death, Livia vanished. Some of Emperor's spies reported seeing her drinking wine in Tolosa, others buying cattle in Sardinia.$ln$, null, timestamptz $ln$2026-08-06T07:20:00+01:00$ln$),
    (dan_id, 55, $ln$funny how times change. These days, you want real cattle ranchers and you need to go to the depths of the Outback. That's where you would meet a man like Cliff.$ln$, null, timestamptz $ln$2026-08-06T08:09:00+01:00$ln$),
    (ben_id, 56, $ln$Cliff claimed to care for all his animals equally, but one cow held a special place in his heart.$ln$, null, timestamptz $ln$2026-08-07T08:01:00+01:00$ln$),
    (dan_id, 57, $ln$She owned those plains, and had been with him for 10 years, longer than the life of many bovine brethren. In truth, that vaste experience had taught her only one thing:$ln$, null, timestamptz $ln$2026-08-07T12:28:00+01:00$ln$),
    (ben_id, 58, $ln$There's no such thing as free milk.$ln$, null, timestamptz $ln$2026-08-07T13:51:00+01:00$ln$),
    (dan_id, 59, $ln$Cliff utilised this hard nosed approach to motivate the rest of the herd. And would you believe it, like stars intertwined in the night sky, this brought his and Livia's paths into orbit.$ln$, null, timestamptz $ln$2026-08-10T20:34:00+01:00$ln$),
    (ben_id, 60, $ln$As a young calf, Livia was unremarkable. She liked to graze on the wild grasses and shrubs, and socialised well with the rest of the herd.$ln$, null, timestamptz $ln$2026-08-11T20:31:00+01:00$ln$),
    (dan_id, 61, $ln$she had inherited not just her name from the emperors daughter, but many of her tendencies too. That being said, veganism was more of a modern thing$ln$, null, timestamptz $ln$2026-08-14T11:47:00+01:00$ln$),
    (ben_id, 62, $ln$Livia had the talent to be in the right place at the right time. Cliff never forgot how she saved his life once.$ln$, null, timestamptz $ln$2026-08-15T18:56:00+01:00$ln$),
    (dan_id, 63, $ln$this was in the depths of Aussie winter when the sun plays a far more minor role than you'd expect. The threat? A cattle rustler looking for some business. Livia's answer? Not today, matey$ln$, null, timestamptz $ln$2026-08-15T19:13:00+01:00$ln$),
    (ben_id, 64, $ln$After a potentially lucrative business deal turned sour, the rustler got desperate. He torched Cliff's house in the depths of the night, hoping to take over his ranch.$ln$, null, timestamptz $ln$2026-08-19T15:03:00+01:00$ln$)
    ) as seed(author_id, position, body, chapter_title, sent_at)
   where l.story_id = story
     and l.position = seed.position;
  get diagnostics fixed = row_count;

  update relay.stories
     set created_at   = $ln$2025-08-25T10:29:00+01:00$ln$,
         last_line_at = $ln$2026-08-19T15:03:00+01:00$ln$
   where id = story;

  raise notice 'Corrected % line timestamps, % to %.',
    fixed, $ln$2025-08-25$ln$, $ln$2026-08-19$ln$;
end $fix$;
