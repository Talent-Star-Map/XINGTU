"""Lazy SDK model class. Import only after optional career dependencies are installed."""
from langchain_openai import ChatOpenAI
_WORKER_SETTINGS=None


class CareerChatModel(ChatOpenAI):
    def __init__(self, **kwargs):
        if _WORKER_SETTINGS is not None:
            kwargs.update(_WORKER_SETTINGS)
            super().__init__(**kwargs)
            return
        from services.llm import LLMTier, _get_api_key, _get_base_url, _get_model, is_global_enabled
        if not is_global_enabled():
            raise RuntimeError('AI 功能未启用')
        kwargs.update(api_key=_get_api_key(LLMTier.STRONG), base_url=_get_base_url(LLMTier.STRONG),
                      model=_get_model(LLMTier.STRONG), timeout=45, max_retries=0)
        super().__init__(**kwargs)
