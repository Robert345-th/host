const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('./db');

const ADMIN_PHONE = '0978012009';
const PHOTOS_PER_SERVICE = 5;

const CITY_COORDS = {
  Lusaka: { lat: -15.3875, lng: 28.3228 },
  Ndola: { lat: -12.9682, lng: 28.6364 },
  Kitwe: { lat: -12.8024, lng: 28.2132 },
  Livingstone: { lat: -17.8419, lng: 25.8544 },
};

const VENDORS = [
  {
    phone: '0771001001',
    name: 'Mutale Banda',
    shop: 'Mutale Catering',
    city: 'Lusaka',
    area: 'Kamwala, Lusaka',
    bio: 'Buffets and traditional menus for weddings, funerals, and office functions in Lusaka.',
  },
  {
    phone: '0771001002',
    name: 'Chanda Banda',
    shop: 'Banda Tents & Chairs',
    city: 'Kitwe',
    area: 'Parklands, Kitwe',
    bio: 'Tents, chairs, and tables for Copperbelt events. We deliver and set up.',
  },
  {
    phone: '0771001003',
    name: 'Kabwe Mwila',
    shop: 'Kabwe Sound',
    city: 'Ndola',
    area: 'Masala, Ndola',
    bio: 'DJ, PA, and stage lights for weddings and club nights around Ndola.',
  },
  {
    phone: '0771001004',
    name: 'Namwinga Phiri',
    shop: 'Namwinga Photos',
    city: 'Lusaka',
    area: 'Kabulonga, Lusaka',
    bio: 'Wedding and event photography. Full-day coverage with edited photos.',
  },
  {
    phone: '0771001005',
    name: 'Lillian Tembo',
    shop: 'Tembo Decor',
    city: 'Livingstone',
    area: 'Town Centre, Livingstone',
    bio: 'Balloon arches, table décor, and hall dressing for weddings and introductions.',
  },
  {
    phone: '0771001006',
    name: 'Gift Mwila',
    shop: 'Mwila Hire',
    city: 'Lusaka',
    area: 'Woodlands, Lusaka',
    bio: 'HiAce vans for weddings, funerals, and group trips. Driver included.',
  },
  {
    phone: '0771001007',
    name: 'Grace Mulenga',
    shop: 'Garden Events',
    city: 'Lusaka',
    area: 'Chalala, Lusaka',
    bio: 'Garden and hall venues for weddings, kitchen parties, and weekend functions.',
  },
  {
    phone: '0771001008',
    name: 'James Zulu',
    shop: 'Zulu MC',
    city: 'Kitwe',
    area: 'Nkana East, Kitwe',
    bio: 'MC for weddings and corporate functions. English and local languages.',
  },
  {
    phone: '0771001009',
    name: 'Mary Chileshe',
    shop: 'Chileshe Cakes',
    city: 'Ndola',
    area: 'Kansenshi, Ndola',
    bio: 'Wedding cakes, birthday cakes, and cupcake platters. Made to order.',
  },
];

