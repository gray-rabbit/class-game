<script lang="ts">
	import { onMount } from 'svelte';
	import {
		DEFAULT_GAME_NAME,
		GAME_OPTIONS,
		isValidRoomCode,
		isValidStudentCount,
		normalizeGameName,
		normalizeRoomCode,
		roomName,
		type GameControlMessage,
		type StudentScorePayload
	} from '$lib';

	type GameState = 'idle' | 'prepared' | 'running' | 'finished';

	type StudentCard = {
		room: string;
		studentNumber: number;
		isConnected: boolean;
		gameState: GameState;
		preparedGameName: string;
		latestGameName: string;
		latestScore: number | null;
		latestSentAt: string;
	};

	type TeacherRoom = {
		room: any;
		controlAction: any;
		scoreAction: any;
	};

	let joinRoomFn: any = $state(null);
	let code = $state('');
	let studentCount = $state(5);
	let gameName = $state(DEFAULT_GAME_NAME);
	let sortOrder = $state<'asc' | 'desc'>('asc');
	let filterMode = $state<'all' | 'range' | 'equal'>('all');
	let rangeStart = $state('');
	let rangeEnd = $state('');
	let equalNumber = $state('');
	let status = $state('방을 아직 만들지 않았습니다.');
	let isCreating = $state(false);
	let students = $state<StudentCard[]>([]);
	let activeRooms = $state<TeacherRoom[]>([]);

	const loadTrystero = async () => {
		if (!joinRoomFn) {
			const module = await import('trystero');
			joinRoomFn = module.joinRoom;
		}
	};

	const clearRooms = () => {
		for (const currentRoom of activeRooms) {
			currentRoom.room?.leave?.();
		}
		activeRooms = [];
	};

	const updateStudent = (room: string, updater: (student: StudentCard) => StudentCard) => {
		students = students.map((student) => (student.room === room ? updater(student) : student));
	};

	const parseOptionalNumber = (value: string) => {
		const trimmedValue = value.trim();
		return trimmedValue ? Number(trimmedValue) : null;
	};

	const getVisibleStudents = () => {
		// 1. 필터 적용 (점수 기준)
		let filtered = students;

		if (filterMode === 'range') {
			const start = parseOptionalNumber(rangeStart);
			const end = parseOptionalNumber(rangeEnd);

			filtered = students.filter((student) => {
				const score = student.latestScore;
				if (score === null) return false;
				return (start === null || score >= start) && (end === null || score <= end);
			});
		} else if (filterMode === 'equal') {
			const target = parseOptionalNumber(equalNumber);

			if (target !== null) {
				filtered = students.filter((student) => student.latestScore === target);
			}
		}

		// 2. 점수 있는 학생은 점수 기준 정렬, 점수 없는 학생은 번호순 정렬해 뒤에 배치
		const scored = filtered.filter((student) => student.latestScore !== null);
		const unscored = filtered.filter((student) => student.latestScore === null);

		const sortedScored = [...scored].sort((firstStudent, secondStudent) => {
			return sortOrder === 'asc'
				? (firstStudent.latestScore ?? 0) - (secondStudent.latestScore ?? 0)
				: (secondStudent.latestScore ?? 0) - (firstStudent.latestScore ?? 0);
		});

		const sortedUnscored = [...unscored].sort(
			(firstStudent, secondStudent) => firstStudent.studentNumber - secondStudent.studentNumber
		);

		return [...sortedScored, ...sortedUnscored];
	};

	const visibleStudentsCount = () => getVisibleStudents().length;

	const createRooms = async () => {
		const nextCode = code.trim();

		if (!isValidRoomCode(nextCode)) {
			status = '4자리 숫자 코드를 입력하세요.';
			return;
		}

		if (!isValidStudentCount(studentCount)) {
			status = '학생 수는 1 이상 100 이하로 입력하세요.';
			return;
		}

		isCreating = true;
		status = 'Trystero 방을 만드는 중입니다.';
		clearRooms();

		try {
			await loadTrystero();
			if (!joinRoomFn) {
				status = 'Trystero를 불러오지 못했습니다.';
				return;
			}

			students = Array.from({ length: studentCount }, (_, index) => {
				const studentNumber = index + 1;
				return {
					room: roomName(nextCode, studentNumber),
					studentNumber,
					isConnected: false,
					gameState: 'idle',
					preparedGameName: '',
					latestGameName: '',
					latestScore: null,
					latestSentAt: ''
				};
			});

			activeRooms = students.map((student) => {
				const currentRoom = joinRoomFn({ appId: 'class-game-room-v1' }, student.room);
				const controlAction = currentRoom.makeAction('student-control');
				const scoreAction = currentRoom.makeAction('student-score');

				currentRoom.onPeerJoin = () => {
					updateStudent(student.room, (current) => ({
						...current,
						isConnected: true
					}));
				};

				currentRoom.onPeerLeave = () => {
					updateStudent(student.room, (current) => ({
						...current,
						isConnected: false,
						gameState: 'idle'
					}));
				};

				controlAction.onMessage = (payload: GameControlMessage) => {
					if (payload.type === 'prepare') {
						updateStudent(student.room, (current) => ({
							...current,
							isConnected: true,
							preparedGameName: payload.gameName,
							latestGameName: payload.gameName,
							gameState: 'prepared'
						}));
						status = `${student.room} 준비 신호를 보냈습니다.`;
					}

					if (payload.type === 'start') {
						updateStudent(student.room, (current) => ({
							...current,
							isConnected: true,
							preparedGameName: payload.gameName,
							latestGameName: payload.gameName,
							gameState: 'running'
						}));
						status = `${student.room} 시작 신호를 보냈습니다.`;
					}
				};

				scoreAction.onMessage = (payload: StudentScorePayload) => {
					updateStudent(student.room, (current) => ({
						...current,
						isConnected: true,
						preparedGameName: payload.gameName,
						latestGameName: payload.gameName,
						latestScore: payload.score,
						latestSentAt: payload.sentAt,
						gameState: 'finished'
					}));
					status = `${student.room} 에서 점수가 들어왔습니다.`;
				};

				return {
					room: currentRoom,
					controlAction,
					scoreAction
				};
			});

			status = `${students.length}개의 방을 만들었습니다.`;
		} catch (error) {
			status = error instanceof Error ? error.message : '방을 만들지 못했습니다.';
		} finally {
			isCreating = false;
		}
	};

	const prepareGame = async () => {
		if (!activeRooms.length) {
			status = '먼저 방을 만드세요.';
			return;
		}

		const normalizedGameName = normalizeGameName(gameName);
		status = `${normalizedGameName} 게임 준비 신호를 보내는 중입니다.`;
		const results = await Promise.all(
			activeRooms.map((entry) =>
				entry.controlAction?.send({
					type: 'prepare',
					gameName: normalizedGameName
				})
			)
		);
		void results;
		students = students.map((student) => ({
			...student,
			preparedGameName: normalizedGameName,
			latestGameName: normalizedGameName,
			gameState: 'prepared',
			// 새 게임 준비 시 이전 점수 초기화 (현재 게임 점수만 표시)
			latestScore: null,
			latestSentAt: ''
		}));
		status = `${normalizedGameName} 게임 준비 신호를 전송했습니다.`;
	};

	const startGame = async () => {
		if (!activeRooms.length) {
			status = '먼저 방을 만드세요.';
			return;
		}

		const normalizedGameName = normalizeGameName(gameName);
		const runToken = crypto.randomUUID();
		status = `${normalizedGameName} 게임 시작 신호를 보내는 중입니다.`;
		const results = await Promise.all(
			activeRooms.map((entry) =>
				entry.controlAction?.send({
					type: 'start',
					gameName: normalizedGameName,
					runToken
				})
			)
		);
		void results;
		students = students.map((student) => ({
			...student,
			preparedGameName: normalizedGameName,
			latestGameName: normalizedGameName,
			gameState: 'running',
			// 새 게임 시작 시 이전 점수 초기화 (현재 게임 점수만 표시)
			latestScore: null,
			latestSentAt: ''
		}));
		status = `${normalizedGameName} 게임 시작 신호를 전송했습니다.`;
	};

	const cancelGame = async () => {
		if (!activeRooms.length) {
			status = '먼저 방을 만드세요.';
			return;
		}

		status = '게임 취소 신호를 보내는 중입니다.';
		const results = await Promise.all(
			activeRooms.map((entry) => entry.controlAction?.send({ type: 'cancel' }))
		);
		void results;
		students = students.map((student) => ({
			...student,
			gameState: 'idle',
			preparedGameName: '',
			latestGameName: ''
		}));
		status = '게임 취소 신호를 전송했습니다.';
	};

	onMount(() => clearRooms);
