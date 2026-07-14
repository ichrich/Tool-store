const bcrypt = require("bcryptjs");
require("dotenv").config();
const { pool } = require("../config/database");

const DEMO_PASSWORD = "Demo123abc";

const categories = [
  ["Электроинструмент", "elektroinstrument"],
  ["Ручной инструмент", "ruchnoy-instrument"],
  ["Измерительные приборы", "izmeritelnye-pribory"],
  ["Сварочное оборудование", "svarochnoe-oborudovanie"],
  ["Складская техника", "skladskaya-tehnika"],
];

const brandModels = [
  ["Bosch Professional", "GSR 18V-50"],
  ["Makita", "DDF485Z"],
  ["DeWALT", "DWE4157"],
  ["Metabo", "W 850-125"],
  ["Knipex", "Cobra 250"],
  ["Stanley", "FatMax 5m"],
  ["ADA Instruments", "Cube 3D Basic"],
  ["Fubag", "IR 200"],
  ["Ресанта", "САИ-190"],
  ["Tor", "CBY-JC 2.0"],
];

const products = [
  {
    category: "elektroinstrument",
    brand: "Bosch Professional",
    model: "GSR 18V-50",
    name: "Аккумуляторная дрель-шуруповерт Bosch Professional GSR 18V-50",
    slug: "bosch-gsr-18v-50",
    price: 21990,
    stock: 18,
    image:
      "/uploads/bosch-gsb-18v-21-professional-combi-drill-18v_min_23898_P_1",
    specs: [
      "18 В",
      "50 Нм",
      "2 скорости",
      "патрон 13 мм",
      "бесщеточный двигатель",
    ],
  },
  {
    category: "elektroinstrument",
    brand: "Makita",
    model: "DDF485Z",
    name: "Дрель-шуруповерт Makita DDF485Z без АКБ",
    slug: "makita-ddf485z",
    price: 12990,
    stock: 25,
    image: "/uploads/ddf485z_c2l0_4694a18eb4.jpg",
    specs: ["18 В", "50 Нм", "1900 об/мин", "подсветка зоны сверления"],
  },
  {
    category: "elektroinstrument",
    brand: "DeWALT",
    model: "DWE4157",
    name: "Угловая шлифмашина DeWALT DWE4157 125 мм",
    slug: "dewalt-dwe4157",
    price: 8690,
    stock: 31,
    image: "/uploads/dewalt_dwe4117-gb-b.webp",
    specs: ["900 Вт", "125 мм", "11800 об/мин", "защита от пыли"],
  },
  {
    category: "elektroinstrument",
    brand: "Metabo",
    model: "W 850-125",
    name: "Угловая шлифмашина Metabo W 850-125",
    slug: "metabo-w-850-125",
    price: 7490,
    stock: 22,
    image: "/uploads/600-21047912523.jpg.webp",
    specs: ["850 Вт", "125 мм", "11000 об/мин", "быстрая замена щеток"],
  },
  {
    category: "ruchnoy-instrument",
    brand: "Knipex",
    model: "Cobra 250",
    name: "Клещи переставные Knipex Cobra 250 мм",
    slug: "knipex-cobra-250",
    price: 4290,
    stock: 44,
    image: "/uploads/knipex_87_01_250_sb-b.webp",
    specs: [
      "250 мм",
      "25 положений",
      "хромованадиевая сталь",
      "тонкая регулировка",
    ],
  },
  {
    category: "ruchnoy-instrument",
    brand: "Stanley",
    model: "FatMax 5m",
    name: "Рулетка Stanley FatMax 5 м x 32 мм",
    slug: "stanley-fatmax-5m",
    price: 1890,
    stock: 60,
    image: "/uploads/I_3132710_COf_ProdMedium_1765431_1.jpg",
    specs: ["5 м", "лента 32 мм", "магнитный зацеп", "ударопрочный корпус"],
  },
  {
    category: "izmeritelnye-pribory",
    brand: "ADA Instruments",
    model: "Cube 3D Basic",
    name: "Лазерный уровень ADA Cube 3D Basic Edition",
    slug: "ada-cube-3d-basic",
    price: 11990,
    stock: 16,
    image: "/uploads/73e3d00bc5beef2516d6259a7ca7ff05fad0cbd4-0.jpg",
    specs: [
      "3 плоскости 360 градусов",
      "точность +/-0.3 мм/м",
      "дальность 20 м",
    ],
  },
  {
    category: "svarochnoe-oborudovanie",
    brand: "Fubag",
    model: "IR 200",
    name: "Сварочный инвертор Fubag IR 200",
    slug: "fubag-ir-200",
    price: 15490,
    stock: 14,
    image: "/uploads/7ye1e5qscgylql3ox8a5b37n3eutc5kr.webp",
    specs: ["MMA", "10-200 А", "электрод 1.6-5 мм", "горячий старт"],
  },
  {
    category: "svarochnoe-oborudovanie",
    brand: "Ресанта",
    model: "САИ-190",
    name: "Сварочный аппарат Ресанта САИ-190",
    slug: "resanta-sai-190",
    price: 8790,
    stock: 20,
    image: "/uploads/4875_big.jpg",
    specs: ["MMA", "10-190 А", "антизалипание", "защита от перегрева"],
  },
  {
    category: "skladskaya-tehnika",
    brand: "Tor",
    model: "CBY-JC 2.0",
    name: "Гидравлическая тележка Tor CBY-JC 2.0 т",
    slug: "tor-cby-jc-20",
    price: 32900,
    stock: 7,
    image: "/uploads/2773.970.jpg",
    specs: [
      "грузоподъемность 2000 кг",
      "вилы 1150 мм",
      "полиуретановые колеса",
    ],
  },
];

