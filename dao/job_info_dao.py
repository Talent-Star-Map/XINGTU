"""JobInfoDAO data access object."""

import json

from database.mysql import get_connection
from models.job_info import JobInfo


class JobInfoDAO:
    """Data access object for JobInfo records."""

    def insert_job_info(self, job: JobInfo):
        """Insert a single JobInfo record into MySQL."""
        connection = None
        cursor = None

        try:
            connection = get_connection()
            cursor = connection.cursor()

            raw_id = getattr(job, "raw_id", None)
            if raw_id is not None:
                check_sql = "SELECT 1 FROM job_info WHERE raw_id = %s LIMIT 1"
                cursor.execute(check_sql, (raw_id,))
                if cursor.fetchone() is not None:
                    return False

            sql = (
                "INSERT INTO job_info ("
                "raw_id, job_name, company_name, city, area, salary_min, salary_max, "
                "salary_months, education, experience, job_type, job_category, "
                "company_type, skills, job_description, publish_time, crawl_time, "
                "salary_unit"
                ") VALUES ("
                "%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s"
                ")"
            )

            params = (
                job.raw_id,
                job.job_name,
                job.company_name,
                job.city,
                job.area,
                job.salary_min,
                job.salary_max,
                job.salary_months,
                job.education,
                job.experience,
                job.job_type,
                job.job_category,
                job.company_type,
                json.dumps(job.skills, ensure_ascii=False),
                job.job_description,
                job.publish_time,
                job.crawl_time,
                job.salary_unit,
            )

            cursor.execute(sql, params)
            connection.commit()
            return True
        except Exception as e:
            print("[ERROR] JobInfo入库失败:", e)
            if connection is not None:
                connection.rollback()
            return False
        finally:
            if cursor is not None:
                cursor.close()
            if connection is not None:
                connection.close()
