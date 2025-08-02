// Database schema types
export interface LineMessage {
  id: number;
  conversation_id: string;
  user_id: string;
  message_type: string;
  message_content: string | null;
  image_url: string | null;
  dify_response: string | null;
  created_at: string;
  updated_at: string;
}

export interface InsertLineMessage {
  conversation_id: string;
  user_id: string;
  message_type: string;
  message_content?: string | null;
  image_url?: string | null;
  dify_response?: string | null;
  created_at: string;
  updated_at: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

export interface MessageListResponse extends PaginatedResponse<LineMessage> {}

export interface MessageStatsResponse extends ApiResponse<{
  total_messages: number;
  unique_users: number;
  unique_conversations: number;
  messages_by_type: Array<{
    message_type: string;
    count: number;
  }>;
  recent_activity: {
    last_24h: number;
    last_7d: number;
    last_30d: number;
  };
  performance_warning: boolean;
  recommendation?: string;
}> {}

// Request types
export interface MessageListRequest {
  limit?: number;
  offset?: number;
  conversation_id?: string;
  user_id?: string;
}

export interface DeleteRequest {
  delete_type?: 'bulk';
  conversation_id?: string;
  user_id?: string;
  older_than_days?: number;
  confirm?: boolean;
}

export interface DeletePreviewRequest {
  conversation_id?: string;
  user_id?: string;
  older_than_days?: number;
}

export interface DeletePreviewResponse extends ApiResponse<{
  target_count: number;
  warning?: string;
  preview: Array<{
    id: number;
    user_id: string;
    created_at: string;
  }>;
}> {}

// Cloudflare Workers types
export interface WorkflowEnv {
  DB: D1Database;
  LINE_MESSAGE_WORKFLOW: DurableObjectNamespace;
  DIFY_API_ENDPOINT?: string;
  DIFY_API_KEY?: string;
  LINE_CHANNEL_ACCESS_TOKEN?: string;
}

export interface LineMessageWorkflowParams {
  userId: string;
  conversationId: string;
  messageType: string;
  messageContent?: string;
  imageUrl?: string;
}