</script>

<svelte:head>
	<title>선생님 방 관리</title>
	<meta
		name="description"
		content="4자리 코드와 학생 수로 Trystero 방을 만들고 학생별 연결 상태와 게임 점수를 확인합니다."
	/>
</svelte:head>

<div class="page-shell teacher-shell">
	<section class="hero-card">
		<div class="eyebrow">Teacher Console</div>
		<h1>학생별 방과 게임 신호를 관리합니다.</h1>
		<p>
			방 이름은 코드-학생번호 형식으로 생성됩니다. 학생이 연결되면 카드가 초록색으로 바뀌고, 게임
			준비나 시작 신호를 보내면 상태가 함께 표시됩니다.
		</p>

		<div class="form-grid">
			<label>
				<span>4자리 코드</span>
				<input
					value={code}
					oninput={(event) =>
						(code = normalizeRoomCode((event.currentTarget as HTMLInputElement).value))}
					inputmode="numeric"
					maxlength="4"
					placeholder="1234"
				/>
			</label>
			<label>
				<span>학생 수</span>
				<input bind:value={studentCount} type="number" min="1" max="100" step="1" placeholder="5" />
			</label>
			<label class="wide-row">
				<span>게임 이름</span>
				<select bind:value={gameName}>
					{#each GAME_OPTIONS as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</label>
		</div>

		<div class="actions">
			<button type="button" onclick={createRooms} disabled={isCreating}>
				{isCreating ? '생성 중...' : '방 만들기'}
			</button>
			<button type="button" onclick={prepareGame} disabled={isCreating}>게임 준비</button>
			<button type="button" onclick={startGame} disabled={isCreating}>게임 시작</button>
			<button type="button" class="cancel-btn" onclick={cancelGame} disabled={isCreating}>
				게임 취소
			</button>
			<div class="status">{status}</div>
		</div>

		<div class="filter-panel">
			<div class="filter-title">학생 칸 정리</div>
			<div class="filter-grid">
				<label>
					<span>점수 정렬</span>
					<select bind:value={sortOrder}>
						<option value="asc">오름차순</option>
						<option value="desc">내림차순</option>
					</select>
				</label>

				<label>
					<span>필터</span>
					<select bind:value={filterMode}>
						<option value="all">전체</option>
						<option value="range">점수 범위</option>
						<option value="equal">특정 점수</option>
					</select>
				</label>

				{#if filterMode === 'range'}
					<label>
						<span>점수 이상</span>
						<input
							value={rangeStart}
							oninput={(event) =>
								(rangeStart = (event.currentTarget as HTMLInputElement).value.replace(/\D/g, ''))}
							inputmode="numeric"
							placeholder="예: 5"
						/>
					</label>
					<label>
						<span>점수 이하</span>
						<input
							value={rangeEnd}
							oninput={(event) =>
								(rangeEnd = (event.currentTarget as HTMLInputElement).value.replace(/\D/g, ''))}
							inputmode="numeric"
							placeholder="예: 20"
						/>
					</label>
				{:else if filterMode === 'equal'}
					<label class="wide-filter">
						<span>같은 점수</span>
						<input
							value={equalNumber}
							oninput={(event) =>
								(equalNumber = (event.currentTarget as HTMLInputElement).value.replace(/\D/g, ''))}
							inputmode="numeric"
							placeholder="예: 5"
						/>
					</label>
				{/if}
			</div>
			<div class="filter-summary">
				보이는 학생 {visibleStudentsCount()}명 / 전체 {students.length}명
			</div>
		</div>
	</section>

	<section class="panel-card student-grid-panel">
		<div class="panel-title">학생 칸</div>
		{#if getVisibleStudents().length}
			<div class="student-grid">
				{#each getVisibleStudents() as student}
					<article
						class:connected={student.isConnected}
						class:disconnected={!student.isConnected}
						class="student-card"
					>
						<div class="card-head">
							<strong>{student.room}</strong>
							<span class="status-chip" class:on={student.isConnected}>
								{student.isConnected ? '● 연결됨' : '○ 미연결'}
							</span>
						</div>
						<div class="card-meta">학생 {student.studentNumber}</div>
						<div class="card-meta">게임 상태: {student.gameState}</div>
						{#if student.preparedGameName}
							<div class="game-chip">{student.preparedGameName}</div>
						{/if}
						<div class="card-body">
							{#if student.latestScore !== null}
								<p class="score">점수 {student.latestScore}</p>
								<small>{student.latestSentAt}</small>
							{:else if student.gameState === 'running'}
								<p class="empty-state">게임 진행 중...</p>
							{:else}
								<p class="empty-state">아직 점수가 들어오지 않았습니다.</p>
							{/if}
						</div>
					</article>
				{/each}
			</div>
		{:else}
			<p class="empty-state">
				{#if students.length}
					현재 필터에 맞는 학생이 없습니다.
				{:else}
					방을 만들면 학생별 카드가 여기에 표시됩니다.
				{/if}
			</p>
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
			radial-gradient(circle at top right, rgba(132, 94, 255, 0.18), transparent 28%),
			linear-gradient(135deg, #07111f 0%, #111827 48%, #1a1030 100%);
		color: #f4f7ff;
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
		background: rgba(8, 14, 28, 0.72);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 24px;
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
		padding: 1.5rem;
	}

	.hero-card {
		grid-column: 1 / -1;
		display: grid;
		gap: 1rem;
	}

	.eyebrow,
	.panel-title {
		letter-spacing: 0.16em;
		text-transform: uppercase;
		font-size: 0.72rem;
		color: #b39cff;
		font-weight: 700;
	}

	h1 {
		margin: 0.75rem 0 0.75rem;
		font-size: clamp(2rem, 4vw, 3.4rem);
		line-height: 1.03;
		max-width: 16ch;
	}

	p {
		margin: 0;
		color: rgba(244, 247, 255, 0.8);
		line-height: 1.6;
	}

	.form-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		margin-top: 0.5rem;
	}

	label {
		display: grid;
		gap: 0.5rem;
	}

	label span {
		font-size: 0.85rem;
		font-weight: 600;
		color: rgba(244, 247, 255, 0.84);
	}

	input,
	select {
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

	input:focus,
	select:focus {
		border-color: rgba(179, 156, 255, 0.95);
		box-shadow: 0 0 0 4px rgba(179, 156, 255, 0.16);
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
		padding: 0.95rem 1.15rem;
		font: inherit;
		font-weight: 700;
		color: #fff;
		background: linear-gradient(135deg, #845eff, #4fd1c5);
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.7;
		cursor: progress;
	}

	.cancel-btn {
		background: linear-gradient(135deg, #ff7b7b, #ff5e9c);
		color: #fff;
	}

	.status {
		color: rgba(244, 247, 255, 0.74);
	}

	.filter-panel {
		margin-top: 0.25rem;
		padding: 1rem;
		border-radius: 20px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		display: grid;
		gap: 1rem;
	}

	.filter-title {
		font-size: 0.9rem;
		font-weight: 700;
		color: rgba(244, 247, 255, 0.88);
	}

	.filter-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.85rem;
	}

	.filter-grid label,
	.wide-filter {
		display: grid;
		gap: 0.45rem;
	}

	.filter-grid span,
	.wide-filter span {
		font-size: 0.8rem;
		font-weight: 600;
		color: rgba(244, 247, 255, 0.82);
	}

	.filter-grid select,
	.filter-grid input,
	.wide-filter input {
		width: 100%;
		box-sizing: border-box;
		border-radius: 14px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.05);
		color: #fff;
		padding: 0.85rem 0.95rem;
		font: inherit;
		outline: none;
	}

	.filter-grid select:focus,
	.filter-grid input:focus,
	.wide-filter input:focus {
		border-color: rgba(179, 156, 255, 0.95);
		box-shadow: 0 0 0 4px rgba(179, 156, 255, 0.14);
	}

	.wide-row,
	.wide-filter {
		grid-column: 1 / -1;
	}

	.filter-summary {
		font-size: 0.85rem;
		color: rgba(244, 247, 255, 0.7);
	}

	.student-grid-panel {
		grid-column: 1 / -1;
	}

	.student-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1rem;
	}

	.student-card {
		padding: 1rem;
		border-radius: 20px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		display: grid;
		gap: 0.75rem;
	}

	.student-card.connected {
		background: rgba(123, 255, 182, 0.16);
		border-color: rgba(123, 255, 182, 0.28);
		color: #defbe9;
	}

	.student-card.disconnected {
		background: rgba(255, 123, 123, 0.16);
		border-color: rgba(255, 123, 123, 0.28);
		color: #ffe0e0;
	}

	.card-head {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: flex-start;
	}

	.card-head strong {
		font-size: 0.98rem;
		word-break: break-all;
	}

	.card-head span,
	.card-meta,
	.card-body small {
		font-size: 0.82rem;
		opacity: 0.8;
	}

	.game-chip {
		padding: 0.45rem 0.7rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.12);
		font-size: 0.8rem;
		font-weight: 700;
		width: fit-content;
	}

	.status-chip {
		padding: 0.35rem 0.7rem;
		border-radius: 999px;
		font-size: 0.78rem;
		font-weight: 800;
		white-space: nowrap;
		background: rgba(255, 123, 123, 0.22);
		color: #ffd6d6;
		border: 1px solid rgba(255, 123, 123, 0.4);
	}

	.status-chip.on {
		background: rgba(123, 255, 182, 0.22);
		color: #c4ffe0;
		border-color: rgba(123, 255, 182, 0.45);
	}

	.card-body {
		display: grid;
		gap: 0.35rem;
	}

	.score {
		font-size: 1.4rem;
		font-weight: 800;
		margin: 0;
	}

	.empty-state {
		color: rgba(244, 247, 255, 0.66);
	}

	@media (max-width: 900px) {
		.page-shell {
			grid-template-columns: 1fr;
			padding: 1rem;
		}

		.form-grid,
		.filter-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
