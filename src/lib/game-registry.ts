import type { GameKey } from './game-protocol';

export const DEFAULT_GAME_NAME: GameKey = 'reaction';

export const GAME_OPTIONS: Array<{ value: GameKey; label: string }> = [
	{ value: 'reaction', label: '반응 속도' },
	{ value: 'make-ten', label: '10 만들기' },
	{ value: 'make-nineteen', label: '19 만들기' },
	{ value: 'compare', label: '큰 수 작은 수' }
];

const loaders: Record<GameKey, () => Promise<{ default: unknown }>> = {
	reaction: () => import('./games/ReactionGame.svelte'),
	'make-ten': () => import('./games/MakeTenGame.svelte'),
	'make-nineteen': () => import('./games/MakeNineteenGame.svelte'),
	compare: () => import('./games/CompareGame.svelte')
};

const VALID_KEYS = new Set<GameKey>(['reaction', 'make-ten', 'make-nineteen', 'compare']);

export function normalizeGameName(value: string) {
	const normalized = value.trim().toLowerCase().replace(/\s+/g, '-');
	return (VALID_KEYS.has(normalized as GameKey) ? normalized : DEFAULT_GAME_NAME) as GameKey;
}

export async function loadGameComponent(gameName: string) {
	const normalized = normalizeGameName(gameName);
	const module = await loaders[normalized]();
	return module.default;
}