const drillBrandLines = [
  {
    brand: "Bosch Professional",
    slug: "bosch",
    models: [
      "GSR 12V-30",
      "GSR 18V-55",
      "GSR 18V-60 C",
      "GSR 18V-90 C",
      "GSR 12V-35 FC",
      "GSR 18V-110 C",
      "GSB 18V-50",
      "GSB 18V-90 C",
      "GSR 18V-150 C",
    ],
  },
  {
    brand: "Makita",
    slug: "makita",
    models: [
      "DDF482Z",
      "DDF484Z",
      "DDF486Z",
      "DHP482Z",
      "DHP484Z",
      "DHP486Z",
      "DF333DWYE",
      "HP333DWYE",
      "TD110DZ",
    ],
  },
  {
    brand: "DeWALT",
    slug: "dewalt",
    models: [
      "DCD771C2",
      "DCD791NT",
      "DCD796P2",
      "DCD800E2T",
      "DCD805E2T",
      "DCF887N",
      "DCF850N",
      "DCD708D2T",
      "DCD999NT",
    ],
  },
  {
    brand: "Metabo",
    slug: "metabo",
    models: [
      "BS 18 L",
      "BS 18 LT",
      "SB 18 L",
      "SB 18 LT",
      "PowerMaxx BS",
      "PowerMaxx SB",
      "BS 18 L BL",
      "SB 18 L BL",
      "BS 18 LT BL",
    ],
  },
  {
    brand: "Milwaukee",
    slug: "milwaukee",
    models: [
      "M18 BDD-0",
      "M18 BLPD2-0",
      "M18 FDD3-0",
      "M18 FPD3-0",
      "M12 BDD-202C",
      "M12 FDDXKIT-202X",
      "M18 CBLDD-0",
      "M18 CBLPD-0",
      "M18 ONEPD3-0",
    ],
  },
  {
    brand: "Ryobi",
    slug: "ryobi",
    models: [
      "R18DD3-0",
      "R18PD3-0",
      "R18DD5-0",
      "R18PD7-0",
      "RDD18C-0",
      "RPD18C-0",
      "R18DD7-0",
      "R18PDBL-0",
      "R18IDBL-0",
    ],
  },
  {
    brand: "Зубр",
    slug: "zubr",
    models: [
      "ДАИ-18-2-Ли КНМ4",
      "ДА-12-2-Ли КМ1",
      "ДАИ-20-2-Ли КНМ4",
      "ДШЛ-121",
      "ДШЛ-181",
      "ДА-14.4-2-Ли КМ2",
      "ДАИ-12-2-Ли КНМ3",
      "ДА-18-2-Ли КМ3",
      "ДАИ-18-2-Ли КМ5",
    ],
  },
  {
    brand: "Интерскол",
    slug: "interskol",
    models: [
      "ДА-10/12В",
      "ДА-13/18ВК",
      "ДАУ-13/18В",
      "ДА-12ЭР-02",
      "ДА-14.4ЭР",
      "ДА-18ЭР",
      "ША-6/10.8М3",
      "ДАУ-10/18Л2",
      "ДА-18Л2",
    ],
  },
  {
    brand: "Вихрь",
    slug: "vihr",
    models: [
      "ДА-12Л-2К",
      "ДА-14.4Л-2К",
      "ДА-18Л-2К",
      "ДА-18Л-2КА",
      "ДА-20Л-2К",
      "ДА-24Л-2К",
      "ДА-12-1",
      "ДА-18-2К",
      "ДА-18Л-2КУ",
    ],
  },
  {
    brand: "Patriot",
    slug: "patriot",
    models: [
      "BR 114Li",
      "BR 141Li",
      "BR 181Li",
      "BR 180UES",
      "BR 201UES",
      "BR 241UES",
      "FS 306",
      "THE ONE BR 181UES",
      "THE ONE BR 201UES",
    ],
  },
];

