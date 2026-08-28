"""JobRaw data model.

Raw job data collected from job platforms.
"""
from datetime import datetime


class JobRaw:
    """原始岗位数据模型。

    由采集器生成，承载从招聘平台抓取的原始字段。
    不包含任何数据库逻辑、清洗逻辑或持久化操作。
    """

    def __init__(
        self,
        source=None,
        source_job_id=None,
        source_url=None,
        raw_job_name=None,
        raw_company_name=None,
        raw_salary=None,
        raw_city=None,
        raw_area=None,
        raw_education=None,
        raw_experience=None,
        raw_job_type=None,
        raw_description=None,
        raw_company_info=None,
        publish_time=None,
        crawl_time=None,
        create_time=None,
        raw_skills=None,
    ):
        self.source = source
        self.source_job_id = source_job_id
        self.source_url = source_url
        self.raw_job_name = raw_job_name
        self.raw_company_name = raw_company_name
        self.raw_salary = raw_salary
        self.raw_city = raw_city
        self.raw_area = raw_area
        self.raw_education = raw_education
        self.raw_experience = raw_experience
        self.raw_job_type = raw_job_type
        self.raw_description = raw_description
        self.raw_company_info = raw_company_info
        self.publish_time = publish_time
        self.crawl_time = crawl_time
        self.create_time = create_time
        self.raw_skills = raw_skills if raw_skills is not None else []

    def __repr__(self):
        return (
            f"JobRaw(source={self.source!r}, "
            f"raw_job_name={self.raw_job_name!r}, "
            f"raw_company_name={self.raw_company_name!r})"
        )

    def to_dict(self):
        return {
            "source": self.source,
            "source_job_id": self.source_job_id,
            "source_url": self.source_url,
            "raw_job_name": self.raw_job_name,
            "raw_company_name": self.raw_company_name,
            "raw_salary": self.raw_salary,
            "raw_city": self.raw_city,
            "raw_area": self.raw_area,
            "raw_education": self.raw_education,
            "raw_experience": self.raw_experience,
            "raw_job_type": self.raw_job_type,
            "raw_description": self.raw_description,
            "raw_company_info": self.raw_company_info,
            "publish_time": self.publish_time,
            "crawl_time": self.crawl_time,
            "create_time": self.create_time,
            "raw_skills": self.raw_skills,
        }
