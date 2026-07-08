<script lang="ts">
	import { onDestroy } from 'svelte';

	type Props = {
		target: number;
		targetRange?: [number, number] | null;
		maxPart?: number;
		buttonMax?: number;
		title?: string;
		runToken?: string | null;
		gameName?: string;
		standalone?: boolean;
		onComplete?: (score: number) => void;
		onClose?: () => void;
	};

	let {
		target,
		targetRange = null,
		maxPart,
		buttonMax,
		title,
		runToken = null,
		gameName,
		standalone = false,
		onComplete,
		onClose
	}: Props = $props();

	const displayTitle = $derived(title ?? `${target} 만들기`);
	const resolvedGameName = $derived(gameName ?? `make-${target}`);
	const resolvedMaxPart = $derived(maxPart ?? target);
	const resolvedButtonMax = $derived(buttonMax ?? target);
	const GAME_DURATION = 60;
	const buttons = $derived(Array.from({ length: resolvedButtonMax + 1 }, (_, i) => i));

	type ProblemType = 'pair-top' | 'pair-bottom';
	type Problem = {
		type: ProblemType;
		blankIndex: 0 | 1;
		given: number;
		answer: number;
		target: number;
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
	let correctFlashKey = $state(0);
	let correctWord = $state('');
	let correctEmoji = $state('');
	let submittedScore = $state<number | null>(null);
	let confettiPieces = $state<ConfettiPiece[]>([]);
	let countdownTimer: ReturnType<typeof setInterval> | null = null;
	let sessionTimer: ReturnType<typeof setTimeout> | null = null;
	let audioCtx: AudioContext | null = null;

	const ensureAudio = () => {
		if (!audioCtx) {
			const Ctor =
				window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
			if (Ctor) {
				audioCtx = new Ctor();
			}
		}
		if (audioCtx?.state === 'suspended') {
			void audioCtx.resume();
		}
	};

	const playCorrect = () => {
		ensureAudio();
		if (!audioCtx) return;
		// 밝고 통쾌한 상승 멜로디 (C5 -> E5 -> G5)
		const now = audioCtx.currentTime;
		const notes = [523.25, 659.25, 783.99];
		notes.forEach((freq, index) => {
			const osc = audioCtx!.createOscillator();
			const gain = audioCtx!.createGain();
			osc.type = 'triangle';
			osc.frequency.value = freq;
			const start = now + index * 0.08;
			gain.gain.setValueAtTime(0.0001, start);
			gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
			osc.connect(gain).connect(audioCtx!.destination);
			osc.start(start);
			osc.stop(start + 0.2);
		});
	};

	const playWrong = () => {
		ensureAudio();
		if (!audioCtx) return;
		const now = audioCtx.currentTime;
		// 부드러운 하강 톤 (짧은 '뿡')
		const osc = audioCtx.createOscillator();
		const gain = audioCtx.createGain();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(220, now);
		osc.frequency.exponentialRampToValueAtTime(140, now + 0.18);
		gain.gain.setValueAtTime(0.0001, now);
		gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
		osc.connect(gain).connect(audioCtx.destination);
		osc.start(now);
		osc.stop(now + 0.26);
	};

	const playFinish = () => {
		ensureAudio();
		if (!audioCtx) return;
		// 완료 팡파레 (C-E-G-C 상승)
		const now = audioCtx.currentTime;
		const notes = [523.25, 659.25, 783.99, 1046.5];
		notes.forEach((freq, index) => {
			const osc = audioCtx!.createOscillator();
			const gain = audioCtx!.createGain();
			osc.type = 'triangle';
			osc.frequency.value = freq;
			const start = now + index * 0.12;
			gain.gain.setValueAtTime(0.0001, start);
			gain.gain.exponentialRampToValueAtTime(0.28, start + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
			osc.connect(gain).connect(audioCtx!.destination);
			osc.start(start);
			osc.stop(start + 0.32);
		});
	};

	const generateProblem = (): Problem => {
		const type: ProblemType = Math.random() < 0.5 ? 'pair-top' : 'pair-bottom';
		// targetRange 가 있으면 매 문제마다 랜덤 target, 없으면 고정 target
		const currentTarget = targetRange
			? targetRange[0] + Math.floor(Math.random() * (targetRange[1] - targetRange[0] + 1))
			: target;
		// given 은 1..maxPart, answer = currentTarget - given
		// 두 수 모두 0이 되지 않고 maxPart 를 넘지 않도록 범위 제한
		const minGiven = Math.max(1, currentTarget - resolvedMaxPart);
		const maxGiven = Math.min(resolvedMaxPart, currentTarget - 1);
		const given = minGiven + Math.floor(Math.random() * (maxGiven - minGiven + 1));
		const answer = currentTarget - given;
		const blankIndex: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
		return { type, blankIndex, given, answer, target: currentTarget };
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
		// 게임 종료 즉시 점수 전송
		submittedScore = score;
		onComplete?.(score);
	};

	const beginGame = () => {
		clearTimers();
		ensureAudio();
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

	const handleAnswer = (value: number) => {
		if (phase !== 'running' || !problem) {
			return;
		}

		if (value === problem.answer) {
			score += 1;
			feedbackKey += 1;
			correctFlashKey += 1;
			correctWord = CORRECT_WORDS[Math.floor(Math.random() * CORRECT_WORDS.length)];
			correctEmoji = CORRECT_EMOJIS[Math.floor(Math.random() * CORRECT_EMOJIS.length)];
			playCorrect();
			problem = generateProblem();
		} else {
			wrongShake = true;
			playWrong();
			setTimeout(() => (wrongShake = false), 450);
		}
	};

	const handleClose = () => {
		// 점수를 아직 전송하지 않은 상태로 닫는 경우에도 전송
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
		audioCtx?.close().catch(() => {});
	});
</script>

<section class="game-shell">
	<header class="game-head">
		<div>
			<div class="game-label">{resolvedGameName}</div>
			<h2>{displayTitle}</h2>
		</div>
		{#if phase === 'running'}
			<div class="timer" class:urgent={timeLeft <= 10}>{timeLeft}</div>
		{/if}
	</header>

	{#if phase === 'idle'}
		<div class="idle-screen">
			<div class="idle-emoji">{standalone ? '🎯' : '⏳'}</div>
			<h3 class="idle-title">{displayTitle}</h3>
			{#if standalone}
				<p class="idle-desc">
					두 수를 더해 {targetRange ? `${target} 이하를` : `${target}을(를)`} 만드는 게임이에요.
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

			{#key problem}
				<div class="problem-board problem-enter">
					<!-- 화살표 오버레이: 위쪽 상자들에서 아래쪽 상자들로 향하는 화살표 2개 -->
					<svg class="arrows-overlay" aria-hidden="true">
						<defs>
							<marker
								id="arrowhead"
								markerWidth="5"
								markerHeight="5"
								refX="2.5"
								refY="2.5"
								orient="auto"
							>
								<path d="M0,0 L5,2.5 L0,5 Z" fill="rgba(255,255,255,0.85)" />
							</marker>
						</defs>
						{#if problem.type === 'pair-top'}
							<!-- 위 2개 -> 아래 1개 -->
							<line
								x1="28%"
								y1="26%"
								x2="50%"
								y2="70%"
								class="arrow-line"
								marker-end="url(#arrowhead)"
							/>
							<line
								x1="72%"
								y1="26%"
								x2="50%"
								y2="70%"
								class="arrow-line"
								marker-end="url(#arrowhead)"
							/>
						{:else}
							<!-- 위 1개 -> 아래 2개 -->
							<line
								x1="50%"
								y1="26%"
								x2="28%"
								y2="70%"
								class="arrow-line"
								marker-end="url(#arrowhead)"
							/>
							<line
								x1="50%"
								y1="26%"
								x2="72%"
								y2="70%"
								class="arrow-line"
								marker-end="url(#arrowhead)"
							/>
						{/if}
					</svg>

					<!-- 상자들 -->
					{#if problem.type === 'pair-top'}
						<div class="num-box pos-top-left" class:blank={problem.blankIndex === 0}>
							{problem.blankIndex === 0 ? '?' : problem.given}
						</div>
						<div class="num-box pos-top-right" class:blank={problem.blankIndex === 1}>
							{problem.blankIndex === 1 ? '?' : problem.given}
						</div>
						<div class="target-box pos-bottom-center">{problem.target}</div>
					{:else}
						<div class="target-box pos-top-center">{problem.target}</div>
						<div class="num-box pos-bottom-left" class:blank={problem.blankIndex === 0}>
							{problem.blankIndex === 0 ? '?' : problem.given}
						</div>
						<div class="num-box pos-bottom-right" class:blank={problem.blankIndex === 1}>
							{problem.blankIndex === 1 ? '?' : problem.given}
						</div>
					{/if}
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

		<div
			class="number-pad"
			style={`grid-template-columns: repeat(${Math.min(resolvedButtonMax + 1, 10)}, 1fr);`}
		>
			{#each buttons as number (number)}
				<button type="button" class="num-btn" onclick={() => handleAnswer(number)}>
					{number}
				</button>
			{/each}
		</div>
		<p class="game-footer">
			두 수를 더해 {problem.target}을(를) 만들어요. 빈칸의 숫자를 골라보세요!
		</p>
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
			radial-gradient(circle at top, rgba(255, 217, 102, 0.18), transparent 40%),
			linear-gradient(160deg, #1b2a52 0%, #243b6b 55%, #2a2f63 100%);
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
		background: linear-gradient(135deg, #ffd93d, #7bffb6);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.idle-desc {
		margin: 0;
		color: rgba(238, 243, 255, 0.78);
		line-height: 1.6;
	}

	.waiting-spinner {
		margin-top: 0.75rem;
		width: 2.8rem;
		height: 2.8rem;
		border-radius: 999px;
		border: 4px solid rgba(255, 255, 255, 0.18);
		border-top-color: #ffd93d;
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
		color: #07111f;
		background: linear-gradient(135deg, #ffd93d, #7bffb6);
		cursor: pointer;
		box-shadow: 0 14px 32px rgba(255, 217, 102, 0.3);
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
		gap: 0.5rem;
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
			rgba(255, 217, 102, 0.18) 45%,
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

	/* ===== Problem board ===== */
	.problem-board {
		position: relative;
		width: min(20rem, 100%);
		height: 13rem;
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

	.arrows-overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
		z-index: 1;
	}

	.arrow-line {
		stroke: rgba(255, 255, 255, 0.8);
		stroke-width: 3;
		stroke-linecap: round;
	}

	.num-box,
	.target-box {
		position: absolute;
		transform: translate(-50%, -50%);
		display: grid;
		place-items: center;
		border-radius: 22px;
		font-size: 2.6rem;
		font-weight: 900;
		z-index: 2;
	}

	.target-box {
		width: 7rem;
		height: 5.2rem;
		color: #4a2b00;
		background: linear-gradient(135deg, #ffd93d, #ffb84d);
		box-shadow:
			0 14px 32px rgba(255, 184, 77, 0.4),
			inset 0 2px 0 rgba(255, 255, 255, 0.5);
	}

	.num-box {
		width: 6.2rem;
		height: 5.2rem;
		color: #071a35;
		background: linear-gradient(135deg, #8ec5ff, #7bffb6);
		box-shadow:
			0 14px 32px rgba(123, 255, 182, 0.35),
			inset 0 2px 0 rgba(255, 255, 255, 0.55);
	}

	.num-box.blank {
		background: repeating-linear-gradient(
			135deg,
			rgba(255, 255, 255, 0.18),
			rgba(255, 255, 255, 0.18) 12px,
			rgba(255, 255, 255, 0.06) 12px,
			rgba(255, 255, 255, 0.06) 24px
		);
		border: 3px dashed rgba(255, 255, 255, 0.7);
		color: rgba(255, 255, 255, 0.9);
		box-shadow: none;
		animation: blankGlow 1.6s ease-in-out infinite;
	}

	@keyframes blankGlow {
		0%,
		100% {
			box-shadow: 0 0 0 0 rgba(255, 217, 102, 0);
		}
		50% {
			box-shadow: 0 0 0 8px rgba(255, 217, 102, 0.18);
		}
	}

	/* 상자 위치 클래스 (problem-board 내 퍼센트 좌표) */
	.pos-top-left {
		left: 28%;
		top: 22%;
	}
	.pos-top-right {
		left: 72%;
		top: 22%;
	}
	.pos-top-center {
		left: 50%;
		top: 22%;
	}
	.pos-bottom-left {
		left: 28%;
		top: 78%;
	}
	.pos-bottom-right {
		left: 72%;
		top: 78%;
	}
	.pos-bottom-center {
		left: 50%;
		top: 78%;
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

	.number-pad {
		display: grid;
		gap: 0.5rem;
		max-width: 560px;
		margin: 0 auto;
		width: 100%;
	}

	.num-btn {
		border: 0;
		border-radius: 16px;
		padding: 0.7rem 0;
		font-size: 1.5rem;
		font-weight: 900;
		color: #071a35;
		background: linear-gradient(135deg, #ffffff, #e8f0ff);
		cursor: pointer;
		box-shadow:
			0 5px 0 rgba(0, 0, 0, 0.18),
			0 10px 22px rgba(0, 0, 0, 0.18);
		transition:
			transform 0.08s ease,
			box-shadow 0.08s ease;
	}

	.num-btn:hover {
		transform: translateY(-2px);
	}

	.num-btn:active {
		transform: translateY(4px);
		box-shadow:
			0 1px 0 rgba(0, 0, 0, 0.18),
			0 4px 10px rgba(0, 0, 0, 0.18);
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
		background: linear-gradient(135deg, #ffd93d, #7bffb6);
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
		background: linear-gradient(135deg, #8ec5ff, #7bffb6);
		cursor: pointer;
		box-shadow: 0 12px 30px rgba(123, 255, 182, 0.35);
		transition: transform 0.15s ease;
	}

	.confirm-btn:hover {
		transform: translateY(-2px);
	}

	@media (max-width: 540px) {
		.target-box,
		.num-box {
			width: 5rem;
			height: 4.4rem;
			font-size: 2.1rem;
		}

		.problem-board {
			height: 11rem;
		}

		.num-btn {
			font-size: 1.2rem;
			padding: 0.55rem 0;
		}
	}
</style>
