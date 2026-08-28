"""JobInfo data model.

Cleaned and standardized job data, produced by cleaning JobRaw records.
"""
from datetime import datetime


class JobInfo:
    """清洗后的标准岗位数据模型。

    由清洗器从 JobRaw 转换而来，承载标准化后的结构化字段。
    不包含任何数据库逻辑、清洗逻辑或持久化操作。
    """

    def __init__(
        self,
        job_name=None,
        company_name=None,
        city=None,
        area=None,
        salary_min=None,
        salary_max=None,
        salary_months=None,
        education=None,
        experience=None,
        job_type=None,
        job_category=None,
        company_type=None,
        skills=None,
        job_description=None,
        publish_time=None,
        crawl_time=None,
        salary_unit=None,
    ):
        self.job_name = job_name
        self.company_name = company_name
        self.city = city
        self.area = area
        self.salary_min = salary_min
        self.salary_max = salary_max
        self.salary_months = salary_months
        self.education = education
        self.experience = experience
        self.job_type = job_type
        self.job_category = job_category
        self.company_type = company_type
        self.skills = skills if skills is not None else []
        self.job_description = job_description
        self.publish_time = publish_time
        self.crawl_time = crawl_time
        self.salary_unit = salary_unit

    def __repr__(self):
        return (
            f"JobInfo(job_name={self.job_name!r}, "
            f"company_name={self.company_name!r}, "
            f"city={self.city!r})"
        )

    def to_dict(self):
        return {
            "job_name": self.job_name,
            "company_name": self.company_name,
            "city": self.city,
            "area": self.area,
            "salary_min": self.salary_min,
            "salary_max": self.salary_max,
            "salary_months": self.salary_months,
            "education": self.education,
            "experience": self.experience,
            "job_type": self.job_type,
            "job_category": self.job_category,
            "company_type": self.company_type,
            "skills": self.skills,
            "job_description": self.job_description,
            "publish_time": self.publish_time,
            "crawl_time": self.crawl_time,
            "salary_unit": self.salary_unit,
        }
