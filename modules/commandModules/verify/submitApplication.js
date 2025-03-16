const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const mongoose = require('mongoose');
const verificationSchema = require('../../../mongodb_schema/verificationApplicationSchema.js');
const { greenColor } = require('../../constants.js');
const { getEstimatedETA } = require('../../database.js');
const runGeminiAnalysis = require('./geminiAnalysis.js'); // Ensure this file contains your Gemini analysis logic

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

    let analysisResult;

    // Analyze the image if the guild ID matches a specific ID
    if (interaction.guild.id === "123") {
        analysisResult = await runGeminiAnalysis(interaction, vehicleName, vehicleAttachment, guildProfile);

        if (analysisResult.success) {
            const { confidence, requirementsMet } = analysisResult.analysis;

            if (confidence >= 90 && requirementsMet) {
                // Call applicationApproval if requirements are met with high confidence
                await applicationApproval(interaction, analysisResult.analysis, guildProfile);
                return;
            } else {
                // Confidence below 90% or requirements not met, proceed to manual verification
                console.log('Confidence below 90% or requirements not met. Proceeding to manual review.');
            }
        } else {
            console.error('Gemini analysis failed:', analysisResult.error);
            // If Gemini analysis fails, log and continue with manual verification
        }
    }else{

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
};
