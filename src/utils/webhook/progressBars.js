// Helper function to generate progress bar
function generateProgressBar(currentQuestionIndex, totalQuestions) {
    let progressBar = '';
    
    // Add filled circles (🟦) for answered questions
    for (let i = 0; i < currentQuestionIndex; i++) {
        progressBar += '🟦';
    }

    // Add empty circles (⬜️) for unanswered questions
    for (let i = currentQuestionIndex; i < totalQuestions; i++) {
        progressBar += '⬜️';
    }

    return `${progressBar}`;
}

// Function to generate the progress bar for correct/wrong attempts
function generateExplanationProgressBar(attempts, currentAttemptIndex) {
    let progressBar = '';

    // Iterate over the attempts array and create the progress bar
    for (let i = 0; i < attempts.length; i++) {
        if (i < currentAttemptIndex) {
            // Show green for correct answers (🟢)
            progressBar += attempts[i] === 'correct' ? '🟢' : '🔴';
        } else {
            // Show empty circle for future attempts (⚪)
            progressBar += '⚪';
        }
    }

    return progressBar;
}


module.exports = {
    generateProgressBar,
    generateExplanationProgressBar
}