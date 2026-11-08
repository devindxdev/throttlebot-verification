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
const { greenColor } = require('../../constants.js');
const { getEstimatedETA, obtainGuildProfile } = require('../../database.js');
const { attachmentKind, assertEvidenceAllowed } = require('../../verification/evidencePolicy');
const runAiAnalysis = require('./aiAnalysis.js');
const { validAnalysis, canAutoApprove } = require('../../verification/aiPolicy');
const { createAutoApproval, commitDecision } = require('../../verification/decisions');
const { fetchApplicantMember } = require('../../eventModules/checkApplicantMembership');
const { extractVehicleMeta } = require('../../vehicleUtils.js');

module.exports = async (interaction, vehicleName, vehicleAttachment, guildProfile) => {
    // A server policy can change while the confirmation buttons are open.
    guildProfile = await obtainGuildProfile(interaction.guild.id);
    if (!guildProfile) throw new Error('Server verification settings were not found.');
    assertEvidenceAllowed(guildProfile, vehicleAttachment, { guildName: interaction.guild.name, username: interaction.user.username });
    const { verificationChannelId, loggingChannelId, customFooterIcon } = guildProfile;
    const attachmentType = vehicleAttachment.contentType || '';
    const kind = attachmentKind(vehicleAttachment);
    const isImage = kind === 'image';
    const isVideo = kind === 'video';

    const verificationChannel = await interaction.guild.channels.fetch(verificationChannelId);
    if (!verificationChannel) {
        throw new Error('Verification channel not found');
    }

    const loggingChannel = loggingChannelId
        ? await interaction.guild.channels.fetch(loggingChannelId).catch(() => null)
        : null;

    // Will be populated if AI analysis runs
    let analysisSummary = null;
    let aiAnalysisData = null;

    const initiator = interaction.user;
    const { id: initiatorId, tag: initiatorTag } = initiator;

    const eta = await getEstimatedETA(interaction.guild.id);
    const vehicleMeta = extractVehicleMeta(vehicleName);

    // Attempt AI auto-analysis if enabled
    if (!guildProfile.videoVerificationRequired && guildProfile.geminiAnalysisEnabled && isImage) {
        try {
            const analysisResult = await runAiAnalysis(interaction, vehicleName, vehicleAttachment, guildProfile);
            if (analysisResult?.success && validAnalysis(analysisResult.analysis)) {
                const { confidence = 0, requirementsMet, vehicleMatch, estimatedValueUSD } = analysisResult.analysis || {};
                const parsedValue = typeof estimatedValueUSD === 'number' ? estimatedValueUSD : NaN;
                const estimatedValue = Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
                aiAnalysisData = analysisResult.analysis || null;

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
                if (canAutoApprove(analysisResult.analysis)) {
                    return await autoApproveApplication({
                        interaction,
                        guildProfile,
                        vehicleName,
                        vehicleAttachment,
                        loggingChannel,
                        verificationChannel,
                        initiator,
                        vehicleMeta,
                        analysis: analysisResult.analysis || null,
                    });
                }
                // Auto-deny when confident enough (>=65) and requirements are not met
                if (confidence >= 65 && requirementsMet === false) {
                    return await autoDenyApplication({
                        interaction,
                        guildProfile,
                        vehicleName,
                        vehicleAttachment,
                        loggingChannel,
                        verificationChannel,
                        initiator,
                        vehicleMeta,
                        analysis: analysisResult.analysis,
                    });
                }
            } else {
                console.warn('AI analysis failed or returned unsuccessful result:', analysisResult?.error);
            }
        } catch (err) {
            if (err.autoDecisionFailed) throw err;
            console.error('AI analysis threw an error, falling back to manual review:', err);
        }
    }

        // Create the application embed for manual review
        const vApplication = new EmbedBuilder()
            .setAuthor({
                name: isVideo ? 'Video Verification — New Application' : 'Vehicle Verification - New Application',
                iconURL: initiator.displayAvatarURL({ dynamic: true }),
            })
            .setDescription(isVideo ? (guildProfile.videoVerificationRequired ? 'A video verification is awaiting staff review. Check the spoken server name and Discord username, then confirm the applicant starts the vehicle with their keys.' : 'A video verification is awaiting staff review. Check the evidence against this server’s guide.') : 'A new verification application has been registered. Please process the verification using the buttons below.')
            .addFields(
                { name: 'Vehicle', value: vehicleName, inline: true },
                { name: 'Owner', value: `${initiatorTag} | <@${initiatorId}>`, inline: true },
                { name: 'Attachment', value: `[${vehicleAttachment.name}](${vehicleAttachment.url}) (${attachmentType || 'file'})`, inline: true },
                { name: 'Status', value: isVideo ? 'Awaiting staff review' : 'Due for verification', inline: true }
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
            vehicleBrand: vehicleMeta.brand,
            vehicleModel: vehicleMeta.model,
            vehicleImageURL: vehicleAttachment.url,
            vehicleImageProxyURL: vehicleAttachment.url,
            vehicleImageName: vehicleAttachment.name,
            status: 'open',
            submittedOn: new Date().toISOString(),
            applicationMessageId: applicationMessage.id,
            aiAnalysis: aiAnalysisData,
        });

        try {
            await application.save();
        } catch (error) {
            await applicationMessage.delete().catch(() => {});
            console.error('Error saving application:', error.name);
            throw new Error('Failed to save application');
        }

        // Log the application in the logging channel (if available)
        if (loggingChannel) {
            const logEmbed = EmbedBuilder.from(vApplication).setDescription(
                `New application submitted in <#${verificationChannelId}>.`
            );

            await loggingChannel.send({ embeds: [logEmbed] }).catch(error => console.warn('Application saved, but submission logging failed:', error.name));
        }

        // Send confirmation to the user
        const confirmationEmbed = new EmbedBuilder()
            .setAuthor({
                name: isVideo ? 'Video Verification Submitted' : 'Verification Application Submitted',
                iconURL: initiator.displayAvatarURL({ dynamic: true }),
            })
            .setDescription(
                isVideo ? `Your video for **${vehicleName}** has been submitted and will be reviewed by the server staff. Keep your DMs open for the decision and any requests for more information.` :
                `Thank you for submitting your verification application! Here’s what happens next:\n\n` +
                    `Your application will be reviewed by the server staff. Please ensure your DMs are open to receive updates about the status of your application.`
            )
            .addFields(
                { name: 'Estimated Wait Time', value: `${eta}`, inline: false },
                { name: 'Vehicle', value: `${vehicleName}`, inline: true },
                {
                    name: 'What to Expect',
                    value: isVideo ? '1. Staff will review your video.\n2. If approved, your vehicle will be added to your garage.\n3. If denied, staff will explain what to fix before you submit another video.' :
                        `1. The staff will review your application.\n` +
                        `2. If approved, your vehicle will be added to your garage.\n` +
                        `3. If rejected, you will receive feedback on why it was denied.`,
                }
            )
            .setColor(greenColor)
            .setFooter({
                text: `${interaction.guild.name} • Vehicle Verification`,
                iconURL: customFooterIcon || interaction.guild.iconURL({ dynamic: true }),
            });

        if (isVideo) confirmationEmbed.addFields({ name: 'Review Status', value: 'Awaiting staff review' });
        if (isImage) confirmationEmbed.setThumbnail(vehicleAttachment.url);

        await interaction.editReply({
            embeds: [confirmationEmbed],
            components: [],
        });
    };

