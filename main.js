const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const { RoomService } = require("./services/room-service");
const { QuestionService } = require("./services/question-service");
const { firebaseConfig } = require("./lib/firebase-config");
const firebase = require("firebase");
const _ = require("lodash");
firebase.initializeApp(firebaseConfig);
let games = [];
const io = new Server(server, {
    cors: {
        methods: ["GET", "POST"],
        origin: ["http://localhost:8080", "http://momentumv2.mobven.com:9091"],
    },
});

app.get('/', (req, res) => {
    res.send('<h1>Hello world</h1>');
});

io.on('connection', (socket) => {
    socket.on('create', (payload) => {
        const room = Math.random().toString().substr(2, 6);
        socket.join(room);
        const user = {
            id: socket.id,
            role: payload.role,
            username: payload.role,
            room: room,
        }
        const users = [];
        users.push(user);
        const response = {
            room: room,
            method: 'create',
            user: user,
        }
        games.push({
            gamePin: room,
            status: "not-started",
            users: users,
            questions: null,
            questionIndex: 0,
            podium: [],
        })
        io.to(socket.id).emit("create", response);
    })

    socket.on('join', (payload) => {
        const service = new RoomService(games);
        const game = service.getRoomById(payload.room);
        if (!game) {
            io.to(socket.id).emit("join", { isError: true, message: "Böyle bir oyun bulunamadı" });
        } else {
            if (game.status !== "not-started") {
                io.to(socket.id).emit("join", { isError: true, message: "Oyun zaten başladı" });
            } else {
                socket.join(payload.room);
                const user = {
                    id: socket.id,
                    role: "player",
                    username: payload.username,
                    room: payload.room,
                }
                game.users = [...game.users, user];
                games = service.replaceGameObject(payload.room, game);
                io.to(payload.room).emit("users", game.users);
                io.to(socket.id).emit("join", user);
            }
        }
    })
    socket.on('disconnect', () => {
        const service = new RoomService(games);
        const response = service.disconnectUser(socket.id);
        if (response) {
            if (response.action === "user") {
                games = response.data;
                let currentGame = service.getRoomById(response.room);
                const index = currentGame.podium.map(i => i.userId).indexOf(socket.id);
                console.log("index", index);
                if (index >= 0) {
                    currentGame.podium.splice(index, 1);
                    games = service.replaceGameObject(response.room, currentGame);
                }
                io.to(response.room).emit("users", currentGame.users);
            } else if (response.action === "game") {
                games = response.data;
                io.to(response.room).emit("crash");
            }
        }
    });

    socket.on('start', (payload) => {
        
        let questions = [];
        const questionService = new QuestionService();
        const roomService = new RoomService(games);
        questionService.getQuestions((response) => {
            questions = response;
            const currentGame = roomService.getRoomById(payload.roomId);
            currentGame.questions = questions;
            currentGame.status = "started";
            io.to(socket.id).emit("start", currentGame.questions[currentGame.questionIndex]);
            io.to(payload.roomId).emit("answer", {
                index: currentGame.questionIndex,
                question: currentGame.questions[currentGame.questionIndex].question
            });
            currentGame.questionIndex += 1;
            roomService.replaceGameObject(payload.roomId, currentGame);
        })
    })

    socket.on('nextQuestion', (payload) => {
        const roomService = new RoomService(games);
        const currentGame = roomService.getRoomById(payload.roomId);
        if (currentGame.questionIndex >= currentGame.questions.length) return;

        io.to(socket.id).emit("nextQuestion", {
            question: currentGame.questions[currentGame.questionIndex],
            isLast: currentGame.questionIndex === currentGame.questions.length - 1
        });
        io.to(payload.roomId).emit("answer", {
            index: currentGame.questionIndex,
            question: currentGame.questions[currentGame.questionIndex].question,
            isLast: currentGame.questionIndex === currentGame.questions.length - 1
        });
        currentGame.questionIndex += 1;
        roomService.replaceGameObject(payload.roomId, currentGame);
    })

    socket.on("timeout", (payload) => {
        io.to(payload.roomId).emit("timeout", true);
    });

    socket.on("finish", (payload) => {
        io.to(payload.roomId).emit("finish");
    });

    socket.on('answer', (payload) => {
        const roomService = new RoomService(games);
        const currentGame = roomService.getRoomById(payload.roomId);
        let answer = currentGame.questions[payload.questionIndex].answer;

        let score = Math.abs(answer - Number(payload.answer))
        if (currentGame.podium.filter(x => x.userId === payload.userId).length === 0) {
            currentGame.podium.push({
                userId: payload.userId,
                score: score,
                username: payload.username,
            });
        } else {
            let user = currentGame.podium.filter(x => x.userId === payload.userId)[0];
            if (user) {
                user.score += score;
            }
        }

        currentGame.podium = _.sortBy(currentGame.podium, ["score"]);

        roomService.replaceGameObject(payload.roomId, currentGame);
        io.to(payload.roomId).emit("podium", {
            podium:currentGame.podium,
            // podium: _.take(currentGame.podium, 5),
            room: payload.roomId
        });
    })
});

server.listen(9090, () => {
    console.log('listening on *:9090');
});