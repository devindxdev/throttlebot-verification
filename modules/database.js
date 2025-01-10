const garageSchema = require('../mongodb_schema/garageSchema.js');
const guildProfileSchema = require('../mongodb_schema/guildProfileSchema.js');
const verificationSchema = require('../mongodb_schema/verificationApplicationSchema.js');
const userProfileSchema = require('../mongodb_schema/userProfileSchema.js');
const { embedColor } = require('../modules/utility.js');
const mongoose = require('mongoose');

async function obtainOneUserVehicle(userId, guildId, vehicleName){
    /*
        Returns the verified vehicle for the specified params.
    */
    const garageData = await garageSchema.find({ userId: userId, guildId: guildId, vehicle: vehicleName });
    return garageData
};

async function obtainAllUserVehicles(userId, guildId){
    /*
        Returns all the verified vehicles for the specified user
        from a specified guild.
    */
    const garageData = await garageSchema.find({ userId: userId, guildId: guildId });
    return garageData
};

async function obtainOneOpenUserApplication(userId, guildId, vehicleName){
    //Returns one open user application with the specified parameters.
    const applicationsData = await verificationSchema.findOne({ userId: userId, guildId: guildId, vehicle: vehicleName, status: 'open'});
    return applicationsData;
};

async function obtainAllUserApplications(userId, guildId){
    //Returns all the applications from a specified user from a guild.
    const applicationsData = await verificationSchema.find({ userId: userId, guildId: guildId });
    return applicationsData;
};

async function obtainAllOpenUserApplications(userId, guildId){
   //Returns all the open applications from a specified user from a guild.
   const applicationsData = await verificationSchema.find({ userId: userId, guildId: guildId, status: 'open' });
   return applicationsData; 
};

async function obtainGuildProfile(guildId){
    /*
        Returns the server/guild profile containing the configurations and other details.
    */
    const guildData = await guildProfileSchema.findOne({ guildId: guildId });
    return guildData;
};

async function obtainUserProfile(userId){
    /*
        Returns the user profile containing configuration settings and premium status etc.
        Refer to the schema model in ../mongodb_schema/userProfileSchema.js for the data points.
    */
    const userData = await userProfileSchema.findOne({ userId: userId });
    return userData;
};

async function defaultEmbedColor(userId = null){
    /*
        Returns the default embed color the bot needs to use across all commands.
        Since premium users can opt to have their own custom default color,
        this function will return either the normal default embed color which is #FFFCFF (white)
        or the custom color selected by the premium user.
    */
    let color = embedColor;
    if(userId){
        const userData = await userProfileSchema.findOne({ userId: userId });
        const whetherPremiumUser = userData?.premiumUser || null;
        const customEmbedColor = userData?.embedColor || null;
        //If the specified user has premium enabled and has a chosen embed color, that will be returned instead.
        if(whetherPremiumUser){
            if(customEmbedColor) color = customEmbedColor;
        };
    };
    return color;
};

async function getServerStats(passportServerId) {
    try {
        // Total number of verified rides in the server
        const totalVerifiedRides = await garageSchema.countDocuments({ guildId: passportServerId });

        // Total number of unique verified users in the server
        const totalVerifiedUsers = await garageSchema.distinct('userId', { guildId: passportServerId }).then(users => users.length);

        return { totalVerifiedRides, totalVerifiedUsers };
    } catch (error) {
        console.error('Error fetching server stats:', error);
        throw new Error('Failed to retrieve server stats.');
    }
}

async function getEstimatedETA(guildId) {
    try {
        // Fetch the last 50 applications for the guild, sorted by submission date
        const applications = await verificationSchema
            .find({ guildId, decision: { $in: ['approved', 'denied'] } })
            .sort({ submittedOn: -1 })
            .limit(50);

        if (!applications || applications.length === 0 || applications.length < 20) {
            return '24 - 48 Hours';
        }

        // Calculate the duration for each application
        const durations = applications
            .filter(app => app.decidedOn)
            .map(app => {
                const submittedDate = new Date(app.submittedOn).getTime();
                // decidedOn is already in milliseconds, no need to convert
                return app.decidedOn - submittedDate;
            });

        if (durations.length === 0) {
            return '24 - 48 Hours';
        }

        // Calculate the average duration in milliseconds
        const averageDuration = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;

        // Convert the average duration to a human-readable format
        const hours = Math.floor(averageDuration / (1000 * 60 * 60));
        const minutes = Math.floor((averageDuration % (1000 * 60 * 60)) / (1000 * 60));

        // Build the time string with proper pluralization
        let timeString = '';
        if (hours > 0) {
            timeString += `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
            if (minutes > 0) {
                timeString += ` and ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
            }
        } else {
            timeString = `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
        }

        return timeString;
    } catch (error) {
        console.error('Error in getEstimatedETA:', error);
        return 'Failed to estimate the wait time.';
    }
}



module.exports = { 
    obtainOneUserVehicle,
    obtainAllUserVehicles, 
    obtainGuildProfile, 
    obtainUserProfile, 
    defaultEmbedColor, 
    obtainAllUserApplications, 
    obtainAllOpenUserApplications, 
    obtainOneOpenUserApplication, 
    getServerStats,
    getEstimatedETA
};