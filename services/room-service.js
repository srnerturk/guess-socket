const _ = require("lodash");
class RoomService {
    constructor(games) {
        this.games = games;
    }
    getRoomById = (id) => {
        return _.find(this.games, { gamePin: id });
    }
    replaceGameObject = (id, newValue) => {
        this.games.forEach(game => {
            if (game.gamePin === id) {
                game = newValue;
            }
        });
        return this.games;
    }
    disconnectUser = (id) => {
        let callBack = null;
        this.games.forEach((game, gameIndex) => {
            game.users.forEach((user, userIndex) => {
                if (user.id === id) {
                    if (user.role === "player") {
                        game.users.splice(userIndex, 1);
                        let changedGameList = this.replaceGameObject(game.gamePin, game);
                        callBack = {
                            action: "user",
                            data: changedGameList,
                            room: user.room,
                        }
                    } else {
                        this.games.splice(gameIndex, 1)
                        callBack = {
                            action: "game",
                            data: this.games,
                            room: user.room
                        }
                    }
                } else {
                    return null;
                }
            })
        });
        return callBack;
    }
    getUsers = () => {

    }
}
module.exports.RoomService = RoomService;