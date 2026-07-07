<script lang="ts">
	const links = [
		{
			href: '/teacher',
			title: '선생님 화면',
			description: '학생 방을 만들고 카드별로 연결 상태와 점수를 확인합니다.'
		},
		{
			href: '/st',
			title: '학생 화면',
			description: '4자리 코드와 학생 번호로 방에 들어가 점수와 메모를 보냅니다.'
		}
	];
</script>

<svelte:head>
	<title>Class Game</title>
	<meta name="description" content="선생님과 학생이 Trystero로 연결되는 대시보드입니다." />
</svelte:head>

<div class="landing-shell">
	<section class="hero">
		<div class="eyebrow">Class Game</div>
		<h1>선생님과 학생이 Trystero로 연결되는 화면</h1>
		<p>선생님은 학생별 방을 만들고, 학생은 /st에서 연결해 점수와 메모를 보냅니다.</p>
	</section>

	<div class="link-grid">
		{#each links as link}
			<a class="link-card" href={link.href}>
				<strong>{link.title}</strong>
				<span>{link.description}</span>
			</a>
		{/each}
	</div>
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
			radial-gradient(circle at top left, rgba(79, 209, 197, 0.22), transparent 30%),
			linear-gradient(135deg, #06111f 0%, #0b1323 45%, #111827 100%);
		color: #f4f7ff;
	}

	.landing-shell {
		min-height: 100vh;
		padding: 2rem;
		display: grid;
		gap: 1.5rem;
		align-content: center;
	}

	.hero,
	.link-card {
		backdrop-filter: blur(18px);
		background: rgba(10, 16, 30, 0.72);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 24px;
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
	}

	.hero {
		padding: 1.75rem;
	}

	.eyebrow {
		letter-spacing: 0.16em;
		text-transform: uppercase;
		font-size: 0.72rem;
		color: #8ec5ff;
		font-weight: 700;
	}

	h1 {
		margin: 0.75rem 0 0.75rem;
		font-size: clamp(2rem, 5vw, 4rem);
		line-height: 1.02;
		max-width: 12ch;
	}

	p {
		margin: 0;
		max-width: 60ch;
		line-height: 1.6;
		color: rgba(244, 247, 255, 0.78);
	}

	.link-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	.link-card {
		padding: 1.25rem;
		color: inherit;
		text-decoration: none;
		display: grid;
		gap: 0.4rem;
		transition:
			transform 0.2s ease,
			border-color 0.2s ease,
			background 0.2s ease;
	}

	.link-card:hover {
		transform: translateY(-2px);
		border-color: rgba(142, 197, 255, 0.5);
		background: rgba(12, 21, 40, 0.82);
	}

	.link-card strong {
		font-size: 1.1rem;
	}

	.link-card span {
		color: rgba(244, 247, 255, 0.72);
		line-height: 1.5;
	}

	@media (max-width: 720px) {
		.landing-shell {
			padding: 1rem;
		}

		.link-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
