<script lang="ts">
	import { onDestroy } from 'svelte';
	import { disposeAudio, playCorrect, playFinish, playWrong, primeAudio } from '$lib/game-sound';

	type Props = {
		runToken?: string | null;
		gameName?: string;
		standalone?: boolean;
		onComplete?: (score: number) => void;
		onClose?: () => void;
	};

	let {
		runToken = null,
		gameName = 'compare',
		standalone = false,
		onComplete,
		onClose
	}: Props = $props();

	const GAME_DURATION = 60;

	// 두 수의 범위: 10보다 크고 20보다 작은 자연수 (11~19)
	const MIN_NUM = 11;
	const MAX_NUM = 19;

	type AskType = 'larger' | 'smaller';
	type Problem = {
		left: number;
		right: number;
		ask: AskType;
		answer: 'left' | 'right';
	};

	type ConfettiPiece = {
		id: number;
		left: number;
		delay: number;
		duration: number;
		emoji: string;
	};

	type Phase = 'idle' | 'running' | 'finished';

	const CONFETTI_EMOJIS = ['⭐', '🎉', '✨', '🌟', '💫', '🎊', '🌈', '🎈'];
	const CORRECT_WORDS = ['정답!', '맞았어!', '멋져!', '잘했어!', '딩동댕!'];
	const CORRECT_EMOJIS = ['✨', '🎉', '🌟', '💫', '👍', '⭐', '🎊'];

	let currentToken = '';
	let phase = $state<Phase>('idle');
	let score = $state(0);
	let timeLeft = $state(GAME_DURATION);
	let problem = $state<Problem | null>(null);
	let feedbackKey = $state(0);
	let wrongShake = $state(false);
	let wrongSide = $state<'left' | 'right' | null>(null);
	let correctFlashKey = $state(0);
	let correctWord = $state('');
	let correctEmoji = $state('');
	let submittedScore = $state<number | null>(null);
	let confettiPieces = $state<ConfettiPiece[]>([]);
	let countdownTimer: ReturnType<typeof setInterval> | null = null;
	let sessionTimer: ReturnType<typeof setTimeout> | null = null;

	const generateProblem = (): Problem => {
		// 두 수는 서로 달라야 비교가 의미 있음
		const left = MIN_NUM + Math.floor(Math.random() * (MAX_NUM - MIN_NUM + 1));
		let right = MIN_NUM + Math.floor(Math.random() * (MAX_NUM - MIN_NUM + 1));
		while (right === left) {
			right = MIN_NUM + Math.floor(Math.random() * (MAX_NUM - MIN_NUM + 1));
		}
		const ask: AskType = Math.random() < 0.5 ? 'larger' : 'smaller';
		const leftIsAnswer = ask === 'larger' ? left > right : left < right;
		return { left, right, ask, answer: leftIsAnswer ? 'left' : 'right' };
	};

	const generateConfetti = (): ConfettiPiece[] => {
		return Array.from({ length: 36 }, (_, index) => ({
			id: index,
			left: Math.random() * 100,
			delay: Math.random() * 0.8,
			duration: 1.8 + Math.random() * 1.8,
			emoji: CONFETTI_EMOJIS[index % CONFETTI_EMOJIS.length]
		}));
	};

	const clearTimers = () => {
		if (countdownTimer) {
			clearInterval(countdownTimer);
			countdownTimer = null;
		}
		if (sessionTimer) {
			clearTimeout(sessionTimer);
			sessionTimer = null;
		}
	};

	const finishGame = () => {
		if (phase !== 'running') {
			return;
		}

		clearTimers();
		confettiPieces = generateConfetti();
		phase = 'finished';
		playFinish();
		submittedScore = score;
		onComplete?.(score);
	};

	const beginGame = () => {
		clearTimers();
		primeAudio();
		score = 0;
		feedbackKey = 0;
		correctFlashKey = 0;
		timeLeft = GAME_DURATION;
		problem = generateProblem();
		confettiPieces = [];
		submittedScore = null;
		phase = 'running';

		countdownTimer = setInterval(() => {
			timeLeft -= 1;
			if (timeLeft <= 0) {
				finishGame();
			}
		}, 1000);

		sessionTimer = setTimeout(() => finishGame(), GAME_DURATION * 1000);
	};

	const handleAnswer = (side: 'left' | 'right') => {
		if (phase !== 'running' || !problem) {
			return;
		}

		if (side === problem.answer) {
			score += 1;
			feedbackKey += 1;
			correctFlashKey += 1;
			correctWord = CORRECT_WORDS[Math.floor(Math.random() * CORRECT_WORDS.length)];
			correctEmoji = CORRECT_EMOJIS[Math.floor(Math.random() * CORRECT_EMOJIS.length)];
			playCorrect();
			problem = generateProblem();
		} else {
			wrongShake = true;
			wrongSide = side;
			playWrong();
			setTimeout(() => {
				wrongShake = false;
				wrongSide = null;
			}, 450);
		}
	};

	const handleClose = () => {
		if (submittedScore === null) {
			submittedScore = score;
			onComplete?.(score);
		}
		clearTimers();
		phase = 'idle';
		problem = null;
		onClose?.();
	};

	const resultMessage = $derived(
		score >= 20 ? '최고예요!' : score >= 10 ? '참 잘했어요!' : '잘했어요!'
	);
	const resultEmoji = $derived(score >= 20 ? '🏆' : score >= 10 ? '🌟' : '😊');

	$effect(() => {
		if (!runToken || runToken === currentToken) {
			return;
		}

		currentToken = runToken;
		beginGame();
	});

	onDestroy(() => {
		clearTimers();
		disposeAudio();
	});
