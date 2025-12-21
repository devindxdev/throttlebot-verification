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
    const attachmentType = vehicleAttachment.contentType || '';
    const isImage = attachmentType.includes('image');
    const isVideo = attachmentType.includes('video');

    const verificationChannel = await interaction.guild.channels.fetch(verificationChannelId);
    if (!verificationChannel) {
        throw new Error('Verification channel not found');
    }

    const loggingChannel = loggingChannelId
        ? await interaction.guild.channels.fetch(loggingChannelId).catch(() => null)
        : null;

    // Will be populated if AI analysis runs
    let analysisSummary = null;

    const initiator = interaction.user;
    const { id: initiatorId, tag: initiatorTag } = initiator;

    const eta = await getEstimatedETA(interaction.guild.id);

    // Attempt AI auto-analysis if enabled
    if (guildProfile.geminiAnalysisEnabled && isImage) {
        try {
            const analysisResult = await runAiAnalysis(interaction, vehicleName, vehicleAttachment, guildProfile);
            if (analysisResult?.success) {
                const { confidence = 0, requirementsMet, vehicleMatch, estimatedValueUSD } = analysisResult.analysis || {};
                const parsedValue = Number(estimatedValueUSD);
                const estimatedValue = Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;

                // High-value rules
                if (estimatedValue !== null && estimatedValue >= 100000) {
                    await handleHighValueRequiresVideo({
                        interaction,
                        vehicleName,
                        vehicleAttachment,
                        customFooterIcon,
                        guildProfile,
                        estimatedValue,
                    });
                    return;
                }

                analysisSummary = summarizeAnalysis({ confidence, requirementsMet, vehicleMatch, estimatedValue });

                // Auto-approve when very confident and all requirements are met and not high-value
                if (requirementsMet && confidence >= 90 && estimatedValue !== null && estimatedValue < 50000) {
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
                // Auto-deny when confident enough (>=65) and requirements are not met
                if (confidence >= 65 && requirementsMet === false) {
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
                { name: 'Attachment', value: `[${vehicleAttachment.name}](${vehicleAttachment.url}) (${attachmentType || 'file'})`, inline: true },
                { name: 'Status', value: 'Due for verification', inline: true }
            )
            .setColor('#FFFCFF')
            .setFooter({
                text: `${interaction.guild.name} • Vehicle Verification`,
                iconURL: customFooterIcon || interaction.guild.iconURL({ dynamic: true }),
            });

        // Add AI summary to help staff if we have it
        if (analysisSummary) {
            vApplication.addFields({
                name: 'AI Summary',
                value: analysisSummary,
            });
        }
        if (isImage) vApplication.setImage(vehicleAttachment.url);

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

        const banButton = new ButtonBuilder()
            .setCustomId('banApplication')
            .setLabel('Ban')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(approveButton, denyButton, denyGuideButton, banButton);

        const applicationMessage = await verificationChannel.send(
            isVideo
                ? {
                    content: `Vehicle Verification Video for: ${vehicleName}`,
                    files: [{ attachment: vehicleAttachment.url, name: vehicleAttachment.name }],
                    embeds: [vApplication],
                    components: [row],
                }
                : { embeds: [vApplication], components: [row] }
        );

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
            sortPreference: 'default',
        });
        await newProfile.save();
    }

    // Persist garage entry
    const newRide = new garageSchema({
        _id: mongoose.Types.ObjectId(),
        guildId,
        userId: initiatorId,
        vehicle: vehicleName,
        vehicleImages: [],
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
        .setDescription('Your verification was automatically approved. You are all set!')
        .addFields(
            { name: 'Vehicle', value: vehicleName, inline: true },
            {
                name: 'Next Steps',
                value:
                    '• View your verified vehicles with `/garage`.\n' +
                    '• Customize images and descriptions with `/settings`.\n' +
                    '• Verify another vehicle anytime with `/verify`.',
            }
        )
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
        .setDescription('This application was automatically denied by AI analysis.')
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

    // Save application record with auto-denied status (no posting to verification channel yet)
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
        applicationMessageId: null,
        decision: 'denied',
        decidedBy: 'ai-auto',
        decidedOn: new Date().toISOString(),
    });
    await application.save();

    // Log auto denial (staff visibility only)
    if (loggingChannel) {
        const logEmbed = EmbedBuilder.from(appEmbed).setDescription(
            `Auto-denied by AI. Not sent to verification channel unless appealed.`
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
        .addFields(
            { name: 'Vehicle', value: vehicleName, inline: true },
            { name: 'Reason', value: reason || 'Requirements were not met.' }
        )
        .setColor('#FF6961')
        .setThumbnail(vehicleAttachment.url)
        .setFooter({
            text: `${interaction.guild.name} • Vehicle Verification`,
            iconURL: guildProfile.customFooterIcon || interaction.guild.iconURL({ dynamic: true }),
        });

    const appealButton = new ButtonBuilder()
        .setCustomId('appealAutoDeny')
        .setLabel('Appeal')
        .setStyle(ButtonStyle.Secondary);

    await interaction.editReply({ embeds: [denialEmbed], components: [new ActionRowBuilder().addComponents(appealButton)] });

    // Collect appeal from the user
    if (interaction.channel) {
        const collector = interaction.channel.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000,
            filter: (btn) => btn.user.id === initiatorId && btn.customId === 'appealAutoDeny',
        });

        collector.on('collect', async (btn) => {
            const modal = new ModalBuilder()
                .setCustomId('appealAutoDenyModal')
                .setTitle('Appeal Auto-Denial');
            const reasonInput = new TextInputBuilder()
                .setCustomId('appeal_reason')
                .setLabel('Why should this be approved?')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(1000)
                .setPlaceholder('Note: Fake appeals may result in disciplinary action.');
            modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

            await btn.showModal(modal);

            try {
                const submission = await btn.awaitModalSubmit({
                    time: 60000,
                    filter: (i) => i.user.id === initiatorId && i.customId === 'appealAutoDenyModal',
                });
                const appealReason = submission.fields.getTextInputValue('appeal_reason')?.trim() || 'No reason provided';
                await submission.deferUpdate();

                // Post to verification channel now
                const appealEmbed = EmbedBuilder.from(appEmbed)
                    .setDescription('This application was auto-denied by AI and has been appealed by the user.')
                    .addFields({ name: 'Appeal Reason', value: appealReason });

                const approveButton = new ButtonBuilder().setCustomId('approveApplication').setLabel('Approve').setStyle(ButtonStyle.Success);
                const denyButton = new ButtonBuilder().setCustomId('denyApplication').setLabel('Deny').setStyle(ButtonStyle.Danger);
                const denyGuideButton = new ButtonBuilder().setCustomId('denyReadGuide').setLabel('Read The Guide').setStyle(ButtonStyle.Danger);
                const banButton = new ButtonBuilder().setCustomId('banApplication').setLabel('Ban').setStyle(ButtonStyle.Danger);
                const row = new ActionRowBuilder().addComponents(approveButton, denyButton, denyGuideButton, banButton);

                const verificationMessage = await verificationChannel.send(
                    vehicleAttachment.contentType?.includes('video')
                        ? {
                            content: `Vehicle Verification Video for: ${vehicleName}`,
                            files: [{ attachment: vehicleAttachment.url, name: vehicleAttachment.name }],
                            embeds: [appealEmbed],
                            components: [row],
                        }
                        : { embeds: [appealEmbed], components: [row] }
                );

                // Update application record with appeal info
                await verificationSchema.updateOne(
                    { _id: application._id },
                    {
                        $set: {
                            status: 'open',
                            decision: null,
                            decidedBy: null,
                            decidedOn: null,
                            applicationMessageId: verificationMessage.id,
                            appealReason,
                        },
                    }
                );

                // Notify user
                const appealAck = new EmbedBuilder()
                    .setAuthor({ name: 'Appeal Submitted', iconURL: initiator.displayAvatarURL({ dynamic: true }) })
                    .setDescription('Your appeal has been submitted to the verification team for review.')
                    .addFields({ name: 'Appeal Reason', value: appealReason })
                    .setColor('#FFFCFF')
                    .setFooter({
                        text: `${interaction.guild.name} • Vehicle Verification`,
                        iconURL: guildProfile.customFooterIcon || interaction.guild.iconURL({ dynamic: true }),
                    });

                await interaction.editReply({ embeds: [appealAck], components: [] });
                collector.stop('appealed');
            } catch (err) {
                await interaction.followUp({
                    content: 'Appeal timed out or failed. Please try again with `/verify` if needed.',
                    ephemeral: true,
                });
            }
        });

        collector.on('end', async (collected, reasonEnd) => {
            if (reasonEnd !== 'appealed') {
                await interaction.editReply({ components: [] }).catch(() => {});
            }
        });
    }
}

