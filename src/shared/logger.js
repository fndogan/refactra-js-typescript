const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

function configuredLevel() {
    return LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LEVELS.info;
}

function format(level, message, data) {
    const timestamp = new Date().toISOString();
    const details = data === undefined ? '' : ` ${JSON.stringify(data)}`;
    return `${timestamp} [${level.toUpperCase()}] ${message}${details}`;
}

export const logger = {
    debug(message, data) {
        if (configuredLevel() <= LEVELS.debug) console.log(format('debug', message, data));
    },
    info(message, data) {
        if (configuredLevel() <= LEVELS.info) console.log(format('info', message, data));
    },
    warn(message, data) {
        if (configuredLevel() <= LEVELS.warn) console.warn(format('warn', message, data));
    },
    error(message, data) {
        if (configuredLevel() <= LEVELS.error) console.error(format('error', message, data));
    },
    success(message, data) {
        console.log(format('ok', message, data));
    },
    divider(title) {
        console.log(`\n${title || '---'}\n`);
    },
};
