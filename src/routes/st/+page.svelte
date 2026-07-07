<script lang="ts">
	import { onMount } from 'svelte';
	import {
		DEFAULT_GAME_NAME,
		loadGameComponent,
		normalizeRoomCode,
		normalizeStudentNumber,
		roomName
	} from '$lib';
	import type { GameControlMessage, StudentScorePayload } from '$lib';

	let joinRoomFn: any = $state(null);
	let room: any = $state(null);
	let controlAction: any = $state(null);
	let scoreAction: any = $state(null);
	let GameComponent: any = $state(null);
	let isConnect = $state(false);
	let status = $state('아직 연결되지 않았습니다.');
	let phase = $state<'idle' | 'connected' | 'prepared' | 'running' | 'result'>('idle');
	let roomCode = $state('');
	let studentNumber = $state('');
	let connectedRoom = $state('');
	let preparedGameName = $state(DEFAULT_GAME_NAME);
	let activeGameName = $state(DEFAULT_GAME_NAME);
	let runToken = $state('');
	let resultScore = $state<number | null>(null);
	let scoreHistory = $state<StudentScorePayload[]>([]);

	const loadTrystero = async () => {
		if (!joinRoomFn) {
			const module = await import('trystero');
			joinRoomFn = module.joinRoom;
		}
	};

	const ensureGameComponent = async (gameName: string) => {
		if (!GameComponent || preparedGameName !== gameName) {
			GameComponent = await loadGameComponent(gameName);
		}
	};

	const leaveRoom = () => {
		room?.leave?.();
		room = null;
		controlAction = null;
		scoreAction = null;
		GameComponent = null;
		isConnect = false;
		phase = 'idle';
		connectedRoom = '';
		runToken = '';
		preparedGameName = DEFAULT_GAME_NAME;
		activeGameName = DEFAULT_GAME_NAME;
		resultScore = null;
		status = '아직 연결되지 않았습니다.';
	};

	const connectRoom = async () => {
		const code = roomCode.trim();
		const number = Number(studentNumber);

		if (!/^\d{4}$/.test(code) || !Number.isInteger(number) || number < 1) {
			status = '4자리 숫자 코드와 학생 번호를 먼저 입력하세요.';
			isConnect = false;
			return null;
		}

		const nextRoom = roomName(code, number);

		if (connectedRoom === nextRoom && room && controlAction && scoreAction) {
			isConnect = true;
			phase = phase === 'idle' ? 'connected' : phase;
			status = '연결';
			return { room, controlAction, scoreAction, nextRoom };
		}

		leaveRoom();
		await loadTrystero();

		if (!joinRoomFn) {
			status = 'Trystero를 불러오지 못했습니다.';
			return null;
		}

		room = joinRoomFn({ appId: 'class-game-room-v1' }, nextRoom);
		controlAction = room.makeAction('student-control');
		scoreAction = room.makeAction('student-score');

		controlAction.onMessage = async (payload: GameControlMessage) => {
			if (payload.type === 'prepare') {
				await ensureGameComponent(payload.gameName);
				preparedGameName = payload.gameName;
				activeGameName = payload.gameName;
				phase = 'prepared';
				status = `${payload.gameName} 게임 준비 완료`;
				return;
			}

			if (payload.type === 'start') {
				await ensureGameComponent(payload.gameName);
				preparedGameName = payload.gameName;
				activeGameName = payload.gameName;
				runToken = payload.runToken;
				phase = 'running';
				status = '게임이 시작되었습니다.';
				return;
			}

			if (payload.type === 'cancel') {
				// 교사가 게임을 취소하면 모달 해제
				resetGameSession();
				phase = 'connected';
				status = '게임이 취소되었습니다.';
			}
		};

		// 선생님(피어)이 방을 떠나면 접속 종료로 간주하고 게임 모달 해제
		room.onPeerLeave = () => {
			if (phase === 'prepared' || phase === 'running' || phase === 'result') {
				resetGameSession();
			}
			isConnect = false;
			phase = 'idle';
			status = '선생님과 연결이 끊어졌습니다.';
		};

		scoreAction.onMessage = (payload: StudentScorePayload) => {
			scoreHistory = [payload, ...scoreHistory].slice(0, 20);
			status = `${nextRoom} 점수가 전달되었습니다.`;
			resultScore = payload.score;
			phase = 'result';
		};

		connectedRoom = nextRoom;
		isConnect = true;
		phase = 'connected';
		status = '연결';
		return { room, controlAction, scoreAction, nextRoom };
	};

	const sendGameScore = async (currentScore: number) => {
		const connection = await connectRoom();
		if (!connection) {
			return;
		}

		const payload: StudentScorePayload = {
			room: connection.nextRoom,
			studentNumber: Number(studentNumber),
			gameName: activeGameName || preparedGameName,
			score: currentScore,
			sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
		};

		await connection.scoreAction.send(payload);
		scoreHistory = [payload, ...scoreHistory].slice(0, 20);
		status = `${payload.gameName} 점수가 자동으로 전송되었습니다.`;
		resultScore = currentScore;
		phase = 'result';
	};

	const resetGameSession = () => {
		GameComponent = null;
		runToken = '';
		resultScore = null;
		preparedGameName = DEFAULT_GAME_NAME;
		activeGameName = DEFAULT_GAME_NAME;
	};

	const handleGameComplete = async (currentScore: number) => {
		await sendGameScore(currentScore);
	};

	const handleCloseGame = () => {
		// 결과 보고 닫기: 게임 세션 초기화, 일반 연결 상태로 복귀
		resetGameSession();
		phase = 'connected';
		status = '연결';
	};

	const handleConnect = async () => {
		await connectRoom();
	};

	onMount(() => leaveRoom);
