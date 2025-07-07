export enum UTPCallback {
    ON_FIREWALL = 0,
    ON_ACCEPT,
    ON_CONNECT,
    ON_ERROR,
    ON_READ,
    ON_OVERHEAD_STATISTICS,
    ON_STATE_CHANGE,
    GET_READ_BUFFER_SIZE,
    ON_DELAY_SAMPLE,
    GET_UDP_MTU,
    GET_UDP_OVERHEAD,
    GET_MILLISECONDS,
    GET_MICROSECONDS,
    GET_RANDOM,
    LOG,
    SENDTO,
}

export enum UTPError {
    CONNREFUSED = 0,
    CONNRESET,
    TIMEDOUT,
}

export enum UTPState {
    CONNECT = 1,
    WRITABLE = 2,
    EOF = 3,
    DESTROYING = 4,
}

export enum UTPFlags {
    DONTFRAG = 2,
}
