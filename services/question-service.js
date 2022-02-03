const firebase = require("firebase");

class QuestionService {
    constructor() {}
    getQuestions = (callback) => {
        let questions = []
        var db = firebase.database();
        db.ref().once('value', (snapshot) => {
            snapshot.forEach((childSnapshot) => {
                questions.push({
                    id: childSnapshot.key,
                    question: childSnapshot.val().soru,
                    answer: childSnapshot.val().cevap
                })
            })
            callback(questions)
        });
    }
}

module.exports.QuestionService = QuestionService;