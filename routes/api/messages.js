const express = require('express');
const app = express();
const router = express.Router();
const bodyParser = require('body-parser')
const multer = require('multer');
const upload = multer({dest: "uploads/"});
const path = require("path");
const fs = require("fs");
const Post = require('../../schemas/PostSchema')
const User = require('../../schemas/UserSchema')
const Chat = require('../../schemas/ChatSchema')
const Message = require('../../schemas/MessageSchema')
const Notification = require('../../schemas/NotificationSchema')


app.use(bodyParser.urlencoded({extended: false}));

router.post("/", async(req, res, next) => {
    if(!req.body.content || !req.body.chatId){
        console.log("invalid data passed into request");
        return res.sendStatus(400);
    }

    var newMessage = {
        sender: req.session.user._id,
        content: req.body.content,
        chat: req.body.chatId,
    }

    Message.create(newMessage)
    .then(async message => {
        message = await message.populate("sender");
        message = await message.populate("chat");
        message = await User.populate(message, {path: "chat.users"});
        

        var chat = Chat.findByIdAndUpdate(req.body.chatId, {latestMessage: message})
        .catch(err => {
            console.log(err);
        })

        insertNotification(chat, message)
        res.status(201).send(message);
    })
    .catch(error => {
        console.log(error);
        res.sendStatus(400);
    })
});

function insertNotification(chat, message) {
    chat.users.forEach(userId => {
        if(userId == message.sender._id.toString()) return;

        Notification.insertNotification(userId, message.sender._id, "newMessage", message.chat._id);
    })
}

module.exports = router;