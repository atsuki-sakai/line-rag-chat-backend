CREATE TABLE line_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'image')),
  message_content TEXT,
  image_url TEXT,
  dify_response TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_line_messages_conversation_id ON line_messages(conversation_id);
CREATE INDEX idx_line_messages_user_id ON line_messages(user_id);
CREATE INDEX idx_line_messages_created_at ON line_messages(created_at);