const { vehicleSelection } = require('../garage/vehicleSelection.js');

/**
 * Presents the vehicle picker and returns the selected vehicle or null if the flow is canceled.
 */
async function selectVehicle(session) {
    const { garageData, initiator, footer, embedColor, interaction } = session;

    return vehicleSelection(
        garageData,
        initiator,
        footer.text,
        footer.icon,
        embedColor,
        interaction
    );
}

module.exports = { selectVehicle };
