const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { obtainAllUserVehicles, defaultEmbedColor } = require('../modules/database.js');
const garageSchema = require('../mongodb_schema/garageSchema.js');
const { estimateVehicleValue } = require('../modules/commandModules/garage/estimateValue.js');
const { errorEmbed } = require('../modules/utility.js');

const PROFILE_GUILD_ID = '438650836512669699';
const MAX_ESTIMATES_PER_RUN = 25;

function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function getVehicleStats(vehicles) {
    if (!vehicles.length) return null;
    const now = Date.now();
    const timestamps = vehicles
        .map((vehicle) => new Date(vehicle.vehicleAddedDate || 0).getTime())
        .filter((value) => Number.isFinite(value) && value > 0);

    if (!timestamps.length) {
        return {
            total: vehicles.length,
            oldestMs: null,
            newestMs: null,
            averageMs: null,
        };
    }

    const oldest = Math.min(...timestamps);
    const newest = Math.max(...timestamps);
    const average = timestamps.reduce((sum, value) => sum + (now - value), 0) / timestamps.length;

    return {
        total: vehicles.length,
        oldestMs: now - oldest,
        newestMs: now - newest,
        averageMs: average,
    };
}

function formatCurrency(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 'Unknown';
    return `$${numeric.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

async function updateMissingEstimates(vehicles) {
    const updates = [];
    const candidates = vehicles.filter((vehicle) => !Number.isFinite(vehicle.estimatedValueUSD));
    const pending = candidates.slice(0, MAX_ESTIMATES_PER_RUN);

    for (const vehicle of pending) {
        const firstPhoto = vehicle?.vehicleImages?.[0] || vehicle?.verificationImageLink || null;
        try {
            const result = await estimateVehicleValue({
                vehicleName: vehicle.vehicle,
                imageUrl: firstPhoto || null,
                imageContentType: null,
            });

            const update = {
                estimatedValueUSD: result.estimatedValueUSD,
                estimatedValueConfidence: result.confidence,
                estimatedValueUpdatedAt: new Date().toISOString(),
            };

            await garageSchema.updateOne(
                { _id: vehicle._id },
                { $set: update }
            );

            vehicle.estimatedValueUSD = update.estimatedValueUSD;
            vehicle.estimatedValueConfidence = update.estimatedValueConfidence;
            vehicle.estimatedValueUpdatedAt = update.estimatedValueUpdatedAt;
            updates.push(vehicle);
        } catch (error) {
            console.warn('Vehicle value estimate failed:', {
                vehicle: vehicle.vehicle,
                error: error.message,
            });
        }
    }

    return updates.length;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View a summary of a user’s verified vehicles.')
        .addUserOption((option) =>
            option
                .setName('mention')
                .setDescription('View another user’s profile.')
        ),
    async execute(interaction) {
        if (interaction.guild?.id !== PROFILE_GUILD_ID) {
            await interaction.reply({
                embeds: [errorEmbed('This command is only available in The Car Community server.')],
                ephemeral: true,
            });
            return;
        }

        if (!interaction.deferred) await interaction.deferReply({ ephemeral: false });

        const targetUser = interaction.options.getUser('mention') || interaction.user;
        const embedColor = (await defaultEmbedColor(targetUser.id)) || '#FFFCFF';

        let garageData;
        try {
            garageData = await obtainAllUserVehicles(targetUser.id, interaction.guild.id);
        } catch (error) {
            await interaction.editReply({
                embeds: [errorEmbed('Failed to load the profile data. Please try again later.')],
            });
            return;
        }

        const vehicles = Array.isArray(garageData) ? garageData : [];
        await updateMissingEstimates(vehicles);
        const stats = getVehicleStats(vehicles);
        const userAvatar = targetUser.displayAvatarURL({ dynamic: true });

        if (!stats || stats.total === 0) {
            const emptyEmbed = new EmbedBuilder()
                .setAuthor({ name: `${targetUser.tag}'s Profile`, iconURL: userAvatar })
                .setDescription('No verified vehicles found for this user yet.')
                .setColor(embedColor)
                .setFooter({ text: `${interaction.guild.name} • Vehicle Verification` });

            await interaction.editReply({ embeds: [emptyEmbed] });
            return;
        }

        const totalEstimatedValue = vehicles.reduce((sum, vehicle) => {
            const value = Number(vehicle.estimatedValueUSD);
            return Number.isFinite(value) ? sum + value : sum;
        }, 0);

        const vehiclesWithValue = vehicles.filter((vehicle) =>
            Number.isFinite(Number(vehicle.estimatedValueUSD))
        );

        const vehicleValueLines = vehicles.map((vehicle) => {
            const value = Number(vehicle.estimatedValueUSD);
            const valueText = Number.isFinite(value) ? formatCurrency(value) : 'Pending';
            return `• ${vehicle.vehicle} — ${valueText}`;
        });

        const profileEmbed = new EmbedBuilder()
            .setAuthor({ name: `${targetUser.tag}'s Profile`, iconURL: userAvatar })
            .setDescription('Here is a quick summary of their verified garage.')
            .addFields(
                { name: 'Total Vehicles', value: `${stats.total}`, inline: true },
                { name: 'Total Estimated Value', value: formatCurrency(totalEstimatedValue), inline: true },
                { name: 'Vehicles Priced', value: `${vehiclesWithValue.length}/${stats.total}`, inline: true },
                {
                    name: 'Longest Owned',
                    value: stats.oldestMs ? formatDuration(stats.oldestMs) : 'Unknown',
                    inline: true,
                },
                {
                    name: 'Most Recent',
                    value: stats.newestMs ? `${formatDuration(stats.newestMs)} ago` : 'Unknown',
                    inline: true,
                },
                {
                    name: 'Average Ownership',
                    value: stats.averageMs ? formatDuration(stats.averageMs) : 'Unknown',
                    inline: true,
                },
                {
                    name: 'Vehicle Estimates',
                    value: vehicleValueLines.slice(0, 25).join('\n'),
                }
            )
            .setColor(embedColor)
            .setFooter({ text: `${interaction.guild.name} • Vehicle Verification` });

        await interaction.editReply({ embeds: [profileEmbed] });
    },
};
