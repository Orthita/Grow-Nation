-- Grow Nation database schema (MySQL 8+)
-- Run with:  npm run init-db     (recommended)
-- or in Workbench / mysql CLI:  source database/schema.sql

CREATE DATABASE IF NOT EXISTS grow_nation CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE grow_nation;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('super_admin','editor','certificate_officer','support') NOT NULL DEFAULT 'support',
  twofa_enabled TINYINT(1) NOT NULL DEFAULT 0,
  totp_secret VARCHAR(255) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  last_login DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  type ENUM('training','consultancy') NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS courses (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id INT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  summary TEXT NULL,
  topics TEXT NULL,                       -- one topic per line
  duration VARCHAR(120) NULL,
  fee VARCHAR(120) NULL,                  -- shown on the card, e.g. "BDT 5,000 per person"
  location VARCHAR(120) NULL,
  standard VARCHAR(160) NULL,
  best_for VARCHAR(200) NULL,
  image VARCHAR(255) NULL,
  listing ENUM('card','catalogue') NOT NULL DEFAULT 'card',  -- card = Services tab card, catalogue = table row
  status ENUM('published','hidden') NOT NULL DEFAULT 'published',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_courses_category FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS batches (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id INT UNSIGNED NOT NULL,
  start_date DATE NOT NULL,
  mode ENUM('on-site','online') NOT NULL DEFAULT 'on-site',
  seats INT NULL,
  status ENUM('open','full','cancelled') NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_batches_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS enquiries (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id INT UNSIGNED NULL,
  name VARCHAR(150) NOT NULL,
  organisation VARCHAR(190) NULL,
  phone VARCHAR(40) NULL,
  email VARCHAR(190) NULL,
  interest VARCHAR(200) NULL,
  message TEXT NULL,
  status ENUM('new','contacted','closed') NOT NULL DEFAULT 'new',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_enquiries_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Enroll Now form on the Training / Consultancy cards. Staff follow up and set the status.
CREATE TABLE IF NOT EXISTS enrollments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id INT UNSIGNED NULL,
  course_title VARCHAR(200) NOT NULL,     -- copy of the title, kept if the course is renamed or deleted
  name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  organisation VARCHAR(190) NULL,
  preferred_date DATE NULL,
  message TEXT NULL,
  status ENUM('pending','contacted','confirmed','rejected') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_enrollments_time (created_at),
  CONSTRAINT fk_enrollments_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS certificates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  number VARCHAR(40) NOT NULL UNIQUE,     -- e.g. GN-FS-2026-0142
  course_id INT UNSIGNED NOT NULL,
  holder_name VARCHAR(150) NOT NULL,
  hours INT NULL,
  issue_date DATE NOT NULL,
  valid_until DATE NULL,                  -- NULL = no expiry
  status ENUM('valid','revoked') NOT NULL DEFAULT 'valid',
  file VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_certificates_course FOREIGN KEY (course_id) REFERENCES courses(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS resources (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  type ENUM('learning','career','workplace') NOT NULL DEFAULT 'learning',
  description TEXT NULL,
  image VARCHAR(255) NULL,
  file_url VARCHAR(255) NULL,
  link VARCHAR(255) NULL,
  status ENUM('published','hidden') NOT NULL DEFAULT 'published',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS slides (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  text VARCHAR(400) NULL,
  eyebrow VARCHAR(60) NULL,
  image VARCHAR(255) NULL,
  button_text VARCHAR(60) NULL,
  button_link VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS testimonials (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  role VARCHAR(190) NULL,
  quote TEXT NOT NULL,
  photo VARCHAR(255) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  user_name VARCHAR(190) NULL,
  action VARCHAR(60) NOT NULL,
  table_name VARCHAR(60) NULL,
  record_id VARCHAR(40) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_time (created_at)
) ENGINE=InnoDB;

-- Contact details the team can edit from the admin panel (key / value)
CREATE TABLE IF NOT EXISTS settings (
  setting_key VARCHAR(60) PRIMARY KEY,
  setting_value TEXT NULL
) ENGINE=InnoDB;
