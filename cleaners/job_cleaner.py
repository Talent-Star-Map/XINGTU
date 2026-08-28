"""Job cleaner for mapping raw job data to cleaned job info."""

import re

from models.job_info import JobInfo
from models.job_raw import JobRaw


class JobCleaner:
    """Convert JobRaw objects into JobInfo objects."""

    def _clean_job_name(self, raw_job_name: str | None) -> str | None:
        """Clean raw job name by removing bracketed text and marketing words."""
        if not raw_job_name:
            return raw_job_name

        job_name = re.sub(r"[\(（][^\)）]*[\)）]", "", raw_job_name)

        marketing_words = [
            "急招",
            "高薪",
            "诚聘",
            "双休",
            "不加班",
            "福利好",
            "稳定",
            "五险一金",
            "包吃住",
            "接受应届生",
            "应届生可",
        ]

        for word in marketing_words:
            job_name = job_name.replace(word, "")

        job_name = " ".join(job_name.split()).strip()
        return job_name or None

    def _clean_area(self, raw_area: str | None) -> str | None:
        """Keep only the second-level area from raw area text."""
        if not raw_area:
            return None

        area_parts = [part.strip() for part in raw_area.split("·") if part.strip()]
        if len(area_parts) >= 2:
            return area_parts[1]

        return None

    def _get_job_category(
        self,
        job_name: str | None,
        skills: list[str] | None = None,
        description: str | None = None,
    ) -> str:
        """Infer job category from job name, skills, and description."""
        text_parts: list[str] = []

        if job_name:
            text_parts.append(job_name)
        if skills:
            text_parts.extend(str(skill) for skill in skills if skill)
        if description:
            text_parts.append(description)

        text = " ".join(text_parts).lower()

        if any(
            keyword in text
            for keyword in ["java", "后端", "服务端", "go", "python", "c++", "spring"]
        ):
            return "后端开发"
        if any(keyword in text for keyword in ["vue", "react", "html", "css", "前端"]):
            return "前端开发"
        if any(keyword in text for keyword in ["测试", "qa", "自动化测试"]):
            return "测试"
        if any(
            keyword in text
            for keyword in ["算法", "机器学习", "深度学习", "ai", "大模型"]
        ):
            return "人工智能"
        if any(keyword in text for keyword in ["运维", "devops", "linux", "云计算"]):
            return "运维开发"

        return "其他"

    def _get_company_type(self, raw_company_info: str | None) -> str | None:
        """Infer company type from company info text."""
        if not raw_company_info:
            return None

        text = raw_company_info.lower()

        if any(
            keyword in text
            for keyword in ["科技", "软件", "互联网", "信息技术", "计算机", "网络技术"]
        ):
            return "科技互联网"
        if any(keyword in text for keyword in ["金融", "银行", "证券", "保险"]):
            return "金融"
        if any(keyword in text for keyword in ["教育", "培训", "学校"]):
            return "教育培训"
        if any(keyword in text for keyword in ["医疗", "医院", "医药", "健康"]):
            return "医疗健康"
        if any(keyword in text for keyword in ["制造", "工业", "工厂"]):
            return "制造业"
        if any(keyword in text for keyword in ["通信", "5G", "5g", "电信"]):
            return "通信"
        if any(keyword in text for keyword in ["房地产", "建筑", "工程"]):
            return "房地产建筑"

        return None

    def _parse_salary(
        self,
        raw_salary: str | None,
    ) -> tuple[int | None, int | None, int | None, str | None]:
        """Parse raw salary text into structured salary fields."""
        if not raw_salary:
            return None, None, None, None

        salary_text = raw_salary.strip()
        if salary_text == "面议":
            return None, None, None, None

        salary_min = None
        salary_max = None
        salary_months = None
        salary_unit = None

        day_range_match = re.search(
            r"(\d+(?:\.\d+)?)\s*[-~]\s*(\d+(?:\.\d+)?)\s*(?:元)?\s*/\s*(?:天|日)",
            salary_text,
        )
        if day_range_match:
            salary_min = int(float(day_range_match.group(1)))
            salary_max = int(float(day_range_match.group(2)))
            salary_unit = "day"
            return salary_min, salary_max, salary_months, salary_unit

        if "日薪" in salary_text or "/天" in salary_text or "/日" in salary_text:
            salary_unit = "day"
        elif "时薪" in salary_text:
            salary_unit = "hour"
        elif "年薪" in salary_text:
            salary_unit = "year"
        elif "万" in salary_text or "月薪" in salary_text or "元/月" in salary_text or "元" in salary_text:
            salary_unit = "month"

        months_match = re.search(r"(\d+)\s*薪", salary_text)
        if months_match:
            salary_months = int(months_match.group(1))

        if "万" in salary_text:
            range_match = re.search(
                r"(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*万",
                salary_text,
            )
            if range_match:
                salary_min = int(float(range_match.group(1)) * 10000)
                salary_max = int(float(range_match.group(2)) * 10000)
                if salary_unit is None:
                    salary_unit = "month"
        elif "元" in salary_text:
            range_match = re.search(
                r"(\d+)\s*-\s*(\d+)\s*元",
                salary_text,
            )
            if range_match:
                salary_min = int(range_match.group(1))
                salary_max = int(range_match.group(2))
                if salary_unit is None:
                    salary_unit = "month"

        return salary_min, salary_max, salary_months, salary_unit

    def clean(self, job: JobRaw) -> JobInfo:
        """Map basic fields from a JobRaw object to a JobInfo object."""
        skills = job.raw_skills if job.raw_skills else []
        salary_min, salary_max, salary_months, salary_unit = self._parse_salary(
            job.raw_salary
        )
        job_name = self._clean_job_name(job.raw_job_name)
        job_category = self._get_job_category(job_name, skills, job.raw_description)
        company_type = self._get_company_type(job.raw_company_info)

        job_info = JobInfo(
            job_name=job_name,
            company_name=job.raw_company_name,
            city=job.raw_city,
            area=self._clean_area(job.raw_area),
            salary_min=salary_min,
            salary_max=salary_max,
            salary_months=salary_months,
            education=job.raw_education,
            experience=job.raw_experience,
            job_type=job.raw_job_type,
            job_category=job_category,
            company_type=company_type,
            skills=skills,
            job_description=job.raw_description,
            publish_time=job.publish_time,
            crawl_time=job.crawl_time,
            salary_unit=salary_unit,
        )
        job_info.raw_id = job.id
        return job_info
