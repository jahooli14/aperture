-- Seed the existing Pasco story into Relay.
--
-- Paste this into the Supabase SQL editor and run it. No terminal needed.
--
-- Before you run it, both writers must have signed in to Relay at least once
-- (magic link) so their accounts exist — this looks them up by email.
--
-- Safe to run twice: if the story already has lines, it does nothing.

do $seed$
declare
  -- ================== EDIT THESE THREE LINES ==================
  dan_email text := 'you@example.com';
  ben_email text := 'ben@example.com';
  -- Roughly when you started the thread, so "the story so far" isn't all
  -- stamped today. Line times are spread evenly from then until now.
  -- Leave as null to stamp every line with the time you run this.
  began_on  date := null;
  -- ============================================================

  dan_id     uuid;
  ben_id     uuid;
  story      uuid;
  have_lines int;
  total      int := 64;
  first_at   timestamptz;
  step       interval;
begin
  select id into dan_id from auth.users where lower(email) = lower(btrim(dan_email));
  select id into ben_id from auth.users where lower(email) = lower(btrim(ben_email));

  if dan_id is null then
    raise exception 'No account for %. Sign in to Relay with that address first.', dan_email;
  end if;
  if ben_id is null then
    raise exception 'No account for %. Get them to sign in to Relay first.', ben_email;
  end if;

  first_at := coalesce(began_on + time '19:00', now());
  step := (now() - first_at) / greatest(total - 1, 1);

  insert into relay.profiles (user_id, display_name) values
    (dan_id, 'Dan'), (ben_id, 'Ben')
    on conflict (user_id) do nothing;

  select id into story from relay.stories
    where title = $ln$Pasco$ln$ and created_by = dan_id;

  if story is null then
    insert into relay.stories (title, blurb, created_by, turn_mode, next_author_id, created_at)
      values ($ln$Pasco$ln$, $ln$A line each, no plan. Started in WhatsApp, moved to Signal, now here.$ln$, dan_id, 'rotation', dan_id, first_at)
      returning id into story;
    raise notice 'Created the story.';
  end if;

  insert into relay.story_members (story_id, user_id, role, turn_order) values
    (story, dan_id, 'owner', 0), (story, ben_id, 'writer', 1)
    on conflict (story_id, user_id) do nothing;

  select count(*) into have_lines from relay.lines where story_id = story;
  if have_lines > 0 then
    raise notice 'Story already has % lines — nothing to add.', have_lines;
    return;
  end if;

  insert into relay.lines (story_id, author_id, position, body, chapter_title, created_at)
  select story, seed.author_id, seed.position, seed.body, seed.chapter_title,
         first_at + step * (seed.position - 1)
    from (values
    (dan_id, 1, $ln$Pasco knew he was in trouble when he realised he'd never eaten a peanut before.$ln$, null),
    (ben_id, 2, $ln$He had always preferred skittles to M&Ms. BLTs to PBJs.$ln$, null),
    (dan_id, 3, $ln$But his recent carelessness meant he was now pulling up a chair at his very own banquet of consequences.$ln$, null),
    (ben_id, 4, $ln$It was open buffet. All you can eat. But what if you can't? He was about to find out.$ln$, null),
    (dan_id, 5, $ln$Out of nowhere, a wild fox burst into the room and garrotted his faux pet echidna$ln$, null),
    (ben_id, 6, $ln$As the fox attacked, the stuffed critter's plastic spikes dug into its soft belly. Dazed and confused, it slunk away to the safety of the dimly lit street.$ln$, null),
    (dan_id, 7, $ln$Seeking further refuge, he spied an open door. He'd usually stick to alleyways and garden boundaries, but the gradual shapeshifting of his thoughts into dreams meant that he needed somewhere to lay his weary head.$ln$, null),
    (ben_id, 8, $ln$There, in the back - a disorderly pile of bin bags, full and untouched, possibly less than a day old. He couldn't believe his luck - breakfast will be a feast. Nestled amongst his pungent pillows, he surrendered to the dreams. They enveloped him.$ln$, null),
    (dan_id, 9, $ln$His breathing slowed. The only movement was the rhythmic rise and fall, rise and fall of his chest. Soon, that too stuck fast in time and his earthly being was left to resemble no more than a chrysalis.$ln$, null),
    (ben_id, 10, $ln$An elite crack squad of bin men burst into the room. A truck's tank engine roars outside. "Put your paws in the air!" they scream.$ln$, null),
    (dan_id, 11, $ln$Our vulpine friend didn't even stir.$ln$, null),
    (ben_id, 12, $ln$In a flash of movement, he launched a beer bottle at one and a broken syringe at another. The binmen, weary from their early morning exertions, had no riposte. The fox melted into the thick fog of the city.$ln$, null),
    (dan_id, 13, $ln$Now, all was still. The only movement was the city itself breathing in, out, in, out, swaying rhythmically to its chosen beat.$ln$, null),
    (ben_id, 14, $ln$the faint sound of an ambulance rang out in the distance. Its two notes floated in the air, conversing, punctuating the city's breathing.$ln$, null),
    (dan_id, 15, $ln$They emerged to punctuate the former sparseness of the air, intertwined like two birds courting.$ln$, null),
    (ben_id, 16, $ln$As the plant grew, its flowers blossomed. Slender stems (known as pegs) pushed down, carrying the beginnings of the peanut beneath the earth. Safely nestled underground, the peanut slowly and surely matured inside its shell.$ln$, $ln$Chapter 2$ln$),
    (dan_id, 17, $ln$All was calm - at least on the inside. Externally, though, there was change in the world.$ln$, null),
    (ben_id, 18, $ln$The West African peanut industry was undergoing deep, structural changes. Gone were the days of small scale subsistence farmers cultivating the nuts to meet the needs of their communities. Our peanut friend was destined for bigger, greater things - a journey through M&M's vertically integrated value chain.$ln$, null),
    (dan_id, 19, $ln$And boy what value he could bring! From field to food, this journey was on the frontier of peanut progression. Time for him to explore his very own wonderland - let's go down the rabbit hole.$ln$, null),
    (ben_id, 20, $ln$Kano State, Nigeria. Once home to the famous "Groundnut Pyramids" that symbolised the region's agricultural might. Once picked, the arachid is driven with thousands of his fellow peanuts to the port of Lagos.$ln$, null),
    (dan_id, 21, $ln$A city which conjures a patchwork of associations in ways few others can. An assault on the senses, where humanity drives sub Saharan pursuits in fashion, arts, economics... And would you believe it, peanuts.$ln$, null),
    (ben_id, 22, $ln$But this peanut had no time for art or fashion. For its purpose had been dictated long ago by the powerful and visionary architects of the global confectionary trade. Along with thousands of other peanuts, in a shipping container among hundreds of other shipping containers, it was headed across the ocean. On a frosty November morning, the air brimming with opportunity, the peanut arrived in Newark, New Jersey. But his journey would not end here.$ln$, null),
    (dan_id, 23, $ln$See the thing with shipping containers is they all look very much alike. So whilst this was meant to be a brief adjournment on shores of hope and glory, the overeager transit network snaffled our peanut pals and set them on their way to the Motor City.$ln$, null),
    (ben_id, 24, $ln$Detroit, Detroit. Industrial grit pounds to the drum of a house baseline. Uprooted from the safety of their supply chain, the nuts were lost and helpless. But they were also free. Free from marketing and safety labels.$ln$, null),
    (dan_id, 25, $ln$freedom is a wonderful asset, and in a place like Detroit it blooms like a flower in the mind. Deshackled from said safety labels, it was time for the nuts to grasp the nettle and explore.$ln$, null),
    (ben_id, 26, $ln$Soon enough they found their way into some of the city's seediest corner shops. "Mixed nuts - unsalted - 99 cents a bag. Origin unknown". Most customers were wary of the lack of branding, but not Jimmy.$ln$, null),
    (dan_id, 27, $ln$you see, Jimmy was the type of man you could sense before you saw him. He was a good bloke, fairly, but got well lary when geezers looked at him funny.$ln$, null),
    (ben_id, 28, $ln$Jimmy was moulded in the blasting furnaces of Motor City. His father, John P Pasco, was a steel company man - hard as nails. He met Cheryl, Jimmy's mum, in a pub in Poplar at the 1967 International Dockers Union Congress.$ln$, null),
    (dan_id, 29, $ln$There was a certain sense of kismet to their meeting - Cheryl was meant to be on the campaign trail that day, but her longtime friend Veronica suggested they hit the docks. Skeptical as she was, Cheryl decided why not.$ln$, null),
    (ben_id, 30, $ln$They chose the Grapes, an old dockers pub with a view on the Thames. Veronika's brother Igor, a freshly emigrated Russian menchevik, had just been hired there to pull pints.$ln$, null),
    (dan_id, 31, $ln$Most people associate the Russians with vodka, but if there's one thing communism is good for it's forcing you to embrace alternative specialities. He learned his trade under the manifesto in southern Stalingrad. Then he spread the love in Limehouse.$ln$, null),
    (ben_id, 32, $ln$He had to have his wits about him. Ever since his father Dimitri, close confidant to top menshevik Fyodor Dan, was killed in the aftermath of the disastrous Kronstadt rebellion, the bolsheviks had been hunting him.$ln$, null),
    (dan_id, 33, $ln$It wasn't the Bolsheviks that worried Igor the most though - it was Jimmy's gambling addiction.$ln$, null),
    (ben_id, 34, $ln$Sometimes lucky, mostly not. Change was getting short, IOUs quickly becoming you owe me's.$ln$, null),
    (dan_id, 35, $ln$They in turn became favours to pay back, and then favours which couldn't be paid back. Luckily for Jimmy, Igor was a pro.$ln$, null),
    (ben_id, 36, $ln$"How many times do I have to save this lad's bacon before he changes his ways?" Igor asked his sister, exasperated. "I swear to God ill send him to the Gulag if he keeps this up. Straighten the boy up".$ln$, null),
    (dan_id, 37, $ln$"Igor, don't forget your roots." shot back Veronika. "You could've spent your life in a Gulag if it wasnt for Rod Stewart stepping in when he did. I've always wondered why he's one of the few Western men to have true influence in the Eastern bloc."$ln$, null),
    (ben_id, 38, $ln$1971, Moscow. Roderick was back in the USSR, riding a Maggie shaped wave.$ln$, null),
    (dan_id, 39, $ln$who'd have thought that the depths of the communist monotony would be punctuated by the song of a showgirl? Only a man with forenames for days it turns out.$ln$, null),
    (ben_id, 40, $ln$Igor was in a Saint Pete cell, awaiting his sentence for smuggling free world contraband. After sharing a few sigareties with the guard, he learned that the his daughter was a big Rod fan.$ln$, null),
    (dan_id, 41, $ln$Not wanting to come across as sleazy, he danced around the subject to gather a little more intel. First Roxy Music, then Chris Rea - the young lady loved them all it turned out. With her father confirming absolute infatuation with Hot Rod himself, the makings of a plan began to take shape - this was his chance to get back out to where he belonged on icy russian streets.$ln$, null),
    (ben_id, 42, $ln$All it took was a promise. "I'm very close to Mister Steward's local agent, Vladimir Petrovich. Friends call him Vlad. I'm sure he can bag us a couple seats at the opera house next week, if you'd like that".$ln$, null),
    (dan_id, 43, $ln$"Save your favours for my daughter - she's wanted to see Rod her whole life. If you can guarantee it, I'll get you out of here. If you don't, I'll see to it that only half of your limbs do."$ln$, null),
    (ben_id, 44, $ln$Three weeks later they were playing Durak in Igor's basement, betting fool's gold until the early hours. Suppose the apple fell close to the tree after all.$ln$, null),
    (dan_id, 45, $ln$The emperor had been growing bored with the monotony or running an empire, and had recently started to pass the time whiling away the day by carving fruits into increasingly curious shapes.$ln$, $ln$III: When in Rome$ln$),
    (ben_id, 46, $ln$It all went pear shaped when he cut himself sculpting a large fig into a small crown. Stained with his blood, it will ripen, and inevitably rot.$ln$, null),
    (dan_id, 47, $ln$not that it matters - nearly everything is temporary when you stretch the timescale out long enough. Even empires. But not his.$ln$, null),
    (ben_id, 48, $ln$The emperor had it all - wealth, fame, territory, power, fresh fruit. For all this, one thing evaded him still - Livia's heart.$ln$, null),
    (dan_id, 49, $ln$Her heart had always been free as the wind, that was the beauty of her. Just when you thought you'd figured her out, she'd surprise you. There are few good surprises when you're an emperor. So that made them even more special when they did come along on days like today.$ln$, null),
    (ben_id, 50, $ln$Livia courted Rome's most powerful men. But though her heart was divided, it would not be conquered. So when her father, a great tactician of the 15th Legion died on the Nabatean front, the air was ripe with opportunity.$ln$, null),
    (dan_id, 51, $ln$An opportunity to find Graceland$ln$, null),
    (ben_id, 52, $ln$The emperor was following the roman road, through the cradle of his own civil war.$ln$, null),
    (dan_id, 53, $ln$For Livia, opportunity meant not riches nor power, but something much more meaningful - freedom.$ln$, null),
    (ben_id, 54, $ln$After her father's death, Livia vanished. Some of Emperor's spies reported seeing her drinking wine in Tolosa, others buying cattle in Sardinia.$ln$, null),
    (dan_id, 55, $ln$funny how times change. These days, you want real cattle ranchers and you need to go to the depths of the Outback. That's where you would meet a man like Cliff.$ln$, null),
    (ben_id, 56, $ln$Cliff claimed to care for all his animals equally, but one cow held a special place in his heart.$ln$, null),
    (dan_id, 57, $ln$She owned those plains, and had been with him for 10 years, longer than the life of many bovine brethren. In truth, that vaste experience had taught her only one thing:$ln$, null),
    (ben_id, 58, $ln$There's no such thing as free milk.$ln$, null),
    (dan_id, 59, $ln$Cliff utilised this hard nosed approach to motivate the rest of the herd. And would you believe it, like stars intertwined in the night sky, this brought his and Livia's paths into orbit.$ln$, null),
    (ben_id, 60, $ln$As a young calf, Livia was unremarkable. She liked to graze on the wild grasses and shrubs, and socialised well with the rest of the herd.$ln$, null),
    (dan_id, 61, $ln$she had inherited not just her name from the emperors daughter, but many of her tendencies too. That being said, veganism was more of a modern thing$ln$, null),
    (ben_id, 62, $ln$Livia had the talent to be in the right place at the right time. Cliff never forgot how she saved his life once.$ln$, null),
    (dan_id, 63, $ln$this was in the depths of Aussie winter when the sun plays a far more minor role than you'd expect. The threat? A cattle rustler looking for some business. Livia's answer? Not today, matey$ln$, null),
    (ben_id, 64, $ln$After a potentially lucrative business deal turned sour, the rustler got desperate. He torched Cliff's house in the depths of the night, hoping to take over his ranch.$ln$, null)
    ) as seed(author_id, position, body, chapter_title);

  -- The insert trigger left the turn where the last line put it. The story
  -- alternates, so after Ben's line it is Dan's go.
  update relay.stories
     set next_author_id = dan_id,
         last_line_at   = (select max(created_at) from relay.lines where story_id = story),
         created_at     = first_at
   where id = story;

  raise notice 'Added % lines. It is Dan''s turn.', total;
end $seed$;