const generatedProducts = Array.from({ length: 90 }, (_, idx) => {
  const line = drillBrandLines[idx % drillBrandLines.length];
  const model = line.models[Math.floor(idx / drillBrandLines.length)];
  const volts = [12, 14.4, 18, 20, 24][idx % 5];
  const torque = 34 + (idx % 9) * 6;
  const rpm = 1350 + (idx % 7) * 150;
  const kit =
    idx % 3 === 0
      ? "с двумя аккумуляторами"
      : idx % 3 === 1
        ? "без аккумулятора"
        : "в кейсе";
  const suffix = String(idx + 1).padStart(2, "0");
  const modelSlug = model
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, "-")
    .replace(/^-|-$/g, "");

  return {
    category: "elektroinstrument",
    brand: line.brand,
    model,
    name: `Аккумуляторный шуруповерт ${line.brand} ${model} ${kit}`,
    slug: `${line.slug}-${modelSlug}-${suffix}`,
    price: 4990 + (idx % 18) * 850 + Math.floor(idx / 10) * 300,
    stock: 8 + (idx % 37),
    image: `/uploads/screwdriver-${suffix}.jpg`,
    specs: [
      `${volts} В`,
      `${torque} Нм`,
      `${rpm} об/мин`,
      "2 скорости",
      idx % 2 === 0 ? "патрон 10 мм" : "патрон 13 мм",
      idx % 4 === 0 ? "бесщеточный двигатель" : "подсветка рабочей зоны",
      kit,
    ],
  };
});

products.push(...generatedProducts);

const demoUsers = [
  { email: "buyer1@local.test", first_name: "Алексей", last_name: "Смирнов" },
  { email: "buyer2@local.test", first_name: "Мария", last_name: "Козлова" },
  { email: "buyer3@local.test", first_name: "Дмитрий", last_name: "Волков" },
];

async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL || "admin@telega.local";
  const password = process.env.ADMIN_PASSWORD || "ChangeMe123!";
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.ADMIN_PASSWORD || password.length < 12)
  ) {
    throw new Error(
      "Для production задайте ADMIN_PASSWORD длиной не менее 12 символов",
    );
  }
  const [users] = await pool.query("SELECT id FROM users WHERE email = ?", [
    email,
  ]);
  if (users.length) return users[0].id;
  const hash = await bcrypt.hash(password, 12);
  const [res] = await pool.query(
    "INSERT INTO users (email, password_hash, role, first_name, last_name) VALUES (?, ?, ?, ?, ?)",
    [email, hash, "admin", "Иван", "Администраторов"],
  );
  return res.insertId;
}

async function ensureUser(user) {
  const [rows] = await pool.query("SELECT id FROM users WHERE email = ?", [
    user.email,
  ]);
  if (rows.length) return rows[0].id;
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const [res] = await pool.query(
    `INSERT INTO users (email, password_hash, role, first_name, last_name, phone)
     VALUES (?, ?, 'user', ?, ?, ?)`,
    [user.email, hash, user.first_name, user.last_name, "+79990000000"],
  );
  return res.insertId;
}

