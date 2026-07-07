<script lang="ts">
	import MakeTenGame from '$lib/games/MakeTenGame.svelte';

	const handleComplete = (score: number) => {
		console.log('게임 종료 — 점수:', score);
	};

	const handleClose = () => {
		console.log('게임 닫기');
	};
</script>

<svelte:head>
	<title>게임 테스트 - 10 만들기</title>
	<meta name="description" content="10 만들기 수학 게임을 단독으로 테스트하는 페이지입니다." />
</svelte:head>

<div class="stage">
	<MakeTenGame standalone onComplete={handleComplete} onClose={handleClose} />
</div>

<style>
	:global(body) {
		margin: 0;
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
		background:
			radial-gradient(circle at top right, rgba(255, 217, 102, 0.18), transparent 30%),
			linear-gradient(135deg, #07111f 0%, #0e1a36 45%, #1a2342 100%);
		color: #eef3ff;
	}

	.stage {
		width: min(560px, 100%);
		height: min(88vh, 820px);
		margin: 2rem auto;
		border-radius: 28px;
		overflow: hidden;
	}

	@media (max-width: 900px) {
		.stage {
			margin: 0;
			height: 100vh;
			border-radius: 0;
		}
	}
</style>
