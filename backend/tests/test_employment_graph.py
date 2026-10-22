from services import job_graph_explorer as graph


def row(i, title='Java开发工程师', role='Java与JVM开发', skills=None):
    return {'posting': {'posting_id':str(i), 'title':title, 'company':'示例公司',
        'role_id':'role:'+role, 'role_name':role, 'source':'tencent', 'level':'junior',
        'source_url':'https://careers.tencent.com/jobdesc.html?postId='+str(i),
        'reference_time':'2026-10-23T00:00:00Z','time_basis':'published', 'description':'真实招聘要求示例'},
        'skills':skills or [{'id':'skill:java','name':'Java','status':'body_quote','quote':'Java开发'}]}


def setup(monkeypatch, rows):
    from services import classification_agent
    monkeypatch.setattr(classification_agent,'apply_approved',lambda value:value)
    monkeypatch.setattr(graph,'current_dataset',lambda:{'id':'test'})
    monkeypatch.setattr(graph,'observations',lambda _:rows)


def test_work_nature_follows_function_not_domain():
    assert graph.work_nature(row(1)['posting'])=='工程开发'
    assert graph.work_nature(row(2,'测试开发工程师')['posting'])=='测试与质量'
    assert graph.work_nature(row(3,'推荐算法工程师')['posting'])=='算法与研究'
    assert graph.work_nature(row(4,'DevOps工程师')['posting'])=='运维与技术支持'
    assert graph.work_nature(row(5,'未知岗位','待归类岗位')['posting'])=='待确认工作性质'


def test_drilldown_filters_nature_role_and_skill(monkeypatch):
    setup(monkeypatch,[row(1),row(2,'测试工程师','软件测试与质量'),
                       row(3,skills=[{'id':'skill:sql','name':'SQL','status':'list_tag'}])])
    result=graph.employment_view('roles',nature='工程开发')
    assert {n['name'] for n in result['nodes'] if n['type']=='Cluster'}=={'Java与JVM开发'}
    result=graph.employment_view('postings','工程开发','Java与JVM开发','skill:java')
    ads=[n for n in result['nodes'] if n['type']=='Recruitment']
    assert len(ads)==1 and ads[0]['recruitment']['posting_id']=='1'
    assert ads[0]['recruitment']['description']=='真实招聘要求示例'
    assert all(e['source'] in {n['id'] for n in result['nodes']} and
               e['target'] in {n['id'] for n in result['nodes']} for e in result['links'])


def test_all_supported_skills_and_no_unverified_tags(monkeypatch):
    skills=[{'id':str(i),'name':str(i),'status':'body_quote','quote':'要求'} for i in range(45)]
    skills.append({'id':'bad','name':'不支持的技能','status':'unverified_tag'})
    setup(monkeypatch,[row(1,skills=skills)])
    result=graph.employment_view('skills','工程开发','Java与JVM开发')
    assert len([n for n in result['nodes'] if n['type']=='Skill'])==45
    assert not any(n['id']=='bad' for n in result['nodes'])


def test_same_company_postings_keep_separate_identity_and_paginate(monkeypatch):
    setup(monkeypatch,[row(i) for i in range(15)])
    first=graph.employment_view('postings','工程开发','Java与JVM开发',page=1)
    second=graph.employment_view('postings','工程开发','Java与JVM开发',page=2)
    a={n['id'] for n in first['nodes'] if n['type']=='Recruitment'}
    b={n['id'] for n in second['nodes'] if n['type']=='Recruitment'}
    assert len(a)==12 and len(b)==3 and not a & b
    assert first['pages']==2



def test_skill_direction_reverse_lookup_crosses_roles(monkeypatch):
    setup(monkeypatch,[row(1),row(2,'算法工程师','机器学习与算法')])
    result=graph.employment_view('skill_roles',nature='工程开发',role='Java与JVM开发',skill='skill:java')
    assert {n['type'] for n in result['nodes']}=={'Skill','Cluster'}
    assert len([n for n in result['nodes'] if n['type']=='Cluster'])==2
    assert all(e['target']=='skill:java' for e in result['links'])


def test_jd_skill_reverse_lookup_only_selected_skill(monkeypatch):
    setup(monkeypatch,[row(1,skills=[{'id':'skill:java','name':'Java','status':'body_quote','quote':'Java'},
                                  {'id':'skill:sql','name':'SQL','status':'list_tag'}]),
                      row(2,skills=[{'id':'skill:sql','name':'SQL','status':'list_tag'}])])
    result=graph.employment_view('skill_jds',skill='skill:java')
    assert {n['type'] for n in result['nodes']}=={'Skill','Recruitment'}
    assert {n['id'] for n in result['nodes'] if n['type']=='Skill'}=={'skill:java'}
    assert len([n for n in result['nodes'] if n['type']=='Recruitment'])==1
    assert all(e['target']=='skill:java' for e in result['links'])
    catalog=graph.employment_view('skill_jds')
    assert all(n['type']=='Skill' for n in catalog['nodes'])