async function ensureCategoryMap() {
  for (const [name, slug] of categories) {
    await pool.query(
      "INSERT IGNORE INTO categories (name, slug) VALUES (?, ?)",
      [name, slug],
    );
  }
  const [rows] = await pool.query("SELECT id, slug FROM categories");
  return Object.fromEntries(rows.map((r) => [r.slug, r.id]));
}

async function ensureCategoryRecommendations(categoryMap) {
  const pairs = [
    ["elektroinstrument", "ruchnoy-instrument"],
    ["elektroinstrument", "izmeritelnye-pribory"],
    ["ruchnoy-instrument", "elektroinstrument"],
    ["svarochnoe-oborudovanie", "izmeritelnye-pribory"],
    ["skladskaya-tehnika", "ruchnoy-instrument"],
  ];

  for (const [sourceSlug, recommendedSlug] of pairs) {
    const sourceId = categoryMap[sourceSlug];
    const recommendedId = categoryMap[recommendedSlug];
    if (!sourceId || !recommendedId || sourceId === recommendedId) continue;
    await pool.query(
      `INSERT IGNORE INTO category_recommendations (category_id, recommended_category_id)
       VALUES (?, ?)`,
      [sourceId, recommendedId],
    );
  }
}

async function ensureBrandModelMap() {
  const map = new Map();
  const pairs = new Map();
  for (const [brandName, modelName] of brandModels) {
    pairs.set(`${brandName}|${modelName}`, [brandName, modelName]);
  }
  for (const product of products) {
    pairs.set(`${product.brand}|${product.model}`, [
      product.brand,
      product.model,
    ]);
  }
  for (const [brandName, modelName] of pairs.values()) {
    const brandSlug = brandName
      .toLowerCase()
      .replace(/[^a-zа-я0-9]+/gi, "-")
      .replace(/^-|-$/g, "");
    await pool.query("INSERT IGNORE INTO brands (name, slug) VALUES (?, ?)", [
      brandName,
      brandSlug,
    ]);
    const [[brand]] = await pool.query("SELECT id FROM brands WHERE name = ?", [
      brandName,
    ]);
    const modelSlug = modelName
      .toLowerCase()
      .replace(/[^a-zа-я0-9]+/gi, "-")
      .replace(/^-|-$/g, "");
    await pool.query(
      "INSERT IGNORE INTO brand_models (brand_id, name, slug) VALUES (?, ?, ?)",
      [brand.id, modelName, modelSlug],
    );
    const [[model]] = await pool.query(
      "SELECT id FROM brand_models WHERE brand_id = ? AND name = ?",
      [brand.id, modelName],
    );
    map.set(`${brandName}|${modelName}`, model.id);
  }
  return map;
}

function descriptionFor(product) {
  return [
    `${product.name} подходит для регулярной работы в мастерской, на объекте и в сервисной зоне.`,
    "",
    "Характеристики:",
    ...product.specs.map((s) => `- ${s}`),
    "",
    "Комплектация и внешний вид могут отличаться в зависимости от партии.",
  ].join("\n");
}

async function ensureProducts(categoryMap, modelMap) {
  for (const p of products) {
    await pool.query(
      `INSERT INTO products (category_id, brand_model_id, name, slug, description, price, image_path, stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         category_id = VALUES(category_id),
         brand_model_id = VALUES(brand_model_id),
         name = VALUES(name),
         description = VALUES(description),
         price = VALUES(price),
         image_path = VALUES(image_path),
         stock = VALUES(stock),
         is_deleted = 0,
         deleted_at = NULL`,
      [
        categoryMap[p.category],
        modelMap.get(`${p.brand}|${p.model}`),
        p.name,
        p.slug,
        descriptionFor(p),
        p.price,
        p.image,
        p.stock,
      ],
    );
  }
}

