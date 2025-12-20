const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { obtainGuildProfile, obtainUserProfile } = require('../database.js');
const verificationSchema = require('../../mongodb_schema/verificationApplicationSchema.js');
const garageSchema = require('../../mongodb_schema/garageSchema.js');
const userProfileSchema = require('../../mongodb_schema/userProfileSchema.js');
const { errorEmbed } = require('../utility.js');
const { greenColor } = require('../constants.js');
const moment = require('moment');
const mongoose = require('mongoose');

module.exports = async function handleApproval(interaction) {
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        const guildId = interaction.guild.id;
        const initiatorId = interaction.user.id;
        const initiatorTag = interaction.user.tag;
        const initiatorAvatar = interaction.user.displayAvatarURL({ dynamic: true });
        const todaysDate = moment.utc();

        // Fetch guild profile
        const guildProfile = await obtainGuildProfile(guildId);
        if (!guildProfile) throw new Error('Server profile not set up. Please contact the administrator.');

        const { loggingChannelId, verifiedVehicleRoleId, customFooterIcon } = guildProfile;
        const footerIcon = customFooterIcon || interaction.guild.iconURL();
        const footerText = `${interaction.guild.name} • Vehicle Verification`;


        // Fetch the verification application using applicationMessageId
        const applicationMessageId = interaction.message.id;
        const applicationData = await verificationSchema.findOne({
            applicationMessageId,
            guildId,
            status: 'open',
        });

        if (!applicationData) throw new Error('No open verification application found for this message.');
        const { userId, vehicle, vehicleImageProxyURL, vehicleImageURL } = applicationData;

        // Create or update the user's profile
        let userProfile = await obtainUserProfile(userId);
        if (!userProfile) {
            const newUserProfile = new userProfileSchema({
                _id: mongoose.Types.ObjectId(),
                userId,
                premiumUser: false,
                premiumTier: 0,
                embedColor: '',
                garageThumbnail: '',
            });
            await newUserProfile.save();
        }

        // Update the verification application as "approved"
        await verificationSchema.updateOne(
            { applicationMessageId },
            {
                $set: {
                    status: 'closed',
                    decision: 'approved',
                    decidedBy: initiatorId,
                    decidedOn: todaysDate,
                },
            }
        );

        // Create a new verified ride in the garage if it doesn't exist
        const existingRide = await garageSchema.findOne({ guildId, userId, vehicle });
        if (!existingRide) {
            const newVerifiedRide = new garageSchema({
                _id: mongoose.Types.ObjectId(),
                guildId,
                userId,
                vehicle,
                vehicleImages: [],
                vehicleDescription: null,
                vehicleAddedDate: todaysDate,
                verificationImageLink: vehicleImageProxyURL,
                embedColor: null,
            });
            await newVerifiedRide.save();
        }

        // Update the embed in the interaction message
        const vApplicationEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
        const fields = vApplicationEmbed.data.fields || [];
        const statusField = fields.find((f) => f.name.toLowerCase().includes('status'));
        if (statusField) {
            statusField.value = 'Verified Successfully';
        } else {
            vApplicationEmbed.addFields({ name: 'Status', value: 'Verified Successfully' });
        }
        vApplicationEmbed.setColor(parseInt(greenColor.replace('#', ''), 16));
        vApplicationEmbed.addFields({
            name: 'Decided By',
            value: `${initiatorTag} | <@${initiatorId}>`,
        });

        const approvedButton = new ButtonBuilder()
            .setCustomId('disabled')
            .setLabel('Approved')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true);

        const row = new ActionRowBuilder().addComponents(approvedButton);

        await interaction.editReply({
            embeds: [vApplicationEmbed],
            components: [row],
        });

        // Assign the verified vehicle role if it exists
        if (verifiedVehicleRoleId) {
            try {
                const applicantMember = await interaction.guild.members.fetch(userId);
                await applicantMember.roles.add(verifiedVehicleRoleId);
            } catch (error) {
                if (error.message === 'Unknown Member') {
                    console.warn(`User ${userId} is no longer a member of the guild. Skipping role assignment.`);
                } else {
                    throw new Error(`Failed to assign role: ${error.message}`);
                }
            }
        }


        // Notify the user via DM
        const dmNotification = new EmbedBuilder()
            .setAuthor({
                name: 'Vehicle Verification Processed',
                iconURL: interaction.guild.iconURL(),
            })
            .setDescription('Your vehicle verification application has been approved! Details are below.')
            .addFields(
                { name: 'Vehicle', value: vehicle, inline: true },
                { name: 'Decision', value: 'Approved Verification', inline: true },
                {
                    name: 'Note',
                    value: 'You can now manage your garage using the `/garage` command.',
                }
            )
            .setThumbnail(vehicleImageURL)
            .setColor(greenColor)
            .setFooter({
                text: footerText,
                iconURL: footerIcon,
            });

        const applicant = await interaction.client.users.fetch(userId);
        await applicant.send({ embeds: [dmNotification] }).catch(async () => {
            await interaction.followUp({
                embeds: [errorEmbed(`Could not notify the user via DM.`, initiatorAvatar)],
                ephemeral: true,
            });
        });

        // Log the action in the logging channel
        const logEmbed = new EmbedBuilder()
            .setAuthor({
                name: 'Vehicle Verification Processed',
                iconURL: interaction.guild.iconURL(),
            })
            .addFields(
                { name: 'Vehicle', value: vehicle, inline: true },
                { name: 'Owner', value: `<@${userId}>`, inline: true },
                { name: 'Decision', value: 'Approved Verification', inline: true },
                { name: 'Decided By', value: `<@${initiatorId}>`, inline: true }
            )
            .setThumbnail(vehicleImageURL)
            .setColor(greenColor)
            .setFooter({
                text: footerText,
                iconURL: footerIcon,
            });

        try {
            const logChannel = await interaction.guild.channels.fetch(loggingChannelId);
            if (logChannel) {
                await logChannel.send({ embeds: [logEmbed] });
            }
        } catch (logErr) {
            console.warn('Failed to log approval:', logErr.message);
        }

        // Final confirmation
        await interaction.followUp({
            content: `Verification for **${vehicle}** approved successfully.`,
            ephemeral: true,
        });
    } catch (error) {
        // Centralized error handling
        console.error(`Error in handleApproval: ${error.message}`);
        const payload = {
            embeds: [errorEmbed(error.message, interaction.user.displayAvatarURL({ dynamic: true }))],
            ephemeral: true,
        };
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp(payload).catch(() => {});
        } else {
            await interaction.reply(payload).catch(() => {});
        }
    }
};
