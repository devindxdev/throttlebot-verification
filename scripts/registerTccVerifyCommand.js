// Backwards-compatible entry point: never recreate a guild /verify duplicate.
const { main } = require('./syncVerifyCommand');
if (require.main === module) main().catch(error => {
    console.error(JSON.stringify({ failed: true, errorType: error.name, status: error.status || null }));
    process.exitCode = 1;
});
module.exports = { main };
