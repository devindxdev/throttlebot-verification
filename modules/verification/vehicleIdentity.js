function vehicleKey(name) {
    return typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').toLowerCase() : '';
}

function vehicleFilter({ guildId, userId, vehicle }) {
    const key = vehicleKey(vehicle);
    const escaped = key.split(' ').map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
    return { guildId, userId, $or: [
        { vehicleKey: key },
        { vehicle: new RegExp(`^\\s*${escaped}\\s*$`, 'i') },
    ] };
}

module.exports = { vehicleKey, vehicleFilter };
