"""JobRawDAO data access object."""

import json

from database.mysql import get_connection
from models.job_raw import JobRaw


class JobRawDAO:
    """Data access object for JobRaw records."""

    def insert_job_raw(self, job: JobRaw) -> bool:
        """Insert a single JobRaw record into MySQL."""
        connection = None
        cursor = None

        try:
            connection = get_connection()
            cursor = connection.cursor()

            sql = (
                "INSERT INTO job_raw ("
                "source, source_job_id, source_url, raw_job_name, raw_company_name, "
                "raw_salary, raw_city, raw_area, raw_education, raw_experience, "
                "raw_job_type, raw_description, raw_company_info, publish_time, "
                "crawl_time, create_time, raw_skills"
                ") VALUES ("
                "%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s"
                ")"
            )

            params = (
                job.source,
                job.source_job_id,
                job.source_url,
                job.raw_job_name,
                job.raw_company_name,
                job.raw_salary,
                job.raw_city,
                job.raw_area,
                job.raw_education,
                job.raw_experience,
                job.raw_job_type,
                job.raw_description,
                job.raw_company_info,
                job.publish_time,
                job.crawl_time,
                job.create_time,
                json.dumps(job.raw_skills, ensure_ascii=False),
            )

            check_sql = (
                "SELECT id FROM job_raw "
                "WHERE source=%s AND source_job_id=%s"
            )
            cursor.execute(
                check_sql,
                (job.source, job.source_job_id),
            )
            existing_record = cursor.fetchone()
            if existing_record is not None:
                job.id = existing_record[0]
                return False

            cursor.execute(sql, params)
            job.id = cursor.lastrowid
            connection.commit()
            return True
        except Exception as e:
            print("[ERROR] JobRaw入库失败:", e)
            if connection is not None:
                connection.rollback()
            return False
        finally:
            if cursor is not None:
                cursor.close()
            if connection is not None:
                connection.close()
