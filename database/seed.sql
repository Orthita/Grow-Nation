-- Starter content taken from the Grow Nation prototype.
-- Run once by `npm run init-db` (skipped automatically if data already exists).

INSERT INTO categories (id, name, type, sort_order) VALUES
 (1, 'Training and education', 'training', 1),
 (2, 'Consultancy', 'consultancy', 2);

-- Service cards: Training tab (category 1)
INSERT INTO courses (id, category_id, title, summary, topics, duration, location, best_for, listing, status, sort_order) VALUES
 (1, 1, 'Corporate & Workforce Training', 'Programmes for frontline workers, supervisors and managers, built from your SOPs.',
  'Technical and on-the-job skills\nSupervisory and leadership skills\nSoft skills and emotional intelligence\nTraining needs analysis',
  '1-2 days (depending on module)', 'On-site / Online', 'Factories, FMCG, service businesses', 'card', 'published', 1),
 (2, 1, 'Food Safety & Quality Training', 'From hygiene basics to internal auditor courses.',
  'GMP, hygiene and allergen control\nHACCP and CCP monitoring\nISO 22000 and FSSC 22000 audit\nFood defence and fraud (TACCP / VACCP)',
  '1-3 days', 'On-site / Online', 'Food handlers, QA/QC, production managers', 'card', 'published', 2),
 (3, 1, 'Operational Excellence Training', 'Lean tools that cut waste, downtime and rework.',
  '5S and Kaizen\nTPM and autonomous maintenance\nLean Six Sigma Yellow Belt\nSPC and root cause analysis',
  '1-2 days', 'On-site / Online', 'Production, maintenance, engineering', 'card', 'published', 3),
 (4, 1, 'Professional Certification Courses', 'Certificates, diplomas and PGDs with partner institutions.',
  'Industry-aligned certificates\nDiploma and PGD programmes\nCustomised corporate academies\nCPD hours',
  'Varies by certification programme', 'On-site / Online', 'Graduates, professionals, HR teams', 'card', 'published', 4),
 (5, 1, 'Rural & Community Skills', 'Vocational and livelihood training.',
  'Income-generating skills\nEntrepreneurship basics\nFood processing and hygiene\nCareer guidance sessions',
  'Customised duration', 'On-site / Online', 'NGOs, partners, communities', 'card', 'published', 5),
 (6, 1, 'Educational Coaching', 'Online and offline coaching and mentoring.',
  'University admission preparation\nGovernment job and competitive exams\nCadet college and ISSB\nStudy materials and mentoring',
  'Varies by coaching programme', 'On-site / Online', 'School, college, university students', 'card', 'published', 6);

-- Service cards: Consultancy tab (category 2)
INSERT INTO courses (id, category_id, title, summary, topics, duration, location, best_for, listing, status, sort_order) VALUES
 (7, 2, 'Food Safety Systems Consultancy', 'Support until your system is audit-ready.',
  'Gap assessment: ISO 22000 / FSSC 22000\nHACCP plans, PRPs, documentation\nInternal and mock audits\nCorrective action support',
  'Project-based', 'On-site', 'Food and beverage manufacturers', 'card', 'published', 1),
 (8, 2, 'Export Readiness & Certification', 'Prepare for international buyers and standards.',
  'ISO, HACCP and CE readiness\nProcess optimisation\nBuyer and third-party audit prep\nTraceability and recall systems',
  'Project-based', 'On-site', 'Exporters and SMEs', 'card', 'published', 2),
 (9, 2, 'HR, Labour & Social Compliance', 'Keep people practices compliant and fair.',
  'Labour Act 2006 review\nPolicy and handbook development\nSocial compliance audit prep\nPerformance management',
  'Project-based', 'On-site / Online', 'Manufacturers, garments, growing firms', 'card', 'published', 3),
 (10, 2, 'Overseas Education & Migration', 'Guidance for study or work abroad.',
  'University admission guidance\nCredential evaluation\nVisa and immigration preparation\nPre-departure orientation',
  'Customised duration', 'Online / Office', 'Students, professionals, skilled workers', 'card', 'published', 4),
 (11, 2, 'Tender & Project Consultancy', 'Support for public, donor and NGO projects.',
  'Curriculum and training design\nTenders for GoB, NSDA, donors\nAssessment and certification\nCapacity building',
  'Project-based', 'On-site / Online', 'Government, NGOs, partners', 'card', 'published', 5);

