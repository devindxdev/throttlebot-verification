// Required Discord.js classes for building commands, embeds, and UI components
const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder, 
	ComponentType,
    PermissionsBitField,
} = require('discord.js');

// Import the MongoDB schema for guild profiles
const guildProfileSchema = require('../mongodb_schema/guildProfileSchema.js');

// Import modular handler functions for different setup options
const handleGlobalPassport = require('../modules/commandModules/setup/handleGlobalPassport.js');
const handleVerificationChannel = require('../modules/commandModules/setup/handleVerificationChannel.js');
const handleGuideChannel = require('../modules/commandModules/setup/handleGuideChannel.js');
const handleLoggingChannel = require('../modules/commandModules/setup/handleLoggingChannel.js');
const handleVerifiedRole = require('../modules/commandModules/setup/handleVerifiedRole.js');
const handleEmbedIcon = require('../modules/commandModules/setup/handleEmbedIcon.js');
const handleGeminiAnalysis = require('../modules/commandModules/setup/handleGeminiAnalysis.js');
const exitSetup = require('../modules/commandModules/setup/exitSetup.js');

/**
 * /setup command: guides admins through configuring core guild settings.
 */
module.exports = {
    // Define the slash command
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Setup the bot for your server.'),
    async execute(interaction) {
        try {
            // Check if the user has ManageGuild permission
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                throw new Error('You do not have the necessary permissions to use this command. (Requires Manage Server permission)');
            }


		    if(!interaction.deferred) await interaction.deferReply({ ephemeral: true });
            // Get guild information
            const guildId = interaction.guild.id;
            const guildName = interaction.guild.name;

        // Fetch existing guild profile or create a new one if it doesn't exist
        let guildProfile = await guildProfileSchema.findOne({ guildId });
        if (!guildProfile) {
            // Initialize new guild profile with default values
            guildProfile = new guildProfileSchema({
                guildId: guildId,
                guideChannelId: null,
                verificationChannelId: null,
                loggingChannelId: null,
                verifiedVehicleRoleId: null,
                addedOn: new Date().toISOString(),
                customFooterIcon: null,
                syncEnabled: false,
                syncedGuildId: null,
                geminiAnalysisEnabled: false,
            });

            try {
                await guildProfile.save();
            } catch (error) {
                throw new Error('Failed to create a server profile. Please try again later.');
            }
        }

        // Set footer text for embeds
        const footerText = `${guildName} • Vehicle Verification`;

        // Create the setup embed showing current configuration
        const setupEmbed = new EmbedBuilder()
		.setTitle('Server Setup')
		.setDescription(
			'Welcome to the Server Setup menu! Use this menu to configure key settings for your server. Each option allows you to personalize the bot for your community. Select an option from the dropdown menu below to get started.'
		)
		.addFields(
			{
				name: '🌍 Global Passport',
				value: guildProfile.passportGuildId
					? `**Linked to:** The Car Community\nThis means your members view their verified vehicles from The Car Community in your server too!`
					: '**Not set**\nConnect your server to The Car Community to share their verified vehicle database. Your members can still verify locally while having access to vehicles verified in The Car Community.',
				inline: false,
			},
			{
				name: '✅ Verification Channel',
				value: guildProfile.verificationChannelId
					? `**Set to:** <#${guildProfile.verificationChannelId}>\nThis is the channel where all vehicle verification applications will be sent for review.`
					: '**Not set**\nThis is the channel where all vehicle verification applications will be sent for review.',
				inline: false,
			},
			{
				name: '📘 Guide Channel',
				value: guildProfile.guideChannelId
					? `**Set to:** <#${guildProfile.guideChannelId}>\nPost guides here to help members learn how to verify their vehicles.`
					: '**Not set**\nPost guides here to help members learn how to verify their vehicles.',
				inline: false,
			},
			{
				name: '📋 Logging Channel',
				value: guildProfile.loggingChannelId
					? `**Set to:** <#${guildProfile.loggingChannelId}>\nLogs all important bot events, including new verifications and garage updates.`
					: '**Not set**\nLogs all important bot events, including new verifications and garage updates.',
				inline: false,
			},
			{
				name: '🔑 Verified Role',
				value: guildProfile.verifiedVehicleRoleId
					? `**Set to:** <@&${guildProfile.verifiedVehicleRoleId}>\nMembers will be assigned this role upon successful verification.`
					: '**Not set**\nMembers will be assigned this role upon successful verification.',
				inline: false,
			},
            {
                name: '🖼️ Embed Icon',
                value: guildProfile.customFooterIcon
                    ? `**Current Icon:** [View Icon](${guildProfile.customFooterIcon})\nCustomize the icon displayed in the footer of bot embeds.`
                    : '**Not set**\nCustomize the icon displayed in the footer of bot embeds.',
                inline: false,
            }
			,
			{
				name: '🤖 Gemini Analysis',
				value: guildProfile.geminiAnalysisEnabled
					? '**Enabled**\nApplications will be auto-reviewed by Gemini.'
					: '**Disabled**\nAuto-analysis of applications is turned off.',
				inline: false,
			}
		)
		.setColor('#FFFCFF')
		.setFooter({ text: footerText });



        // Create dropdown menu for setup options
        const menu = new StringSelectMenuBuilder()
		.setCustomId('setup_menu')
		.setPlaceholder('Select an option to configure...')
		.addOptions([
			{
				label: '🌍 Global Passport',
				description: 'Link your server with a Passport server for shared verifications.',
				value: 'global_passport',
			},
			{
				label: '✅ Verification Channel',
				description: 'Set the channel for vehicle verification applications.',
				value: 'verification_channel',
			},
			{
				label: '📘 Guide Channel',
				description: 'Set the channel for vehicle verification guides.',
				value: 'guide_channel',
			},
			{
				label: '📋 Logging Channel',
				description: 'Set the channel for logging bot events (e.g., verification updates).',
				value: 'logging_channel',
			},
			{
				label: '🔑 Verified Role',
				description: 'Set the role to assign to verified members.',
				value: 'verified_role',
			},
			{
				label: '🖼️ Embed Icon',
				description: 'Set a custom icon for embed footers.',
				value: 'embed_icon',
			},
			{
				label: '🤖 Gemini Analysis',
				description: 'Enable or disable automatic Gemini analysis.',
				value: 'gemini_analysis',
			},
			{
				label: '❌ Exit',
				description: 'Exit the setup process without making changes.',
				value: 'exit',
			},
		]);

        // Create action row with the menu
        const row = new ActionRowBuilder().addComponents(menu);

        // Send initial setup message with embed and menu
        await interaction.editReply({ embeds: [setupEmbed], components: [row] });

        // Create collector to handle menu interactions
        const collector = interaction.channel.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 60000, // Collector times out after 60 seconds
            filter: (i) => i.user.id === interaction.user.id
        });

        let handled = false;
        // Handle menu selection events
        collector.on('collect', async (menuInteraction) => {
            const selectedOption = menuInteraction.values[0];
            // Route the interaction to appropriate handler based on selection
            switch (selectedOption) {
				case 'global_passport':
					collector.stop(); 
                    await handleGlobalPassport(menuInteraction, guildProfile);
                    handled = true;
                    break;
                case 'verification_channel':
					collector.stop(); 
                    await handleVerificationChannel(menuInteraction, guildProfile);
                    handled = true;
                    break;
                case 'guide_channel':
					collector.stop(); 
                    await handleGuideChannel(menuInteraction, guildProfile);
                    handled = true;
                    break;
                case 'logging_channel':
					collector.stop(); 
                    await handleLoggingChannel(menuInteraction, guildProfile);
                    handled = true;
                    break;
                case 'verified_role':
					collector.stop(); 
                    await handleVerifiedRole(menuInteraction, guildProfile);
                    handled = true;
                    break;
                case 'embed_icon':
                    collector.stop();
                    await handleEmbedIcon(menuInteraction, guildProfile);
                    handled = true;
                    break;
				case 'gemini_analysis':
					collector.stop(); 
					await handleGeminiAnalysis(menuInteraction, guildProfile);
                    handled = true;
					break;
                case 'exit':
                    await exitSetup(menuInteraction);
                    handled = true;
                    break;
                default:
                    await menuInteraction.reply({
                        content: 'Invalid option selected. Please try again.',
                        ephemeral: true,
                    });
                    break;
            }
        });

        collector.on('end', async (collected, reason) => {
            if (!handled && reason === 'time' && collected.size === 0) {
                // Disable components on timeout to avoid stale interactions
                await interaction.editReply({ components: [] }).catch(() => {});
            }
        });
        } catch (err) {
            console.error('Error executing /setup:', err);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('#FF6961').setTitle('Setup Error').setDescription(err.message || 'An error occurred during setup.')],
                    components: [],
                }).catch(() => {});
            } else {
                await interaction.reply({ content: 'An error occurred while running /setup.', ephemeral: true }).catch(() => {});
            }
        }
    },
};
