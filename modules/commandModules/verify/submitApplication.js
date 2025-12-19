const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const mongoose = require('mongoose');
const verificationSchema = require('../../../mongodb_schema/verificationApplicationSchema.js');
const garageSchema = require('../../../mongodb_schema/garageSchema.js');
const userProfileSchema = require('../../../mongodb_schema/userProfileSchema.js');
const { obtainUserProfile } = require('../../database.js');
const { greenColor } = require('../../constants.js');
const { getEstimatedETA } = require('../../database.js');
const runAiAnalysis = require('./aiAnalysis.js');

module.exports = async (interaction, vehicleName, vehicleAttachment, guildProfile) => {
    const { verificationChannelId, loggingChannelId, customFooterIcon } = guildProfile;

    const verificationChannel = await interaction.guild.channels.fetch(verificationChannelId);
    if (!verificationChannel) {
        throw new Error('Verification channel not found');
    }

    const loggingChannel = loggingChannelId
        ? await interaction.guild.channels.fetch(loggingChannelId).catch(() => null)
        : null;

    const initiator = interaction.user;
    const { id: initiatorId, tag: initiatorTag } = initiator;

    const eta = await getEstimatedETA(interaction.guild.id);

    // Attempt AI auto-analysis if enabled
    if (guildProfile.geminiAnalysisEnabled) {
        try {
            const analysisResult = await runAiAnalysis(interaction, vehicleName, vehicleAttachment, guildProfile);
            if (analysisResult?.success) {
                const { confidence = 0, requirementsMet, vehicleMatch } = analysisResult.analysis || {};
                // Auto-approve when very confident and all requirements are met
                if (requirementsMet && confidence >= 90) {
                    await autoApproveApplication({
                        interaction,
                        guildProfile,
                        vehicleName,
                        vehicleAttachment,
                        loggingChannel,
                        verificationChannel,
                        initiator,
                    });
                    return;
                }
                // Auto-deny when confident enough (>=50) and requirements are not met
                if (confidence >= 50 && requirementsMet === false) {
                    await autoDenyApplication({
                        interaction,
                        guildProfile,
                        vehicleName,
                        vehicleAttachment,
                        loggingChannel,
                        verificationChannel,
                        initiator,
                        analysis: analysisResult.analysis,
                    });
                    return;
                }
            } else {
                console.warn('AI analysis failed or returned unsuccessful result:', analysisResult?.error);
            }
        } catch (err) {
            console.error('AI analysis threw an error, falling back to manual review:', err);
        }
    }

        // Create the application embed for manual review
        const vApplication = new EmbedBuilder()
            .setAuthor({
                name: 'Vehicle Verification - New Application',
                iconURL: initiator.displayAvatarURL({ dynamic: true }),
            })
            .setDescription('A new verification application has been registered. Please process the verification using the buttons below.')
            .addFields(
                { name: 'Vehicle', value: vehicleName, inline: true },
                { name: 'Owner', value: `${initiatorTag} | <@${initiatorId}>`, inline: true },
                { name: 'Image Name', value: `[${vehicleAttachment.name}](${vehicleAttachment.proxyURL})`, inline: true },
                { name: 'Status', value: 'Due for verification', inline: true }
            )
            .setImage(vehicleAttachment.url)
            .setColor('#FFFCFF')
            .setFooter({
                text: `${interaction.guild.name} • Vehicle Verification`,
                iconURL: customFooterIcon || interaction.guild.iconURL({ dynamic: true }),
            });

        const approveButton = new ButtonBuilder()
            .setCustomId(`approveApplication`)
            .setLabel('Approve')
            .setStyle(ButtonStyle.Success);

        const denyButton = new ButtonBuilder()
            .setCustomId(`denyApplication`)
            .setLabel('Deny')
            .setStyle(ButtonStyle.Danger);

        const denyGuideButton = new ButtonBuilder()
            .setCustomId(`denyReadGuide`)
            .setLabel('Read The Guide')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(approveButton, denyButton, denyGuideButton);

        const applicationMessage = await verificationChannel.send({
            embeds: [vApplication],
            components: [row],
        });

        // Save application to the database
        const application = new verificationSchema({
            _id: new mongoose.Types.ObjectId(),
            guildId: interaction.guild.id,
            userId: initiatorId,
            vehicle: vehicleName,
            vehicleImageURL: vehicleAttachment.url,
            vehicleImageProxyURL: vehicleAttachment.proxyURL,
            vehicleImageName: vehicleAttachment.name,
            status: 'open',
            submittedOn: new Date().toISOString(),
            applicationMessageId: applicationMessage.id,
        });

        try {
            await application.save();
        } catch (error) {
            console.error('Error saving application:', error);
            throw new Error('Failed to save application');
        }

        // Log the application in the logging channel (if available)
        if (loggingChannel) {
            const logEmbed = EmbedBuilder.from(vApplication).setDescription(
                `New application submitted in <#${verificationChannelId}>.`
            );

            await loggingChannel.send({ embeds: [logEmbed] });
        }

        // Send confirmation to the user
        const confirmationEmbed = new EmbedBuilder()
            .setAuthor({
                name: 'Verification Application Submitted',
                iconURL: initiator.displayAvatarURL({ dynamic: true }),
            })
            .setDescription(
                `Thank you for submitting your verification application! Here’s what happens next:\n\n` +
                    `Your application will be reviewed by the server staff. Please ensure your DMs are open to receive updates about the status of your application.`
            )
            .addFields(
                { name: 'Estimated Wait Time', value: `${eta}`, inline: false },
                { name: 'Vehicle', value: `${vehicleName}`, inline: true },
                {
                    name: 'What to Expect',
                    value:
                        `1. The staff will review your application.\n` +
                        `2. If approved, your vehicle will be added to your garage.\n` +
                        `3. If rejected, you will receive feedback on why it was denied.`,
                }
            )
            .setColor(greenColor)
            .setThumbnail(vehicleAttachment.url)
            .setFooter({
                text: `${interaction.guild.name} • Vehicle Verification`,
                iconURL: customFooterIcon || interaction.guild.iconURL({ dynamic: true }),
            });

        await interaction.editReply({
            embeds: [confirmationEmbed],
            components: [],
        });
    };

