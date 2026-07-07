export const TRYSTERO_APP_ID = 'class-game-room-v1';

export function normalizeRoomCode(value: string) {
    return value.replace(/\D/g, '').slice(0, 4);
}

export function normalizeStudentNumber(value: string) {
    return value.replace(/\D/g, '').slice(0, 3);
}

export function isValidRoomCode(value: string) {
    return /^\d{4}$/.test(value);
}

export function isValidStudentCount(value: number) {
    return Number.isInteger(value) && value > 0 && value <= 100;
}

export function roomName(roomCode: string, studentNumber: number) {
    return `${roomCode}-${studentNumber}`;
}

export {
    DEFAULT_GAME_NAME,
    GAME_OPTIONS,
    loadGameComponent,
    normalizeGameName
} from './game-registry';

export type {
    GameControlMessage,
    GameKey,
    StudentScorePayload
} from './game-protocol';
