import { OpenAPIRoute, OpenAPIRouteSchema } from "chanfana";
import { z } from "zod";
import { lineMessages } from "../../db/schema";
import { desc, sql, eq, and } from "drizzle-orm";
import { AppContext } from "../../types";

export class MessageView extends OpenAPIRoute {
  schema: OpenAPIRouteSchema = {
    tags: ["Admin"],
    summary: "View LINE messages in HTML format",
    request: {
      query: z.object({
        limit: z.string().optional().default("50"),
        offset: z.string().optional().default("0"),
        conversation_id: z.string().optional(),
        user_id: z.string().optional()
      })
    },
    responses: {
      "200": {
        description: "HTML view of LINE messages",
        content: {
          "text/html": {
            schema: z.string()
          }
        }
      }
    }
  };

  async handle(c: AppContext) {
    const db = c.get("db");
    const limit = c.req.query("limit") || "50";
    const offset = c.req.query("offset") || "0";
    const conversation_id = c.req.query("conversation_id");
    const user_id = c.req.query("user_id");

    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);

    let whereConditions = [];
    if (conversation_id) {
      whereConditions.push(eq(lineMessages.conversation_id, conversation_id));
    }
    if (user_id) {
      whereConditions.push(eq(lineMessages.user_id, user_id));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [messages, totalResult] = await Promise.all([
      db.select()
        .from(lineMessages)
        .where(whereClause)
        .orderBy(desc(lineMessages.created_at))
        .limit(limitNum)
        .offset(offsetNum),
      db.select({ count: sql<number>`count(*)` })
        .from(lineMessages)
        .where(whereClause)
    ]);

    const total = totalResult[0]?.count || 0;

    const html = this.generateHTML(messages, total, limitNum, offsetNum, conversation_id, user_id);
    
    return c.html(html);
  }

  private generateHTML(messages: any[], total: number, limit: number, offset: number, conversation_id?: string, user_id?: string) {
    const params = new URLSearchParams();
    if (conversation_id) params.set('conversation_id', conversation_id);
    if (user_id) params.set('user_id', user_id);
    
    const baseUrl = `/admin/dashboard`;
    const csvUrl = `/admin/messages/csv?${params.toString()}`;
    
    const nextParams = new URLSearchParams(params);
    nextParams.set('limit', limit.toString());
    nextParams.set('offset', (offset + limit).toString());
    
    const prevParams = new URLSearchParams(params);
    prevParams.set('limit', limit.toString());
    prevParams.set('offset', Math.max(0, offset - limit).toString());

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LINE メッセージ管理ダッシュボード</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #f5f7fa;
            color: #2d3748;
            line-height: 1.6;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        
        .header h1 {
            color: #1a202c;
            margin-bottom: 10px;
            font-size: 24px;
        }
        
        .stats {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
            margin-bottom: 20px;
        }
        
        .stat-card {
            background: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            min-width: 120px;
        }
        
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #2b6cb0;
        }
        
        .stat-label {
            font-size: 12px;
            color: #718096;
            text-transform: uppercase;
        }
        