async function autoApproveApplication({ interaction, guildProfile, vehicleName, vehicleAttachment, loggingChannel, verificationChannel, initiator, analysis, vehicleMeta }) {
    try {
        const { id: initiatorId, tag: initiatorTag } = initiator;
        const guildId = interaction.guild.id;

        const applicantMember = await fetchApplicantMember(interaction.guild, initiatorId);
        if (!applicantMember) throw Object.assign(new Error('You are no longer a member of this server.'), { autoDecisionFailed: true });
        const application = {
            _id: new mongoose.Types.ObjectId(), guildId, userId: initiatorId, vehicle: vehicleName,
            vehicleBrand: vehicleMeta?.brand || null, vehicleModel: vehicleMeta?.model || null,
            vehicleImageURL: vehicleAttachment.url, vehicleImageProxyURL: vehicleAttachment.url,
            vehicleImageName: vehicleAttachment.name, status: 'auto-approved', submittedOn: new Date(),
            applicationMessageId: null, decision: 'approved', decidedBy: 'ai-auto', decidedOn: new Date(),
            aiAnalysis: analysis, originalAiDecision: 'approved',
        };
        try { await createAutoApproval(application); }
        catch (error) { error.autoDecisionFailed = true; throw error; }

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

        try {
            const message = await verificationChannel.send({ embeds: [appEmbed], components: [new ActionRowBuilder().addComponents(overrideButton)] });
            await verificationSchema.updateOne({ _id: application._id }, { $set: { applicationMessageId: message.id } });
        } catch (error) {
            console.error('Auto-approved application saved, but staff message could not be posted:', error.name);
        }

        // Assign role if configured
        if (guildProfile.verifiedVehicleRoleId) {
            await applicantMember.roles.add(guildProfile.verifiedVehicleRoleId).catch(() => {});
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

        await interaction.editReply({ embeds: [confirmationEmbed], components: [] }).catch(error => {
            error.autoDecisionFailed = true; throw error;
        });
    } catch (error) {
        error.autoDecisionFailed = true;
        throw error;
    }
}

async function autoDenyApplication({ interaction, guildProfile, vehicleName, vehicleAttachment, loggingChannel, verificationChannel, initiator, analysis, vehicleMeta }) {
    try {
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
            vehicleBrand: vehicleMeta?.brand || null,
            vehicleModel: vehicleMeta?.model || null,
            vehicleImageURL: vehicleAttachment.url,
            vehicleImageProxyURL: vehicleAttachment.url,
            vehicleImageName: vehicleAttachment.name,
            status: 'auto-denied',
            submittedOn: new Date().toISOString(),
            applicationMessageId: null,
            decision: 'denied',
            decidedBy: 'ai-auto',
            decidedOn: new Date().toISOString(),
            aiAnalysis: analysis || null,
            denialReason: reason, originalAiDecision: 'denied',
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

        // Collect appeal only from this application's response.
        const appealMessage = await interaction.fetchReply();
        if (appealMessage) {
            const collector = appealMessage.createMessageComponentCollector({
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
                    try {
                        await commitDecision(application, {
                            status: 'open', decision: null, decidedBy: null, decidedOn: null,
                            applicationMessageId: verificationMessage.id, appealReason, originalAiDecision: 'denied',
                            submittedOn: new Date(),
                        });
                    } catch (error) {
                        await verificationMessage.delete().catch(() => {});
                        throw error;
                    }

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
    } catch (error) {
        error.autoDecisionFailed = true;
        throw error;
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
