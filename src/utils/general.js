function hasMinutesPassed(timestamp, minutes) {
    // Parse the given timestamp to a Date object
    const timestampDate = new Date(timestamp.replace(" ", "T"));
    
    // Get the current date and time
    const currentDate = new Date();
    
    // Calculate the difference in milliseconds
    const differenceInMilliseconds = new Date() - new Date(timestamp.replace(" ", "T"));
    
    // Convert the difference to minutes
    const differenceInMinutes = (new Date() - new Date(timestamp.replace(" ", "T"))) / (1000 * 60);
    
    // Check if the difference is greater than or equal to the specified minutes
    return differenceInMinutes >= minutes;
}


module.exports = {
    hasMinutesPassed,
}