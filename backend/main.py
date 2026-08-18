from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router
from api.journal_routes import router as journal_router
from api.news_routes import router as news_router


app = FastAPI(
    title="PAL Trading Buddy API",
    version="2.0.0",
    description="PAL Trading Buddy Backend",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------
# Existing PAL V1 routes
# -----------------------------------------

app.include_router(router)


# -----------------------------------------
# PAL V2 Journal
# -----------------------------------------

app.include_router(journal_router)


# -----------------------------------------
# PAL V2 News
# -----------------------------------------

app.include_router(news_router)


@app.get("/")
def root():

    return {
        "name": "PAL Trading Buddy",
        "version": "2.0.0",
        "status": "Running",
    }


@app.get("/health")
def health():

    return {
        "status": "healthy",
    }