</script>

<section class="game-shell">
	<header class="game-head">
		<div>
			<div class="game-label">{gameName}</div>
			<h2>큰 수 작은 수</h2>
		</div>
		{#if phase === 'running'}
			<div class="timer" class:urgent={timeLeft <= 10}>{timeLeft}</div>
		{/if}
	</header>

	{#if phase === 'idle'}
		<div class="idle-screen">
			<div class="idle-emoji">{standalone ? '🎯' : '⏳'}</div>
			<h3 class="idle-title">큰 수 작은 수</h3>
			{#if standalone}
				<p class="idle-desc">
					두 숫자 중에서 더 <strong>큰 수</strong>나 더 <strong>작은 수</strong>를 찾는 게임이에요.
					<br />60초 동안 많이 맞춰보세요!
				</p>
				<button type="button" class="start-btn" onclick={beginGame}>게임 시작</button>
			{:else}
				<p class="idle-desc">선생님이 시작할 때까지 잠시만 기다려주세요.</p>
				<div class="waiting-spinner" aria-label="대기 중"></div>
			{/if}
		</div>
	{:else if phase === 'running' && problem}
		<div class="playfield" class:shake={wrongShake}>
			{#key correctFlashKey}
				{#if correctFlashKey > 0}
					<div class="correct-flash" aria-hidden="true">
						<span class="correct-emoji">{correctEmoji}</span>
						<span class="correct-text">{correctWord}</span>
					</div>
				{/if}
			{/key}

			<div class="prompt">
				{#if problem.ask === 'larger'}
					더 <span class="prompt-accent">큰</span> 수를 골라보세요
				{:else}
					더 <span class="prompt-accent">작은</span> 수를 골라보세요
				{/if}
			</div>

			{#key problem}
				<div class="choice-row problem-enter">
					<button
						type="button"
						class="choice-btn"
						class:wrong={wrongSide === 'left'}
						onclick={() => handleAnswer('left')}
					>
						{problem.left}
					</button>
					<div class="vs-mark">VS</div>
					<button
						type="button"
						class="choice-btn"
						class:wrong={wrongSide === 'right'}
						onclick={() => handleAnswer('right')}
					>
						{problem.right}
					</button>
				</div>
			{/key}

			<div class="scoreline">
				<span class="score-label">점수</span>
				<span class="score-value">{score}</span>
				{#key feedbackKey}
					{#if feedbackKey > 0}
						<span class="score-pop">+1</span>
					{/if}
				{/key}
			</div>
		</div>
		<p class="game-footer">두 숫자 중에서 물음에 맞는 쪽을 골라보세요!</p>
	{:else if phase === 'finished'}
		<div class="result-screen">
			{#each confettiPieces as piece (piece.id)}
				<span
					class="confetti"
					style={`left: ${piece.left}%; animation-delay: ${piece.delay}s; animation-duration: ${piece.duration}s;`}
				>
					{piece.emoji}
				</span>
			{/each}
			<div class="result-content">
				<div class="result-emoji">{resultEmoji}</div>
				<h2 class="result-title">{resultMessage}</h2>
				<div class="result-score">{score}<span>점</span></div>
				<p class="result-sub">60초 동안 풀린 문제예요</p>
				<div class="result-actions">
					{#if standalone}
						<button type="button" class="replay-btn" onclick={beginGame}>다시 하기</button>
					{/if}
					<button type="button" class="confirm-btn" onclick={handleClose}>게임 닫기</button>
				</div>
			</div>
		</div>
	{/if}
</section>

<style>
	.game-shell {
		position: relative;
		display: grid;
		gap: 1rem;
		padding: 1.25rem;
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		grid-template-rows: auto 1fr;
		border-radius: 26px;
		background:
			radial-gradient(circle at top, rgba(167, 139, 250, 0.22), transparent 42%),
			linear-gradient(160deg, #2a1b52 0%, #3b246b 55%, #2f1f63 100%);
		border: 1px solid rgba(255, 255, 255, 0.1);
		overflow: hidden;
	}

	.game-head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: center;
	}

	.game-label {
		font-size: 0.74rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: rgba(238, 243, 255, 0.68);
	}

	h2 {
		margin: 0.2rem 0 0;
		font-size: 1.4rem;
	}

	.timer {
		min-width: 3.6rem;
		text-align: center;
		padding: 0.55rem 0.9rem;
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.12);
		font-weight: 800;
		font-size: 1.6rem;
		color: #fff;
		transition: all 0.25s ease;
	}

	.timer.urgent {
		background: linear-gradient(135deg, #ff7b9c, #ff5e5e);
		color: #fff;
		box-shadow: 0 0 0 4px rgba(255, 123, 156, 0.25);
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.06);
		}
	}

	/* ===== Idle ===== */
	.idle-screen {
		display: grid;
		place-items: center;
		gap: 0.75rem;
		text-align: center;
		min-height: 0;
	}

	.idle-emoji {
		font-size: 4rem;
		animation: bounce 1.4s ease-in-out infinite;
	}

	.idle-title {
		margin: 0;
		font-size: 2rem;
		background: linear-gradient(135deg, #c4b5fd, #7bffb6);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.idle-desc {
		margin: 0;
		color: rgba(238, 243, 255, 0.78);
		line-height: 1.6;
	}

	.idle-desc strong {
		color: #c4b5fd;
	}

	.waiting-spinner {
		margin-top: 0.75rem;
		width: 2.8rem;
		height: 2.8rem;
		border-radius: 999px;
		border: 4px solid rgba(255, 255, 255, 0.18);
		border-top-color: #c4b5fd;
		animation: spin 0.9s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.start-btn {
		margin-top: 0.5rem;
		border: 0;
		border-radius: 999px;
		padding: 1rem 2.6rem;
		font: inherit;
		font-weight: 800;
		font-size: 1.15rem;
		color: #1a0a3a;
		background: linear-gradient(135deg, #c4b5fd, #7bffb6);
		cursor: pointer;
		box-shadow: 0 14px 32px rgba(196, 181, 253, 0.3);
		transition: transform 0.15s ease;
	}

	.start-btn:hover {
		transform: translateY(-2px);
	}

	/* ===== Playfield ===== */
	.playfield {
		position: relative;
		display: grid;
		place-items: center;
		gap: 1.25rem;
		min-height: 0;
		align-self: stretch;
		overflow: hidden;
	}

	.correct-flash {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		justify-items: center;
		gap: 0.25rem;
		pointer-events: none;
		z-index: 5;
		background: radial-gradient(
			circle at center,
			rgba(123, 255, 182, 0.35),
			rgba(196, 181, 253, 0.2) 45%,
			transparent 75%
		);
		animation: flashIn 0.7s ease-out forwards;
	}

	.correct-emoji {
		font-size: 4.5rem;
		line-height: 1;
		animation: emojiPop 0.7s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;
	}

	.correct-text {
		font-size: 2.6rem;
		font-weight: 900;
		color: #fff;
		text-shadow:
			0 0 18px rgba(123, 255, 182, 0.9),
			0 4px 0 rgba(0, 0, 0, 0.25);
		animation: textPop 0.7s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;
	}

	@keyframes flashIn {
		0% {
			opacity: 0;
			transform: scale(0.6);
		}
		25% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: scale(1.25);
		}
	}

	@keyframes emojiPop {
		0% {
			opacity: 0;
			transform: scale(0.2) rotate(-25deg);
		}
		40% {
			opacity: 1;
			transform: scale(1.5) rotate(12deg);
		}
		70% {
			transform: scale(1) rotate(-4deg);
		}
		100% {
			opacity: 0;
			transform: scale(1.4) rotate(0deg) translateY(-30px);
		}
	}

	@keyframes textPop {
		0% {
			opacity: 0;
			transform: scale(0.4) translateY(20px);
		}
		35% {
			opacity: 1;
			transform: scale(1.3) translateY(0);
		}
		65% {
			transform: scale(1) translateY(0);
		}
		100% {
			opacity: 0;
			transform: scale(1.1) translateY(-24px);
		}
	}

	.prompt {
		font-size: 1.5rem;
		font-weight: 800;
		color: rgba(238, 243, 255, 0.92);
		text-align: center;
	}

	.prompt-accent {
		display: inline-block;
		padding: 0.05em 0.4em;
		border-radius: 10px;
		background: linear-gradient(135deg, #c4b5fd, #f0abfc);
		color: #1a0a3a;
		margin: 0 0.15em;
	}

	.choice-row {
		display: flex;
		align-items: center;
		gap: 1.25rem;
	}

	.problem-enter {
		animation: boardIn 0.35s ease-out;
	}

	@keyframes boardIn {
		from {
			opacity: 0;
			transform: translateY(14px) scale(0.96);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.choice-btn {
		width: 8rem;
		height: 8rem;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 28px;
		font-size: 3.4rem;
		font-weight: 900;
		color: #1a0a3a;
		background: linear-gradient(135deg, #ffffff, #e8f0ff);
		cursor: pointer;
		box-shadow:
			0 16px 36px rgba(0, 0, 0, 0.28),
			inset 0 2px 0 rgba(255, 255, 255, 0.6);
		transition:
			transform 0.1s ease,
			box-shadow 0.1s ease;
	}

	.choice-btn:hover {
		transform: translateY(-3px);
	}

	.choice-btn:active {
		transform: translateY(2px);
	}

	.choice-btn.wrong {
		background: linear-gradient(135deg, #ff9c9c, #ff5e5e);
		color: #fff;
		animation: wrongPulse 0.45s ease-in-out;
	}

	@keyframes wrongPulse {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(0.92);
		}
	}

	.vs-mark {
		font-size: 1.3rem;
		font-weight: 900;
		color: rgba(255, 255, 255, 0.55);
		letter-spacing: 0.1em;
	}

	.scoreline {
		position: absolute;
		top: 0.5rem;
		right: 0.75rem;
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.score-label {
		font-size: 0.85rem;
		color: rgba(238, 243, 255, 0.7);
		font-weight: 700;
	}

	.score-value {
		font-size: 2rem;
		font-weight: 900;
		color: #fff;
	}

	.score-pop {
		position: absolute;
		top: 0;
		right: -0.25rem;
		font-size: 1.4rem;
		font-weight: 900;
		color: #7bffb6;
		pointer-events: none;
		animation: floatUp 0.9s ease-out forwards;
	}

	@keyframes floatUp {
		0% {
			opacity: 0;
			transform: translateY(0) scale(0.5);
		}
		20% {
			opacity: 1;
			transform: translateY(-8px) scale(1.3);
		}
		100% {
			opacity: 0;
			transform: translateY(-56px) scale(1);
		}
	}

	.shake {
		animation: shake 0.45s ease-in-out;
	}

	@keyframes shake {
		0%,
		100% {
			transform: translateX(0);
		}
		20% {
			transform: translateX(-12px);
		}
		40% {
			transform: translateX(10px);
		}
		60% {
			transform: translateX(-7px);
		}
		80% {
			transform: translateX(5px);
		}
	}

	.game-footer {
		margin: 0;
		text-align: center;
		font-size: 0.88rem;
		color: rgba(238, 243, 255, 0.7);
	}

	/* ===== Result ===== */
	.result-screen {
		position: relative;
		grid-column: 1 / -1;
		grid-row: 1 / -1;
		display: grid;
		place-items: center;
		overflow: hidden;
		min-height: 0;
	}

	.confetti {
		position: absolute;
		top: -2rem;
		font-size: 1.8rem;
		animation-name: confettiFall;
		animation-timing-function: ease-in;
		animation-fill-mode: forwards;
		opacity: 0;
	}

	@keyframes confettiFall {
		0% {
			opacity: 0;
			transform: translateY(-2rem) rotate(0deg);
		}
		10% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translateY(560px) rotate(540deg);
		}
	}

	.result-content {
		position: relative;
		z-index: 2;
		display: grid;
		justify-items: center;
		gap: 0.5rem;
		text-align: center;
		padding: 2rem 2.4rem;
		border-radius: 28px;
		background: rgba(10, 16, 30, 0.72);
		border: 1px solid rgba(255, 255, 255, 0.12);
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(12px);
		animation: resultIn 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28);
	}

	@keyframes resultIn {
		from {
			opacity: 0;
			transform: scale(0.7) translateY(20px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.result-emoji {
		font-size: 5rem;
		line-height: 1;
		animation: bounce 1.2s ease-in-out infinite;
	}

	@keyframes bounce {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-12px);
		}
	}

	.result-title {
		margin: 0;
		font-size: 2rem;
		background: linear-gradient(135deg, #c4b5fd, #7bffb6);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.result-score {
		font-size: 4.5rem;
		font-weight: 900;
		color: #fff;
		line-height: 1;
	}

	.result-score span {
		font-size: 1.6rem;
		margin-left: 0.25rem;
		color: rgba(238, 243, 255, 0.8);
	}

	.result-sub {
		margin: 0 0 0.75rem;
		color: rgba(238, 243, 255, 0.68);
	}

	.result-actions {
		display: flex;
		gap: 0.75rem;
	}

	.replay-btn {
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 999px;
		padding: 0.85rem 1.8rem;
		font: inherit;
		font-weight: 800;
		color: #eef3ff;
		background: rgba(255, 255, 255, 0.08);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.replay-btn:hover {
		background: rgba(255, 255, 255, 0.16);
	}

	.confirm-btn {
		border: 0;
		border-radius: 999px;
		padding: 0.85rem 2rem;
		font: inherit;
		font-weight: 800;
		font-size: 1.05rem;
		color: #07111f;
		background: linear-gradient(135deg, #c4b5fd, #7bffb6);
		cursor: pointer;
		box-shadow: 0 12px 30px rgba(123, 255, 182, 0.35);
		transition: transform 0.15s ease;
	}

	.confirm-btn:hover {
		transform: translateY(-2px);
	}

	@media (max-width: 540px) {
		.choice-btn {
			width: 6rem;
			height: 6rem;
			font-size: 2.4rem;
		}
	}
</style>
