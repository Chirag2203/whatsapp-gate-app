
async function handleDailyChallenge(req, res) {
    console.log("cron job called");
    res.send({hi: "message"})
}

module.exports = {
    handleDailyChallenge
}