-- Course catalogue (table on the Services page; certificates link to these)
INSERT INTO courses (id, category_id, title, standard, duration, location, best_for, listing, status, sort_order) VALUES
 (12, 1, 'GMP & Personal Hygiene for Food Handlers', 'Codex Food Hygiene', '4 hours', 'On-site / Online', 'Frontline workers', 'catalogue', 'published', 1),
 (13, 1, 'HACCP Fundamentals & CCP Monitoring', 'Codex HACCP', '2 days', 'On-site / Online', 'QA, supervisors', 'catalogue', 'published', 2),
 (14, 1, 'ISO 22000:2018 Internal Auditor', 'ISO 22000:2018 · ISO 19011', '3 days', 'On-site / Online', 'QA and audit teams', 'catalogue', 'published', 3),
 (15, 1, 'FSSC 22000 Version 6 Implementation', 'FSSC 22000 v6', '2 days', 'On-site / Online', 'Food safety leaders', 'catalogue', 'published', 4),
 (16, 1, 'Food Defence & Food Fraud (TACCP / VACCP)', 'FSSC additional requirements', '1 day', 'On-site / Online', 'QA managers', 'catalogue', 'published', 5),
 (17, 1, '5S & Visual Workplace', '5S methodology', '1 day', 'On-site / Online', 'All production staff', 'catalogue', 'published', 6),
 (18, 1, 'Lean Six Sigma Yellow Belt', 'DMAIC', '3 days', 'On-site / Online', 'Engineers, supervisors', 'catalogue', 'published', 7),
 (19, 1, 'TPM & Autonomous Maintenance', 'TPM pillars · OEE', '2 days', 'On-site / Online', 'Maintenance, operators', 'catalogue', 'published', 8),
 (20, 1, 'Statistical Process Control', 'Control charts · Cp/Cpk', '1 day', 'On-site / Online', 'QC, process engineers', 'catalogue', 'published', 9),
 (21, 1, 'Bangladesh Labour Act 2006 for Supervisors', 'BLA 2006 (amended 2018)', '1 day', 'On-site / Online', 'Line managers, HR', 'catalogue', 'published', 10),
 (22, 1, 'Emotional Intelligence for Line Managers', 'Competency-based', '1 day', 'On-site / Online', 'Supervisors, team leaders', 'catalogue', 'published', 11),
 (23, 1, 'ISO 14001 Environmental Awareness', 'ISO 14001:2015', '1 day', 'On-site / Online', 'EHS and plant teams', 'catalogue', 'published', 12);

-- Home slider
INSERT INTO slides (title, eyebrow, text, button_text, button_link, sort_order, active) VALUES
 ('Build practical skills for a stronger future', '01 / Training', 'Professional training designed around real workplace needs.', 'Explore training', '/services.html', 1, 1),
 ('Get audit-ready with systems that last', '02 / Consultancy', 'Food safety, export readiness and compliance support built around your factory.', 'Explore consultancy', '/services.html#consultancy', 2, 1),
 ('Learn, plan and take the next step', '03 / Resources', 'Learning materials, career guidance and workplace resources in one place.', 'Browse resources', '/resources.html', 3, 1);

-- Resources page (no files yet: add PDFs from the admin panel)
INSERT INTO resources (title, type, description, status) VALUES
 ('Learning Materials', 'learning', 'Training notes, learning materials and practical guidance to support continuous learning.', 'published'),
 ('Career Guidance', 'career', 'Explore guidance for professional development, education and career preparation.', 'published'),
 ('Workplace Resources', 'workplace', 'Practical information for workplace skills, quality, safety and operational improvement.', 'published');

-- Contact details (edit later in Admin > Contact details)
INSERT INTO settings (setting_key, setting_value) VALUES
 ('office_address', 'House No-86/1, Jamurun Nessa Palace (Level-03), Adabor Bazar Road, Mohammadpur PS, Dhaka-1207, Bangladesh'),
 ('registration', 'Proprietorship, BIN registered with NBR (June 2026)'),
 ('phone', '+88 01726511168'),
 ('email', 'grownationbd@gmail.com'),
 ('website', 'www.grownation.org'),
 ('whatsapp', ''),
 ('hours', '');

-- DEMO certificates copied from the prototype so you can test the verifier.
-- Delete or replace them in Admin > Certificates before going live.
INSERT INTO certificates (number, course_id, holder_name, hours, issue_date, valid_until, status) VALUES
 ('GN-FS-2026-0142', 13, 'Demo holder (delete before launch)', 16, '2026-08-18', '2029-08-17', 'valid'),
 ('GN-OE-2026-0031', 17, 'Demo holder (delete before launch)', 8,  '2026-02-20', '2026-09-20', 'valid'),
 ('GN-FS-2025-0007', 12, 'Demo holder (delete before launch)', 4,  '2025-06-01', '2028-05-31', 'revoked');
