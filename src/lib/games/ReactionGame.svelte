<script lang="ts">
	import { onDestroy } from 'svelte';

	type Props = {
		runToken: string | null;
		gameName: string;
		onComplete: (score: number) => void;
	};

	let { runToken, gameName, onComplete }: Props = $props();

	let currentToken = '';
	let score = $state(0);
	let timeLeft = $state(0);
	let isRunning = $state(false);
	let targetX = $state(50);
	let targetY = $state(50);
	let roundTimer: ReturnType<typeof setInterval> | null = null;
	let countdownTimer: ReturnType<typeof setInterval> | null = null;
	let sessionTimer: ReturnType<typeof setTimeout> | null = null;

	const clearTimers = () => {
		if (roundTimer) {
			clearInterval(roundTimer);
			roundTimer = null;
		}

		if (countdownTimer) {
			clearInterval(countdownTimer);
			countdownTimer = null;
		}

		if (sessionTimer) {
			clearTimeout(sessionTimer);
			sessionTimer = null;
		}
	};

	const randomizeTarget = () => {
		targetX = 10 + Math.random() * 80;
		targetY = 18 + Math.random() * 54;
	};

	const finishGame = () => {
		if (!isRunning) {
			return;
		}

		isRunning = false;
		clearTimers();
		onComplete(score);
	};

	const startGame = () => {
		clearTimers();
		score = 0;
		timeLeft = 10;
		isRunning = true;
		randomizeTarget();

		countdownTimer = setInterval(() => {
			timeLeft -= 1;
			if (timeLeft <= 0) {
				finishGame();
			}
		}, 1000);

		roundTimer = setInterval(() => {
			randomizeTarget();
		}, 1200);

		sessionTimer = setTimeout(() => finishGame(), 10000);
	};

	const hitTarget = () => {
		if (!isRunning) {
			return;
		}

		score += 1;
		randomizeTarget();
	};

	$effect(() => {
		if (!runToken || runToken === currentToken) {
			return;
		}

		currentToken = runToken;
		startGame();
	});

	onDestroy(() => {
		clearTimers();
	});
</script>

<section class="game-shell">
	<div class="game-head">
		<div>
			<div class="game-label">{gameName}</div>
			<h2>반응 속도 게임</h2>
		</div>
		<div class="timer">{timeLeft}s</div>
	</div>

	{#if isRunning}
		<div class="playfield" aria-label="반응 속도 게임">
			<button
				type="button"
				class="target"
				style={`left: ${targetX}%; top: ${targetY}%;`}
				onclick={hitTarget}
			>
				+</button
			>
		</div>
		<div class="game-footer">클릭할수록 점수가 올라갑니다. 시간이 끝나면 자동으로 종료됩니다.</div>
	{:else}
		<div class="waiting-state">게임을 시작할 준비가 되었습니다.</div>
	{/if}

	<div class="scoreline">점수 {score}</div>
</section>

<style>
	.game-shell {
		display: grid;
		gap: 1rem;
		padding: 1rem;
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		grid-template-rows: auto 1fr auto;
		border-radius: 22px;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.game-head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: center;
	}

	.game-label {
		font-size: 0.78rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: rgba(238, 243, 255, 0.68);
	}

	h2 {
		margin: 0.2rem 0 0;
		font-size: 1.35rem;
	}

	.timer,
	.scoreline {
		font-weight: 800;
		font-size: 1rem;
	}

	.playfield {
		position: relative;
		min-height: 0;
		height: 100%;
		border-radius: 20px;
		background:
			radial-gradient(circle at top, rgba(123, 255, 182, 0.16), transparent 34%),
			linear-gradient(135deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.08));
		overflow: hidden;
		align-self: stretch;
	}

	.target {
		position: absolute;
		transform: translate(-50%, -50%);
		width: 4rem;
		height: 4rem;
		border: 0;
		border-radius: 999px;
		background: linear-gradient(135deg, #8ec5ff, #7bffb6);
		font-size: 1.6rem;
		font-weight: 900;
		color: #07111f;
		cursor: pointer;
		box-shadow: 0 16px 40px rgba(123, 255, 182, 0.35);
	}

	.waiting-state,
	.game-footer {
		padding: 0.95rem 1rem;
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.05);
		color: rgba(238, 243, 255, 0.8);
	}
</style>
