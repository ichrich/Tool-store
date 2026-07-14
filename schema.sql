-- Telega — MySQL schema v2 (utf8mb4)
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS review_reports;
DROP TABLE IF EXISTS review_images;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS vk_link_codes;
DROP TABLE IF EXISTS unblock_appeals;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS user_suspensions;
DROP TABLE IF EXISTS promotion_usages;
DROP TABLE IF EXISTS promotions;
DROP TABLE IF EXISTS discount_scope_products;
DROP TABLE IF EXISTS discount_codes;
DROP TABLE IF EXISTS product_characteristic_values;
DROP TABLE IF EXISTS characteristic_values;
DROP TABLE IF EXISTS characteristics;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS view_history;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS article_blocks;
DROP TABLE IF EXISTS articles;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS brand_models;
DROP TABLE IF EXISTS brands;
DROP TABLE IF EXISTS category_recommendations;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- ─── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  email         VARCHAR(254)     NOT NULL,
  password_hash VARCHAR(255)     NOT NULL,
  role          ENUM('admin','user') NOT NULL DEFAULT 'user',
  first_name    VARCHAR(100)     NULL,
  last_name     VARCHAR(100)     NULL,
  phone         VARCHAR(20)      NULL,
  is_active     TINYINT(1)       NOT NULL DEFAULT 1,
  vk_user_id     BIGINT          NULL,
  created_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Categories ──────────────────────────────────────────────────────────────
