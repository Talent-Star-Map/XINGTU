-- Prospective, append-only crawl evidence. Apply only after production backup
-- and disk-capacity review; the API ORM model mirrors this schema.
CREATE TABLE IF NOT EXISTS job_observations (
  id BIGINT NOT NULL AUTO_INCREMENT,
  observation_key VARCHAR(64) NOT NULL,
  source VARCHAR(80) NOT NULL,
  source_job_id VARCHAR(200) NOT NULL,
  source_url VARCHAR(1000) NULL,
  company_name VARCHAR(255) NULL,
  title VARCHAR(255) NULL,
  observed_at DATETIME NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  raw_text LONGTEXT NOT NULL,
  skill_tags JSON NULL,
  extraction JSON NULL,
  ingested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_job_observation_key (observation_key),
  KEY ix_job_observation_history (source, source_job_id, observed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
