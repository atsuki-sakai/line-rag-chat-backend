<script lang="ts">
	import { onMount } from 'svelte';
	import type { MessageStatsResponse, MessageListResponse } from 'shared';
	
	let messages: any[] = [];
	let stats = {
		total_messages: 0,
		unique_users: 0,
		unique_conversations: 0
	};
	
	onMount(async () => {
		try {
			// Stats API call
			const statsResponse = await fetch('/api/admin/stats');
			if (statsResponse.ok) {
				const statsData: MessageStatsResponse = await statsResponse.json();
				if (statsData.success && statsData.data) {
					stats = statsData.data;
				}
			}
			
			// Messages API call
			const messagesResponse = await fetch('/api/admin/messages?limit=10');
			if (messagesResponse.ok) {
				const messagesData: MessageListResponse = await messagesResponse.json();
				if (messagesData.success && messagesData.data) {
					messages = messagesData.data;
				}
			}
		} catch (error) {
			console.error('Failed to load data:', error);
		}
	});
</script>

<svelte:head>
	<title>LINE メッセージダッシュボード</title>
</svelte:head>

<div class="dashboard">
	<div class="stats-grid">
		<div class="stat-card">
			<div class="stat-value">{stats.total_messages}</div>
			<div class="stat-label">総メッセージ数</div>
		</div>
		<div class="stat-card">
			<div class="stat-value">{stats.unique_users}</div>
			<div class="stat-label">ユニークユーザー</div>
		</div>
		<div class="stat-card">
			<div class="stat-value">{stats.unique_conversations}</div>
			<div class="stat-label">会話数</div>
		</div>
	</div>
	
	<div class="messages-section">
		<h2>最新メッセージ</h2>
		{#if messages.length > 0}
			<div class="messages-list">
				{#each messages as message}
					<div class="message-card">
						<div class="message-header">
							<span class="user-id">User: {message.user_id}</span>
							<span class="message-time">
								{new Date(message.created_at).toLocaleString('ja-JP')}
							</span>
						</div>
						{#if message.message_content}
							<div class="user-message">
								{message.message_content}
							</div>
						{/if}
						{#if message.dify_response}
							<div class="ai-response">
								{message.dify_response}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<p>メッセージが見つかりません</p>
		{/if}
	</div>
</div>

<style>
	.dashboard {
		space-y: 2rem;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.stat-card {
		background: white;
		padding: 1.5rem;
		border-radius: 12px;
		box-shadow: 0 1px 3px rgba(0,0,0,0.1);
		text-align: center;
	}

	.stat-value {
		font-size: 2rem;
		font-weight: bold;
		color: #2b6cb0;
		margin-bottom: 0.5rem;
	}

	.stat-label {
		font-size: 0.875rem;
		color: #718096;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.messages-section {
		background: white;
		border-radius: 12px;
		box-shadow: 0 1px 3px rgba(0,0,0,0.1);
		overflow: hidden;
	}

	.messages-section h2 {
		padding: 1.5rem;
		margin: 0;
		border-bottom: 1px solid #f7fafc;
	}

	.messages-list {
		divide-y: 1px solid #f7fafc;
	}

	.message-card {
		padding: 1rem 1.5rem;
		transition: background-color 0.2s;
	}

	.message-card:hover {
		background: #f7fafc;
	}

	.message-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
		font-size: 0.875rem;
	}

	.user-id {
		font-weight: 600;
		color: #4a5568;
	}

	.message-time {
		color: #718096;
	}

	.user-message {
		background: #ebf8ff;
		padding: 0.75rem;
		border-radius: 8px;
		border-left: 3px solid #4299e1;
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.ai-response {
		background: #f0fff4;
		padding: 0.75rem;
		border-radius: 8px;
		border-left: 3px solid #48bb78;
		font-size: 0.875rem;
		line-height: 1.5;
	}
</style>