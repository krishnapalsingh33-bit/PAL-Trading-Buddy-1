from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router
from api.journal_routes import router as journal_router
from api.news_routes import router as news_router
from api.history_routes import router as history_router

app = FastAPI(title="PAL Trading Buddy API", version="2.0.0", description="PAL Trading Buddy Backend")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.include_router(router)
app.include_router(journal_router)
app.include_router(news_router)
app.include_router(history_router)

@app.get("/")
def root():
    return {"name": "PAL Trading Buddy", "version": "2.0.0", "status": "Running"}

@app.get("/health")
def health():
    return {"status": "healthy"}