        .controls {
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        
        .filter-form {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 15px;
        }
        
        .form-group {
            display: flex;
            flex-direction: column;
        }
        
        .form-group label {
            font-size: 12px;
            font-weight: 600;
            color: #4a5568;
            margin-bottom: 5px;
            text-transform: uppercase;
        }
        
        .form-group input {
            padding: 8px 12px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            font-size: 14px;
            transition: border-color 0.2s;
        }
        
        .form-group input:focus {
            outline: none;
            border-color: #4299e1;
            box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
        }
        
        .button-group {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        
        .btn {
            padding: 10px 16px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s;
        }
        
        .btn-primary {
            background: #4299e1;
            color: white;
        }
        
        .btn-primary:hover {
            background: #3182ce;
        }
        
        .btn-success {
            background: #48bb78;
            color: white;
        }
        
        .btn-success:hover {
            background: #38a169;
        }
        
        .btn-secondary {
            background: #edf2f7;
            color: #4a5568;
            border: 1px solid #e2e8f0;
        }
        
        .btn-secondary:hover {
            background: #e2e8f0;
        }
        
        .btn-danger {
            background: #e53e3e;
            color: white;
        }
        
        .btn-danger:hover {
            background: #c53030;
        }
        
        .modal {
            display: none;
            position: fixed;
            z-index: 9999;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.7);
            overflow-y: auto;
        }
        
        .modal-content {
            background-color: white;
            margin: 15% auto;
            padding: 20px;
            border-radius: 12px;
            width: 90%;
            max-width: 500px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        
        .modal-header {
            margin-bottom: 20px;
        }
        
        .modal-header h3 {
            color: #e53e3e;
            margin: 0;
        }
        
        .form-row {
            margin-bottom: 15px;
        }
        
        .form-row label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
            color: #4a5568;
        }
        
        .form-row input, .form-row select {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            font-size: 14px;
        }
        
        .warning-box {
            background: #fed7d7;
            border: 1px solid #feb2b2;
            color: #c53030;
            padding: 12px;
            border-radius: 6px;
            margin: 15px 0;
            font-size: 14px;
        }
        
        .preview-box {
            background: #f7fafc;
            border: 1px solid #e2e8f0;
            padding: 15px;
            border-radius: 6px;
            margin: 15px 0;
            max-height: 200px;
            overflow-y: auto;
        }
        
        .preview-item {
            padding: 5px 0;
            border-bottom: 1px solid #edf2f7;
            font-size: 12px;
            color: #4a5568;
        }
        
        .close {
            color: #a0aec0;
            float: right;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
        }
        
        .close:hover {
            color: #4a5568;
        }
        
        .messages-container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .message-card {
            border-bottom: 1px solid #f7fafc;
            padding: 16px 20px;
            transition: background-color 0.2s;
        }
        
        .message-card:hover {
            background: #f7fafc;
        }
        
        .message-card:last-child {
            border-bottom: none;
        }
        
        .message-header {
            display: flex;
            justify-content: between;
            align-items: flex-start;
            margin-bottom: 8px;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .message-meta {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
        }
        
        .meta-item {
            font-size: 12px;
            color: #718096;
        }
        
        .meta-label {
            font-weight: 600;
        }
        
        .message-content {
            margin: 12px 0;
        }
        
        .user-message {
            background: #ebf8ff;
            padding: 10px 12px;
            border-radius: 8px;
            border-left: 3px solid #4299e1;
            margin-bottom: 8px;
        }
        
        .ai-response {
            background: #f0fff4;
            padding: 10px 12px;
            border-radius: 8px;
            border-left: 3px solid #48bb78;
        }
        
        .message-text {
            font-size: 14px;
            line-height: 1.5;
            white-space: pre-wrap;
        }
        
        .image-link {
            color: #4299e1;
            text-decoration: none;
            font-size: 12px;
        }
        
        .image-link:hover {
            text-decoration: underline;
        }
        
        .pagination {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            background: white;
            margin-top: 20px;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .pagination-info {
            font-size: 14px;
            color: #718096;
        }
        
        .pagination-buttons {
            display: flex;
            gap: 10px;
        }
        
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #718096;
        }
        
        .empty-state h3 {
            margin-bottom: 8px;
            color: #4a5568;
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            
            .header {
                padding: 15px;
            }
            
            .header h1 {
                font-size: 20px;
            }
            
            .stats {
                gap: 10px;
            }
            
            .stat-card {
                padding: 12px 15px;
                min-width: 100px;
            }
            
            .filter-form {
                grid-template-columns: 1fr;
            }
            
            .message-card {
                padding: 12px 15px;
            }
            
            .message-header {
                flex-direction: column;
                align-items: flex-start;
            }
            
            .pagination {
                flex-direction: column;
                gap: 15px;
            }
            
            .pagination-buttons {
                width: 100%;
                justify-content: space-between;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📱 LINE メッセージダッシュボード</h1>
            <p>メッセージ管理とエクスポート機能</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-value">${total}</div>
                <div class="stat-label">総メッセージ数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${messages.length}</div>
                <div class="stat-label">表示中</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Math.ceil(total / limit)}</div>
                <div class="stat-label">総ページ数</div>
            </div>
        </div>
        
        <div class="controls">
            <form class="filter-form" method="get">
                <div class="form-group">
                    <label for="user_id">ユーザーID</label>
                    <input type="text" id="user_id" name="user_id" value="${user_id || ''}" placeholder="U1234567890...">
                </div>
                <div class="form-group">
                    <label for="conversation_id">会話ID</label>
                    <input type="text" id="conversation_id" name="conversation_id" value="${conversation_id || ''}" placeholder="uuid-format...">
                </div>
                <div class="form-group">
                    <label for="limit">表示件数</label>
                    <input type="number" id="limit" name="limit" value="${limit}" min="1" max="100">
                </div>
            </form>
            
            <div class="button-group">
                <button type="button" class="btn btn-primary" id="filterBtn">🔍 フィルター</button>
                <a href="${csvUrl}&limit=5000" class="btn btn-success">📥 CSV ダウンロード (最大5K件)</a>
                <a href="${csvUrl}&limit=1000" class="btn btn-success">📥 クイック CSV (1K件)</a>
                <button type="button" class="btn btn-danger" onclick="showDeleteModal()">🗑️ データ削除</button>
                <a href="${baseUrl}" class="btn btn-secondary">🔄 リセット</a>
            </div>
        </div>
        
        <div class="messages-container">
            ${messages.length === 0 ? `
                <div class="empty-state">
                    <h3>メッセージが見つかりません</h3>
                    <p>フィルター条件を調整するか、後でもう一度確認してください</p>
                </div>
            ` : messages.map(msg => `
                <div class="message-card">
                    <div class="message-header">
                        <div class="message-meta">
                            <span class="meta-item"><span class="meta-label">ID:</span> ${msg.id}</span>
                            <span class="meta-item"><span class="meta-label">ユーザー:</span> ${msg.user_id}</span>
                            <span class="meta-item"><span class="meta-label">タイプ:</span> ${msg.message_type}</span>
                            <span class="meta-item"><span class="meta-label">日時:</span> ${new Date(msg.created_at).toLocaleString('ja-JP')}</span>
                        </div>
                    </div>
                    
                    <div class="message-content">
                        ${msg.message_content ? `
                            <div class="user-message">
                                <div class="message-text">${this.escapeHtml(msg.message_content)}</div>
                            </div>
                        ` : ''}
                        
                        ${msg.image_url ? `
                            <div style="margin: 8px 0;">
                                <a href="${msg.image_url}" target="_blank" class="image-link">🖼️ 画像を表示</a>
                            </div>
                        ` : ''}
                        
                        ${msg.dify_response ? `
                            <div class="ai-response">
                                <div class="message-text">${this.escapeHtml(msg.dify_response)}</div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="message-meta">
                        <span class="meta-item"><span class="meta-label">会話:</span> ${msg.conversation_id}</span>
                    </div>
                </div>
            `).join('')}
        </div>
        
        ${total > limit ? `
            <div class="pagination">
                <div class="pagination-info">
                    ${offset + 1}-${Math.min(offset + limit, total)} / ${total} 件を表示中
                </div>
                <div class="pagination-buttons">
                    ${offset > 0 ? `<a href="${baseUrl}?${prevParams.toString()}" class="btn btn-secondary">← 前へ</a>` : ''}
                    ${offset + limit < total ? `<a href="${baseUrl}?${nextParams.toString()}" class="btn btn-secondary">次へ →</a>` : ''}
                </div>
            </div>
        ` : ''}
    </div>

    <!-- Delete Modal -->
    <div id="deleteModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <span class="close" onclick="closeDeleteModal()">&times;</span>
                <h3>🗑️ データ削除</h3>
            </div>
            
            <form id="deleteForm">
                <div class="form-row">
                    <label for="deleteType">削除タイプ</label>
                    <select id="deleteType" name="deleteType" onchange="toggleDeleteOptions()">
                        <option value="">選択してください</option>
                        <option value="conversation">会話単位で削除</option>
                        <option value="user">ユーザー単位で削除</option>
                        <option value="date">日付で削除</option>
                        <option value="combined">複合条件で削除</option>
                    </select>
                </div>
                
                <div id="conversationOption" style="display: none;">
                    <div class="form-row">
                        <label for="deleteConversationId">会話ID</label>
                        <input type="text" id="deleteConversationId" name="deleteConversationId" placeholder="会話IDを入力">
                    </div>
                </div>
                
                <div id="userOption" style="display: none;">
                    <div class="form-row">
                        <label for="deleteUserId">ユーザーID</label>
                        <input type="text" id="deleteUserId" name="deleteUserId" placeholder="ユーザーIDを入力">
                    </div>
                </div>
                
                <div id="dateOption" style="display: none;">
                    <div class="form-row">
                        <label for="deleteOlderThan">～日以前のデータを削除</label>
                        <input type="number" id="deleteOlderThan" name="deleteOlderThan" placeholder="日数を入力" min="1">
                    </div>
                </div>
                
                <div id="combinedOption" style="display: none;">
                    <div class="form-row">
                        <label for="deleteCombinedUserId">ユーザーID（オプション）</label>
                        <input type="text" id="deleteCombinedUserId" name="deleteCombinedUserId" placeholder="特定ユーザーのみ">
                    </div>
                    <div class="form-row">
                        <label for="deleteCombinedDays">～日以前（オプション）</label>
                        <input type="number" id="deleteCombinedDays" name="deleteCombinedDays" placeholder="日数" min="1">
                    </div>
                </div>
                
                <div class="button-group">
                    <button type="button" class="btn btn-secondary" onclick="previewDelete()">🔍 削除対象を確認</button>
                    <button type="button" class="btn btn-danger" onclick="executeDelete()" disabled id="executeBtn">🗑️ 削除実行</button>
                    <button type="button" class="btn btn-secondary" onclick="closeDeleteModal()">キャンセル</button>
                </div>
                
                <div id="previewResult"></div>
            </form>
        </div>
    </div>

    <script>
        // Auto-submit form on enter
        document.addEventListener('DOMContentLoaded', function() {
            const form = document.querySelector('.filter-form');
            const filterBtn = document.getElementById('filterBtn');
            
            function submitForm() {
                const formData = new FormData(form);
                const params = new URLSearchParams();
                
                for (let [key, value] of formData) {
                    if (value.trim()) {
                        params.set(key, value);
                    }
                }
                
                window.location.href = '${baseUrl}?' + params.toString();
            }
            
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                submitForm();
            });
            
            // Add form submit to button click
            filterBtn.addEventListener('click', function(e) {
                e.preventDefault();
                submitForm();
            });
        });
        
        // Delete Modal Functions
        function showDeleteModal() {
            console.log('showDeleteModal called'); // デバッグログ
            const modal = document.getElementById('deleteModal');
            if (modal) {
                modal.style.display = 'block';
                console.log('Modal should be visible now');
            } else {
                console.error('Modal element not found');
            }
        }
        
        function closeDeleteModal() {
            document.getElementById('deleteModal').style.display = 'none';
            document.getElementById('deleteForm').reset();
            document.getElementById('previewResult').innerHTML = '';
            document.getElementById('executeBtn').disabled = true;
            toggleDeleteOptions();
        }
        
        function toggleDeleteOptions() {
            const deleteType = document.getElementById('deleteType').value;
            
            // Hide all options
            document.getElementById('conversationOption').style.display = 'none';
            document.getElementById('userOption').style.display = 'none';
            document.getElementById('dateOption').style.display = 'none';
            document.getElementById('combinedOption').style.display = 'none';
            
            // Show selected option
            if (deleteType === 'conversation') {
                document.getElementById('conversationOption').style.display = 'block';
            } else if (deleteType === 'user') {
                document.getElementById('userOption').style.display = 'block';
            } else if (deleteType === 'date') {
                document.getElementById('dateOption').style.display = 'block';
            } else if (deleteType === 'combined') {
                document.getElementById('combinedOption').style.display = 'block';
            }
            
            // Reset preview
            document.getElementById('previewResult').innerHTML = '';
            document.getElementById('executeBtn').disabled = true;
        }
        
        async function previewDelete() {
            const deleteType = document.getElementById('deleteType').value;
            if (!deleteType) {
                alert('削除タイプを選択してください');
                return;
            }
            
            const payload = {};
            
            if (deleteType === 'conversation') {
                const convId = document.getElementById('deleteConversationId').value;
                if (!convId) {
                    alert('会話IDを入力してください');
                    return;
                }
                payload.conversation_id = convId;
            } else if (deleteType === 'user') {
                const userId = document.getElementById('deleteUserId').value;
                if (!userId) {
                    alert('ユーザーIDを入力してください');
                    return;
                }
                payload.user_id = userId;
            } else if (deleteType === 'date') {
                const days = document.getElementById('deleteOlderThan').value;
                if (!days) {
                    alert('日数を入力してください');
                    return;
                }
                payload.older_than_days = parseInt(days);
            } else if (deleteType === 'combined') {
                const userId = document.getElementById('deleteCombinedUserId').value;
                const days = document.getElementById('deleteCombinedDays').value;
                if (!userId && !days) {
                    alert('少なくとも1つの条件を入力してください');
                    return;
                }
                if (userId) payload.user_id = userId;
                if (days) payload.older_than_days = parseInt(days);
            }
            
            try {
                const response = await fetch('/admin/messages/delete-preview', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    let html = '<div class="warning-box">';
                    html += \`<strong>削除対象: \${result.target_count}件</strong>\`;
                    if (result.warning) {
                        html += \`<br><span style="color: #e53e3e;">⚠️ \${result.warning}</span>\`;
                    }
                    html += '</div>';
                    
                    if (result.preview.length > 0) {
                        html += '<div class="preview-box">';
                        html += '<strong>削除対象のサンプル（最大10件）:</strong>';
                        result.preview.forEach(item => {
                            html += \`<div class="preview-item">ID: \${item.id} | User: \${item.user_id} | Date: \${new Date(item.created_at).toLocaleString('ja-JP')}</div>\`;
                        });
                        html += '</div>';
                    }
                    
                    document.getElementById('previewResult').innerHTML = html;
                    document.getElementById('executeBtn').disabled = false;
                } else {
                    document.getElementById('previewResult').innerHTML = \`<div class="warning-box">エラー: \${result.warning || 'プレビューに失敗しました'}</div>\`;
                }
            } catch (error) {
                document.getElementById('previewResult').innerHTML = \`<div class="warning-box">エラー: \${error.message}</div>\`;
            }
        }
        
        async function executeDelete() {
            if (!confirm('本当に削除しますか？この操作は取り消せません。')) {
                return;
            }
            
            const deleteType = document.getElementById('deleteType').value;
            const payload = {
                delete_type: 'bulk',
                confirm: true
            };
            
            if (deleteType === 'conversation') {
                payload.conversation_id = document.getElementById('deleteConversationId').value;
            } else if (deleteType === 'user') {
                payload.user_id = document.getElementById('deleteUserId').value;
            } else if (deleteType === 'date') {
                payload.older_than_days = parseInt(document.getElementById('deleteOlderThan').value);
            } else if (deleteType === 'combined') {
                const userId = document.getElementById('deleteCombinedUserId').value;
                const days = document.getElementById('deleteCombinedDays').value;
                if (userId) payload.user_id = userId;
                if (days) payload.older_than_days = parseInt(days);
            }
            
            try {
                document.getElementById('executeBtn').disabled = true;
                document.getElementById('executeBtn').textContent = '削除中...';
                
                const response = await fetch('/admin/messages', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert(\`削除完了: \${result.deleted_count}件のメッセージを削除しました\`);
                    closeDeleteModal();
                    window.location.reload(); // ページをリロードして最新状態を表示
                } else {
                    alert(\`削除失敗: \${result.message}\`);
                }
            } catch (error) {
                alert(\`削除エラー: \${error.message}\`);
            } finally {
                document.getElementById('executeBtn').disabled = false;
                document.getElementById('executeBtn').textContent = '🗑️ 削除実行';
            }
        }
        
        // Close modal when clicking outside
        window.onclick = function(event) {
            const modal = document.getElementById('deleteModal');
            if (event.target === modal) {
                closeDeleteModal();
            }
        }
    </script>
</body>
</html>
    `;
  }

  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}