async function handleHighValueRequiresVideo({ interaction, vehicleName, vehicleAttachment, customFooterIcon, guildProfile, estimatedValue }) {
    const embed = new EmbedBuilder()
        .setAuthor({ name: 'High-Value Verification Required', iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setDescription(
            'This vehicle appears to be high value. For security, please re-submit using a short video instead of an image that clearly shows:\n' +
            '1. Show the vehicle in the video and unlock the vehicle with your keys.\n' +
            `2. While showing this, say "The Car Community" and your Discord username "${interaction.user.username}.`
        )
        .addFields(
            { name: 'Vehicle', value: vehicleName, inline: true },
            { name: 'Estimated Value', value: formatCurrency(estimatedValue), inline: true }
        )
        .setColor('#FFB347')
        .setFooter({
            text: `${interaction.guild.name} • Vehicle Verification`,
            iconURL: customFooterIcon || interaction.guild.iconURL({ dynamic: true }),
        });

    await interaction.editReply({ embeds: [embed], components: [] });

    // Optional log to staff
    if (guildProfile.loggingChannelId) {
        interaction.guild.channels.fetch(guildProfile.loggingChannelId).then((channel) => {
            channel.send({
                embeds: [
                    EmbedBuilder.from(embed).setDescription(
                        'High-value verification requested. User was asked to re-submit with a video.'
                    ),
                ],
            }).catch(() => {});
        }).catch(() => {});
    }
}

function summarizeAnalysis({ confidence, requirementsMet, vehicleMatch, estimatedValue }) {
    const req = requirementsMet === true ? '✅ Requirements met' : requirementsMet === false ? '❌ Requirements failed' : '⚠️ Unknown';
    const match = vehicleMatch === true ? '✅ Vehicle matches' : vehicleMatch === false ? '❌ Vehicle mismatch' : '⚠️ Unknown';
    const value = Number.isFinite(estimatedValue) && estimatedValue > 0 ? `Est. value: ${formatCurrency(estimatedValue)}` : 'Est. value: n/a';
    return `${req}\n${match}\nConfidence: ${confidence}%\n${value}`;
}

function formatCurrency(value) {
    const numeric = Number(value) || 0;
    return `$${numeric.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
