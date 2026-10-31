"""Health, chat history and the chat round trip (REC-6/8/9). Agent is stubbed."""

from app import main


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_messages_start_with_seeded_welcome(client):
    messages = client.get("/api/messages").json()
    assert len(messages) == 1
    assert messages[0]["role"] == "assistant"
    assert messages[0]["content"].startswith("Welcome to Recenter")


def test_chat_persists_user_message_and_reply(client, agent_replies):
    reply = client.post("/api/chat", json={"content": "hello coach"}).json()
    assert reply["role"] == "assistant"
    assert reply["content"] == "echo: hello coach"
    assert agent_replies == [("hello coach", "main")]

    history = client.get("/api/messages").json()
    assert [m["role"] for m in history[-2:]] == ["user", "assistant"]
    assert history[-2]["content"] == "hello coach"


def test_chat_threads_are_separate(client):
    client.post("/api/chat", json={"content": "in thread b", "thread_id": "b"})
    assert len(client.get("/api/messages?thread_id=b").json()) == 2
    assert len(client.get("/api/messages").json()) == 1  # main untouched


def test_chat_falls_back_when_agent_fails(client, monkeypatch):
    def broken(content, thread_id="main"):
        raise RuntimeError("no api key")

    monkeypatch.setattr(main, "run_agent", broken)
    reply = client.post("/api/chat", json={"content": "hi"}).json()
    assert "couldn't reach my brain" in reply["content"]
    assert "RuntimeError" in reply["content"]
    # The user's message is still saved
    assert client.get("/api/messages").json()[-2]["content"] == "hi"
