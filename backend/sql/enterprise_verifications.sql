CREATE TABLE IF NOT EXISTS enterprise_verifications (
    enterprise_id INT PRIMARY KEY,
    submission_id VARCHAR(32) NOT NULL,
    company_name VARCHAR(200) NOT NULL,
    credit_code VARCHAR(18) NOT NULL,
    status VARCHAR(16) NOT NULL,
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME NULL,
    reviewer_id INT NULL,
    review_note VARCHAR(500) NULL,
    FOREIGN KEY (enterprise_id) REFERENCES enterprises(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
