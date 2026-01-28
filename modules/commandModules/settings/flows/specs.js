const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
const OpenAI = require('openai');
const { errorEmbed } = require('../../../utility.js');
const {
    updateVehicleSpecs,
    clearVehicleSpecs,
    updateVehicleDescription,
    clearVehicleDescription,
} = require('../../manage/services/vehicleService.js');

const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.API_KEY;
// Newer small model default; override with OPENAI_SPECS_MODEL if desired.
const AI_MODEL = process.env.OPENAI_SPECS_MODEL || 'gpt-5-mini-2025-08-07';

function formatSpecs(specs = {}) {
    const fields = [];
    if (specs.engine) fields.push({ name: 'Engine', value: specs.engine, inline: false });
    if (specs.horsepower) fields.push({ name: 'Horsepower', value: specs.horsepower, inline: true });
    if (specs.torque) fields.push({ name: 'Torque', value: specs.torque, inline: true });
    if (specs.drivetrain) fields.push({ name: 'Drivetrain', value: specs.drivetrain, inline: true });
    if (specs.transmission) fields.push({ name: 'Transmission', value: specs.transmission, inline: true });
    if (specs.acceleration) fields.push({ name: 'Acceleration', value: specs.acceleration, inline: true });
    if (specs.year) fields.push({ name: 'Year', value: specs.year, inline: true });
    if (specs.powertrain) fields.push({ name: 'Powertrain', value: specs.powertrain, inline: false });
    if (specs.mods) fields.push({ name: 'Mods', value: specs.mods, inline: false });
    return fields;
}

function mergeSpecs(existing, updates) {
    return {
        engine: updates.engine ?? existing?.engine ?? null,
        horsepower: updates.horsepower ?? existing?.horsepower ?? null,
        torque: updates.torque ?? existing?.torque ?? null,
        acceleration: updates.acceleration ?? existing?.acceleration ?? null,
        drivetrain: updates.drivetrain ?? existing?.drivetrain ?? null,
        transmission: updates.transmission ?? existing?.transmission ?? null,
        year: updates.year ?? existing?.year ?? null,
        color: updates.color ?? existing?.color ?? null,
        powertrain: updates.powertrain ?? existing?.powertrain ?? null,
        mods: updates.mods ?? existing?.mods ?? null,
        featuredSpec: null,
    };
}

function finalizeSpecs(specs) {
    const next = { ...specs };
    if (!next.powertrain) {
        const parts = [];
        if (next.engine) parts.push(next.engine);
        if (next.drivetrain) parts.push(next.drivetrain);
        if (next.transmission) parts.push(next.transmission);
        if (parts.length) next.powertrain = parts.join(' • ');
    }
    next.featuredSpec = null;
    return next;
}

