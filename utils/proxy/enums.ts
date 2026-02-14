export enum Teams {
    UNKNOWN = 0,
    ORDER = 100,
    CHAOS = 200,
}

export enum Orders {
    NONE = 0,
    HOLD = 1,
    MOVETO = 2,
    ATTACKTO = 3,
    TEMP_CASTSPELL = 4,
    PETHARDATTACK = 5,
    PETHARDMOVE = 6,
    ATTACKMOVE = 7,
    TAUNT = 8,
    PETHARDRETURN = 9,
    STOP = 10,
    PETHARDSTOP = 11,
}

export enum AIState {
    IDLE = 0,
    SOFTATTACK = 1,
    HARDATTACK = 2,
    ATTACKMOVE = 3,
    STANDING = 4,
    MOVE = 5,
    ATTACK = 7,
    HARDIDLE = 9,
    TAUNTED = 11,
    FEARED = 13,
    CHARMED = 14,
    ATTACK_GOING_TO_LAST_KNOWN_LOCATION = 16,
    HALTED = 17,
}
