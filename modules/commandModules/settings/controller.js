const { buildSettingsSession } = require('./sessionBuilder.js');
const { selectVehicle } = require('./vehicleSelector.js');
const { presentSettingsDashboard } = require('./dashboard.js');
require('./flows/sorting.js'); // ensure module discovered by bundlers/linting

/**
 * Entry point for the /settings command. Performs guild/user prechecks, vehicle selection,
 * and dispatches to the appropriate settings subflow.
 */
async function settingsController(interaction) {
    if (!interaction.deferred) await interaction.deferReply({ ephemeral: false });

    const { session, errorEmbed } = await buildSettingsSession(interaction);
    if (!session) {
        await interaction.editReply({ embeds: [errorEmbed], components: [] });
        return;
    }

    const selectedVehicle = await selectVehicle(session);
    if (!selectedVehicle) return;

    await presentSettingsDashboard({
        ...session,
        selectedVehicle,
    });
}

module.exports = settingsController;
