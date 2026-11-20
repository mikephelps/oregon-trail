/*
 * ============================================================
 *  GAME CONTENT — this is the file to edit for mods.
 * ============================================================
 *  Everything a player reads or meets lives here: professions,
 *  names, the store, landmarks, people you talk to, illnesses,
 *  random events, animals, weather, and scoring.
 *
 *  Text templates can use these placeholders:
 *    {name}    a random living party member
 *    {amount}  the quantity gained or lost
 *    {item}    the item name that goes with {amount}
 *    {days}    days lost
 *    {part}    the wagon part that broke
 *
 *  After editing, just reload the page. See README.md for the
 *  full list of event effects and conditions.
 * ============================================================
 */
(function (root) {
  root.OT_CONTENT = {
    title: 'The Oregon Trail',
    subtitle: 'Independence, Missouri to the Willamette Valley',
    tagline: 'Two thousand miles of prairie, mountain, and river stand between your family and a new life.',
    year: 1848,

    // ---------- Who you are ----------
    professions: [
      { id: 'banker', name: 'Banker from Boston', money: 1600, multiplier: 1,
        blurb: 'Deep pockets, soft hands. Easiest start, smallest score.' },
      { id: 'carpenter', name: 'Carpenter from Ohio', money: 800, multiplier: 2,
        blurb: 'Enough money for a decent outfit. Double points at the end.' },
      { id: 'farmer', name: 'Farmer from Illinois', money: 400, multiplier: 3,
        blurb: 'A thin purse and a long road. Triple points if you make it.' },
    ],
    partySize: 5,
    suggestedNames: [
      'Abigail', 'Amos', 'Clara', 'Eli', 'Hattie', 'Jeb', 'Lavinia', 'Silas',
      'Mercy', 'Obadiah', 'Ruth', 'Tobias', 'Winifred', 'Zeke', 'Prudence',
      'Cyrus', 'Delia', 'Gideon', 'Ida', 'Luther', 'Nell', 'Orrin', 'Sadie', 'Virgil',
    ],
    months: [
      { id: 3, name: 'March', note: 'Early. Grass is thin and rivers run high, but you beat the snow.' },
      { id: 4, name: 'April', note: 'The usual choice. A good balance of grass and time.' },
      { id: 5, name: 'May', note: 'Green prairie, but you will be racing winter at the end.' },
      { id: 6, name: 'June', note: 'Late. Expect snow in the Blue Mountains.' },
      { id: 7, name: 'July', note: 'Very late. Only the bold or the foolish leave now.' },
    ],

    // ---------- Supplies ----------
    // price: cost of one "pack" at Independence. pack: units per purchase.
    // value: per-unit worth when strangers trade with you. max: wagon limit.
    items: {
      oxen:     { label: 'Oxen', noun: ['ox', 'oxen'], price: 20, pack: 1, step: 1, max: 20, value: 20, tradeQty: [1, 2],
                  hint: 'At least 6 recommended. More oxen = faster travel.' },
      food:     { label: 'Food', noun: ['pound of food', 'pounds of food'], storeUnit: 'lb', price: 0.2, pack: 1, step: 50, max: 2000, value: 0.2, tradeQty: [50, 150],
                  hint: 'Each person eats 1–2 lbs a day depending on rations.' },
      clothing: { label: 'Clothing', noun: ['set of clothing', 'sets of clothing'], storeUnit: 'set', price: 10, pack: 1, step: 1, max: 50, value: 10, tradeQty: [1, 3],
                  hint: 'Two sets per person keeps the mountain cold away.' },
      bullets:  { label: 'Bullets', noun: ['bullet', 'bullets'], storeUnit: 'box of 20', price: 2, pack: 20, step: 1, max: 2000, value: 0.1, tradeQty: [20, 60],
                  hint: 'Every shot you fire while hunting uses one.' },
      wheel:    { label: 'Wagon wheel', noun: ['wagon wheel', 'wagon wheels'], price: 10, pack: 1, step: 1, max: 3, value: 10, tradeQty: [1, 1],
                  hint: 'Spare parts save days when something breaks.' },
      axle:     { label: 'Wagon axle', noun: ['wagon axle', 'wagon axles'], price: 10, pack: 1, step: 1, max: 3, value: 10, tradeQty: [1, 1], hint: '' },
      tongue:   { label: 'Wagon tongue', noun: ['wagon tongue', 'wagon tongues'], price: 10, pack: 1, step: 1, max: 3, value: 10, tradeQty: [1, 1], hint: '' },
    },

    store: {
      name: 'Hollis & Daughters Outfitters',
      keeper: 'Ada Hollis',
      greeting: "Heading west? Then you'll want to listen to me before you spend a cent.",
      advice: [
        'Get yourself at least three yoke of oxen. Six animals, minimum.',
        'Two hundred pounds of food per person will see most families through.',
        'Two sets of clothes each. The mountains are cold, even in September.',
        'A spare wheel, axle, and tongue are cheap now and dear later.',
      ],
      fortGreeting: 'Prices out here are steep. Everything had to come a long way.',
    },

    // ---------- How you travel ----------
    paces: [
      { id: 'steady', name: 'Steady', miles: 17, health: 0, desc: 'About 8 hours a day. Easy on people and oxen.' },
      { id: 'strenuous', name: 'Strenuous', miles: 21, health: -1.5, desc: '12 hours a day. Faster, but people tire.' },
      { id: 'grueling', name: 'Grueling', miles: 25, health: -3, desc: 'Dawn to dusk. People and oxen break down.' },
    ],
    rations: [
      { id: 'filling', name: 'Filling', lbs: 2, health: 1, desc: 'Two pounds a person, every day. Meals are large and generous.' },
      { id: 'meager', name: 'Meager', lbs: 1.5, health: -0.7, desc: 'A pound and a half. Small meals stretch the food.' },
      { id: 'bare', name: 'Bare bones', lbs: 1, health: -2.5, desc: 'One pound. Hunger sets in fast.' },
    ],
    terrains: {
      plains:    { name: 'Prairie', speed: 1.0 },
      hills:     { name: 'High plains', speed: 0.85 },
      mountains: { name: 'Mountains', speed: 0.7, cold: 15 },
      river:     { name: 'River', speed: 1.6, eventChance: 0.4 },
    },
    weather: {
      // average temperature (°F) and chance of rain/snow, by month 1–12
      temp:   [0, 25, 30, 42, 55, 65, 75, 82, 80, 70, 57, 42, 30],
      precip: [0, .15, .15, .25, .3, .3, .25, .15, .12, .15, .18, .2, .18],
    },

    // ---------- Sickness ----------
    // severity: health lost per day while sick. days: how long it lasts.
    // weight: how often it's picked for a random illness (0 = only via events).
    illnesses: [
      { id: 'exhaustion', name: 'exhaustion', severity: 1.5, days: [3, 6], weight: 3 },
      { id: 'fever', name: 'a fever', severity: 2.5, days: [4, 8], weight: 3 },
      { id: 'dysentery', name: 'dysentery', severity: 3.5, days: [5, 10], weight: 3 },
      { id: 'measles', name: 'measles', severity: 3, days: [5, 9], weight: 2 },
      { id: 'typhoid', name: 'typhoid', severity: 3.5, days: [6, 10], weight: 2 },
      { id: 'cholera', name: 'cholera', severity: 5, days: [3, 6], weight: 1 },
      { id: 'snakebite', name: 'a snakebite', severity: 4, days: [2, 4], weight: 0 },
      { id: 'brokenarm', name: 'a broken arm', severity: 1, days: [8, 14], weight: 0, deathText: '{name} has died of complications from a broken arm.' },
      { id: 'brokenleg', name: 'a broken leg', severity: 2, days: [10, 16], weight: 0, deathText: '{name} has died of complications from a broken leg.' },
    ],

    // ---------- Random events ----------
    // weight: relative odds. when: conditions (terrain, months, minMile,
    // maxMile, pace, minTemp, maxTemp, sky, needs{item:qty}).
    // effects ops: item, itemPct, days, health, sick, break.
    events: [
      { id: 'thief-food', weight: 3, title: 'Thief in the night', tone: 'bad',
        text: 'A thief crept into camp and made off with {amount} {item}.',
        when: { needs: { food: 50 } }, effects: [{ op: 'item', item: 'food', amount: [-80, -20] }] },
      { id: 'thief-bullets', weight: 2, title: 'Thief in the night', tone: 'bad',
        text: 'Someone rifled through the wagon overnight. {amount} {item} are gone.',
        when: { needs: { bullets: 20 } }, effects: [{ op: 'item', item: 'bullets', amount: [-40, -10] }] },
      { id: 'ox-lame', weight: 2, title: 'Lame ox', tone: 'bad',
        text: 'One of your oxen went lame and had to be left behind.',
        when: { needs: { oxen: 2 } }, effects: [{ op: 'item', item: 'oxen', amount: -1 }] },
      { id: 'ox-dies', weight: 3, title: 'An ox has died', tone: 'bad',
        text: 'Worn out by the pace, one of your oxen collapsed and died.',
        when: { needs: { oxen: 2 }, pace: ['strenuous', 'grueling'] }, effects: [{ op: 'item', item: 'oxen', amount: -1 }] },
      { id: 'broken-part', weight: 4, title: 'Broken wagon', tone: 'bad',
        text: 'A {part} cracked on a rut in the trail.', effects: [{ op: 'break' }] },
      { id: 'wrong-trail', weight: 2, title: 'Wrong trail', tone: 'bad',
        text: 'You followed a cattle path for miles before realizing your mistake. Lost {days} days.',
        effects: [{ op: 'days', amount: [2, 4] }] },
      { id: 'lost-member', weight: 1, title: 'Missing!', tone: 'bad',
        text: '{name} wandered off to look for firewood and got lost. It took {days} days to find them.',
        effects: [{ op: 'days', amount: [1, 3] }] },
      { id: 'fog', weight: 2, title: 'Heavy fog', tone: 'neutral',
        text: 'A heavy fog rolled in. You lose a day waiting for it to lift.',
        when: { months: [3, 4, 5, 9, 10, 11] }, effects: [{ op: 'days', amount: 1 }] },
      { id: 'hail', weight: 2, title: 'Hailstorm', tone: 'bad',
        text: 'Hail the size of walnuts pounded the wagon. Everyone is bruised.',
        when: { months: [5, 6, 7, 8], terrain: ['plains', 'hills'] }, effects: [{ op: 'health', who: 'all', amount: [-8, -4] }] },
      { id: 'bad-water', weight: 3, title: 'Bad water', tone: 'bad',
        text: 'The only water nearby was brackish and foul. Several of you are feeling poorly.',
        effects: [{ op: 'health', who: 'all', amount: [-6, -3] }] },
      { id: 'no-water', weight: 2, title: 'Little water', tone: 'bad',
        text: 'The creeks have dried up. Everyone is parched.',
        when: { months: [7, 8, 9], minTemp: 70 }, effects: [{ op: 'health', who: 'all', amount: [-5, -2] }] },
      { id: 'rough', weight: 2, title: 'Rough trail', tone: 'neutral',
        text: 'Boulders and washouts slow you to a crawl. You lose a day.',
        when: { terrain: ['hills', 'mountains'] }, effects: [{ op: 'days', amount: 1 }] },
      { id: 'snake', weight: 1, title: 'Snakebite', tone: 'bad',
        text: '{name} was bitten by a rattlesnake.',
        when: { months: [5, 6, 7, 8, 9] }, effects: [{ op: 'sick', who: 'one', illness: 'snakebite' }] },
      { id: 'arm', weight: 1, title: 'Accident', tone: 'bad',
        text: '{name} fell from the wagon and broke an arm.', effects: [{ op: 'sick', who: 'one', illness: 'brokenarm' }] },
      { id: 'leg', weight: 1, title: 'Accident', tone: 'bad',
        text: 'A wheel rolled over {name}\'s leg. It is broken.', effects: [{ op: 'sick', who: 'one', illness: 'brokenleg' }] },
      { id: 'fire', weight: 1, title: 'Fire!', tone: 'bad',
        text: 'A spark from the cookfire caught the wagon cover. You saved most of it, but lost {amount} {item}.',
        when: { needs: { food: 30 } }, effects: [{ op: 'item', item: 'food', amount: [-60, -20] }] },
      { id: 'blizzard', weight: 4, title: 'Blizzard', tone: 'bad',
        text: 'A blizzard howls down the mountain. You huddle in the wagon for {days} days.',
        when: { maxTemp: 25 }, effects: [{ op: 'days', amount: [1, 3] }, { op: 'health', who: 'all', amount: [-6, -2] }] },
      { id: 'berries', weight: 2, title: 'Wild fruit', tone: 'good',
        text: 'You found bushes heavy with wild berries and gathered {amount} {item}.',
        when: { months: [6, 7, 8, 9] }, effects: [{ op: 'item', item: 'food', amount: [20, 50] }] },
      { id: 'abandoned', weight: 2, title: 'Abandoned wagon', tone: 'good',
        text: 'You came across an abandoned wagon and salvaged {amount} {item}.',
        effects: [{ op: 'item', item: 'food', amount: [30, 90] }] },
      { id: 'abandoned-clothes', weight: 1, title: 'Abandoned wagon', tone: 'good',
        text: 'Someone lightened their load beside the trail. You picked up {amount} {item}.',
        effects: [{ op: 'item', item: 'clothing', amount: [1, 3] }] },
      { id: 'kind-stranger', weight: 1, title: 'A kind stranger', tone: 'good',
        text: 'A returning trapper shared a sack of jerky with you: {amount} {item}.',
        effects: [{ op: 'item', item: 'food', amount: [25, 60] }] },
      // ----- only on the Columbia River raft -----
      { id: 'raft-rocks', weight: 3, title: 'Rapids!', tone: 'bad',
        text: 'The raft slammed into rocks in the rapids. You lost {amount} {item} overboard.',
        when: { terrain: ['river'], needs: { food: 20 } }, effects: [{ op: 'itemPct', item: 'food', pct: [15, 40] }] },
      { id: 'raft-overboard', weight: 2, title: 'Overboard!', tone: 'bad',
        text: '{name} was thrown into the icy Columbia and barely pulled out alive.',
        when: { terrain: ['river'] }, effects: [{ op: 'health', who: 'one', amount: [-35, -15] }] },
      { id: 'raft-calm', weight: 2, title: 'Smooth water', tone: 'good',
        text: 'A long, calm stretch of river. Everyone rests while the current does the work.',
        when: { terrain: ['river'] }, effects: [{ op: 'health', who: 'all', amount: [3, 6] }] },
    ],

    // ---------- Hunting ----------
    hunting: { seconds: 25, carry: 100 },
    animals: [
      { id: 'squirrel', emoji: '🐿️', name: 'squirrel', lbs: [1, 2], speed: [180, 260], size: 1.6, weight: 4 },
      { id: 'rabbit', emoji: '🐇', name: 'rabbit', lbs: [2, 4], speed: [200, 300], size: 2, weight: 4 },
      { id: 'deer', emoji: '🦌', name: 'deer', lbs: [40, 70], speed: [140, 220], size: 3.2, weight: 3 },
      { id: 'bison', emoji: '🦬', name: 'bison', lbs: [300, 800], speed: [60, 110], size: 4.4, weight: 2, terrains: ['plains', 'hills'] },
      { id: 'bear', emoji: '🐻', name: 'bear', lbs: [100, 300], speed: [90, 140], size: 3.6, weight: 1, terrains: ['hills', 'mountains'] },
    ],

    // ---------- The trail ----------
    // Each node lists where you can go next. Two or more options = a fork.
    trail: {
      start: 'independence',
      nodes: [
        { id: 'independence', name: 'Independence, Missouri', short: 'Independence', type: 'start', store: { priceFactor: 1 },
          blurb: 'The jumping-off point. Wagons crowd every street, and the air smells of dust and new canvas.',
          talk: [
            ['Ada Hollis, storekeeper', 'Buy your spare parts here. A wheel costs ten dollars in Missouri and a fortune past Fort Laramie.'],
            ['A nervous father', 'They say one grave every eighty yards, all the way to Oregon. I try not to think on it.'],
          ],
          next: [{ to: 'kansas', miles: 102, terrain: 'plains' }] },
        { id: 'kansas', name: 'Kansas River Crossing', short: 'Kansas R.', type: 'river',
          blurb: 'The Kansas runs wide and muddy here. A ferry works the crossing for those who can pay.',
          river: { name: 'Kansas River', width: [600, 700], depth: [2.2, 4.5], swift: 0.25, ferry: { cost: 5, wait: [1, 3] } },
          talk: [
            ['Ferryman', 'Five dollars and my boat takes you across dry. Or save your money and swim your cattle, your choice.'],
            ['A muddy teamster', 'Forded it yesterday. Lost a barrel of flour and nearly lost my boy.'],
          ],
          next: [{ to: 'bigblue', miles: 83, terrain: 'plains' }] },
        { id: 'bigblue', name: 'Big Blue River Crossing', short: 'Big Blue', type: 'river',
          blurb: 'A smaller river with steep banks. No ferry here. You will have to manage on your own.',
          river: { name: 'Big Blue River', width: [180, 260], depth: [1.6, 3.8], swift: 0.35 },
          talk: [
            ['An old scout', 'Look at the water, not the width. Anything over three feet, you caulk the wagon and float it.'],
          ],
          next: [{ to: 'kearney', miles: 119, terrain: 'plains' }] },
        { id: 'kearney', name: 'Fort Kearney', short: 'Ft. Kearney', type: 'fort', store: { priceFactor: 1.25 },
          blurb: 'An Army post on the Platte River. Sod buildings, a flag, and the last real store for a long while.',
          talk: [
            ['Sergeant Pruitt', 'Follow the Platte. It\'s a mile wide and an inch deep, but it\'ll lead you straight to the mountains.'],
            ['A schoolteacher', 'I keep a diary. Yesterday I wrote "buffalo" eleven times.'],
          ],
          next: [{ to: 'chimney', miles: 250, terrain: 'plains' }] },
        { id: 'chimney', name: 'Chimney Rock', short: 'Chimney Rock', type: 'landmark',
          blurb: 'A spire of clay and sandstone rising hundreds of feet above the plain. Travelers can see it for days before they reach it.',
          talk: [
            ['A girl carving her name', 'Everybody writes their name on it. Mine will be here forever!'],
            ['A tired mother', 'We\'ve seen that rock for three days now. I swear it isn\'t getting any closer.'],
          ],
          next: [{ to: 'laramie', miles: 86, terrain: 'plains' }] },
        { id: 'laramie', name: 'Fort Laramie', short: 'Ft. Laramie', type: 'fort', store: { priceFactor: 1.5 },
          blurb: 'A trading post with thick adobe walls. Past here the land climbs toward the Rockies.',
          talk: [
            ['A blacksmith', 'Half the wagons that come through here need iron work. The other half need it and don\'t know yet.'],
            ['A trapper', 'Lighten your load before the mountains. Folks leave pianos and stoves along the trail.'],
          ],
          next: [{ to: 'indrock', miles: 190, terrain: 'hills' }] },
        { id: 'indrock', name: 'Independence Rock', short: 'Indep. Rock', type: 'landmark',
          blurb: 'A great granite dome. Reach it by the Fourth of July and you\'re on schedule to beat the snows.',
          talk: [
            ['A preacher', 'I preached from the top of the rock this morning. Fine acoustics, poor attendance.'],
            ['A young man', 'What\'s the date? If we\'re late, we\'re late. No use fretting.'],
          ],
          next: [{ to: 'southpass', miles: 102, terrain: 'hills' }] },
        { id: 'southpass', name: 'South Pass', short: 'South Pass', type: 'landmark',
          blurb: 'A broad, gentle saddle across the Continental Divide. From here, the rivers run toward the Pacific.',
          forkText: 'The trail divides. Which way will you go?',
          talk: [
            ['A surveyor', 'Doesn\'t look like much, does it? Yet you\'ve just crossed the spine of the continent.'],
          ],
          next: [
            { to: 'bridger', miles: 125, terrain: 'mountains', label: 'Head to Fort Bridger', note: 'The longer way, with a fort to resupply.' },
            { to: 'greenriver', miles: 57, terrain: 'mountains', label: 'Take the Sublette Cutoff', note: 'Saves days, but it is dry, and a deep river lies ahead.' },
          ] },
        { id: 'bridger', name: 'Fort Bridger', short: 'Ft. Bridger', type: 'fort', store: { priceFactor: 1.75 },
          blurb: 'A rough trading post run by mountain men. Prices are high and the coffee is worse.',
          talk: [
            ['A mountain man', 'Been out here twenty years. The mountains don\'t care how much you paid for your wagon.'],
          ],
          next: [{ to: 'soda', miles: 162, terrain: 'mountains' }] },
        { id: 'greenriver', name: 'Green River Crossing', short: 'Green R.', type: 'river',
          blurb: 'A cold, deep river. Wagons wait in line for the ferry.',
          river: { name: 'Green River', width: [350, 450], depth: [5, 12], swift: 0.6, ferry: { cost: 10, wait: [1, 4] } },
          talk: [
            ['A ferry hand', 'Nobody fords the Green. Not twice, anyhow.'],
          ],
          next: [{ to: 'soda', miles: 144, terrain: 'mountains' }] },
        { id: 'soda', name: 'Soda Springs', short: 'Soda Springs', type: 'landmark',
          blurb: 'Bubbling mineral springs. Some say the water tastes like beer. Most say it doesn\'t.',
          talk: [
            ['A doctor', 'Mineral water is good for the constitution. Don\'t drink too much of it.'],
            ['A boy', 'It fizzes! Like sarsaparilla!'],
          ],
          next: [{ to: 'forthall', miles: 57, terrain: 'hills' }] },
        { id: 'forthall', name: 'Fort Hall', short: 'Ft. Hall', type: 'fort', store: { priceFactor: 2 },
          blurb: 'A Hudson\'s Bay Company post on the Snake River plain. Some travelers turn south for California here.',
          talk: [
            ['A clerk', 'Oregon or California? Make up your mind; the line\'s behind you.'],
          ],
          next: [{ to: 'snake', miles: 182, terrain: 'hills' }] },
        { id: 'snake', name: 'Snake River Crossing', short: 'Snake R.', type: 'river',
          blurb: 'The Snake runs fast through a deep canyon. Local guides know where to cross safely.',
          river: { name: 'Snake River', width: [900, 1100], depth: [3.5, 7], swift: 0.5,
                   guide: { item: 'clothing', cost: 3, label: 'Hire a local guide', note: 'Costs 3 sets of clothing. Guides know the safe crossing.' } },
          talk: [
            ['A guide', 'Not here. Downstream there\'s an island where the water is slow. I\'ll show you, for a fair trade.'],
          ],
          next: [{ to: 'boise', miles: 114, terrain: 'hills' }] },
        { id: 'boise', name: 'Fort Boise', short: 'Ft. Boise', type: 'fort', store: { priceFactor: 2.25 },
          blurb: 'A small trading fort. The Blue Mountains rise on the horizon.',
          talk: [
            ['A trader', 'The Blues will test you. Rest your animals before you climb.'],
          ],
          next: [{ to: 'bluemtns', miles: 160, terrain: 'mountains' }] },
        { id: 'bluemtns', name: 'Blue Mountains', short: 'Blue Mtns', type: 'landmark',
          blurb: 'Dark pine forests and steep grades. The last range before the Columbia.',
          forkText: 'The trail splits on the far side of the mountains.',
          talk: [
            ['A woman mending a wheel', 'We lowered the wagons down that last slope with ropes. Lord, my arms.'],
          ],
          next: [
            { to: 'wallawalla', miles: 55, terrain: 'mountains', label: 'Detour to Fort Walla Walla', note: 'Resupply before the final push.' },
            { to: 'dalles', miles: 125, terrain: 'mountains', label: 'Press on to The Dalles', note: 'Skip the fort and save some miles.' },
          ] },
        { id: 'wallawalla', name: 'Fort Walla Walla', short: 'Ft. Walla Walla', type: 'fort', store: { priceFactor: 2.5 },
          blurb: 'A Hudson\'s Bay post where the Walla Walla River meets the Columbia.',
          talk: [
            ['A missionary', 'You\'re nearly there. Don\'t let up now.'],
          ],
          next: [{ to: 'dalles', miles: 120, terrain: 'hills' }] },
        { id: 'dalles', name: 'The Dalles', short: 'The Dalles', type: 'landmark',
          blurb: 'The end of the wagon road. Ahead lie the Cascade Mountains and the roaring Columbia River.',
          forkText: 'One last decision. How will you reach the Willamette Valley?',
          talk: [
            ['A raft builder', 'I\'ll float you down the Columbia. Fast as anything, if you mind the rapids.'],
            ['Sam Barlow\'s toll man', 'The road goes over the mountain. Slow and steep, but your feet stay dry.'],
          ],
          next: [
            { to: 'willamette', miles: 100, terrain: 'river', label: 'Raft down the Columbia River', note: 'Fast, but the rapids are dangerous.' },
            { to: 'willamette', miles: 100, terrain: 'mountains', toll: 30, label: 'Take the Barlow Toll Road', note: 'Slow, cold, steep. Toll: $30.' },
          ] },
        { id: 'willamette', name: 'Willamette Valley, Oregon', short: 'Oregon', type: 'end',
          blurb: 'Green fields, tall timber, and rich soil as far as you can see. You made it to Oregon.' },
      ],
    },

    // ---------- Misc text ----------
    text: {
      noOxen: 'You have no oxen to pull the wagon. Try trading with other travelers for an ox.',
      usedSpare: 'You replaced it with a spare.',
      noSpare: 'With no spare, it took {days} days to patch it together.',
      noTrade: 'No one along the trail wants to trade today.',
      ferryOk: 'You waited {days} days for your turn, and the ferry carried you safely across.',
      guideOk: 'The guide led you to a shallow crossing and you made it across without trouble.',
      fordOk: 'You forded the river safely.',
      fordWet: 'The water was deep, but you made it across. Your supplies got wet, and you lost a day drying them.',
      caulkOk: 'You caulked the wagon and floated it across without trouble.',
      capsize: 'The wagon tipped over in the current!',
      graveTitle: 'A grave by the trail',
      graveText: 'You pass a simple wooden marker. "Here lies {name}. {epitaph}"',
      win: 'Your wagon rolls into the Willamette Valley. Rain falls on green land. After everything, you are home.',
      lose: 'There is no one left to drive the wagon.',
    },

    scoring: {
      health: { good: 500, fair: 400, poor: 300, verypoor: 200 },
      wagon: 50,
      perOx: 4,
      perPart: 2,
      perClothing: 2,
      bulletsPerPoint: 50,
      foodPerPoint: 25,
      moneyPerPoint: 5,
    },

    hallOfFame: [
      { name: 'Ezra Whitlock', score: 7120, title: 'Trail Guide' },
      { name: 'Hannah Pruitt', score: 5410, title: 'Adventurer' },
      { name: 'Josiah Crane', score: 3880, title: 'Adventurer' },
      { name: 'Mabel Ostrander', score: 2250, title: 'Greenhorn' },
      { name: 'Otis Fenn', score: 1100, title: 'Greenhorn' },
    ],
    ranks: [
      { min: 6000, title: 'Trail Guide' },
      { min: 3000, title: 'Adventurer' },
      { min: 0, title: 'Greenhorn' },
    ],
  };
})(typeof window !== 'undefined' ? window : globalThis);
