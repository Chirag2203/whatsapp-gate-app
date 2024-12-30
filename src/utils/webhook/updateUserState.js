// Helper function to update user state in the database
const getDB = require('../../db');

const db = getDB();

async function updateUserState(phoneNumber, userState) {
    try {
        await db
            .from("whatsapp_user_activity")
            .update({ value: userState })
            .eq("phone_number", phoneNumber.slice(2));
    } catch (error) {
        console.error("Error updating user state:", error);
    }
}

module.exports = {
    updateUserState,
}