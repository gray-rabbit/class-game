// 게임에서 공통으로 사용하는 효과음 유틸리티.
// AudioContext를 지연 생성하고, 사용자 제스처에서 resume 한다.

let audioCtx: AudioContext | null = null;

function ensureAudio(): AudioContext | null {
	if (!audioCtx) {
		const Ctor =
			typeof window !== 'undefined' &&
			(window.AudioContext ||
				(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
		if (Ctor) {
			audioCtx = new Ctor();
		}
	}
	if (audioCtx?.state === 'suspended') {
		void audioCtx.resume();
	}
	return audioCtx;
}

function playTone(
	ctx: AudioContext,
	freq: number,
	start: number,
	duration: number,
	type: OscillatorType = 'triangle',
	peak = 0.25
) {
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = type;
	osc.frequency.value = freq;
	gain.gain.setValueAtTime(0.0001, start);
	gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
	gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
	osc.connect(gain).connect(ctx.destination);
	osc.start(start);
	osc.stop(start + duration + 0.02);
}

/** 정답: 밝고 통쾌한 상승 멜로디 (C5 -> E5 -> G5) */
export function playCorrect() {
	const ctx = ensureAudio();
	if (!ctx) return;
	const now = ctx.currentTime;
	[523.25, 659.25, 783.99].forEach((freq, index) => {
		playTone(ctx, freq, now + index * 0.08, 0.16, 'triangle', 0.25);
	});
}

/** 오답: 부드러운 하강 톤 (짧은 '뿡') */
export function playWrong() {
	const ctx = ensureAudio();
	if (!ctx) return;
	const now = ctx.currentTime;
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = 'sine';
	osc.frequency.setValueAtTime(220, now);
	osc.frequency.exponentialRampToValueAtTime(140, now + 0.18);
	gain.gain.setValueAtTime(0.0001, now);
	gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
	gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
	osc.connect(gain).connect(ctx.destination);
	osc.start(now);
	osc.stop(now + 0.26);
}

/** 종료: 팡파레 (C-E-G-C 상승) */
export function playFinish() {
	const ctx = ensureAudio();
	if (!ctx) return;
	const now = ctx.currentTime;
	[523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
		playTone(ctx, freq, now + index * 0.12, 0.28, 'triangle', 0.28);
	});
}

/** 오디오 컨텍스트 사용자 제스처로 사전 준비 (버튼 클릭 등에서 호출) */
export function primeAudio() {
	ensureAudio();
}

/** 컴포넌트 파괴 시 정리 */
export function disposeAudio() {
	audioCtx?.close().catch(() => {});
	audioCtx = null;
}
