import logging
import requests

from fastapi import APIRouter, Request
from bot.chain import evaluation_chain
from bot.prompt import EvaluationPrompt
import json

# Router
router = APIRouter()

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] - %(message)s")
logger = logging.getLogger(__name__)



@router.post("/evaluate")
async def reply(request: Request):
    try:
        data = await request.json()

        note = data.get("note")

        # Get note policy
        policy_url = data.get("policy_url")
        policy = requests.get(policy_url).text

        print(f"note: {note}")

        # Chain
        prompt = EvaluationPrompt()
        chain = evaluation_chain(
            prompt=prompt.prompt(),
        )
        result = chain({"note": note, "policy": policy})
        output = result['text']

        # Parse json
        if "```json" not in output:
            raise Exception("No JSON object found in output")

        # Parse JSON object
        json_string = output.split("```json")[1].strip().strip("```").strip()
        try:
            json_obj = json.loads(json_string)
        except json.JSONDecodeError as e:
            raise Exception("Invalid JSON object found in output")

        return json_obj

    except Exception as e:
        logging.error(e)
        return {"response": "error"}
