<script lang="ts">
	import '../app.css';
</script>

<div class="app">
	<header>
		<nav>
			<h1>📱 LINE メッセージダッシュボード</h1>
		</nav>
	</header>
	
	<main>
		<slot />
	</main>
</div>

<style>
	.app {
		min-height: 100vh;
		background: #f5f7fa;
	}

	header {
		background: white;
		box-shadow: 0 1px 3px rgba(0,0,0,0.1);
		padding: 1rem 2rem;
	}

	nav h1 {
		margin: 0;
		color: #1a202c;
	}

	main {
		padding: 2rem;
		max-width: 1200px;
		margin: 0 auto;
	}
</style>