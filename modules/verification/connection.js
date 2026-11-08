function databaseName(uri, override = process.env.MONGO_DB_NAME) {
    if (override) return override;
    const pathname = new URL(uri).pathname.replace(/^\//, '');
    return pathname ? decodeURIComponent(pathname) : 'throttlebot-verification';
}
module.exports = { databaseName };