</script>

<svelte:head>
	<title>학생 방 입장</title>
	<meta
		name="description"
		content="학생이 4자리 코드와 번호로 Trystero 방에 들어가 게임 준비와 시작 신호를 받고 점수를 자동 전송합니다."
	/>
</svelte:head>

<svelte:boundary>
	<!-- 게임 모달: page-shell과 형제로 두어 backdrop-filter 함정 회피 -->
	{#if (phase === 'prepared' || phase === 'running') && GameComponent}
		<div class="game-modal" aria-modal="true" role="dialog">
			<div class="game-modal-surface">
				<GameComponent
					{runToken}
					gameName={preparedGameName}
					onComplete={handleGameComplete}
					onClose={handleCloseGame}
				/>
			</div>
		</div>
	{/if}

	{#if phase === 'result'}
		<div class="result-modal" aria-modal="true" role="dialog">
			<div class="result-card">
				<div class="panel-title">게임 결과</div>
				<h2>{preparedGameName}</h2>
				<p class="result-score">{resultScore ?? 0}점</p>
				<p>게임이 종료되었습니다. 종료 버튼을 누르면 원래 화면으로 돌아갑니다.</p>
				<button type="button" class="close-button" onclick={handleCloseGame}>게임 닫기</button>
			</div>
		</div>
	{/if}
</svelte:boundary>

<!-- 게임이 진행/준비 중일 때 뒤의 UI를 비활성화 -->
<div class="page-shell student-shell" inert={phase === 'prepared' || phase === 'running'}>
	<section class="hero-card">
		<div class="eyebrow">Student Console</div>
		<h1>코드와 번호로 방에 들어가 게임을 기다립니다.</h1>
		<p>
			연결되면 준비가 크게 표시되고, 교사가 보내는 준비/시작 신호에 따라 게임이 전체 화면 모달로
			열립니다.
		</p>

		<div class="form-grid">
			<label>
				<span>4자리 코드</span>
				<input
					value={roomCode}
					oninput={(event) =>
						(roomCode = normalizeRoomCode((event.currentTarget as HTMLInputElement).value))}
					inputmode="numeric"
					maxlength="4"
					placeholder="1234"
				/>
			</label>
			<label>
				<span>학생 번호</span>
				<input
					value={studentNumber}
					oninput={(event) =>
						(studentNumber = normalizeStudentNumber(
							(event.currentTarget as HTMLInputElement).value
						))}
					inputmode="numeric"
					maxlength="3"
					placeholder="1"
				/>
			</label>
		</div>

		<div class="actions">
			<button type="button" onclick={handleConnect} disabled={isConnect}>
				{isConnect ? '연결됨' : '연결'}
			</button>
			<div class="status">{status}</div>
		</div>

		<div
			class:banner-connected={phase === 'connected'}
			class:banner-prepared={phase === 'prepared'}
			class:banner-running={phase === 'running'}
			class:banner-result={phase === 'result'}
			class:banner-disconnected={phase === 'idle'}
			class="ready-banner"
		>
			{phase === 'idle'
				? '연결 안됨'
				: phase === 'connected'
					? '연결'
					: phase === 'prepared'
						? '게임준비'
						: phase === 'running'
							? '게임시작'
							: '결과'}
		</div>

		<div class="game-meta">
			<span>연결 방: {connectedRoom || '대기 중'}</span>
			<span>게임: {preparedGameName}</span>
		</div>
	</section>

	<section class="panel-card">
		<div class="panel-title">게임 화면</div>
		{#if phase === 'idle'}
			<p class="empty-state">먼저 연결하면 준비 상태가 표시됩니다.</p>
		{:else if phase === 'prepared'}
			<p class="empty-state">게임이 준비되었습니다. 전체 화면 게임이 열려 있습니다.</p>
		{:else if phase === 'running'}
			<p class="empty-state">게임이 진행 중입니다. 전체 화면 게임이 열려 있습니다.</p>
		{:else if phase === 'result'}
			<p class="empty-state">게임이 종료되었습니다. 결과 창을 확인해 주세요.</p>
		{:else}
			<p class="empty-state">게임 컴포넌트를 불러오는 중입니다.</p>
		{/if}
	</section>

	<section class="panel-card">
		<div class="panel-title">전송 기록</div>
		{#if scoreHistory.length}
			<ul class="message-list">
				{#each scoreHistory as item}
					<li>
						<strong>{item.gameName}</strong>
						<span>{item.room}</span>
						<p>점수: {item.score}</p>
						<small>{item.sentAt}</small>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty-state">점수 전송 기록이 여기에 표시됩니다.</p>
		{/if}
	</section>
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
			radial-gradient(circle at top left, rgba(72, 187, 120, 0.2), transparent 28%),
			linear-gradient(135deg, #081120 0%, #0d1728 45%, #121d33 100%);
		color: #eef3ff;
	}

	.page-shell {
		min-height: 100vh;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.5rem;
		padding: 2rem;
	}

	.hero-card,
	.panel-card {
		backdrop-filter: blur(18px);
		background: rgba(10, 16, 30, 0.7);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 24px;
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.3);
		padding: 1.5rem;
	}

	.hero-card {
		grid-column: 1 / -1;
		display: grid;
		gap: 1rem;
		position: relative;
	}

	.eyebrow,
	.panel-title {
		letter-spacing: 0.16em;
		text-transform: uppercase;
		font-size: 0.72rem;
		color: #8ec5ff;
		font-weight: 700;
	}

	h1 {
		margin: 0.75rem 0 0.75rem;
		font-size: clamp(2rem, 4vw, 3.6rem);
		line-height: 1.03;
		max-width: 16ch;
	}

	p {
		margin: 0;
		color: rgba(238, 243, 255, 0.78);
		line-height: 1.6;
	}

	.form-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	label {
		display: grid;
		gap: 0.5rem;
	}

	label span {
		font-size: 0.85rem;
		font-weight: 600;
		color: rgba(238, 243, 255, 0.84);
	}

	input {
		width: 100%;
		box-sizing: border-box;
		border-radius: 16px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.05);
		color: #fff;
		padding: 0.95rem 1rem;
		font: inherit;
		outline: none;
	}

	input:focus {
		border-color: rgba(142, 197, 255, 0.9);
		box-shadow: 0 0 0 4px rgba(142, 197, 255, 0.16);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	button {
		border: 0;
		border-radius: 999px;
		padding: 0.95rem 1.35rem;
		font: inherit;
		font-weight: 700;
		color: #081120;
		background: linear-gradient(135deg, #8ec5ff, #7bffb6);
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.7;
		cursor: progress;
	}

	.status {
		color: rgba(238, 243, 255, 0.72);
	}

	.ready-banner {
		padding: 1.25rem 1rem;
		border-radius: 22px;
		background: rgba(123, 255, 182, 0.14);
		color: #ecfff4;
		font-size: clamp(2.5rem, 10vw, 5rem);
		font-weight: 900;
		text-align: center;
		letter-spacing: 0.08em;
	}

	.ready-banner.banner-disconnected {
		background: rgba(255, 123, 123, 0.18);
		color: #ffd6d6;
	}

	.ready-banner.banner-connected {
		background: rgba(123, 255, 182, 0.14);
		color: #ecfff4;
	}

	.ready-banner.banner-prepared {
		background: rgba(142, 197, 255, 0.16);
		color: #eef6ff;
	}

	.ready-banner.banner-running {
		background: rgba(255, 208, 123, 0.16);
		color: #fff5e0;
	}

	.ready-banner.banner-result {
		background: rgba(183, 123, 255, 0.16);
		color: #f4e8ff;
	}

	.game-modal,
	.result-modal {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgba(2, 7, 18, 0.86);
		backdrop-filter: blur(14px);
	}

	.game-modal-surface {
		width: min(1200px, 100%);
		height: min(96vh, 980px);
		border-radius: 28px;
		overflow: hidden;
	}

	.result-card {
		width: min(560px, 100%);
		padding: 1.5rem;
		border-radius: 28px;
		background: rgba(10, 16, 30, 0.95);
		border: 1px solid rgba(255, 255, 255, 0.1);
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
		display: grid;
		gap: 1rem;
		text-align: center;
	}

	.result-card h2 {
		margin: 0;
		font-size: 2rem;
	}

	.result-score {
		font-size: 4rem;
		font-weight: 900;
		margin: 0;
		color: #7bffb6;
	}

	.close-button {
		justify-self: center;
		padding-inline: 2rem;
	}

	.game-meta {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		color: rgba(238, 243, 255, 0.72);
		font-size: 0.9rem;
	}

	.panel-card {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		position: relative;
	}

	.message-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.9rem;
	}

	.message-list li {
		padding: 1rem;
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.06);
	}

	.message-list strong,
	.message-list span,
	.message-list small,
	.message-list p {
		display: block;
	}

	.message-list span,
	.message-list small {
		color: rgba(238, 243, 255, 0.6);
		font-size: 0.85rem;
	}

	.message-list p {
		margin: 0.45rem 0;
		white-space: pre-wrap;
	}

	.empty-state {
		color: rgba(238, 243, 255, 0.66);
	}

	@media (max-width: 900px) {
		.page-shell {
			grid-template-columns: 1fr;
			padding: 1rem;
		}

		.form-grid {
			grid-template-columns: 1fr;
		}

		.game-modal-surface {
			height: 88vh;
		}

		.result-score {
			font-size: 3rem;
		}
	}
</style>
