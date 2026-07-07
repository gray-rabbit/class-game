<script lang="ts">
	import MakeSumGame from './MakeSumGame.svelte';

	type Props = {
		runToken?: string | null;
		gameName?: string;
		standalone?: boolean;
		onComplete?: (score: number) => void;
		onClose?: () => void;
	};

	let { runToken, gameName, standalone, onComplete, onClose }: Props = $props();
</script>

<MakeSumGame
	target={19}
	title="19 만들기"
	{runToken}
	{gameName}
	{standalone}
	{onComplete}
	{onClose}
/>