CREATE TABLE categories (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(200) NOT NULL,
  slug       VARCHAR(220) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE category_recommendations (
  category_id             INT UNSIGNED NOT NULL,
  recommended_category_id INT UNSIGNED NOT NULL,
  created_at              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (category_id, recommended_category_id),
  KEY idx_category_recommendations_target (recommended_category_id),
  CONSTRAINT fk_category_recommendations_category FOREIGN KEY (category_id) REFERENCES categories (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_category_recommendations_recommended FOREIGN KEY (recommended_category_id) REFERENCES categories (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_category_recommendations_not_self CHECK (category_id <> recommended_category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Products ─────────────────────────────────────────────────────────────────
CREATE TABLE brands (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(200) NOT NULL,
  slug       VARCHAR(220) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_brands_name (name),
  UNIQUE KEY uq_brands_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE brand_models (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  brand_id   INT UNSIGNED NOT NULL,
  name       VARCHAR(200) NOT NULL,
  slug       VARCHAR(220) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_brand_models_brand_slug (brand_id, slug),
  KEY idx_brand_models_brand (brand_id),
  CONSTRAINT fk_brand_models_brand FOREIGN KEY (brand_id) REFERENCES brands (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
  id           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  category_id  INT UNSIGNED    NOT NULL,
  brand_model_id INT UNSIGNED  NULL,
  name         TEXT            NOT NULL,
  slug         VARCHAR(255)    NOT NULL,
  description  TEXT            NULL,
  price        DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  image_path   TEXT            NULL,
  stock        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_deleted   TINYINT(1)      NOT NULL DEFAULT 0,
  deleted_at   TIMESTAMP       NULL,
  created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_slug (slug),
  KEY idx_products_category (category_id),
  KEY idx_products_brand_model (brand_model_id),
  KEY idx_products_deleted (is_deleted),
  CONSTRAINT chk_products_price_positive CHECK (price > 0),
  CONSTRAINT chk_products_stock_non_negative CHECK (stock >= 0),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_products_brand_model FOREIGN KEY (brand_model_id) REFERENCES brand_models (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Orders ───────────────────────────────────────────────────────────────────
CREATE TABLE discount_codes (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  code            VARCHAR(50)   NOT NULL,
  type            ENUM('percent','fixed') NOT NULL DEFAULT 'percent',
  value           DECIMAL(10,2) NOT NULL COMMENT 'percent 0-100 or fixed amount',
  scope           ENUM('global','category','product','user') NOT NULL DEFAULT 'global',
  scope_id        INT UNSIGNED  NULL COMMENT 'category_id or user_id if scope != global',
  min_order_amount DECIMAL(12,2) NULL,
  max_uses        INT UNSIGNED  NULL COMMENT 'NULL = unlimited',
  uses_count      INT UNSIGNED  NOT NULL DEFAULT 0,
  starts_at       TIMESTAMP     NULL,
  expires_at      TIMESTAMP     NULL,
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_discount_code (code),
  KEY idx_discount_active (is_active),
  KEY idx_discount_expires (expires_at),
  CONSTRAINT chk_discount_value_positive CHECK (value > 0),
  CONSTRAINT chk_discount_percent_max CHECK (type <> 'percent' OR value <= 100),
  CONSTRAINT chk_discount_min_order_non_negative CHECK (min_order_amount IS NULL OR min_order_amount >= 0),
  CONSTRAINT chk_discount_uses_valid CHECK (max_uses IS NULL OR max_uses >= 1),
  CONSTRAINT chk_discount_uses_count_valid CHECK (uses_count >= 0 AND (max_uses IS NULL OR uses_count <= max_uses)),
  CONSTRAINT chk_discount_dates_valid CHECK (starts_at IS NULL OR expires_at IS NULL OR starts_at <= expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE characteristics (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(120) NOT NULL,
  slug       VARCHAR(140) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_characteristics_name (name),
  UNIQUE KEY uq_characteristics_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE characteristic_values (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  characteristic_id INT UNSIGNED NOT NULL,
  value             VARCHAR(160) NOT NULL,
  sort_order        INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_characteristic_value (characteristic_id, value),
  KEY idx_characteristic_values_characteristic (characteristic_id),
  CONSTRAINT fk_characteristic_values_characteristic FOREIGN KEY (characteristic_id) REFERENCES characteristics (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_characteristic_values (
  product_id INT UNSIGNED NOT NULL,
  value_id   INT UNSIGNED NOT NULL,
  PRIMARY KEY (product_id, value_id),
  KEY idx_product_characteristic_values_value (value_id),
  CONSTRAINT fk_product_characteristic_values_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_product_characteristic_values_value FOREIGN KEY (value_id) REFERENCES characteristic_values (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE discount_scope_products (
  discount_id INT UNSIGNED NOT NULL,
  product_id  INT UNSIGNED NOT NULL,
  PRIMARY KEY (discount_id, product_id),
  KEY idx_discount_scope_products_product (product_id),
  CONSTRAINT fk_discount_scope_products_discount FOREIGN KEY (discount_id) REFERENCES discount_codes (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_discount_scope_products_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE orders (
  id                  INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  user_id             INT UNSIGNED   NULL,
  status              ENUM('new','processing','completed','delivered','cancelled') NOT NULL DEFAULT 'new',
  customer_name       VARCHAR(200)   NOT NULL,
  customer_email      VARCHAR(254)   NOT NULL,
  customer_phone      VARCHAR(20)    NOT NULL,
  customer_company    VARCHAR(255)   NULL,
  address             TEXT           NULL,
  notes               TEXT           NULL,
  payment_method      ENUM('cash','yookassa') NOT NULL DEFAULT 'cash',
  payment_status      ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending',
  delivery_time       DATETIME       NULL,
  total_amount        DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  discount_amount     DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  promo_code          VARCHAR(50)    NULL,
  admin_note          TEXT           NULL,
  created_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_orders_user (user_id),
  KEY idx_orders_status (status),
  KEY idx_orders_created (created_at),
  KEY idx_orders_promo_code (promo_code),
  CONSTRAINT chk_orders_total_non_negative CHECK (total_amount >= 0),
  CONSTRAINT chk_orders_discount_non_negative CHECK (discount_amount >= 0),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_orders_promo_code FOREIGN KEY (promo_code) REFERENCES discount_codes (code)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Order Items ──────────────────────────────────────────────────────────────
CREATE TABLE order_items (
  id                    INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  order_id              INT UNSIGNED  NOT NULL,
  product_id            INT UNSIGNED  NULL,
  quantity              SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  unit_price            DECIMAL(12,2) NOT NULL,
  product_name_snapshot TEXT          NOT NULL,
  PRIMARY KEY (id),
  KEY idx_order_items_order (order_id),
  KEY idx_order_items_product (product_id),
  CONSTRAINT chk_order_items_quantity_positive CHECK (quantity >= 1),
  CONSTRAINT chk_order_items_unit_price_positive CHECK (unit_price > 0),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Articles ─────────────────────────────────────────────────────────────────
CREATE TABLE articles (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  author_user_id INT UNSIGNED NULL,
  author_name VARCHAR(255) NULL,
  title      TEXT         NOT NULL,
  slug       VARCHAR(255) NOT NULL,
  published  TINYINT(1)   NOT NULL DEFAULT 0,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_articles_slug (slug),
  KEY idx_articles_published (published),
  KEY idx_articles_author_user (author_user_id),
  CONSTRAINT fk_articles_author_user FOREIGN KEY (author_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE article_blocks (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  article_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NULL,
  block_type ENUM('text','image','product') NOT NULL,
  body       LONGTEXT     NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_article_blocks_article (article_id),
  KEY idx_article_blocks_product (product_id),
  CONSTRAINT fk_article_blocks_article FOREIGN KEY (article_id) REFERENCES articles (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_article_blocks_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Cart Items (server-side for auth users) ──────────────────────────────────
CREATE TABLE cart_items (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED  NOT NULL,
  product_id INT UNSIGNED  NOT NULL,
  quantity   SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cart_user_product (user_id, product_id),
  KEY idx_cart_user (user_id),
  CONSTRAINT chk_cart_quantity_positive CHECK (quantity >= 1),
  CONSTRAINT fk_cart_user    FOREIGN KEY (user_id)    REFERENCES users    (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cart_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── View History ─────────────────────────────────────────────────────────────
CREATE TABLE view_history (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NULL,
  session_id VARCHAR(64)  NULL,
  product_id INT UNSIGNED NOT NULL,
  viewed_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_view_history_user    (user_id),
  KEY idx_view_history_session (session_id),
  KEY idx_view_history_product (product_id),
  KEY idx_view_history_time    (viewed_at),
  CONSTRAINT fk_view_history_user    FOREIGN KEY (user_id)    REFERENCES users    (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_view_history_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Reviews ──────────────────────────────────────────────────────────────────
CREATE TABLE reviews (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id  INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  rating      TINYINT UNSIGNED NOT NULL COMMENT '1-5',
  body        TEXT         NOT NULL,
  status      ENUM('pending','approved','rejected','deleted') NOT NULL DEFAULT 'approved',
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reviews_product (product_id),
  KEY idx_reviews_user    (user_id),
  KEY idx_reviews_status  (status),
  CONSTRAINT chk_reviews_rating_range CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_reviews_user    FOREIGN KEY (user_id)    REFERENCES users    (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Review images (фото к отзыву) ───────────────────────────────────────────
CREATE TABLE review_images (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  review_id   INT UNSIGNED NOT NULL,
  image_path  TEXT NOT NULL,
  sort_order  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_review_images_review (review_id),
  CONSTRAINT fk_review_images_review FOREIGN KEY (review_id) REFERENCES reviews (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Review Reports ───────────────────────────────────────────────────────────
CREATE TABLE review_reports (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  review_id  INT UNSIGNED NOT NULL,
  review_image_id INT UNSIGNED NULL COMMENT 'если жалоба на конкретное фото',
  user_id    INT UNSIGNED NOT NULL,
  reason     ENUM('spam','insult','fake','other','photo') NOT NULL DEFAULT 'other',
  comment    TEXT          NULL,
  status     ENUM('pending','reviewed','dismissed') NOT NULL DEFAULT 'pending',
  resolved_at TIMESTAMP NULL DEFAULT NULL,
  resolved_by_admin_id INT UNSIGNED NULL,
  reviewer_sanction ENUM('none','review_ban','account_block') NULL DEFAULT NULL,
  sanction_days SMALLINT UNSIGNED NULL,
  admin_note TEXT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reports_review (review_id),
  KEY idx_reports_user   (user_id),
  KEY idx_reports_status (status),
  CONSTRAINT fk_reports_review FOREIGN KEY (review_id) REFERENCES reviews (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_reports_review_image FOREIGN KEY (review_image_id) REFERENCES review_images (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_reports_user   FOREIGN KEY (user_id)   REFERENCES users   (id)             ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── User Suspensions (from review moderation) ────────────────────────────────
CREATE TABLE user_suspensions (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  admin_id    INT UNSIGNED NULL,
  reason      TEXT NOT NULL,
  expires_at  TIMESTAMP    NULL COMMENT 'NULL = permanent',
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_suspensions_user  (user_id),
  KEY idx_suspensions_admin (admin_id),
  CONSTRAINT fk_suspensions_user  FOREIGN KEY (user_id)  REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_suspensions_admin FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── VK one-time link codes ──────────────────────────────────────────────────
CREATE TABLE notifications (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NULL,
  type       ENUM('order_created','order_status','order_delivered','review_report','account_blocked','appeal_created','appeal_resolved','payment_failed','payment_paid') NOT NULL,
  title      VARCHAR(255) NOT NULL,
  body       TEXT NULL,
  entity_type VARCHAR(50) NULL,
  entity_id  INT UNSIGNED NULL,
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user_read (user_id, is_read),
  KEY idx_notifications_type (type),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE unblock_appeals (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  message     TEXT NOT NULL,
  screenshot_path TEXT NULL,
  status      ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  admin_id    INT UNSIGNED NULL,
  admin_note  TEXT NULL,
  resolved_at TIMESTAMP NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_unblock_appeals_user (user_id),
  KEY idx_unblock_appeals_status (status),
  CONSTRAINT fk_unblock_appeals_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_unblock_appeals_admin FOREIGN KEY (admin_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vk_link_codes (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  code       VARCHAR(64)  NOT NULL,
  expires_at TIMESTAMP    NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vk_link_code (code),
  KEY idx_vk_link_user (user_id),
  CONSTRAINT fk_vk_link_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
