"""Chat with the AI assistant: the new-chat screen, one conversation, and the Memory placeholder.

Forms post with HTMX and get back the fragment they replace. A response that changes the sidebar (a new reply
moves the conversation to the top, a pin moves it to Pinned) sends `HX-Trigger: threads-changed`, and the
sidebar's thread list reloads itself.
"""

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response

from prepermint.db import DB
from prepermint.lib import actions
from prepermint.lib.ai import ai_enabled
from prepermint.lib.dal import CurrentUser, ensure_profile, get_thread
from prepermint.routes.shell import render_app, thread_items
from prepermint.templating import templates

router = APIRouter()

THREADS_CHANGED = {"HX-Trigger": "threads-changed"}


@router.get("/chat", response_class=HTMLResponse)
async def new_chat(request: Request, db: DB, user: CurrentUser) -> Response:
    profile = await ensure_profile(db, user)
    first = (profile.display_name or "").strip().split()
    greeting = f"What are we working on, {first[0]}?" if first else "What are we working on?"
    return await render_app(
        request, db, user, "chat/new.html", {"greeting": greeting, "ai_enabled": ai_enabled(), "title": "New chat"}
    )


@router.post("/chat")
async def start_chat(request: Request, db: DB, user: CurrentUser) -> Response:
    """New chat from the composer on /chat. The thread page asks for the reply, so it opens at once."""
    form = await request.form()
    text = form.get("text")
    thread_id = await actions.create_thread(db, user, text if isinstance(text, str) else "")
    return RedirectResponse(f"/chat/{thread_id}" if thread_id else "/chat", status_code=303)


@router.post("/chat/starters/{starter_id}")
async def start_starter(starter_id: str, db: DB, user: CurrentUser) -> Response:
    """New chat from a starter: its prompt is sent as the first message."""
    thread_id = await actions.start_starter(db, user, starter_id)
    return RedirectResponse(f"/chat/{thread_id}" if thread_id else "/chat", status_code=303)


@router.get("/chat/_threads", response_class=HTMLResponse)
async def threads(request: Request, db: DB, user: CurrentUser) -> Response:
    """The sidebar's thread list, reloaded after a reply or a pin."""
    return templates.TemplateResponse(request, "app/thread_list.html", {"threads": await thread_items(db, user.id)})


@router.get("/chat/{thread_id}", response_class=HTMLResponse)
async def thread_page(request: Request, thread_id: str, db: DB, user: CurrentUser) -> Response:
    thread = await get_thread(db, user.id, thread_id)
    if thread is None:
        raise HTTPException(status_code=404)
    return await render_app(
        request,
        db,
        user,
        "chat/thread.html",
        {
            "thread": thread,
            "messages": thread.messages,
            "error": None,
            "ai_enabled": ai_enabled(),
            # A chat opened from the composer or a starter arrives with the first message stored and no reply yet:
            # the page asks for the reply once.
            "awaiting_reply": bool(thread.messages) and thread.messages[-1]["role"] == "user",
            "title": "Chat",
        },
    )


async def _messages(request: Request, thread_id: str, text: str, db: DB, user: CurrentUser) -> Response:
    try:
        result = await actions.send_chat_message(db, user, thread_id, text)
    except actions.NotFoundError:
        raise HTTPException(status_code=404) from None
    return templates.TemplateResponse(
        request,
        "chat/messages.html",
        {"thread_id": thread_id, "messages": result.messages, "error": result.error, "ai_enabled": ai_enabled()},
        headers=THREADS_CHANGED,
    )


@router.post("/chat/{thread_id}/messages", response_class=HTMLResponse)
async def send_message(request: Request, thread_id: str, db: DB, user: CurrentUser) -> Response:
    """Adds the user's message and the assistant's reply; answers with the updated message list."""
    form = await request.form()
    text = form.get("text")
    return await _messages(request, thread_id, text if isinstance(text, str) else "", db, user)


@router.post("/chat/{thread_id}/reply", response_class=HTMLResponse)
async def reply(request: Request, thread_id: str, db: DB, user: CurrentUser) -> Response:
    """The reply to a conversation that is waiting for one (a new chat)."""
    return await _messages(request, thread_id, "", db, user)


@router.post("/chat/{thread_id}/pin", response_class=HTMLResponse)
async def pin(request: Request, thread_id: str, db: DB, user: CurrentUser) -> Response:
    form = await request.form()
    pinned = form.get("pinned") == "true"
    result = await actions.set_thread_pinned(db, user, thread_id, pinned)
    thread = await get_thread(db, user.id, thread_id)
    if thread is None:
        raise HTTPException(status_code=404)
    return templates.TemplateResponse(
        request,
        "chat/pin.html",
        {"thread": thread, "error": result.error},
        headers=THREADS_CHANGED if result.ok else None,
    )


@router.post("/chat/{thread_id}/save", response_class=HTMLResponse)
async def save_to_cv(request: Request, thread_id: str, db: DB, user: CurrentUser) -> Response:
    result = await actions.save_chat_to_cv(db, user, thread_id)
    return templates.TemplateResponse(request, "chat/save_status.html", {"result": result})


@router.get("/memory", response_class=HTMLResponse)
async def memory(request: Request, db: DB, user: CurrentUser) -> Response:
    """Placeholder until the memory panel (MVP-27) is built."""
    return await render_app(request, db, user, "app/memory.html", {"title": "Memory"})
