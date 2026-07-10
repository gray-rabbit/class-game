export type GameKey = 'reaction' | 'make-ten' | 'make-nineteen' | 'compare';

export type GameControlMessage =
	| {
			type: 'prepare';
			gameName: GameKey;
	  }
	| {
			type: 'start';
			gameName: GameKey;
			runToken: string;
	  }
	| {
			type: 'cancel';
	  };

export type StudentScorePayload = {
	room: string;
	studentNumber: number;
	gameName: GameKey;
	score: number;
	sentAt: string;
};
