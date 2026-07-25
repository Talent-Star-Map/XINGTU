"""
Selenium 浏览器自动化 JD 采集
模拟真实用户行为，绕过反爬检测

用法：
  pip install selenium
  下载 ChromeDriver 或用 webdriver-manager 自动管理
  python selenium_scraper.py

@owner: 静怡、议桓（多源异构数据采集）
"""

import json, os, time, random, re
from datetime import datetime

# test_data 目录在 backend/ 根，需向上跳一层
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'test_data')
os.makedirs(OUTPUT_DIR, exist_ok=True)

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.common.keys import Keys
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from webdriver_manager.chrome import ChromeDriverManager
    SELENIUM_OK = True
except ImportError:
    SELENIUM_OK = False
    print('需要安装: pip install selenium webdriver-manager')


def scrape_boss_selenium(keywords: list = None, count: int = 50):
    """用 Selenium 爬取 Boss 直聘"""
    if not SELENIUM_OK:
        return []

    if keywords is None:
        keywords = ['Java开发', 'Python开发', '前端开发', 'AI工程师', '大数据', 'Go开发', '算法工程师', '架构师']

    options = Options()
    options.add_argument('--headless=new')  # 无头模式
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1920,1080')
    options.add_experimental_option('excludeSwitches', ['enable-automation'])
    options.add_experimental_option('useAutomationExtension', False)
    options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    driver.execute_script('Object.defineProperty(navigator, "webdriver", {get: () => undefined})')

    jds = []
    seen = set()

    try:
        for kw in keywords:
            if len(jds) >= count:
                break
            print(f'  搜索: {kw}')
            try:
                url = f'https://www.zhipin.com/web/geek/job?query={kw}&city=100010000'
                driver.get(url)
                time.sleep(random.uniform(3, 5))

                # 等待职位列表加载
                WebDriverWait(driver, 15).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, '.job-list-box .job-card-wrap'))
                )

                # 滚动加载更多
                for _ in range(5):
                    driver.execute_script('window.scrollTo(0, document.body.scrollHeight)')
                    time.sleep(random.uniform(1.5, 2.5))

                # 获取职位列表
                cards = driver.find_elements(By.CSS_SELECTOR, '.job-card-wrap')[:count]
                print(f'    找到 {len(cards)} 个岗位卡片')

                for card in cards:
                    if len(jds) >= count:
                        break
                    try:
                        title_el = card.find_element(By.CSS_SELECTOR, '.job-name')
                        title = title_el.text.strip()
                        company = card.find_element(By.CSS_SELECTOR, '.company-name').text.strip() if card.find_elements(By.CSS_SELECTOR, '.company-name') else ''
                        location = card.find_element(By.CSS_SELECTOR, '.job-area').text.strip() if card.find_elements(By.CSS_SELECTOR, '.job-area') else ''

                        # 获取薪资等信息（列表页）
                        salary = ''
                        try:
                            salary = card.find_element(By.CSS_SELECTOR, '.salary').text.strip()
                        except: pass

                        exp_edu = card.find_elements(By.CSS_SELECTOR, '.tag-list li')
                        experience = exp_edu[0].text.strip() if len(exp_edu) > 0 else ''
                        education = exp_edu[1].text.strip() if len(exp_edu) > 1 else ''

                        # 点击进去获取详细描述
                        desc = ''
                        try:
                            title_el.click()
                            time.sleep(random.uniform(1, 2))
                            desc_el = driver.find_element(By.CSS_SELECTOR, '.job-sec-text')
                            desc = desc_el.text.strip()
                            # 返回列表
                            driver.back()
                            time.sleep(random.uniform(1.5, 2))
                        except:
                            pass

                        if not title:
                            continue

                        jid = f'boss_{hash(title + company) & 0xffffffff}'
                        if jid in seen:
                            continue
                        seen.add(jid)

                        jds.append({
                            'id': jid,
                            'title': title,
                            'company': company,
                            'location': location,
                            'salary': salary,
                            'experience': experience,
                            'education': education,
                            'description': desc,
                            'skills': [],
                            'source': 'Boss直聘(Selenium)',
                            'collected_at': datetime.now().isoformat(),
                        })
                        print(f'    ✓ {title} @ {company} | {salary}')
                    except Exception as e:
                        continue

            except Exception as e:
                print(f'    搜索 {kw} 出错: {e}')
                continue
            finally:
                time.sleep(random.uniform(2, 4))

    finally:
        driver.quit()

    return jds


def auto_annotate_with_deepseek(jds: list) -> list:
    """用 DeepSeek 自动标注技能（半自动，后续需人工校验）"""
    import requests
    api_key = os.getenv('DEEPSEEK_API_KEY', '')
    if not api_key:
        print('未配置 DEEPSEEK_API_KEY，跳过自动标注')
        return jds

    print(f'正在用 DeepSeek 标注 {len(jds)} 条 JD...')
    for i, jd in enumerate(jds):
        if jd.get('skills') and len(jd['skills']) > 0:
            continue
        desc = jd.get('description', '')
        title = jd.get('title', '')
        if not desc or len(desc) < 10:
            continue
        try:
            resp = requests.post(
                'https://api.deepseek.com/v1/chat/completions',
                headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
                json={
                    'model': 'deepseek-chat',
                    'messages': [
                        {'role': 'system', 'content': '从JD文本中提取技能标签。只返回JSON数组。'},
                        {'role': 'user', 'content': f'岗位：{title}\n\nJD内容：{desc[:2000]}\n\n提取技能标签（JSON数组）：'}
                    ],
                    'temperature': 0.1, 'max_tokens': 500,
                },
                timeout=30
            )
            raw = resp.json()['choices'][0]['message']['content'].strip()
            if raw.startswith('```'): raw = raw.split('\n', 1)[1].rsplit('\n```', 1)[0]
            skills = json.loads(raw)
            jd['skills'] = skills
            print(f'  [{i+1}/{len(jds)}] {title}: {len(skills)} 项技能')
        except Exception as e:
            print(f'  [{i+1}/{len(jds)}] {title}: 标注失败 - {e}')
    return jds


def main():
    if not SELENIUM_OK:
        print('请先安装依赖: pip install selenium webdriver-manager')
        return

    print('=== Selenium JD 采集 ===')
    jds = scrape_boss_selenium(count=50)

    if jds:
        print(f'\n采集到 {len(jds)} 条 JD，开始自动标注...')
        jds = auto_annotate_with_deepseek(jds)

    if len(jds) < 100:
        # 补充模拟数据
        print(f'\n仅有 {len(jds)} 条，补充模拟数据至100条...')
        from jd_scraper import generate_sample_jds
        extra = generate_sample_jds(100 - len(jds))
        jds.extend(extra)

    # 保存
    path = os.path.join(OUTPUT_DIR, 'scraped_jds.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(jds, f, ensure_ascii=False, indent=2)

    answers = [{'id': j['id'], 'title': j['title'], 'skills': j.get('skills', [])} for j in jds]
    ans_path = os.path.join(OUTPUT_DIR, 'standard_answers.json')
    with open(ans_path, 'w', encoding='utf-8') as f:
        json.dump(answers, f, ensure_ascii=False, indent=2)

    annotated = sum(1 for j in jds if j.get('skills'))
    print(f'\n完成: {len(jds)} 条 JD ({annotated} 条已标注) → {path}')
    print(f'标准答案: {ans_path}')


if __name__ == '__main__':
    main()
