const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
} = require('discord.js');
const mongoose = require('mongoose');
const verificationSchema = require('../../../mongodb_schema/verificationApplicationSchema.js');
const { greenIndicator, greenColor } = require('../../constants.js');
const { getEstimatedETA } = require('../../database.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async (interaction, vehicleName, vehicleAttachment, guildProfile) => {
    const { verificationChannelId, loggingChannelId, customFooterIcon } = guildProfile;

    const verificationChannel = await interaction.guild.channels.fetch(verificationChannelId);
    if (!verificationChannel) {
        throw new Error('Verification channel not found');
    }

    const loggingChannel = await interaction.guild.channels.fetch(loggingChannelId);

    const initiator = interaction.user;
    const { id: initiatorId, tag: initiatorTag, displayAvatarURL } = initiator;

    const eta = await getEstimatedETA(interaction.guild.id);

    // Initialize Google Generative AI SDK
    const genAI = new GoogleGenerativeAI(process.env.API_KEY);
    const model = genAI.getGenerativeModel({ model: 'models/gemini-1.5-pro' });

    // Download image data and convert it to base64
    let analysisResult;
    try {
        const imageResp = await fetch(vehicleAttachment.url).then((res) => res.arrayBuffer());
        const base64Image = Buffer.from(imageResp).toString("base64");
        const prompt = `
            Analyze the following image and provide a JSON response. 
            YOU MUST MAKE SURE that the image includes the following:
            - A handwritten note containing:
                - Username: "Omerta#1638"
                - Server Name: "${"The car community"}"
            - The user's vehicle and keys in the picture.
            - YOU MUST Verify if the handwritten note is clear and follows the above requirements.
            - YOU MUST Verify if the vehicle name provided ("${vehicleName}") matches the vehicle in the image.

            Provide the result in JSON format with the following keys:
            {
                "requirementsMet": <true/false>,
                "issues": [<list of identified issues>],
                "vehicleMatch": <true/false>,
                "feedback": <detailed feedback>
                "confidence": <How confident you are that you are right about whether the requirements have been met or not out of 100" 
            }
        `;
        // Send the image to Google Generative AI for analysis
        const result = await model.generateContent([
            {
                inlineData: {
                    data: base64Image,
                    mimeType: vehicleAttachment.contentType || "image/jpeg",
                },
            },
            prompt,
        ]);

        analysisResult = result.response.text();
        console.log(analysisResult)
    } catch (error) {
        console.error("Error analyzing image with Gemini API:", error);
        analysisResult = "Failed to analyze the image.";
    }



    // Create the application embed
    const vApplication = new EmbedBuilder()
        .setAuthor({
            name: 'Vehicle Verification - New Application',
            iconURL: initiator.displayAvatarURL({ dynamic: true }),
        })
        .setDescription(
            'A new verification application has been registered. Please process the verification using the buttons below.'
        )
        .addFields(
            { name: 'Vehicle', value: vehicleName, inline: true },
            { name: 'Owner', value: `${initiatorTag} | <@${initiatorId}>`, inline: true },
            { name: 'Image Name', value: `[${vehicleAttachment.name}](${vehicleAttachment.proxyURL})`, inline: true },
            { name: 'Status', value: 'Due for verification', inline: true }
        )
        .setImage(vehicleAttachment.url)
        .setColor('#FFFCFF') // White for initial status
        .setFooter({
            text: `${interaction.guild.name} • Vehicle Verification`,
            iconURL: customFooterIcon || interaction.guild.iconURL({ dynamic: true }),
        });

    // Buttons for action
    const approveButton = new ButtonBuilder()
        .setCustomId(`approveApplication+${initiatorId}`)
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success);

    const denyButton = new ButtonBuilder()
        .setCustomId(`denyApplication+${initiatorId}`)
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger);

    const denyGuideButton = new ButtonBuilder()
        .setCustomId(`denyReadGuide+${initiatorId}`)
        .setLabel('Read The Guide')
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(approveButton, denyButton, denyGuideButton);

    // Send the embed and buttons to the verification channel
    const applicationMessage = await verificationChannel.send({
        embeds: [vApplication],
        components: [row],
    });

    // Save application details in the database
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
        const logEmbed = EmbedBuilder.from(vApplication)
            .setDescription(`New application submitted in <#${verificationChannelId}>.`);

        await loggingChannel.send({ embeds: [logEmbed] });
    }

    const confirmationEmbed = new EmbedBuilder()
    .setAuthor({
        name: 'Verification Application Submitted',
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
    })
    .setDescription(
        `Thank you for submitting your verification application! Here’s what happens next:\n\n` +
        `Your application will be reviewed by the server staff. Please ensure your DMs are open to receive updates about the status of your application.`
    )
    .addFields(
        {
            name: 'Estimated Wait Time',
            value: `${eta}`,
            inline: false,
        },
        {
            name: 'Vehicle',
            value: `${vehicleName}`
        },
        {
            name: 'What to Expect',
            value: `1. The staff will review your application.\n` +
                   `2. If approved, your vehicle will be added to your garage.\n` +
                   `3. If rejected, you will receive feedback on why it was denied.`,
        }
    )
    .setColor(greenColor)
    .setThumbnail(vehicleAttachment.url) // Adds the submitted image as the thumbnail
    .setFooter({
        text: `${interaction.guild.name} • Vehicle Verification`,
        iconURL: guildProfile.customFooterIcon || interaction.guild.iconURL({ dynamic: true }),
    });


    await interaction.editReply({
        embeds: [confirmationEmbed],
        components: [],
    });
};