function toSpecString(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (typeof value === 'object') {
        // Engine-style detail object
        if (
            value.displacement ||
            value.cylinder_count ||
            value.cylinder_layout ||
            value.aspiration ||
            value.valvetrain ||
            value.injection
        ) {
            const parts = [];
            if (value.displacement) parts.push(String(value.displacement));
            if (value.cylinder_layout || value.cylinder_count) {
                const layout = value.cylinder_layout ? String(value.cylinder_layout) : '';
                const count = value.cylinder_count ? `${value.cylinder_count}-cyl` : '';
                const combo = [layout, count].filter(Boolean).join(' ');
                if (combo) parts.push(combo);
            }
            if (value.aspiration) parts.push(String(value.aspiration));
            if (value.valvetrain) parts.push(String(value.valvetrain));
            if (value.injection) parts.push(String(value.injection));
            const compact = parts.filter(Boolean).join(' ');
            return compact || null;
        }

        const { value: v, unit, peak_rpm, rpm, ...rest } = value;
        if (v !== undefined && v !== null) {
            let txt = String(v);
            if (unit) txt += ` ${unit}`;
            const peak = peak_rpm || rpm;
            if (peak) txt += ` @ ${peak} rpm`;
            const extras = Object.entries(rest || {})
                .filter(([_, val]) => val !== null && val !== undefined && val !== '')
                .map(([k, val]) => `${k}: ${val}`);
            if (extras.length) txt += ` (${extras.join(', ')})`;
            return txt;
        }
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
    return String(value);
}

async function generateAiSpecs(vehicleName, modelHint) {
    if (!OPENAI_KEY) {
        throw new Error('Missing OPENAI_API_KEY');
    }
    const client = new OpenAI({ apiKey: OPENAI_KEY });
    const vehicleContext = modelHint ? `${vehicleName} (${modelHint})` : vehicleName;
    const prompt =
        'Return JSON only with keys: year, engine, horsepower, torque, drivetrain, transmission, acceleration. ' +
        'Keep each value short and readable. ' +
        'Engine: include displacement + cylinder/layout + aspiration (e.g., "4.0L twin-turbo V8"). ' +
        'Horsepower/torque: include number + unit (e.g., "603 hp", "664 lb-ft"). Skip peak rpm. ' +
        'Drivetrain: simple term (e.g., AWD, RWD, FWD). ' +
        'Transmission: simple term (e.g., 8-speed auto, 6MT). ' +
        'Acceleration: give 0-60 mph or 0-100 km/h with unit (e.g., "3.1s 0-60"). ' +
        'Prefer giving a plausible estimate for horsepower and acceleration; only use null if impossible. Vehicle: ' + vehicleContext;

    let res;
    try {
        res = await client.chat.completions.create({
            model: AI_MODEL,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: 'You extract vehicle specs. Respond only with JSON.' },
                { role: 'user', content: prompt },
            ],
        });
    } catch (err) {
        console.error('AI specs request failed:', err);
        throw err;
    }

    const raw = res?.choices?.[0]?.message?.content || '{}';
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        console.error('AI specs JSON parse failed:', raw, err);
        throw new Error('AI response could not be parsed');
    }
    return {
        engine: toSpecString(parsed.engine),
        horsepower: toSpecString(parsed.horsepower),
        torque: toSpecString(parsed.torque),
        drivetrain: toSpecString(parsed.drivetrain),
        transmission: toSpecString(parsed.transmission),
        acceleration: toSpecString(parsed.acceleration),
        year: toSpecString(parsed.year),
    };
}

