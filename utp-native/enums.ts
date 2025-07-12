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

export enum UTPOptions {
    UTP_LOG_NORMAL = 16,
    UTP_LOG_MTU,
    UTP_LOG_DEBUG,
	UTP_SNDBUF,
	UTP_RCVBUF,
	UTP_TARGET_DELAY,
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

export enum UTPShutdown
{
    SHUT_RD = 0, // No more receptions.
    SHUT_WR, // No more transmissions.
    SHUT_RDWR, // No more receptions or transmissions.
};
