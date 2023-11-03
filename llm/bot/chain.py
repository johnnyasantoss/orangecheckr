from langchain.chains import LLMChain
from langchain.chat_models import ChatOpenAI
from langchain.prompts import PromptTemplate


def evaluation_chain(
    prompt: PromptTemplate,
    model: str = "gpt-4",
    temperature: float = 0.0,
):

    # Response LLM
    llm = ChatOpenAI(
        model=model,
        temperature=temperature,
        streaming=False,
        verbose=True,
        max_retries=5,
    )  # type: ignore

    return LLMChain(
        llm=llm,
        prompt=prompt,
    )