async function autoApproveApplication({ interaction, guildProfile, vehicleName, vehicleAttachment, loggingChannel, verificationChannel, initiator }) {
    const { id: initiatorId, tag: initiatorTag } = initiator;
    const guildId = interaction.guild.id;

    // Create/ensure user profile
    let userProfile = await obtainUserProfile(initiatorId);
    if (!userProfile) {
        const newProfile = new userProfileSchema({
            _id: new mongoose.Types.ObjectId(),
            userId: initiatorId,
            premiumUser: false,
            premiumTier: 0,
            embedColor: '',
            garageThumbnail: '',
        });
        await newProfile.save();
    }

    // Persist garage entry
    const newRide = new garageSchema({
        _id: mongoose.Types.ObjectId(),
        guildId,
        userId: initiatorId,
        vehicle: vehicleName,
        vehicleImages: [vehicleAttachment.url],
        vehicleDescription: null,
        vehicleAddedDate: new Date().toISOString(),
        verificationImageLink: vehicleAttachment.proxyURL,
        embedColor: null,
    });
    await newRide.save();

    // Create override message for staff
    const appEmbed = new EmbedBuilder()
        .setAuthor({ name: 'Vehicle Verification - Auto Approved', iconURL: initiator.displayAvatarURL({ dynamic: true }) })
        .setDescription('This application was automatically approved by AI analysis. Staff may override below if needed.')
        .addFields(
            { name: 'Vehicle', value: vehicleName, inline: true },
            { name: 'Owner', value: `${initiatorTag} | <@${initiatorId}>`, inline: true },
            { name: 'Status', value: 'Auto-approved', inline: true }
        )
        .setImage(vehicleAttachment.url)
        .setColor('#77DD77')
        .setFooter({
            text: `${interaction.guild.name} • Vehicle Verification`,
            iconURL: guildProfile.customFooterIcon || interaction.guild.iconURL({ dynamic: true }),
        });

    const overrideButton = new ButtonBuilder()
        .setCustomId(`autoOverrideDeny`)
        .setLabel('Override: Deny')
        .setStyle(ButtonStyle.Danger);

    const message = await verificationChannel.send({ embeds: [appEmbed], components: [new ActionRowBuilder().addComponents(overrideButton)] });

    // Save application record with auto-approved status for potential override
    const application = new verificationSchema({
        _id: new mongoose.Types.ObjectId(),
        guildId,
        userId: initiatorId,
        vehicle: vehicleName,
        vehicleImageURL: vehicleAttachment.url,
        vehicleImageProxyURL: vehicleAttachment.proxyURL,
        vehicleImageName: vehicleAttachment.name,
        status: 'auto-approved',
        submittedOn: new Date().toISOString(),
        applicationMessageId: message.id,
        decision: 'approved',
        decidedBy: 'ai-auto',
        decidedOn: new Date().toISOString(),
    });
    await application.save();

    // Assign role if configured
    if (guildProfile.verifiedVehicleRoleId) {
        await interaction.guild.members.fetch(initiatorId).then(m => m.roles.add(guildProfile.verifiedVehicleRoleId)).catch(() => {});
    }

    // Log auto approval
    if (loggingChannel) {
        const logEmbed = EmbedBuilder.from(appEmbed).setDescription(`Auto-approved in <#${verificationChannel.id}>. AI confidence >= 90%.`);
        await loggingChannel.send({ embeds: [logEmbed] }).catch(() => {});
    }

    // User confirmation
    const confirmationEmbed = new EmbedBuilder()
        .setAuthor({ name: 'Verification Auto-Approved', iconURL: initiator.displayAvatarURL({ dynamic: true }) })
        .setDescription('Your verification was automatically approved. You can manage your garage using `/garage`.')
        .addFields({ name: 'Vehicle', value: vehicleName, inline: true })
        .setColor('#77DD77')
        .setThumbnail(vehicleAttachment.url)
        .setFooter({
            text: `${interaction.guild.name} • Vehicle Verification`,
            iconURL: guildProfile.customFooterIcon || interaction.guild.iconURL({ dynamic: true }),
        });

    await interaction.editReply({ embeds: [confirmationEmbed], components: [] });
}