const CATALOG = [
  {
    phone: '0771001001',
    category: 'Catering',
    title: 'Wedding buffet catering',
    price: 8500,
    city: 'Lusaka',
    description:
      'Buffet for about 100 guests. Chicken, beef stew, nshima, rice, and salads. Chafing dishes and serving staff included. Lusaka only.',
    photos: [
      'Chafing_dish.jpg',
      'Chafing_Dish_MET_DP216624.jpg',
      'Ugali.jpg',
      'Grilled_chicken.jpg',
      'Samosas.jpg',
    ],
  },
  {
    phone: '0771001001',
    category: 'Catering',
    title: 'Traditional nshima catering',
    price: 4200,
    city: 'Lusaka',
    description:
      'Nshima, relish, and vegetables for family gatherings and funerals. We cook on site or deliver in warmers. From 50 plates.',
    photos: [
      'Ugali.jpg',
      'Grilled_chicken.jpg',
      'Chafing_dish.jpg',
      'Samosas.jpg',
      'Spring_rolls.jpg',
    ],
  },
  {
    phone: '0771001001',
    category: 'Catering',
    title: 'Corporate lunch catering',
    price: 2800,
    city: 'Lusaka',
    description:
      'Packed or buffet lunch for offices and workshops. Chicken, rice, salad, and a drink. Minimum 20 people. Same-day if you call early.',
    photos: [
      'Grilled_chicken.jpg',
      'Spring_rolls.jpg',
      'Samosas.jpg',
      'Chafing_dish.jpg',
      'Ugali.jpg',
    ],
  },
  {
    phone: '0771001001',
    category: 'Catering',
    title: 'Starter platters',
    price: 950,
    city: 'Lusaka',
    description:
      'Samosas, spring rolls, and chicken bites for kitchen parties and meetings. Tray feeds about 15 people.',
    photos: [
      'Samosas.jpg',
      'Spring_rolls.jpg',
      'Grilled_chicken.jpg',
      'Chafing_dish.jpg',
      'Ugali.jpg',
    ],
  },
  {
    phone: '0771001002',
    category: 'Tents & Chairs',
    title: 'White party tent, 100 guests',
    price: 4500,
    city: 'Kitwe',
    description:
      'White tent for about 100 seated guests. Delivery and setup on the Copperbelt. Pegs and side walls included.',
    photos: [
      'Party_Tent.JPG',
      'Party_tent.jpg',
      'New_Party_Tent.jpg',
      'Pagoda_tent.jpg',
      'Empty_Service_Desk_Tent_after_Event_20140607.jpg',
    ],
  },
  {
    phone: '0771001002',
    category: 'Tents & Chairs',
    title: 'Chiavari chairs hire',
    price: 1800,
    city: 'Kitwe',
    description:
      'Chiavari chairs for the high table and guests. Price is for 50 chairs, delivered and collected after the event.',
    photos: [
      'Imported_Chiavari_Chair.jpg',
      'Chivari_Fruitwood_Ballroom_Chairs.JPG',
      'Sedia_di_Chiavari_Gaetano_descalzi.JPG',
      'Despliegue_de_sillas_plegables_de_madera.jpg',
      'Round_table.jpg',
    ],
  },
  {
    phone: '0771001002',
    category: 'Tents & Chairs',
    title: 'Tent and chairs package',
    price: 6200,
    city: 'Kitwe',
    description:
      'Tent, 80 chairs, and 10 tables. We set up the day before if the ground is ready. Kitwe, Ndola, and Chingola.',
    photos: [
      'Party_tent.jpg',
      'Party_Tent.JPG',
      'Imported_Chiavari_Chair.jpg',
      'New_Party_Tent.jpg',
      'Interconnecting_Canopy_Tent.JPG',
    ],
  },
  {
    phone: '0771001002',
    category: 'Tents & Chairs',
    title: 'Pagoda tent',
    price: 2200,
    city: 'Kitwe',
    description:
      'Small pagoda tent for a cake table, registration, or outdoor serving. Easy to place on a lawn.',
    photos: [
      'Pagoda_tent.jpg',
      'Gazebo&Pagoda_tent.jpg',
      'Canopy_Tent_Walkway.JPG',
      'Party_tent.jpg',
      'Aldenham_Country_Park_event_field_with_Kayam_tent.jpg',
    ],
  },
  {
    phone: '0771001002',
    category: 'Tents & Chairs',
    title: 'Folding chairs hire',
    price: 900,
    city: 'Ndola',
    description:
      'Plastic and wooden folding chairs. Price covers 50 chairs. Good for church, funerals, and backyard events.',
    photos: [
      'Despliegue_de_sillas_plegables_de_madera.jpg',
      'Imported_Chiavari_Chair.jpg',
      'Chivari_Fruitwood_Ballroom_Chairs.JPG',
      'Round_table.jpg',
      'Party_tent.jpg',
    ],
  },
  {
    phone: '0771001003',
    category: 'DJ & Sound',
    title: 'Wedding DJ package',
    price: 3500,
    city: 'Ndola',
    description:
      'DJ for the ceremony and reception. Mixer, two speakers, and wireless mics. We play your song list.',
    photos: [
      'DJM_350.jpg',
      'Pioneer_DJM-350_20181003.jpg',
      'DJ_Mixer.JPG',
      'Pioneer_DJM900_Nexus_DJ_Mixer_tweaked_(2015-04-25_by_Aurélien)_pixabay.jpg',
      'Pink_and_blue_stage_lighting.jpg',
    ],
  },
  {
    phone: '0771001003',
    category: 'DJ & Sound',
    title: 'PA speakers hire',
    price: 1500,
    city: 'Ndola',
    description:
      'Two PA speakers and a mixer for a small hall or outdoor MC. You can use your own DJ or ours.',
    photos: [
      'Pioneer_DJM-350_20181003.jpg',
      'Pioneer_DJM2000_Nexus_DJ_Mixer_-_B&W_right_(2015-04-12_by_Aurélien)_pixabay_-_720589.jpg',
      'DJM_350.jpg',
      'DJ_Mixer.JPG',
      'Pioneer_SVM-1000_DVJ_mixer_(rear).jpg',
    ],
  },
  {
    phone: '0771001003',
    category: 'DJ & Sound',
    title: 'Stage lighting',
    price: 1800,
    city: 'Ndola',
    description:
      'Wash lights and uplighting for a hall or outdoor stage. We set the colours to match your décor.',
    photos: [
      'Pink_and_blue_stage_lighting.jpg',
      'Stage_light.jpg',
      'Uplighting_(9321907373).jpg',
      'Stage_curtains.jpg',
      'DJ_Mixer.JPG',
    ],
  },
  {
    phone: '0771001003',
    category: 'DJ & Sound',
    title: 'DJ mixer hire',
    price: 800,
    city: 'Kitwe',
    description:
      'Pioneer-style mixer for DJs who already have speakers. Collect in Ndola or we deliver on the Copperbelt.',
    photos: [
      'DJ_Mixer.JPG',
      'DJM_350.jpg',
      'Pioneer_DJM-350_20181003.jpg',
      'Pioneer_SVM-1000_DVJ_mixer_(rear).jpg',
      'Pioneer_DJM900_Nexus_DJ_Mixer_tweaked_(2015-04-25_by_Aurélien)_pixabay.jpg',
    ],
  },
  {
    phone: '0771001004',
    category: 'Photography',
    title: 'Wedding photography',
    price: 6500,
    city: 'Lusaka',
    description:
      'Full-day wedding coverage. Ceremony, portraits, and reception. Edited photos sent within two weeks.',
    photos: [
      'Canon_EOS_7D.jpg',
      'Canon_EOS_7D_DSLR_body_front.jpg',
      'Canon_EOS_5D.jpg',
      'Nikon_D850.jpg',
      'Camera_tripod.jpg',
    ],
  },
  {
    phone: '0771001004',
    category: 'Photography',
    title: 'Event coverage',
    price: 2800,
    city: 'Lusaka',
    description:
      'Half-day coverage for kitchen parties, birthdays, and corporate events. You get a gallery of edited photos.',
    photos: [
      'Canon_EOS_5D.jpg',
      'Canon_EOS_5D_Mark_IV_(Front),_1803241116,_ako.jpg',
      'Canon_EOS_7D.jpg',
      'Canon_EOS_R5_Mark_II_(front,_no_body_cap).jpg',
      'Camera_tripod.jpg',
    ],
  },
  {
    phone: '0771001004',
    category: 'Photography',
    title: 'Camera package',
    price: 1500,
    city: 'Lusaka',
    description:
      'DSLR body and lens for a day if you already have a photographer. Collect in Kabulonga. Deposit required.',
    photos: [
      'Nikon_D850.jpg',
      'Canon_EOS_300D_digital_SLR_camera_(body).jpg',
      'Canon_EOS_7D_DSLR_body_back.jpg',
      'Canon_EOS_7D_DSLR_body_front_cap.jpg',
      'Camera_tripod.jpg',
    ],
  },
  {
    phone: '0771001005',
    category: 'Decor',
    title: 'Balloon arch',
    price: 1200,
    city: 'Livingstone',
    description:
      'Organic balloon arch for the entrance or photo corner. Colours to match your theme. Setup on the day.',
    photos: [
      'Organic_Arch_2016_balloon_decorations.jpg',
      'Balloon_arch.jpg',
      'Kalp_Balon_Süsleme_Örneği.JPG',
      'Flower_arrangement.jpg',
      'Legant_table_setting_with_white_floral_centerpiece.jpg',
    ],
  },
  {
    phone: '0771001005',
    category: 'Decor',
    title: 'Table centrepieces',
    price: 900,
    city: 'Livingstone',
    description:
      'Flower and candle centrepieces for the high table and guest tables. Price is for 10 tables.',
    photos: [
      'Flower_arrangement.jpg',
      'Legant_table_setting_with_white_floral_centerpiece.jpg',
      'Round_table.jpg',
      'Organic_Arch_2016_balloon_decorations.jpg',
      'Cupcakes.jpg',
    ],
  },
  {
    phone: '0771001005',
    category: 'Decor',
    title: 'Hall balloon décor',
    price: 2500,
    city: 'Livingstone',
    description:
      'Balloon columns, backdrop, and table clusters for a hall. Livingstone and nearby lodges.',
    photos: [
      'Kalp_Balon_Süsleme_Örneği.JPG',
      'Organic_Arch_2016_balloon_decorations.jpg',
      'Balloon_arch.jpg',
      'Stage_curtains.jpg',
      'Flower_arrangement.jpg',
    ],
  },
  {
    phone: '0771001005',
    category: 'Decor',
    title: 'High table setting',
    price: 1600,
    city: 'Livingstone',
    description:
      'Cloth, runner, flowers, and place setting for the high table. We dress it before guests arrive.',
    photos: [
      'Legant_table_setting_with_white_floral_centerpiece.jpg',
      'Round_table.jpg',
      'Flower_arrangement.jpg',
      'Kalp_Balon_Süsleme_Örneği.JPG',
      'Wedding_Cake_-_White_and_Blue.jpg',
    ],
  },
  {
    phone: '0771001006',
    category: 'Cars for Hire',
    title: 'HiAce 14 seater',
    price: 1800,
    city: 'Lusaka',
    description:
      '14-seater HiAce with driver for weddings, funerals, and airport groups. Fuel for Lusaka trips included. Daily rate.',
    photos: [
      'Toyota_HiAce.jpg',
      '2003_Toyota_HiAce_Commuter_Van.jpg',
      "Toyota_HiAce_Van_DX_'20_(1).jpg",
      'Toyota_HiAce_(H200)_cargo_van_delivery_van_in_Japan.jpg',
      'Toyota_HiAce_Commuter_(H200)_mid_roof_window_van_in_Japan.jpg',
    ],
  },
  {
    phone: '0771001006',
    category: 'Cars for Hire',
    title: 'Commuter van hire',
    price: 1500,
    city: 'Lusaka',
    description:
      'Commuter van for church trips and family events. Driver stays with the vehicle. Extra for the Copperbelt.',
    photos: [
      '2003_Toyota_HiAce_Commuter_Van.jpg',
      'Toyota_HiAce_Commuter_(H200)_mid_roof_window_van_in_Japan.jpg',
      'Toyota_HiAce.jpg',
      'Toyota_HiAce_Rear_1991.jpg',
      "Toyota_HiAce_Van_DX_'20_(1).jpg",
    ],
  },
  {
    phone: '0771001006',
    category: 'Cars for Hire',
    title: 'Wedding van hire',
    price: 2200,
    city: 'Lusaka',
    description:
      'Clean HiAce for the bridal party. Decorated on request. Morning to evening in Lusaka.',
    photos: [
      "Toyota_HiAce_Van_DX_'20_(1).jpg",
      'Toyota_HiAce.jpg',
      'Toyota_HiAce_(H200)_cargo_van_delivery_van_in_Japan.jpg',
      '2003_Toyota_HiAce_Commuter_Van.jpg',
      'Toyota_HiAce_Rear_1991.jpg',
    ],
  },
  {
    phone: '0771001007',
    category: 'Venues',
    title: 'Garden venue, day hire',
    price: 7500,
    city: 'Lusaka',
    description:
      'Garden lawn and gazebo for a daytime wedding or kitchen party. Parking on site. You bring your own caterer.',
    photos: [
      'Colonial_Garden_gazebo_NBG_LR.jpg',
      '2019_Japanese_Garden_Moscow_gazebo_01.jpg',
      'Empty_beds,_main_lawn,_Jephson_Gardens_-_geograph.org.uk_-_3264188.jpg',
      'Gazebo.jpg',
      'Pagoda_tent.jpg',
    ],
  },
  {
    phone: '0771001007',
    category: 'Venues',
    title: 'Hall hire with chairs',
    price: 5500,
    city: 'Lusaka',
    description:
      'Indoor hall with chairs facing the front. Good for introductions, church, and year-end functions. Sound extra.',
    photos: [
      'DZ6_0468_Spacious_elegantly_lit_banquet_hall_set_up_with_rows_of_white-covered_chairs_facing_a_stage_ready_for_a_large_conference_or_formal_event.jpg',
      'Stage_curtains.jpg',
      'Round_table.jpg',
      'Empty_stage.jpg',
      'Colonial_Garden_gazebo_NBG_LR.jpg',
    ],
  },
  {
    phone: '0771001007',
    category: 'Venues',
    title: 'Weekend garden package',
    price: 12000,
    city: 'Lusaka',
    description:
      'Friday setup, Saturday event, Sunday pack-down. Garden, power, and toilets. Sleeps none — day venue only.',
    photos: [
      '2019_Japanese_Garden_Moscow_gazebo_01.jpg',
      'Colonial_Garden_gazebo_NBG_LR.jpg',
      'Gazebo.jpg',
      'Empty_beds,_main_lawn,_Jephson_Gardens_-_geograph.org.uk_-_3264188.jpg',
      'A_marquee-hirer\'s_marquee_-_geograph.org.uk_-_7742488.jpg',
    ],
  },
  {
    phone: '0771001007',
    category: 'Venues',
    title: 'Open lawn venue',
    price: 3800,
    city: 'Lusaka',
    description:
      'Open lawn if you are bringing your own tent. Water point and parking. Chalala area.',
    photos: [
      'Empty_beds,_main_lawn,_Jephson_Gardens_-_geograph.org.uk_-_3264188.jpg',
      'Gazebo.jpg',
      'Colonial_Garden_gazebo_NBG_LR.jpg',
      'Aldenham_Country_Park_event_field_with_Kayam_tent.jpg',
      'Party_tent.jpg',
    ],
  },
  {
    phone: '0771001008',
    category: 'MC & Entertainment',
    title: 'Wedding MC',
    price: 2500,
    city: 'Kitwe',
    description:
      'MC for the ceremony and reception. English, Bemba, and Nyanja. I work with your programme, not against it.',
    photos: [
      'Microphone_on_stand_in_front_of_blurry_background.jpg',
      'Shure_SM58.jpg',
      'Desktop_microphone_stand.jpg',
      'Shure_SM57_microphone.jpg',
      'Tripod_microphone_stand.jpg',
    ],
  },
  {
    phone: '0771001008',
    category: 'MC & Entertainment',
    title: 'MC and PA package',
    price: 3800,
    city: 'Kitwe',
    description:
      'MC plus a small PA and two mics. Enough for a backyard wedding or office function if the crowd is under 150.',
    photos: [
      'Shure_SM58.jpg',
      'Shure_Wireless_Microphone_SM58.jpg',
      'Microphone_on_stand_in_front_of_blurry_background.jpg',
      'AKG_C214_Condenser_microphone.jpg',
      'DJM_350.jpg',
    ],
  },
  {
    phone: '0771001008',
    category: 'MC & Entertainment',
    title: 'Corporate function MC',
    price: 1800,
    city: 'Ndola',
    description:
      'MC for launches, year-end parties, and award nights. I keep the programme on time.',
    photos: [
      'Stage_curtains.jpg',
      'Empty_stage.jpg',
      'Microphone_on_stand_in_front_of_blurry_background_crop.jpg',
      'Shure_MV7_microphone.jpg',
      'Realistic_desk_microphone_stand.jpg',
    ],
  },
  {
    phone: '0771001009',
    category: 'Cakes & Baking',
    title: 'Wedding cake',
    price: 1800,
    city: 'Ndola',
    description:
      'Two-tier wedding cake. Vanilla or chocolate, buttercream finish. We deliver in Ndola on the event day.',
    photos: [
      'Wedding_Cake_-_White_and_Blue.jpg',
      'Wedding_cake_with_pillars_and_floral_decoration.jpg',
      'Hochzeitstorte.jpg',
      'Wedding_Cake_with_cake_topper.jpeg',
      'Cupcakes.jpg',
    ],
  },
  {
    phone: '0771001009',
    category: 'Cakes & Baking',
    title: 'Birthday cake',
    price: 450,
    city: 'Ndola',
    description:
      'Single-tier birthday cake. Write the name on top. Collect in Kansenshi or we deliver in Ndola for a small fee.',
    photos: [
      'Hochzeitstorte.jpg',
      'Birthday_cupcake.jpg',
      'Wedding_Cake_-_White_and_Blue.jpg',
      'Cupcakes_01.jpg',
      'Cupcakes_(26158114321).jpg',
    ],
  },
  {
    phone: '0771001009',
    category: 'Cakes & Baking',
    title: 'Cupcake platters',
    price: 380,
    city: 'Ndola',
    description:
      'Two dozen cupcakes on a tray. Mix of vanilla and chocolate. Good for office birthdays and kitchen parties.',
    photos: [
      'Cupcakes.jpg',
      'Cupcakes_01.jpg',
      'Strawberry_coconut_cupcakes_tray.jpg',
      'Cupcakes_on_a_tray_and_wood_table_(18675022382).jpg',
      'Birthday_cupcake.jpg',
    ],
  },
  {
    phone: '0771001009',
    category: 'Cakes & Baking',
    title: 'Celebration cake with pillars',
    price: 2400,
    city: 'Ndola',
    description:
      'Tall cake with pillars for a big wedding or church. Order at least five days ahead.',
    photos: [
      'Wedding_cake_with_pillars_and_floral_decoration.jpg',
      'Wedding_Cake_with_cake_topper.jpeg',
      'Wedding_Cake_-_White_and_Blue.jpg',
      'Hochzeitstorte.jpg',
      'Cupcakes.jpg',
    ],
  },
];

function phoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function isAdminPhone(phone) {
  const d = phoneDigits(phone);
  return d === '0978012009' || d === '978012009' || d === '260978012009' || d.endsWith('978012009');
}

function phoneVariants(phone) {
  let d = phoneDigits(phone);
  if (d.startsWith('260') && d.length >= 12) d = '0' + d.slice(3);
  if (d.length === 9) d = '0' + d;
  const local = d;
  const nine = local.startsWith('0') ? local.slice(1) : local;
  return [...new Set([local, nine, '260' + nine, phoneDigits(phone)].filter(Boolean))];
}

function commonsThumb(filename) {
  const file = String(filename || '').replace(/^File:/i, '');
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=960`;
}

function photoUrls(filenames) {
  const unique = [];
  for (const name of filenames || []) {
    const url = commonsThumb(name);
    if (!unique.includes(url)) unique.push(url);
  }
  if (!unique.length) return [];
  const out = unique.slice(0, PHOTOS_PER_SERVICE);
  let i = 0;
  while (out.length < PHOTOS_PER_SERVICE) {
    out.push(unique[i % unique.length]);
    i += 1;
  }
  return out;
}

function coordsFor(city) {
  return CITY_COORDS[city] || CITY_COORDS.Lusaka;
}

async function findUserByPhone(phone) {
  const variants = phoneVariants(phone);
  const result = await pool.query(
    `SELECT * FROM users
     WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = ANY($1::text[])
     ORDER BY CASE WHEN is_deleted IS TRUE THEN 1 ELSE 0 END, id
     LIMIT 1`,
    [variants]
  );
  return result.rows[0] || null;
}

async function ensureColumns() {
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_sample BOOLEAN DEFAULT false');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_vendor BOOLEAN DEFAULT false');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_status TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS business_name TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS business_bio TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS business_photo_url TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS selling_type TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_address TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS home_address TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_location_label TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS home_location_label TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT');
  await pool.query('ALTER TABLE services ADD COLUMN IF NOT EXISTS is_sample BOOLEAN DEFAULT false');
  await pool.query('ALTER TABLE services ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION');
  await pool.query('ALTER TABLE services ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION');
  await pool.query('ALTER TABLE services ADD COLUMN IF NOT EXISTS location_label TEXT');
}

async function ensureVendor(vendor) {
  if (isAdminPhone(vendor.phone) || vendor.phone === ADMIN_PHONE) {
    throw new Error('Refusing to put sample services on the admin account.');
  }
  const existing = await findUserByPhone(vendor.phone);
  if (existing && isAdminPhone(existing.phone)) {
    throw new Error(`Sample phone ${vendor.phone} matched the admin account.`);
  }
  if (existing) {
    await pool.query(
      `UPDATE users SET
         name = $1,
         phone = $2,
         phone_verified = true,
         is_deleted = false,
         deleted_at = NULL,
         is_admin = false,
         is_suspended = false,
         is_vendor = true,
         vendor_status = 'approved',
         business_name = $3,
         business_bio = $4,
         city = $5,
         country = COALESCE(country, 'ZM'),
         selling_type = COALESCE(selling_type, 'shop'),
         shop_address = COALESCE(NULLIF(BTRIM(shop_address), ''), $6),
         shop_location_label = COALESCE(NULLIF(BTRIM(shop_location_label), ''), $6),
         date_of_birth = COALESCE(date_of_birth, DATE '1990-03-14'),
         is_sample = true
       WHERE id = $7`,
      [vendor.name, vendor.phone, vendor.shop, vendor.bio, vendor.city, vendor.area, existing.id]
    );
    return existing.id;
  }

  const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
  const referralCode = 'S' + vendor.phone.slice(-6);
  const inserted = await pool.query(
    `INSERT INTO users (
        name, phone, password_hash, phone_verified, is_admin, is_vendor, vendor_status,
        business_name, business_bio, city, country, selling_type, shop_address,
        shop_location_label, date_of_birth, referral_code, is_sample
      ) VALUES (
        $1, $2, $3, true, false, true, 'approved',
        $4, $5, $6, 'ZM', 'shop', $7,
        $7, DATE '1990-03-14', $8, true
      )
      RETURNING id`,
    [
      vendor.name,
      vendor.phone,
      passwordHash,
      vendor.shop,
      vendor.bio,
      vendor.city,
      vendor.area,
      referralCode,
    ]
  );
  return inserted.rows[0].id;
}

async function categoryMap() {
  const result = await pool.query('SELECT id, name FROM categories');
  const map = new Map(result.rows.map((row) => [row.name, row.id]));
  return map;
}

async function deleteSampleDeps(serviceIds) {
  if (!serviceIds.length) return;
  await pool.query('DELETE FROM favorites WHERE service_id = ANY($1::int[])', [serviceIds]).catch(() => {});
  await pool.query('DELETE FROM reports WHERE service_id = ANY($1::int[])', [serviceIds]).catch(() => {});
  await pool.query('UPDATE messages SET service_id = NULL WHERE service_id = ANY($1::int[])', [serviceIds]).catch(() => {});
}

async function seedSampleServices() {
  await ensureColumns();

  const cats = await categoryMap();
  const missingCats = [...new Set(CATALOG.map((item) => item.category))].filter((name) => !cats.has(name));
  if (missingCats.length) {
    console.error(`Sample seed skipped missing categories: ${missingCats.join(', ')}`);
    return;
  }

  const vendorIds = {};
  for (const vendor of VENDORS) {
    vendorIds[vendor.phone] = await ensureVendor(vendor);
  }

  const admin = await findUserByPhone(ADMIN_PHONE);
  if (admin) {
    const misplaced = await pool.query(
      `SELECT id FROM services
       WHERE vendor_id = $1
         AND (is_sample = true OR vendor_id = ANY($2::int[]))`,
      [admin.id, Object.values(vendorIds)]
    );
    if (misplaced.rows.length) {
      const ids = misplaced.rows.map((row) => row.id);
      await deleteSampleDeps(ids);
      await pool.query('DELETE FROM services WHERE id = ANY($1::int[])', [ids]);
      console.log(`Removed ${ids.length} sample service(s) that were on the admin account.`);
    }
  }

  const wanted = CATALOG.map((item) => `${item.phone}::${item.title}`);
  const existing = await pool.query(
    `SELECT s.id, s.title, s.vendor_id, u.phone
     FROM services s
     JOIN users u ON u.id = s.vendor_id
     WHERE s.is_sample = true OR u.is_sample = true`
  );

  const byKey = new Map();
  for (const row of existing.rows) {
    byKey.set(`${row.phone}::${row.title}`, row);
  }

  let updated = 0;
  let added = 0;
  for (let i = 0; i < CATALOG.length; i++) {
    const item = CATALOG[i];
    const vendorId = vendorIds[item.phone];
    const key = `${item.phone}::${item.title}`;
    const place = coordsFor(item.city);
    const photos = photoUrls(item.photos);
    const params = [
      vendorId,
      item.title,
      item.description,
      item.price,
      cats.get(item.category),
      photos,
      place.lat,
      place.lng,
      item.city,
    ];
    const found = byKey.get(key);
    if (found) {
      await pool.query(
        `UPDATE services
            SET vendor_id = $1,
                title = $2,
                description = $3,
                price = $4,
                category_id = $5,
                photos = $6,
                latitude = $7,
                longitude = $8,
                location_label = $9,
                status = 'active',
                is_sample = true
          WHERE id = $10`,
        [...params, found.id]
      );
      updated += 1;
    } else {
      await pool.query(
        `INSERT INTO services (
            vendor_id, title, description, price, category_id, photos,
            status, latitude, longitude, location_label, is_sample, date_posted
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            'active', $7, $8, $9, true, NOW() - ($10 || ' minutes')::interval
          )`,
        [...params, String(12 * (i + 1))]
      );
      added += 1;
    }
  }

  const leftoverIds = existing.rows
    .filter((row) => !wanted.includes(`${row.phone}::${row.title}`))
    .map((row) => row.id);
  if (leftoverIds.length) {
    await deleteSampleDeps(leftoverIds);
    await pool.query('DELETE FROM services WHERE id = ANY($1::int[])', [leftoverIds]);
  }

  console.log(
    `Sample services ready: ${CATALOG.length} listings on ${VENDORS.length} shops (${added} added, ${updated} updated). Not on ${ADMIN_PHONE}.`
  );
}

module.exports = { seedSampleServices };
