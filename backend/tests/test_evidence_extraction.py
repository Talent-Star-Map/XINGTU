"""Offline regression for literal LLM evidence; no API, model or database."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.evidence_extraction import verify_skill_quote
from services import resume_parser


def main():
    text = '要求熟悉 Python；有 RAG 经验。另需掌握 FluxDBX。'
    assert verify_skill_quote(text, 'Python', '要求熟悉 Python') == {
        'quote': '要求熟悉 Python', 'start': 0, 'end': len('要求熟悉 Python')}
    assert verify_skill_quote(text, 'Python', '要求精通 Python') is None
    assert verify_skill_quote('熟悉 Google', 'Go', '熟悉 Google') is None
    assert verify_skill_quote(text, 'FluxDBX', '另需掌握 FluxDBX')

    original = resume_parser._jd_llm_extract
    try:
        resume_parser._jd_llm_extract = lambda _: [
            {'skill': 'Python', 'evidence': '虚构的 Python 引文'},
            {'skill': 'FluxDBX', 'evidence': '另需掌握 FluxDBX'},
            {'skill': 'MadeUp', 'evidence': '另需掌握 MadeUp'},
            {'skill': 'RAG', 'evidence': '另需掌握 FluxDBX'},
        ]
        result = resume_parser.extract_jd_skills(text)
        assert 'python' in result['skills']
        assert all(quote in text for quotes in result['evidence'].values() for quote in quotes)
        assert result['novel_candidates'] == [{
            'skill': 'FluxDBX',
            'evidence': verify_skill_quote(text, 'FluxDBX', '另需掌握 FluxDBX'),
            'status': 'review_required'}]
    finally:
        resume_parser._jd_llm_extract = original
    print('PASS: literal offsets, fabricated quote rejection, open-vocabulary quarantine')


if __name__ == '__main__':
    main()