module.exports = async function specsFlow(triggerInteraction, ctx) {
    const { interaction, initiator, guild, embedColor, footer, selectedVehicle, logChannel } = ctx;
    const initiatorAvatar = initiator.displayAvatarURL({ dynamic: true });
    const mainInteractionId = interaction.id;
    const getField = (submission, id) => {
        try {
            return submission.fields.getTextInputValue(id)?.trim() || '';
        } catch (_err) {
            return '';
        }
    };
    const modalFilter = (modalInteraction) =>
        modalInteraction.customId.endsWith(`+${mainInteractionId}`) &&
        modalInteraction.user.id === initiator.id;

    const buildState = () => {
        const specs = selectedVehicle.vehicleSpecs || {};
        const hasSpecs = Object.values(specs || {}).some(Boolean);
        const description = selectedVehicle.vehicleDescription || 'No specs set.';
        const embed = new EmbedBuilder()
            .setAuthor({ name: 'Garage Settings - Vehicle Specs', iconURL: initiatorAvatar })
            .setDescription('Choose manual entry (freeform) or generate specs with AI.')
            .addFields(
                { name: 'Vehicle', value: selectedVehicle.vehicle, inline: true },
                { name: 'Owner', value: initiator.tag, inline: true }
            )
            .setColor(embedColor)
            .setFooter({ text: footer.text, iconURL: footer.icon });

        if (hasSpecs) {
            embed.setDescription('Here are the specs for the vehicle:');
            const specFields = formatSpecs(specs);
            if (specFields.length) embed.addFields(specFields);
        } else {
            embed.addFields({ name: 'Specs', value: description });
        }
        return { embed, hasSpecs };
    };

    const buildControls = (hasSpecs, aiBusy = false) => [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`settingsSpecsManual+${mainInteractionId}`)
                .setLabel('Enter Specs')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`settingsSpecsAi+${mainInteractionId}`)
                .setLabel(aiBusy ? 'Generating...' : 'Generate with AI')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(aiBusy),
            new ButtonBuilder()
                .setCustomId(`settingsSpecsOptional+${mainInteractionId}`)
                .setLabel('Optional Fields')
                .setStyle(ButtonStyle.Secondary),
            ...(hasSpecs
                ? [
                      new ButtonBuilder()
                          .setCustomId(`settingsSpecsEdit+${mainInteractionId}`)
                          .setLabel('Edit Fields')
                          .setStyle(ButtonStyle.Secondary),
                  ]
                : [])
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`settingsSpecsClear+${mainInteractionId}`)
                .setLabel('Clear')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`settingsSpecsExit+${mainInteractionId}`)
                .setLabel('Exit')
                .setStyle(ButtonStyle.Secondary)
        ),
    ];

    const initial = buildState();
    await interaction.editReply({ embeds: [initial.embed], components: buildControls(initial.hasSpecs) });

    const settingsMessage = await interaction.fetchReply().catch(() => null);

    const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) =>
            i.user.id === initiator.id &&
            (!settingsMessage || i.message.id === settingsMessage.id),
        time: 20 * 60 * 1000,
    });

    collector.on('collect', async (btn) => {
        const id = btn.customId;

        if (id === `settingsSpecsManual+${mainInteractionId}`) {
            const specs = selectedVehicle.vehicleSpecs || {};
            const modal = new ModalBuilder()
                .setCustomId(`settingsSpecsManualModal+${mainInteractionId}`)
                .setTitle('Enter Vehicle Specs')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('spec_engine')
                            .setLabel('Engine (e.g., 4.0L twin-turbo V8)')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                            .setMaxLength(100)
                            .setValue(specs.engine || '')
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('spec_horsepower')
                            .setLabel('Horsepower (e.g., 603 hp)')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                            .setMaxLength(30)
                            .setValue(specs.horsepower || '')
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('spec_torque')
                            .setLabel('Torque (e.g., 664 lb-ft)')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                            .setMaxLength(30)
                            .setValue(specs.torque || '')
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('spec_drivetrain')
                            .setLabel('Drivetrain (e.g., AWD)')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                            .setMaxLength(30)
                            .setValue(specs.drivetrain || '')
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('spec_transmission')
                            .setLabel('Transmission (e.g., 9-speed auto)')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                            .setMaxLength(40)
                            .setValue(specs.transmission || '')
                    )
                );

            await btn.showModal(modal);

            let submission;
            try {
                submission = await btn.awaitModalSubmit({ filter: modalFilter, time: 20 * 60 * 1000 });
            } catch (err) {
                console.error('Specs manual modal timed out or failed:', err);
                await interaction.followUp({
                    embeds: [errorEmbed('No response was received, ending operation.', initiatorAvatar)],
                    ephemeral: true,
                });
                collector.stop('timeout');
                return;
            }

            const updates = {
                engine: toSpecString(getField(submission, 'spec_engine') || null),
                horsepower: toSpecString(getField(submission, 'spec_horsepower') || null),
                torque: toSpecString(getField(submission, 'spec_torque') || null),
                drivetrain: toSpecString(getField(submission, 'spec_drivetrain') || null),
                transmission: toSpecString(getField(submission, 'spec_transmission') || null),
            };
            const merged = finalizeSpecs(mergeSpecs(selectedVehicle.vehicleSpecs, updates));

            try {
                await updateVehicleSpecs({
                    guildId: guild.id,
                    userId: initiator.id,
                    vehicleName: selectedVehicle.vehicle,
                    specs: merged,
                });
                await clearVehicleDescription({
                    guildId: guild.id,
                    userId: initiator.id,
                    vehicleName: selectedVehicle.vehicle,
                });
            } catch (err) {
                console.error('Saving manual specs failed:', err);
                await submission.reply({
                    embeds: [errorEmbed('Failed to save the specs. Try again later.', initiatorAvatar)],
                    ephemeral: true,
                });
                return;
            }

            selectedVehicle.vehicleSpecs = merged;
            selectedVehicle.vehicleDescription = null;

            const successEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Vehicle Specs Updated', iconURL: initiatorAvatar })
                .setDescription('Specs updated successfully.')
                .setColor('#77DD77')
                .setFooter({ text: footer.text, iconURL: footer.icon });

            await logChannel
                .send({ embeds: [successEmbed.setDescription(`${initiator.tag} updated vehicle specs (manual).`)] })
                .catch(() => {});

            const { embed, hasSpecs } = buildState();
            await submission.update({ embeds: [embed], components: buildControls(hasSpecs) });
            return;
        }

        if (id === `settingsSpecsEdit+${mainInteractionId}`) {
            const specs = selectedVehicle.vehicleSpecs || {};
            const modal = new ModalBuilder()
                .setCustomId(`settingsSpecsEditModal+${mainInteractionId}`)
                .setTitle('Edit Vehicle Specs')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('spec_engine')
                            .setLabel('Engine')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                            .setMaxLength(60)
                            .setValue(specs.engine || '')
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('spec_horsepower')
                            .setLabel('Horsepower')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                            .setMaxLength(30)
                            .setValue(specs.horsepower || '')
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('spec_torque')
                            .setLabel('Torque')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                            .setMaxLength(30)
                            .setValue(specs.torque || '')
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('spec_drivetrain')
                            .setLabel('Drivetrain')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                            .setMaxLength(30)
                            .setValue(specs.drivetrain || '')
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('spec_transmission')
                            .setLabel('Transmission')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                            .setMaxLength(40)
                            .setValue(specs.transmission || '')
                    )
                );

            await btn.showModal(modal);

            let submission;
            try {
                submission = await btn.awaitModalSubmit({ filter: modalFilter, time: 20 * 60 * 1000 });
            } catch (err) {
                console.error('Specs edit modal timed out or failed:', err);
                await interaction.followUp({
                    embeds: [errorEmbed('No response was received, ending operation.', initiatorAvatar)],
                    ephemeral: true,
                });
                collector.stop('timeout');
                return;
            }

            const updates = {
                engine: getField(submission, 'spec_engine') || null,
                horsepower: getField(submission, 'spec_horsepower') || null,
                torque: getField(submission, 'spec_torque') || null,
                drivetrain: getField(submission, 'spec_drivetrain') || null,
                transmission: getField(submission, 'spec_transmission') || null,
            };
            const merged = finalizeSpecs(mergeSpecs(selectedVehicle.vehicleSpecs, updates));

            try {
                await updateVehicleSpecs({
                    guildId: guild.id,
                    userId: initiator.id,
                    vehicleName: selectedVehicle.vehicle,
                    specs: merged,
                });
            } catch (err) {
                console.error('Saving edited specs failed:', err);
                await submission.reply({
                    embeds: [errorEmbed('Failed to update the specs. Try again later.', initiatorAvatar)],
                    ephemeral: true,
                });
                return;
            }

            selectedVehicle.vehicleSpecs = merged;

            const successEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Vehicle Specs Updated', iconURL: initiatorAvatar })
                .setDescription('Specs updated successfully.')
                .setColor('#77DD77')
                .setFooter({ text: footer.text, iconURL: footer.icon });

            await logChannel
                .send({ embeds: [successEmbed.setDescription(`${initiator.tag} edited vehicle specs.`)] })
                .catch(() => {});

            const { embed, hasSpecs } = buildState();
            await submission.update({ embeds: [embed], components: buildControls(hasSpecs) });
            return;
        }

        if (id === `settingsSpecsAi+${mainInteractionId}`) {
            const modal = new ModalBuilder()
                .setCustomId(`settingsSpecsAiModal+${mainInteractionId}`)
                .setTitle('Generate Specs with AI')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('spec_model_hint')
                            .setLabel('Exact model/trim (optional)')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                            .setMaxLength(100)
                    )
                );

            await btn.showModal(modal);

            let submission;
            try {
                submission = await btn.awaitModalSubmit({ filter: modalFilter, time: 20 * 60 * 1000 });
            } catch (err) {
                console.error('Specs AI modal timed out or failed:', err);
                await interaction.followUp({
                    embeds: [errorEmbed('No response was received, ending operation.', initiatorAvatar)],
                    ephemeral: true,
                });
                collector.stop('timeout');
                return;
            }

            await submission.deferUpdate();

            const modelHintSafe = getField(submission, 'spec_model_hint') || null;

            // Disable AI button while generating
            try {
                const { embed, hasSpecs } = buildState();
                await interaction.editReply({
                    embeds: [embed],
                    components: buildControls(hasSpecs, true),
                });
            } catch (err) {
                console.error('Failed to disable AI button:', err);
            }

            await interaction
                .followUp({
                    content: 'Generating specs with AI... might be imperfect. Please review.',
                    ephemeral: true,
                })
                .catch(() => {});
            let aiSpecs;
            try {
                aiSpecs = await generateAiSpecs(selectedVehicle.vehicle, modelHintSafe);
            } catch (err) {
                console.error('AI specs generation failed:', err);
                try {
                    const { embed, hasSpecs } = buildState();
                    await interaction.editReply({ embeds: [embed], components: buildControls(hasSpecs, false) });
                } catch (e) {
                    console.error('Failed to re-enable AI button after error:', e);
                }
                await interaction.followUp({
                    embeds: [errorEmbed('AI specs failed. Please try manual entry.', initiatorAvatar)],
                    ephemeral: true,
                });
                return;
            }

            const merged = finalizeSpecs(mergeSpecs(selectedVehicle.vehicleSpecs, aiSpecs));

            try {
                await updateVehicleSpecs({
                    guildId: guild.id,
                    userId: initiator.id,
                    vehicleName: selectedVehicle.vehicle,
                    specs: merged,
                });
                // Clear old description to avoid confusion
                await clearVehicleDescription({
                    guildId: guild.id,
                    userId: initiator.id,
                    vehicleName: selectedVehicle.vehicle,
                });
            } catch (err) {
                console.error('Saving AI specs failed:', err);
                try {
                    const { embed, hasSpecs } = buildState();
                    await interaction.editReply({ embeds: [embed], components: buildControls(hasSpecs, false) });
                } catch (e) {
                    console.error('Failed to re-enable AI button after save error:', e);
                }
                await interaction.followUp({
                    embeds: [errorEmbed('Failed to save AI specs. Try again later.', initiatorAvatar)],
                    ephemeral: true,
                });
                return;
            }

            selectedVehicle.vehicleSpecs = merged;

            const successEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Vehicle Specs Generated', iconURL: initiatorAvatar })
                .setDescription('AI specs have been added. Review and edit if needed.')
                .setColor('#77DD77')
                .setFooter({ text: footer.text, iconURL: footer.icon });

            await logChannel
                .send({ embeds: [successEmbed.setDescription(`${initiator.tag} generated AI vehicle specs.`)] })
                .catch(() => {});

            const { embed, hasSpecs } = buildState();
            await interaction.editReply({ embeds: [embed], components: buildControls(hasSpecs) });
            return;
        }

        if (id === `settingsSpecsOptional+${mainInteractionId}`) {
            const specs = selectedVehicle.vehicleSpecs || {};
            const modal = new ModalBuilder()
                .setCustomId(`settingsSpecsOptionalModal+${mainInteractionId}`)
                .setTitle('Optional Fields')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('spec_acceleration')
                            .setLabel('Acceleration (e.g., 3.1s 0-60)')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                            .setMaxLength(30)
                            .setValue(specs.acceleration || '')
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('spec_color')
                            .setLabel('Color (optional)')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                            .setMaxLength(30)
                            .setValue(specs.color || '')
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('spec_year')
                            .setLabel('Year')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                            .setMaxLength(10)
                            .setValue(specs.year || '')
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('spec_mods')
                            .setLabel('Mods (optional)')
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(false)
                            .setMaxLength(200)
                            .setValue(specs.mods || '')
                    )
                );

            await btn.showModal(modal);

            let submission;
            try {
                submission = await btn.awaitModalSubmit({ filter: modalFilter, time: 20 * 60 * 1000 });
            } catch (err) {
                console.error('Specs optional modal timed out or failed:', err);
                await interaction.followUp({
                    embeds: [errorEmbed('No response was received, ending operation.', initiatorAvatar)],
                    ephemeral: true,
                });
                collector.stop('timeout');
                return;
            }

            const updates = {
                acceleration: toSpecString(getField(submission, 'spec_acceleration') || null),
                color: toSpecString(getField(submission, 'spec_color') || null),
                year: toSpecString(getField(submission, 'spec_year') || null),
                mods: toSpecString(getField(submission, 'spec_mods') || null),
            };
            const merged = finalizeSpecs(mergeSpecs(selectedVehicle.vehicleSpecs, updates));

            try {
                await updateVehicleSpecs({
                    guildId: guild.id,
                    userId: initiator.id,
                    vehicleName: selectedVehicle.vehicle,
                    specs: merged,
                });
            } catch (err) {
                console.error('Saving optional specs failed:', err);
                await submission.reply({
                    embeds: [errorEmbed('Failed to save optional fields. Try again later.', initiatorAvatar)],
                    ephemeral: true,
                });
                return;
            }

            selectedVehicle.vehicleSpecs = merged;

            const successEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Vehicle Specs Updated', iconURL: initiatorAvatar })
                .setDescription('Optional fields updated.')
                .setColor('#77DD77')
                .setFooter({ text: footer.text, iconURL: footer.icon });

            await logChannel
                .send({ embeds: [successEmbed.setDescription(`${initiator.tag} updated optional specs.`)] })
                .catch(() => {});

            const { embed, hasSpecs } = buildState();
            await submission.update({ embeds: [embed], components: buildControls(hasSpecs) });
            return;
        }

        if (id === `settingsSpecsClear+${mainInteractionId}`) {
            try {
                await Promise.all([
                    clearVehicleSpecs({
                        guildId: guild.id,
                        userId: initiator.id,
                        vehicleName: selectedVehicle.vehicle,
                    }),
                    clearVehicleDescription({
                        guildId: guild.id,
                        userId: initiator.id,
                        vehicleName: selectedVehicle.vehicle,
                    }),
                ]);
            } catch (err) {
                await btn.reply({
                    embeds: [errorEmbed('Failed to clear the specs. Try again later.', initiatorAvatar)],
                    ephemeral: true,
                });
                return;
            }

            selectedVehicle.vehicleSpecs = null;
            selectedVehicle.vehicleDescription = null;

            const resetEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Vehicle Specs Cleared', iconURL: initiatorAvatar })
                .setDescription('The vehicle specs have been removed.')
                .setColor('#FF6961')
                .setFooter({ text: footer.text, iconURL: footer.icon });

            await logChannel
                .send({ embeds: [resetEmbed.setDescription(`${initiator.tag} cleared vehicle specs.`)] })
                .catch(() => {});

            const { embed } = buildState();
            await btn.update({ embeds: [embed], components: [] });
            collector.stop('cleared');
            return;
        }

        if (id === `settingsSpecsExit+${mainInteractionId}`) {
            await btn.deferUpdate();
            collector.stop('exit');
            await interaction.deleteReply().catch(() => {});
        }
    });

    collector.on('end', async (_c, reason) => {
        if (reason === 'time') {
            await interaction.deleteReply().catch(() => {});
        }
    });
};