async function autoDenyApplication({ interaction, guildProfile, vehicleName, vehicleAttachment, loggingChannel, verificationChannel, initiator, analysis }) {
    const { id: initiatorId, tag: initiatorTag } = initiator;
    const guildId = interaction.guild.id;
    const issues = Array.isArray(analysis?.issues) ? analysis.issues.slice(0, 5).join('\n• ') : null;
    const feedback = analysis?.feedback || null;
    const reason = issues ? `• ${issues}` : feedback || 'Requirements were not met based on the uploaded image.';

    const appEmbed = new EmbedBuilder()
        .setAuthor({ name: 'Vehicle Verification - Auto Denied', iconURL: initiator.displayAvatarURL({ dynamic: true }) })
        .setDescription('This application was automatically denied by AI analysis. Staff can override below if this is incorrect.')
        .addFields(
            { name: 'Vehicle', value: vehicleName, inline: true },
            { name: 'Owner', value: `${initiatorTag} | <@${initiatorId}>`, inline: true },
            { name: 'Status', value: 'Auto-denied', inline: true },
            { name: 'Reason', value: reason.length > 1024 ? reason.slice(0, 1021) + '...' : reason, inline: false }
        )
        .setImage(vehicleAttachment.url)
        .setColor('#FF6961')
        .setFooter({
            text: `${interaction.guild.name} • Vehicle Verification`,
            iconURL: guildProfile.customFooterIcon || interaction.guild.iconURL({ dynamic: true }),
        });

    const overrideApproveButton = new ButtonBuilder()
        .setCustomId('autoOverrideApprove')
        .setLabel('Override: Approve')
        .setStyle(ButtonStyle.Success);

    const message = await verificationChannel.send({
        embeds: [appEmbed],
        components: [new ActionRowBuilder().addComponents(overrideApproveButton)],
    });

    // Save application record with auto-denied status for potential override
    const application = new verificationSchema({
        _id: new mongoose.Types.ObjectId(),
        guildId,
        userId: initiatorId,
        vehicle: vehicleName,
        vehicleImageURL: vehicleAttachment.url,
        vehicleImageProxyURL: vehicleAttachment.proxyURL,
        vehicleImageName: vehicleAttachment.name,
        status: 'auto-denied',
        submittedOn: new Date().toISOString(),
        applicationMessageId: message.id,
        decision: 'denied',
        decidedBy: 'ai-auto',
        decidedOn: new Date().toISOString(),
    });
    await application.save();

    // Log auto denial
    if (loggingChannel) {
        const logEmbed = EmbedBuilder.from(appEmbed).setDescription(
            `Auto-denied in <#${verificationChannel.id}>. AI confidence >= threshold.`
        );
        await loggingChannel.send({ embeds: [logEmbed] }).catch(() => {});
    }

    // User notification
    const denialEmbed = new EmbedBuilder()
        .setAuthor({ name: 'Verification Auto-Denied', iconURL: initiator.displayAvatarURL({ dynamic: true }) })
        .setDescription(
            'Your verification was automatically denied because the image did not meet the requirements.\n' +
            'If you believe this is incorrect, staff can override the decision, or you can re-submit with a corrected image.'
        )
        .addFields({ name: 'Vehicle', value: vehicleName, inline: true })
        .setColor('#FF6961')
        .setThumbnail(vehicleAttachment.url)
        .setFooter({
            text: `${interaction.guild.name} • Vehicle Verification`,
            iconURL: guildProfile.customFooterIcon || interaction.guild.iconURL({ dynamic: true }),
        });

    await interaction.editReply({ embeds: [denialEmbed], components: [] });
}
