from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from bot.routes import router as bot_router


app = FastAPI(title="Hackaton LLM")

# Add CORS middleware
origins = [
    "*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bot_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)