async function ensureOrdersAndReviews(userIds) {
  const [existing] = await pool.query(
    "SELECT id FROM orders WHERE customer_email = 'buyer1@local.test' LIMIT 1",
  );
  if (existing.length) return;

  const [rows] = await pool.query(
    "SELECT id, name, price FROM products WHERE is_deleted = 0 ORDER BY id ASC LIMIT 6",
  );
  for (let i = 0; i < userIds.length; i += 1) {
    const p1 = rows[i * 2];
    const p2 = rows[i * 2 + 1];
    const total = Number(p1.price) + Number(p2.price);
    const [order] = await pool.query(
      `INSERT INTO orders
       (user_id, status, customer_name, customer_email, customer_phone, address, payment_method, payment_status, delivery_time, total_amount)
       VALUES (?, 'delivered', ?, ?, '+79990000000', ?, 'cash', 'paid', DATE_ADD(NOW(), INTERVAL 2 DAY), ?)`,
      [
        userIds[i],
        demoUsers[i].first_name,
        demoUsers[i].email,
        `г. Иркутск, ул. Промышленная, ${10 + i}`,
        total,
      ],
    );
    await pool.query(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price, product_name_snapshot)
       VALUES (?, ?, 1, ?, ?), (?, ?, 1, ?, ?)`,
      [
        order.insertId,
        p1.id,
        p1.price,
        p1.name,
        order.insertId,
        p2.id,
        p2.price,
        p2.name,
      ],
    );
    const [review] = await pool.query(
      `INSERT INTO reviews (product_id, user_id, rating, body, status)
       VALUES (?, ?, ?, ?, 'approved')`,
      [
        p1.id,
        userIds[i],
        i === 1 ? 4 : 5,
        `Покупали ${p1.name} для бригады. Работает стабильно, цена адекватная.`,
      ],
    );
    if (i !== 1) {
      await pool.query(
        "INSERT INTO review_images (review_id, image_path, sort_order) VALUES (?, ?, 0)",
        [review.insertId, `/uploads/review-${p1.id}.jpg`],
      );
    }
  }
}

async function ensureArticle(adminId) {
  const [[exists]] = await pool.query(
    "SELECT id FROM articles WHERE slug = 'kak-vybrat-shurupovert'",
  );
  if (exists) return;
  const [[p1]] = await pool.query(
    "SELECT id FROM products WHERE slug = 'bosch-gsr-18v-50'",
  );
  const [[p2]] = await pool.query(
    "SELECT id FROM products WHERE slug = 'makita-ddf485z'",
  );
  const [article] = await pool.query(
    `INSERT INTO articles (author_user_id, author_name, title, slug, published)
     VALUES (?, 'Иван Петров', 'Как выбрать шуруповерт для монтажной бригады', 'kak-vybrat-shurupovert', 1)`,
    [adminId],
  );
  await pool.query(
    `INSERT INTO article_blocks (article_id, product_id, block_type, body, sort_order) VALUES
     (?, NULL, 'text', ?, 0),
     (?, ?, 'product', NULL, 1),
     (?, NULL, 'text', ?, 2),
     (?, ?, 'product', NULL, 3),
     (?, NULL, 'image', '/uploads/article-tools-workbench.jpg', 4)`,
    [
      article.insertId,
      "Для ежедневного монтажа важнее не максимальная мощность, а баланс крутящего момента, веса, патрона и доступности аккумуляторов.",
      article.insertId,
      p1.id,
      article.insertId,
      "Если инструмент нужен как универсальный рабочий вариант, сравните запас момента, эргономику и наличие сервиса в городе.",
      article.insertId,
      p2.id,
      article.insertId,
    ],
  );
}

async function ensureDiscount() {
  await pool.query(
    `INSERT IGNORE INTO discount_codes (code, type, value, scope, min_order_amount, max_uses, is_active)
     VALUES ('TOOLS10', 'percent', 10, 'global', 10000, 1000, 1)`,
  );
}

async function run() {
  const adminId = await ensureAdmin();
  const categoryMap = await ensureCategoryMap();
  await ensureCategoryRecommendations(categoryMap);
  const modelMap = await ensureBrandModelMap();
  await ensureProducts(categoryMap, modelMap);
  const userIds = [];
  for (const user of demoUsers) userIds.push(await ensureUser(user));
  await ensureOrdersAndReviews(userIds);
  await ensureArticle(adminId);
  await ensureDiscount();
  const [[{ c }]] = await pool.query(
    "SELECT COUNT(*) AS c FROM products WHERE is_deleted = 0",
  );
  console.log(`Seed complete. Products: ${c}. Demo password: ${DEMO_PASSWORD}`);
  await pool.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
