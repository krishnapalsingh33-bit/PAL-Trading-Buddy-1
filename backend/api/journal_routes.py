from fastapi import APIRouter

from providers.mt5_journal_provider import MT5JournalProvider


router = APIRouter(
    prefix="/v2/journal",
    tags=["PAL V2 Journal"],
)


journal_provider = MT5JournalProvider()


@router.get("")
def get_journal(days: int = 30):

    if days < 1:
        days = 1

    if days > 365:
        days = 365

    journal = journal_provider.get_journal(
        days=days
    )

    return {
        "success": True,
        "data": journal,
    }